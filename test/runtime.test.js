const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, makePdf, mergeForm } = require('./helpers')

let server, url
before(async () => {
    delete process.env.WEB3FORMS_ACCESS_KEY
    ;({ server, url } = await startServer())
})
after(() => server.close())

// Collect everything written to the console while fn runs
async function captureLogs(fn) {
    const lines = []
    const originals = {}
    for (const level of ['log', 'info', 'warn', 'error']) {
        originals[level] = console[level]
        console[level] = (...args) => lines.push(args.map(String).join(' '))
    }
    try {
        await fn()
    } finally {
        Object.assign(console, originals)
    }
    return lines.join('\n')
}

test('oversized form bodies get a plain error without stack traces or paths', async () => {
    const res = await fetch(url + '/contact', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: 'message=' + 'a'.repeat(30 * 1024)
    })
    assert.equal(res.status, 413)
    const body = await res.text()
    assert.equal(body, 'Request too large.')
    assert.doesNotMatch(body, /node_modules|at \w|[A-Z]:\\|\/home\//)
})

test('contact form reports a missing Web3Forms access key instead of trying to send', async () => {
    const res = await fetch(url + '/contact', {
        method: 'POST',
        body: new URLSearchParams({ name: 'Test User', email: 'tester@example.org', message: 'Hello, this is a test message.' })
    })
    assert.equal(res.status, 200)
    assert.match(await res.text(), /contact form is temporarily unavailable/)
})

test('merging does not log uploaded file names or page ranges', async () => {
    const pdf = await makePdf(2)
    const logs = await captureLogs(async () => {
        const form = mergeForm([{ data: pdf, name: 'secret-client-report.pdf' }, { data: pdf, name: 'payroll.pdf' }],
            { mergeMode: 'specific', 'pageRanges[0]': '1', 'pageRanges[1]': '9' })
        await (await fetch(url + '/merge', { method: 'POST', body: form })).arrayBuffer()
    })
    assert.doesNotMatch(logs, /secret-client-report|payroll|pageRanges/)
})
