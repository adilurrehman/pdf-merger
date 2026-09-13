// Cloudflare Workers entry point (wrangler dev / wrangler deploy).
// Local Node.js uses server.js instead.
import path from 'node:path'
import { httpServerHandler } from 'cloudflare:node'
import app from './app.js'
import templates from './dist/views.js'

// EJS compiles templates with new Function(), which Workers disallow,
// so views are precompiled at build time by scripts/build-views.js
function renderTemplate(name, data) {
    // Includes resolve relative to the including template, as EJS does on Node
    const dir = path.posix.dirname(name)
    return templates[name](data, null, (includeName, includeData) =>
        renderTemplate(path.posix.normalize(path.posix.join(dir, includeName)), { ...data, ...includeData }))
}

class PrecompiledView {
    constructor(name) {
        this.name = name
        this.root = 'precompiled views'
        this.path = Object.hasOwn(templates, name) ? name : undefined
    }

    render(options, callback) {
        try {
            callback(null, renderTemplate(this.name, options))
        } catch (err) {
            callback(err)
        }
    }
}

app.set('view', PrecompiledView)

const port = 3000
app.listen(port)

export default httpServerHandler({ port })
