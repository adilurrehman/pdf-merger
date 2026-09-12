// At most 3 contact posts here: the contact limit is 3 per hour per IP
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer } = require('./helpers')

let server, url
before(async () => {
    delete process.env.WEB3FORMS_ACCESS_KEY
    ;({ server, url } = await startServer())
})
after(() => server.close())

async function postContact(fields) {
    const res = await fetch(url + '/contact', { method: 'POST', body: new URLSearchParams(fields) })
    return { status: res.status, html: await res.text() }
}

test('rejects invalid contact input', async () => {
    const { html } = await postContact({ name: 'A', email: 'not-an-email', message: 'short' })
    assert.match(html, /Invalid input/)
})

test('flags spam content', async () => {
    const { html } = await postContact({ name: 'Spam Bot', email: 'bot@mailinator.com', message: 'You are a lottery winner, claim now!' })
    assert.match(html, /flagged as spam/)
})

test('valid input without a Web3Forms access key shows a clean error, not a crash', async () => {
    const { status, html } = await postContact({
        name: '<script>alert(1)</script>', email: 'tester@example.org', message: 'Hello, this is a valid message.'
    })
    assert.equal(status, 200)
    assert.match(html, /temporarily unavailable/)
    assert.ok(!html.includes('<script>alert(1)</script>'), 'input is not reflected')
})
