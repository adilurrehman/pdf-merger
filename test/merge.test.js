const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { startServer, makePdf, pageWidths, mergeForm } = require('./helpers')

const root = path.join(__dirname, '..')
let server, url, pdfA, pdfB

// Every file under the given project directories, used to prove nothing is written to disk
function listFiles(dirs) {
    return dirs.flatMap(dir => {
        const full = path.join(root, dir)
        return fs.existsSync(full) ? fs.readdirSync(full, { recursive: true }).map(f => path.join(dir, f)) : []
    }).sort()
}
const watchedDirs = ['public', 'uploads']

before(async () => {
    ({ server, url } = await startServer())
    pdfA = await makePdf(3, 200)
    pdfB = await makePdf(4, 300)
})
after(() => server.close())

function merge(files, fields) {
    return fetch(url + '/merge', { method: 'POST', body: mergeForm(files, fields) })
}

test('merge-all returns the merged PDF as a direct download', async () => {
    const before = listFiles(watchedDirs)
    const res = await merge([{ data: pdfA }, { data: pdfB }], { mergeMode: 'all' })
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/pdf')
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="merged.pdf"')
    assert.equal(res.headers.get('cache-control'), 'no-store')
    assert.equal(res.headers.get('location'), null)
    assert.deepEqual(await pageWidths(Buffer.from(await res.arrayBuffer())), [201, 202, 203, 301, 302, 303, 304])
    assert.deepEqual(listFiles(watchedDirs), before, 'no files written to public/ or uploads/')
})

test('specific-page merge keeps only the requested pages', async () => {
    const res = await merge([{ data: pdfA }, { data: pdfB }], {
        mergeMode: 'specific', 'pageRanges[0]': '1, 3', 'pageRanges[1]': '2-4'
    })
    assert.equal(res.status, 200)
    assert.deepEqual(await pageWidths(Buffer.from(await res.arrayBuffer())), [201, 203, 302, 303, 304])
})

test('specific mode with "all" keeps every page of that file', async () => {
    const res = await merge([{ data: pdfA }, { data: pdfB }], {
        mergeMode: 'specific', 'pageRanges[0]': 'all', 'pageRanges[1]': '4'
    })
    assert.equal(res.status, 200)
    assert.deepEqual(await pageWidths(Buffer.from(await res.arrayBuffer())), [201, 202, 203, 304])
})

test('failed merge returns the form with an error and writes nothing', async () => {
    const before = listFiles(watchedDirs)
    const res = await merge([{ data: pdfA }, { data: pdfB }], {
        mergeMode: 'specific', 'pageRanges[0]': '9', 'pageRanges[1]': 'all'
    })
    assert.equal(res.status, 400)
    assert.match(await res.text(), /Could not merge the PDFs/)
    assert.deepEqual(listFiles(watchedDirs), before)
})

test('concurrent merges never share output', async () => {
    const [one, two] = await Promise.all([
        merge([{ data: pdfA }, { data: pdfB }], { mergeMode: 'all' }),
        merge([{ data: pdfB }, { data: pdfA }], { mergeMode: 'all' })
    ])
    assert.deepEqual(await pageWidths(Buffer.from(await one.arrayBuffer())), [201, 202, 203, 301, 302, 303, 304])
    assert.deepEqual(await pageWidths(Buffer.from(await two.arrayBuffer())), [301, 302, 303, 304, 201, 202, 203])
})

test('no public URL serves merged PDFs', async () => {
    for (const p of ['/static/1700000000000_merged.pdf', '/1700000000000_merged.pdf', '/assets/merged.pdf']) {
        assert.equal((await fetch(url + p)).status, 404, p)
    }
})
