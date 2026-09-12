// Shared helpers for the node:test suites (not a test file itself)
const { PDFDocument } = require('pdf-lib')
const app = require('../app')

// Start the Express app on a random local port
function startServer() {
    return new Promise(resolve => {
        const server = app.listen(0, '127.0.0.1', () => {
            resolve({ server, url: `http://127.0.0.1:${server.address().port}` })
        })
    })
}

// Build a PDF whose page N has width baseWidth + N, so pages can be identified after merging
async function makePdf(pageCount, baseWidth = 200) {
    const doc = await PDFDocument.create()
    for (let i = 1; i <= pageCount; i++) doc.addPage([baseWidth + i, 400])
    return Buffer.from(await doc.save())
}

async function pageWidths(pdfBytes) {
    const doc = await PDFDocument.load(pdfBytes)
    return doc.getPages().map(page => page.getWidth())
}

// files: [{ data, name?, type? }], fields: { name: value }
function mergeForm(files, fields = {}) {
    const form = new FormData()
    for (const [name, value] of Object.entries(fields)) form.append(name, value)
    for (const file of files) {
        form.append('pdfs', new Blob([file.data], { type: file.type || 'application/pdf' }), file.name || 'file.pdf')
    }
    return form
}

module.exports = { startServer, makePdf, pageWidths, mergeForm }
