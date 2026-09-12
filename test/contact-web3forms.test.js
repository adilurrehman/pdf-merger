// Web3Forms is stubbed, so no real message is ever sent.
// At most 3 contact posts here: the contact limit is 3 per hour per IP.
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer } = require('./helpers')

const ACCESS_KEY = 'test-access-key-do-not-leak'
const WEB3FORMS_URL = 'https://api.web3forms.com/submit'
const realFetch = globalThis.fetch
const web3formsCalls = []
let web3formsReply

let server, url
before(async () => {
    process.env.WEB3FORMS_ACCESS_KEY = ACCESS_KEY
    // Intercept only the app's call to Web3Forms; the tests' own requests go through untouched
    globalThis.fetch = async (input, init) => {
        if (String(input) === WEB3FORMS_URL) {
            web3formsCalls.push({ init, body: JSON.parse(init.body) })
            return web3formsReply()
        }
        return realFetch(input, init)
    }
    ;({ server, url } = await startServer())
})
after(() => {
    globalThis.fetch = realFetch
    delete process.env.WEB3FORMS_ACCESS_KEY
    server.close()
})

const validFields = { name: 'Test User', email: 'tester@example.org', message: 'Hello, this is a valid message.' }

async function postContact(fields) {
    const res = await realFetch(url + '/contact', { method: 'POST', body: new URLSearchParams(fields) })
    return { status: res.status, html: await res.text() }
}

test('the access key never appears in the contact page', async () => {
    const html = await (await realFetch(url + '/contact')).text()
    assert.ok(!html.includes(ACCESS_KEY))
    assert.doesNotMatch(html, /web3forms|access_key/i)
})

test('valid message is sent to Web3Forms and shows success', async () => {
    web3formsReply = () => Response.json({ success: true, message: 'Email sent successfully!' })
    const { status, html } = await postContact(validFields)

    assert.equal(status, 200)
    assert.match(html, /Message sent successfully!/)
    assert.ok(!html.includes(ACCESS_KEY), 'access key leaked into the response')

    assert.equal(web3formsCalls.length, 1)
    const [{ init, body }] = web3formsCalls
    assert.equal(init.method, 'POST')
    assert.equal(init.headers['Content-Type'], 'application/json')
    assert.deepEqual(body, {
        access_key: ACCESS_KEY,
        name: 'Test User',
        email: 'tester@example.org',
        message: 'Hello, this is a valid message.',
        subject: '[PDF Merger] Contact from Test User',
        from_name: 'PDF Merger Contact Form'
    })
})

test('Web3Forms "success: false" response shows the failure message', async () => {
    web3formsReply = () => Response.json({ success: false, message: 'Invalid access key' })
    const { html } = await postContact(validFields)
    assert.match(html, /Failed to send message\. Please try again\./)
    assert.doesNotMatch(html, /Invalid access key/)
})

test('blocked or non-JSON Web3Forms response shows the failure message', async () => {
    web3formsReply = () => new Response('<!DOCTYPE html><title>Just a moment...</title>', {
        status: 403, headers: { 'content-type': 'text/html' }
    })
    const { html } = await postContact(validFields)
    assert.match(html, /Failed to send message\. Please try again\./)
    assert.doesNotMatch(html, /Just a moment/)
})
