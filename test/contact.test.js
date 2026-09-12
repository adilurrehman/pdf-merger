// The contact form is sent from the browser straight to Web3Forms; the server only renders the page
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer } = require('./helpers')

let server, url
before(async () => ({ server, url } = await startServer()))
after(() => server.close())

async function contactPage() {
    const res = await fetch(url + '/contact')
    return { res, html: await res.text() }
}

test('contact page carries the Web3Forms fields and a hidden botcheck', async () => {
    const { res, html } = await contactPage()
    assert.equal(res.status, 200)
    assert.match(html, /<input type="hidden" name="access_key" value="608dcbd3-ff87-4e85-b5b5-3eae6470ed11">/)
    assert.match(html, /<input type="hidden" name="subject" value="\[PDF Merger\] Contact Form">/)
    assert.match(html, /<input type="hidden" name="from_name" value="PDF Merger">/)
    assert.match(html, /<input type="checkbox" name="botcheck" class="d-none"/)
})

test('contact script submits to Web3Forms with AJAX and shows the existing messages', async () => {
    const { res, html } = await contactPage()
    const nonce = res.headers.get('content-security-policy').match(/'nonce-([^']+)'/)[1]
    const js = [...html.matchAll(/<script nonce="([^"]+)">([\s\S]*?)<\/script>/g)]
        .filter(([, scriptNonce]) => scriptNonce === nonce)
        .map(([, , body]) => body)
        .find(body => body.includes("getElementById('contactForm')"))
    assert.ok(js, 'nonce-tagged contact script found')

    assert.match(js, /fetch\('https:\/\/api\.web3forms\.com\/submit'/)
    assert.match(js, /e\.preventDefault\(\)/)
    assert.match(js, /submitBtn\.disabled = true/)
    assert.match(js, /form\.reset\(\)/)
    for (const text of [
        'Message sent successfully!',
        'Failed to send message. Please try again.',
        'Invalid input. Name: 2-100 chars, Message: 10-1000 chars, Valid email required.',
        'Your message was flagged as spam.'
    ]) {
        assert.ok(js.includes(text), text)
    }
    assert.doesNotMatch(js, /innerHTML/)
})

test('CSP lets the page connect only to itself and Web3Forms', async () => {
    const csp = (await contactPage()).res.headers.get('content-security-policy')
    assert.match(csp, /connect-src 'self' https:\/\/api\.web3forms\.com(;|$)/)
    assert.match(csp, /form-action 'self'(;|$)/)
})

test('the server no longer accepts contact submissions', async () => {
    const res = await fetch(url + '/contact', {
        method: 'POST',
        body: new URLSearchParams({ name: 'Test User', email: 'tester@example.org', message: 'Hello, this is a message.' })
    })
    assert.equal(res.status, 404)
})
