const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, makePdf, pageWidths, mergeForm } = require('./helpers')

let server, url
before(async () => ({ server, url } = await startServer()))
after(() => server.close())

for (const path of ['/', '/about', '/contact', '/developer']) {
    test(`GET ${path} renders`, async () => {
        const res = await fetch(url + path)
        assert.equal(res.status, 200)
        assert.match(res.headers.get('content-type'), /text\/html/)
        assert.match(await res.text(), /<title>[^<]+<\/title>/)
    })
}

test('removed /blog route returns 404 without internals', async () => {
    const res = await fetch(url + '/blog')
    assert.equal(res.status, 404)
    assert.doesNotMatch(await res.text(), /node_modules|Failed to lookup view|[A-Z]:\\/)
})

test('GET /assets/style.css is served', async () => {
    const res = await fetch(url + '/assets/style.css')
    assert.equal(res.status, 200)
    assert.match(res.headers.get('content-type'), /text\/css/)
})

test('POST /merge merges two PDFs', async () => {
    const form = mergeForm([{ data: await makePdf(3, 200) }, { data: await makePdf(4, 300) }], { mergeMode: 'all' })
    const res = await fetch(url + '/merge', { method: 'POST', body: form })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/pdf')
    const widths = await pageWidths(Buffer.from(await res.arrayBuffer()))
    assert.deepEqual(widths, [201, 202, 203, 301, 302, 303, 304])
})
