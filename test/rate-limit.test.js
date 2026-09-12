// Runs in its own process (node --test isolates files), so the in-memory limits start empty
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer } = require('./helpers')

let server, url
before(async () => ({ server, url } = await startServer()))
after(() => server.close())

// Cheapest possible merge request: no files, rejected by validation but still counted
function emptyMerge(headers = {}) {
    return fetch(url + '/merge', { method: 'POST', headers, body: new URLSearchParams({ mergeMode: 'all' }) })
}

test('merge endpoint allows 30 requests per window, then returns 429', async () => {
    for (let i = 1; i <= 30; i++) {
        const res = await emptyMerge()
        assert.equal(res.status, 400, `request ${i}`)
        await res.arrayBuffer()
    }
    const limited = await emptyMerge()
    assert.equal(limited.status, 429)
    assert.match(await limited.text(), /Too many merge requests/)
})

test('a spoofed CF-Connecting-IP header does not bypass the merge limit outside Workers', async () => {
    const res = await emptyMerge({ 'cf-connecting-ip': '203.0.113.7' })
    assert.equal(res.status, 429)
})

test('contact form allows 3 messages per hour, then blocks', async () => {
    const post = () => fetch(url + '/contact', { method: 'POST', body: new URLSearchParams({ name: 'x', email: 'bad', message: 'short' }) })
    for (let i = 1; i <= 3; i++) {
        assert.doesNotMatch(await (await post()).text(), /Too many messages sent/, `message ${i}`)
    }
    assert.match(await (await post()).text(), /Too many messages sent/)
})
