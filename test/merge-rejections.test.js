const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { startServer, makePdf, mergeForm } = require('./helpers')

const root = path.join(__dirname, '..')
let server, url, pdf, snapshot

// Every file under public/ and uploads/, to prove rejected uploads leave nothing behind
function listFiles() {
    return ['public', 'uploads'].flatMap(dir => {
        const full = path.join(root, dir)
        return fs.existsSync(full) ? fs.readdirSync(full, { recursive: true }).map(f => path.join(dir, f)) : []
    }).sort()
}

before(async () => {
    ({ server, url } = await startServer())
    pdf = await makePdf(3)
    snapshot = listFiles()
})
after(() => server.close())

async function postMerge(body) {
    const res = await fetch(url + '/merge', { method: 'POST', body })
    return { status: res.status, html: await res.text() }
}

function expectRejected({ status, html }, expectedStatus, message) {
    assert.equal(status, expectedStatus)
    assert.match(html, message)
    assert.match(html, /<form method="post" action="\/merge"/, 'the merge form is shown again')
}

test('rejects fewer than 2 files', async () => {
    expectRejected(await postMerge(mergeForm([{ data: pdf }])), 400, /Please upload at least 2 PDF files/)
    expectRejected(await postMerge(new URLSearchParams({ mergeMode: 'all' })), 400, /Please upload at least 2 PDF files/)
})

test('accepts exactly 10 files', async () => {
    const res = await fetch(url + '/merge', { method: 'POST', body: mergeForm(Array(10).fill({ data: pdf })) })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/pdf')
})

test('rejects more than 10 files', async () => {
    expectRejected(await postMerge(mergeForm(Array(11).fill({ data: pdf }))), 400, /Maximum 10 PDF files allowed/)
})

test('rejects a file over 5MB', async () => {
    const big = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.alloc(5 * 1024 * 1024)])
    expectRejected(await postMerge(mergeForm([{ data: big }, { data: pdf }])), 413, /5MB or smaller/)
})

test('rejects a fake application/pdf file', async () => {
    const fake = Buffer.from('<html><script>alert(1)</script></html>')
    expectRejected(await postMerge(mergeForm([{ data: fake }, { data: pdf }])), 400, /Only PDF files are allowed/)
})

test('rejects a real PDF sent with a non-PDF MIME type', async () => {
    expectRejected(await postMerge(mergeForm([{ data: pdf, type: 'text/plain' }, { data: pdf }])), 400, /Only PDF files are allowed/)
})

test('rejects a malformed PDF', async () => {
    const malformed = Buffer.from('%PDF-1.7\nthis is not a real pdf body\n%%EOF')
    expectRejected(await postMerge(mergeForm([{ data: malformed }, { data: pdf }])), 400, /Could not merge the PDFs/)
})

test('rejects invalid page ranges', async () => {
    for (const range of ['abc', '0', '3-1', '1;2', '1to3', '-1', '1,,2', '', '1-2-3', '12345']) {
        const form = mergeForm([{ data: pdf }, { data: pdf }], { mergeMode: 'specific', 'pageRanges[0]': range, 'pageRanges[1]': 'all' })
        expectRejected(await postMerge(form), 400, /Invalid page ranges/)
    }
})

test('rejects oversized page-range input', async () => {
    const tooLong = mergeForm([{ data: pdf }, { data: pdf }], { mergeMode: 'specific', 'pageRanges[0]': '1,'.repeat(60) + '1' })
    expectRejected(await postMerge(tooLong), 400, /Invalid page ranges/)
    const tooManyPages = mergeForm([{ data: pdf }, { data: pdf }], { mergeMode: 'specific', 'pageRanges[0]': '1-9999' })
    expectRejected(await postMerge(tooManyPages), 400, /Invalid page ranges/)
})

test('rejects malformed page-range fields', async () => {
    const asObject = mergeForm([{ data: pdf }, { data: pdf }], { mergeMode: 'specific', 'pageRanges[a]': '1' })
    expectRejected(await postMerge(asObject), 400, /Invalid page ranges/)
    const tooMany = mergeForm([{ data: pdf }, { data: pdf }], { mergeMode: 'specific', 'pageRanges[5]': '1' })
    expectRejected(await postMerge(tooMany), 400, /Invalid page ranges/)
})

test('rejects an unknown merge mode', async () => {
    expectRejected(await postMerge(mergeForm([{ data: pdf }, { data: pdf }], { mergeMode: 'evil' })), 400, /Invalid merge mode/)
})

test('rejects files in an unexpected field', async () => {
    const form = mergeForm([{ data: pdf }, { data: pdf }])
    form.append('other', new Blob([pdf], { type: 'application/pdf' }), 'x.pdf')
    expectRejected(await postMerge(form), 400, /Invalid upload/)
})

test('rejections leave no files behind', () => {
    assert.deepEqual(listFiles(), snapshot)
})
