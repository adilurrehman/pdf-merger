// Local Node.js entry point (npm start). Cloudflare Workers uses worker.js instead.
require('dotenv').config()
const app = require('./app')

const port = process.env.PORT || 3000

app.listen(port, () => {
  console.log(`Example app listening on port http://localhost:${port}`)
})
