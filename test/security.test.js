const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, makePdf, mergeForm } = require('./helpers')

const pages = ['/', '/about', '/contact', '/developer']
let server, url
before(async () => ({ server, url } = await startServer()))
after(() => server.close())

for (const path of pages) {
    test(`${path} sends security headers`, async () => {
        const res = await fetch(url + path)
        const csp = res.headers.get('content-security-policy')
        assert.match(csp, /default-src 'self'/)
        assert.match(csp, /script-src 'self' https:\/\/cdn\.jsdelivr\.net 'nonce-[A-Za-z0-9+/=]+'/)
        assert.match(csp, /script-src-attr 'none'/)
        assert.match(csp, /object-src 'none'/)
        assert.match(csp, /frame-ancestors 'none'/)
        assert.match(csp, /connect-src 'self' https:\/\/api\.web3forms\.com(;|$)/)
        assert.match(csp, /form-action 'self'(;|$)/)
        assert.doesNotMatch(csp, /unsafe-eval/)
        assert.equal(res.headers.get('x-content-type-options'), 'nosniff')
        assert.equal(res.headers.get('x-frame-options'), 'DENY')
        assert.equal(res.headers.get('referrer-policy'), 'no-referrer')
        assert.match(res.headers.get('strict-transport-security'), /max-age=\d+/)
        assert.match(res.headers.get('permissions-policy'), /camera=\(\)/)
        assert.equal(res.headers.get('x-powered-by'), null)
    })

    test(`${path} inline scripts carry the CSP nonce and there are no inline handlers`, async () => {
        const res = await fetch(url + path)
        const nonce = res.headers.get('content-security-policy').match(/'nonce-([^']+)'/)[1]
        const html = await res.text()
        for (const [tag] of html.matchAll(/<script\b[^>]*>/g)) {
            if (!/\bsrc=/.test(tag)) assert.ok(tag.includes(`nonce="${nonce}"`), `inline script without nonce: ${tag}`)
        }
        assert.doesNotMatch(html, /\son[a-z]+\s*=\s*["']/i, 'inline event handler attribute found')
        for (const [link] of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
            assert.match(link, /rel="noopener noreferrer"/, link)
        }
    })

    test(`${path} nonce changes per response`, async () => {
        const nonceOf = async () => (await fetch(url + path)).headers.get('content-security-policy').match(/'nonce-([^']+)'/)[1]
        assert.notEqual(await nonceOf(), await nonceOf())
    })
}

test('home page never builds the file list from HTML strings', async () => {
    const html = await (await fetch(url + '/')).text()
    assert.doesNotMatch(html, /innerHTML|insertAdjacentHTML|outerHTML/)
    assert.match(html, /label\.textContent = `\$\{index \+ 1\}\. \$\{file\.name\}/)
})

test('malicious HTML file names are never reflected', async () => {
    const evil = '<img src=x onerror=alert(1)>.pdf'
    const pdf = await makePdf(1)

    const ok = await fetch(url + '/merge', { method: 'POST', body: mergeForm([{ data: pdf, name: evil }, { data: pdf }]) })
    assert.equal(ok.status, 200)
    assert.equal(ok.headers.get('content-type'), 'application/pdf')
    assert.equal(ok.headers.get('content-disposition'), 'attachment; filename="merged.pdf"')
    assert.equal(ok.headers.get('x-content-type-options'), 'nosniff')

    const rejected = await fetch(url + '/merge', { method: 'POST', body: mergeForm([{ data: Buffer.from('nope'), name: evil }, { data: pdf }]) })
    assert.equal(rejected.status, 400)
    const html = await rejected.text()
    assert.ok(!html.includes('<img src=x'), 'file name reflected as HTML')
    assert.ok(!html.includes('onerror=alert'), 'file name reflected')
})
