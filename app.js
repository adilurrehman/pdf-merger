const express = require('express')
const path = require('path')
const tls = require('tls')
const crypto = require('crypto')
const helmet = require('helmet')
const nodemailer = require('nodemailer')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const { body, validationResult } = require('express-validator')
const app = express()
const multer  = require('multer')
const {mergePDF}  = require('./mergePDF')

// Upload limits for POST /merge
const MAX_FILES = 10
const MAX_FILE_SIZE = 5 * 1024 * 1024   // 5MB per file
const MAX_RANGE_LENGTH = 100            // characters per page-range field
const MAX_SELECTED_PAGES = 1000         // pages selected from a single file

// Configure multer with hard limits on every part of the multipart body
// Files are kept in memory only and never written to disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        files: MAX_FILES,
        fileSize: MAX_FILE_SIZE,
        fields: MAX_FILES + 1,          // mergeMode + one page range per file
        parts: MAX_FILES * 2 + 1,
        fieldNameSize: 50,
        fieldSize: MAX_RANGE_LENGTH,
        headerPairs: 20
    }
})

// Fresh nonce per response so the pages' own inline scripts can run under the CSP
app.use((req, res, next) => {
    res.locals.nonce = crypto.randomBytes(16).toString('base64')
    next()
})

// Security headers. The CSP allows only this site, the pinned Bootstrap/Bootstrap Icons CDN,
// Google Fonts (developer page) and the avatar fallback image; inline scripts need the nonce
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", 'https://cdn.jsdelivr.net', (req, res) => `'nonce-${res.locals.nonce}'`],
            scriptSrcAttr: ["'none'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https://ui-avatars.com'],
            connectSrc: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            upgradeInsecureRequests: null  // would break plain-http local development
        }
    },
    frameguard: { action: 'deny' }
}))
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
    next()
})

// On Cloudflare Workers /assets is served by Workers Static Assets before reaching Express
app.use('/assets', express.static(path.join(__dirname, 'public/assets')))
app.use(express.urlencoded({ extended: true, limit: '20kb', parameterLimit: 20 }))

// Set EJS as template engine
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

const onWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'

// Real client IP. Only trust CF-Connecting-IP on Cloudflare, where the edge sets it;
// elsewhere any client could send that header to dodge the rate limits
function clientIp(req) {
    return (onWorkers && req.get('cf-connecting-ip')) || req.ip
}

// Rate limiters are created on first request: Workers forbid timers in global scope
// and the in-memory store starts one
function lazyRateLimit(options) {
    let limiter
    return (req, res, next) => {
        limiter ??= rateLimit({
            keyGenerator: (req) => ipKeyGenerator(clientIp(req) || 'unknown'),
            validate: { creationStack: false },  // created once, lazily - not per request
            ...options
        })
        limiter(req, res, next)
    }
}

// Rate limiter for contact form - max 3 emails per hour per IP
const contactLimiter = lazyRateLimit({
    windowMs: 60 * 60 * 1000,  // 1 hour
    max: 3,                     // 3 requests per hour
    message: 'Too many messages sent. Please try again after 1 hour.',
    handler: (req, res) => {
        res.render('contact', {
            title: 'Contact - PDF Merger',
            page: 'contact',
            success: null,
            error: 'Too many messages sent. Please try again after 1 hour.'
        })
    }
})

// Rate limiter for merging - max 30 merge requests per 15 minutes per IP
const mergeLimiter = lazyRateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    handler: (req, res) => {
        res.status(429).render('index', {
            title: 'PDF Merger',
            page: 'home',
            error: 'Too many merge requests. Please try again in a few minutes.'
        })
    }
})

// Nodemailer resolves the SMTP host to an IP before connecting, but Cloudflare Workers
// sockets cannot connect to those raw IPs. On Workers, open the TLS socket by hostname instead.
function getWorkersSocket(options, callback) {
    const socket = tls.connect({ host: options.host, port: options.port, servername: options.host }, () => {
        socket.removeListener('error', callback)
        callback(null, { connection: socket, secured: true })
    })
    socket.once('error', callback)
}

// Email transporter configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    ...(onWorkers && { getSocket: getWorkersSocket })
})

// Blocked emails/domains list
const blockedDomains = ['tempmail.com', 'throwaway.com', 'mailinator.com', 'guerrillamail.com']
const blockedWords = ['viagra', 'casino', 'lottery', 'winner', 'free money']

// Escape text for the notification email's HTML body
function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
}

// Check for spam content
function isSpam(name, email, message) {
    const content = `${name} ${email} ${message}`.toLowerCase()

    // Check blocked domains
    const emailDomain = email.split('@')[1]
    if (blockedDomains.includes(emailDomain)) {
        return true
    }

    // Check spam words
    for (let word of blockedWords) {
        if (content.includes(word)) {
            return true
        }
    }

    return false
}

app.get('/', (req, res) => {
  res.render('index', { title: 'PDF Merger', page: 'home' })
})

app.get('/about', (req, res) => {
  res.render('about', { title: 'About - PDF Merger', page: 'about' })
})

app.get('/developer', (req, res) => {
  res.render('developer', { title: 'Developer - Adil ur Rehman Kakar', page: 'developer' })
})

app.get('/contact', (req, res) => {
  res.render('contact', { title: 'Contact - PDF Merger', page: 'contact', success: null, error: null })
})

// Handle contact form with rate limiting and validation
app.post('/contact',
    contactLimiter,
    [
        body('name').trim().isLength({ min: 2, max: 100 }).escape(),
        body('email').isEmail().normalizeEmail(),
        body('message').trim().isLength({ min: 10, max: 1000 }).escape()
    ],
    async (req, res) => {
        const errors = validationResult(req)

        if (!errors.isEmpty()) {
            return res.render('contact', {
                title: 'Contact - PDF Merger',
                page: 'contact',
                success: null,
                error: 'Invalid input. Name: 2-100 chars, Message: 10-1000 chars, Valid email required.'
            })
        }

        const { name, email, message } = req.body

        // Check for spam
        if (isSpam(name, email, message)) {
            return res.render('contact', {
                title: 'Contact - PDF Merger',
                page: 'contact',
                success: null,
                error: 'Your message was flagged as spam.'
            })
        }

        // Without credentials nothing can be sent; say so instead of failing inside Nodemailer
        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            return res.render('contact', {
                title: 'Contact - PDF Merger',
                page: 'contact',
                success: null,
                error: 'The contact form is temporarily unavailable. Please email adilurrehmanofficial@gmail.com directly.'
            })
        }

        const mailOptions = {
            from: 'akkakar128@gmail.com',
            to: 'akkakar128@gmail.com',
            replyTo: email,
            subject: `[Contact Form] Message from ${name}`,
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                <p><strong>IP:</strong> ${escapeHtml(clientIp(req))}</p>
                <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
                <hr>
                <p><strong>Message:</strong></p>
                <p>${message}</p>
            `
        }

        try {
            await transporter.sendMail(mailOptions)
            res.render('contact', {
                title: 'Contact - PDF Merger',
                page: 'contact',
                success: 'Message sent successfully!',
                error: null
            })
        } catch (err) {
            console.error('Email Error:', err.message)
            res.render('contact', {
                title: 'Contact - PDF Merger',
                page: 'contact',
                success: null,
                error: 'Failed to send message. Please try again.'
            })
        }
    }
)

const INVALID_RANGES_MESSAGE = 'Invalid page ranges. Use formats like 1-3, 5, 7-10 or "all".'

function renderMergeError(res, status, error) {
    res.status(status).render('index', { title: 'PDF Merger', page: 'home', error })
}

// A real PDF has the "%PDF-" header within its first 1024 bytes
function isPdf(buffer) {
    return buffer.subarray(0, 1024).includes('%PDF-')
}

// Turns "1-3, 5" into [1, 2, 3, 5] and "all" into 'all'; returns null for anything else
function parsePageRange(value) {
    if (typeof value !== 'string' || value.length > MAX_RANGE_LENGTH) return null
    const compact = value.replace(/\s+/g, '')
    if (compact.toLowerCase() === 'all') return 'all'
    if (!/^\d{1,4}(-\d{1,4})?(,\d{1,4}(-\d{1,4})?)*$/.test(compact)) return null

    const pages = []
    for (const part of compact.split(',')) {
        const [start, end = start] = part.split('-').map(Number)
        if (start < 1 || end < start || pages.length + end - start + 1 > MAX_SELECTED_PAGES) return null
        for (let page = start; page <= end; page++) pages.push(page)
    }
    return pages
}

// Multer rejections become the same friendly form errors as the other checks
const uploadErrors = {
    LIMIT_FILE_SIZE: [413, 'Each PDF must be 5MB or smaller'],
    LIMIT_FILE_COUNT: [400, 'Maximum 10 PDF files allowed'],
    LIMIT_UNEXPECTED_FILE: [400, 'Maximum 10 PDF files allowed'],
    LIMIT_FIELD_VALUE: [400, INVALID_RANGES_MESSAGE]
}

function receivePdfs(req, res, next) {
    upload.array('pdfs', MAX_FILES)(req, res, err => {
        if (!err) return next()
        let [status, message] = uploadErrors[err.code] || [400, 'Invalid upload']
        if (err.code === 'LIMIT_UNEXPECTED_FILE' && err.field !== 'pdfs') message = 'Invalid upload'
        renderMergeError(res, status, message)
    })
}

// Cap simultaneous merges so parallel uploads cannot exhaust memory (each can hold 50MB)
const MAX_ACTIVE_MERGES = 4
let activeMerges = 0

function limitConcurrentMerges(req, res, next) {
    if (activeMerges >= MAX_ACTIVE_MERGES) {
        return renderMergeError(res, 503, 'The server is busy. Please try again in a moment.')
    }
    activeMerges++
    let released = false
    const release = () => {
        if (!released) { released = true; activeMerges-- }
    }
    res.once('finish', release)
    res.once('close', release)
    next()
}

app.post('/merge', mergeLimiter, limitConcurrentMerges, receivePdfs, async (req, res, next) => {
    // Validate file count (2-10 files)
    if (!req.files || req.files.length < 2) {
        return res.status(400).render('index', {
            title: 'PDF Merger',
            page: 'home',
            error: 'Please upload at least 2 PDF files'
        })
    }

    if (req.files.length > 10) {
        return res.status(400).render('index', {
            title: 'PDF Merger',
            page: 'home',
            error: 'Maximum 10 PDF files allowed'
        })
    }

    for (let file of req.files) {
        // Check both the MIME type the browser sent and the actual file content
        if (file.mimetype !== 'application/pdf' || !isPdf(file.buffer)) {
            return renderMergeError(res, 400, 'Only PDF files are allowed')
        }
    }

    // Validate the merge mode and page ranges before anything reaches the PDF merger
    const mergeMode = req.body.mergeMode ?? 'all'
    if (mergeMode !== 'all' && mergeMode !== 'specific') {
        return renderMergeError(res, 400, 'Invalid merge mode')
    }

    // Page selection per file: 'all' or a validated list of page numbers
    let pageRanges = null;
    if (mergeMode === 'specific' && req.body.pageRanges !== undefined) {
        const ranges = req.body.pageRanges
        if (!Array.isArray(ranges) || ranges.length > req.files.length) {
            return renderMergeError(res, 400, INVALID_RANGES_MESSAGE)
        }
        pageRanges = req.files.map((file, i) => ranges[i] === undefined ? 'all' : parsePageRange(ranges[i]))
        if (pageRanges.includes(null)) {
            return renderMergeError(res, 400, INVALID_RANGES_MESSAGE)
        }
    }

    let mergedPdf
    try {
        mergedPdf = await mergePDF(req.files.map(file => file.buffer), pageRanges)
    } catch (err) {
        console.error('Merge Error:', err.message)
        return res.status(400).render('index', {
            title: 'PDF Merger',
            page: 'home',
            error: 'Could not merge the PDFs. Check that the files are valid and the page ranges exist.'
        })
    } finally {
        // Uploads only ever live in memory; drop them as soon as the merge is done or failed
        req.files.forEach(file => { file.buffer = null })
    }

    // Send the merged PDF straight back as a download; nothing is written to disk or public/
    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="merged.pdf"',
        'Cache-Control': 'no-store'
    })
    res.send(mergedPdf)
})

// Central error handler: details go to the server log only, never stack traces or paths to the browser
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err)
    if (res.headersSent) return next(err)
    const status = err.status >= 400 && err.status < 500 ? err.status : 500
    const message = status === 413 ? 'Request too large.' : status < 500 ? 'Bad request.' : 'Something went wrong. Please try again.'
    res.status(status).type('text').send(message)
})

module.exports = app
