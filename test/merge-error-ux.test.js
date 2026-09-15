// A merge error is shown once, for the attempt that caused it, and never survives a refresh or a new attempt
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { startServer, makePdf, mergeForm } = require('./helpers')

let server, url
before(async () => ({ server, url } = await startServer()))
after(() => server.close())

// The page's own inline script (the one carrying the CSP nonce that builds the merge form)
async function homeScript(res) {
    const nonce = res.headers.get('content-security-policy').match(/'nonce-([^']+)'/)[1]
    const html = await res.text()
    const js = [...html.matchAll(/<script nonce="([^"]+)">([\s\S]*?)<\/script>/g)]
        .filter(([, scriptNonce]) => scriptNonce === nonce)
        .map(([, , body]) => body)
        .find(body => body.includes("getElementById('mergeForm')"))
    assert.ok(js, 'merge script found')
    return { html, js }
}

test('a failed merge shows the server error in a removable alert', async () => {
    const pdf = await makePdf(1)
    const res = await fetch(url + '/merge', { method: 'POST', body: mergeForm([{ data: Buffer.from('not a pdf') }, { data: pdf }]) })
    assert.equal(res.status, 400)
    const html = await res.text()
    assert.match(html, /<div class="alert alert-danger" role="alert" id="mergeError">\s*Only PDF files are allowed\s*<\/div>/)
})

test('a normal page load (what a refresh becomes) has no merge error', async () => {
    const html = await (await fetch(url + '/')).text()
    assert.doesNotMatch(html, /id="mergeError"/)
    assert.doesNotMatch(html, /alert-danger/)
})

test('the error page rewrites its history entry to "/" so refresh never resubmits the POST', async () => {
    const { js } = await homeScript(await fetch(url + '/'))
    assert.match(js, /if \(window\.location\.pathname === '\/merge'\) \{\s*window\.history\.replaceState\(null, '', '\/'\);\s*\}/)
})

test('the error is cleared at the start of every new-attempt action', async () => {
    const { js } = await homeScript(await fetch(url + '/'))
    assert.match(js, /function clearMergeError\(\) \{\s*const mergeError = document\.getElementById\('mergeError'\);\s*if \(mergeError\) mergeError\.remove\(\);\s*\}/)

    const clearsFirst = {
        'browse or drop files (both go through handleFiles)': /function handleFiles\(files\) \{\s*clearMergeError\(\);/,
        'remove a selected file': /function removeFile\(index\) \{\s*clearMergeError\(\);/,
        'switch to Merge All': /mergeAllOption\.addEventListener\('click', function\(e\) \{\s*e\.preventDefault\(\);\s*clearMergeError\(\);/,
        'switch to Merge Specific': /mergeSpecificOption\.addEventListener\('click', function\(e\) \{\s*e\.preventDefault\(\);\s*clearMergeError\(\);/,
        'edit a page range': /fileList\.addEventListener\('input', function \(e\) \{\s*if \(e\.target\.classList\.contains\('page-range-input'\)\) clearMergeError\(\);/,
        'start a new submission': /form\.addEventListener\('submit', function \(e\) \{\s*clearMergeError\(\);/
    }
    for (const [action, pattern] of Object.entries(clearsFirst)) {
        assert.match(js, pattern, action)
    }
    // Browsing and dropping both feed handleFiles
    assert.match(js, /fileInput\.addEventListener\('change', function \(\) \{\s*handleFiles\(this\.files\);/)
    assert.match(js, /function handleDrop\(e\) \{[\s\S]*?handleFiles\(files\);/)
})

test('a new failed attempt shows its own error', async () => {
    const pdf = await makePdf(1)
    const res = await fetch(url + '/merge', {
        method: 'POST',
        body: mergeForm([{ data: pdf }, { data: pdf }], { mergeMode: 'specific', 'pageRanges[0]': 'abc', 'pageRanges[1]': 'all' })
    })
    assert.equal(res.status, 400)
    const html = await res.text()
    const alerts = [...html.matchAll(/<div class="alert alert-danger" role="alert" id="mergeError">([\s\S]*?)<\/div>/g)].map(m => m[1].trim())
    assert.equal(alerts.length, 1, 'exactly one merge error')
    assert.match(alerts[0], /^Invalid page ranges/)
    assert.doesNotMatch(alerts[0], /Only PDF files are allowed/, 'no leftover from the previous attempt')
})
