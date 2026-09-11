const express = require('express')
const path = require('path')
const tls = require('tls')
const nodemailer = require('nodemailer')
const { rateLimit, ipKeyGenerator } = require('express-rate-limit')
const { body, validationResult } = require('express-validator')
const app = express()
const multer  = require('multer')
const {mergePDF}  = require('./mergePDF')

// Configure multer with 5MB file size limit
// Files are kept in memory only and never written to disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }  // 5MB per file
})
// On Cloudflare Workers /assets is served by Workers Static Assets before reaching Express
app.use('/assets', express.static(path.join(__dirname, 'public/assets')))
app.use(express.urlencoded({ extended: true }))

// Set EJS as template engine
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))

// Real client IP: Cloudflare sets CF-Connecting-IP, fall back to socket address locally
function clientIp(req) {
    return req.get('cf-connecting-ip') || req.ip
}

// Rate limiter for contact form - max 3 emails per hour per IP
// Created on first request: Workers forbid timers in global scope and the memory store starts one
let rateLimiter
const contactLimiter = (req, res, next) => {
    rateLimiter ??= rateLimit({
        windowMs: 60 * 60 * 1000,  // 1 hour
        max: 3,                     // 3 requests per hour
        keyGenerator: (req) => ipKeyGenerator(clientIp(req) || 'unknown'),
        validate: { creationStack: false },  // created once, lazily - not per request
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
    rateLimiter(req, res, next)
}

// Nodemailer resolves the SMTP host to an IP before connecting, but Cloudflare Workers
// sockets cannot connect to those raw IPs. On Workers, open the TLS socket by hostname instead.
const onWorkers = typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers'
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

        const mailOptions = {
            from: 'akkakar128@gmail.com',
            to: 'akkakar128@gmail.com',
            replyTo: email,
            subject: `[Contact Form] Message from ${name}`,
            html: `
                <h3>New Contact Form Submission</h3>
                <p><strong>Name:</strong> ${name}</p>
                <p><strong>Email:</strong> ${email}</p>
                <p><strong>IP:</strong> ${clientIp(req)}</p>
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
            console.log('Email Error:', err.message)
            res.render('contact', {
                title: 'Contact - PDF Merger',
                page: 'contact',
                success: null,
                error: 'Failed to send message. Please try again.'
            })
        }
    }
)

app.get('/blog', (req, res) => {
  res.render('blog', { title: 'Blog - PDF Merger', page: 'blog' })
})

app.post('/merge', upload.array('pdfs', 10), async (req, res, next) => {
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

    const validTypes = ['application/pdf']
    for (let file of req.files) {
        if (!validTypes.includes(file.mimetype)) {
            return res.status(400).render('index', {
                title: 'PDF Merger',
                page: 'home',
                error: 'Only PDF files are allowed'
            })
        }
    }

    console.log('Files:', req.files.map(file => `${file.originalname} (${file.size} bytes)`));
    console.log('Merge Mode:', req.body.mergeMode);
    console.log('Page Ranges:', req.body.pageRanges);

    // Get page ranges if in specific mode
    let pageRanges = null;
    if (req.body.mergeMode === 'specific' && req.body.pageRanges) {
        pageRanges = req.body.pageRanges;
    }

    let mergedPdf
    try {
        mergedPdf = await mergePDF(req.files.map(file => file.buffer), pageRanges)
    } catch (err) {
        console.log('Merge Error:', err.message)
        return res.status(400).render('index', {
            title: 'PDF Merger',
            page: 'home',
            error: 'Could not merge the PDFs. Check that the files are valid and the page ranges exist.'
        })
    }

    // Return the merged PDF directly to the requester; nothing is stored
    res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="merged.pdf"',
        'Cache-Control': 'no-store'
    })
    res.send(mergedPdf)
})

module.exports = app
