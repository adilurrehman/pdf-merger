// Local Node.js entry point (npm start). Cloudflare Workers uses worker.js instead.
require('dotenv').config({ quiet: true })
const fs = require('fs')
const path = require('path')
const app = require('./app')

const port = process.env.PORT || 3000

if (!process.env.WEB3FORMS_ACCESS_KEY) {
  console.warn('WEB3FORMS_ACCESS_KEY is not set: the contact form will show an error instead of sending messages.')
}

// Older versions left merged PDFs in public/ and raw uploads in uploads/. The current
// version writes nothing to disk; remove only those known leftovers, matched by exact name pattern.
function removeLegacyTempFiles() {
  const legacy = [
    [path.join(__dirname, 'public'), /^\d+_merged\.pdf$/],
    [path.join(__dirname, 'uploads'), /^[0-9a-f]{32}$/]
  ]
  for (const [dir, pattern] of legacy) {
    try {
      for (const name of fs.readdirSync(dir)) {
        if (pattern.test(name)) fs.rmSync(path.join(dir, name), { force: true })
      }
    } catch (err) {
      if (err.code !== 'ENOENT') console.warn(`Could not clean ${path.basename(dir)}/:`, err.code)
    }
  }
}
removeLegacyTempFiles()

const server = app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})

// Graceful shutdown: stop accepting connections and let in-flight requests finish (10s max)
function shutdown(signal) {
  console.log(`${signal} received, shutting down`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(1), 10 * 1000).unref()
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
