const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer } = require('./helpers')

let server, url
before(async () => ({ server, url } = await startServer()))
after(() => server.close())

const pages = ['/', '/about', '/contact', '/developer']
const faviconLinks = [
    '<link rel="icon" href="/favicon.ico" sizes="any">',
    '<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">',
    '<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">',
    '<link rel="manifest" href="/site.webmanifest">'
]

// Width and height from a PNG's IHDR chunk
function pngSize(buf) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

for (const path of pages) {
    test(`${path} links each favicon exactly once`, async () => {
        const html = await (await fetch(url + path)).text()
        for (const link of faviconLinks) {
            assert.equal(html.split(link).length - 1, 1, link)
        }
    })
}

test('favicon files are served with the right sizes', async () => {
    for (const [file, size] of [
        ['/favicon-32x32.png', 32],
        ['/apple-touch-icon.png', 180],
        ['/android-chrome-192x192.png', 192],
        ['/android-chrome-512x512.png', 512]
    ]) {
        const res = await fetch(url + file)
        assert.equal(res.status, 200, file)
        assert.equal(res.headers.get('content-type'), 'image/png', file)
        assert.deepEqual(pngSize(Buffer.from(await res.arrayBuffer())), { width: size, height: size }, file)
    }

    const ico = Buffer.from(await (await fetch(url + '/favicon.ico')).arrayBuffer())
    assert.equal(ico.readUInt16LE(2), 1, 'ICO type')
    assert.equal(ico.readUInt16LE(4), 3, '16, 32 and 48px images')

    const manifest = await (await fetch(url + '/site.webmanifest')).json()
    assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512'])
})

test('navbar and footer use the logo with fixed dimensions (no layout shift)', async () => {
    const html = await (await fetch(url + '/')).text()
    assert.match(html, /<img src="\/assets\/images\/pdf-merger-logo-nav\.webp" alt="PDF Merger" width="114" height="44" class="brand-logo navbar-logo">/)
    assert.match(html, /<img src="\/assets\/images\/pdf-merger-logo-nav\.webp" alt="PDF Merger" width="130" height="50" class="brand-logo footer-logo-img"/)
    const logo = await fetch(url + '/assets/images/pdf-merger-logo-nav.webp')
    assert.equal(logo.status, 200)
    assert.equal(logo.headers.get('content-type'), 'image/webp')
})

test('dotfiles in public/ are not served', async () => {
    assert.equal((await fetch(url + '/.assetsignore')).status, 404)
})

test('location: Islamabad for the contact location, UET Lahore kept as the university name', async () => {
    assert.match(await (await fetch(url + '/contact')).text(), /Islamabad, Pakistan/)
    for (const path of ['/about', '/developer']) {
        const html = await (await fetch(url + path)).text()
        assert.match(html, /UET, Lahore, Pakistan/, path)
        assert.doesNotMatch(html, /UET, Islamabad/, path)
    }
})
