# PDF Merger

A free, fast online tool to merge PDF files into a single document.

![Node.js](https://img.shields.io/badge/Node.js-22+-green)
![Express](https://img.shields.io/badge/Express-5.x-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

- 🚀 **Fast** - Merge PDFs in seconds, entirely in memory
- 📄 **Page Selection** - Choose specific pages from each PDF (e.g. `1-3, 5, 7-10` or `all`)
- 🔄 **Drag & Drop** - Add files by dragging or browsing, and remove files before merging
- 🎨 **Dark/Light Theme** - System preference aware
- 📱 **Mobile Friendly** - Works on all devices
- 💯 **Free** - No account or registration needed

## 📏 Limits

- 2 to 10 PDF files per merge
- 5MB maximum per file
- 30 merge requests per 15 minutes per IP address

Files are merged in the order they were added. To change the order, remove files and add them again.

## 🔐 Privacy & Security

What the app actually does with your files:

- Uploaded PDFs are held **in memory only** for the duration of the request. They are never written to disk.
- The merged PDF is sent straight back to your browser as a download. It is **not stored** and there is no public download URL.
- Upload buffers are released as soon as the merge finishes or fails.
- Server logs never contain file names or page selections.

Protections:

- Uploads are checked for real PDF content, not just the MIME type the browser reports
- Strict server-side validation of page ranges
- Hard limits on file count, file size, form fields and request size
- Rate limiting on merging and a cap on concurrent merges
- Security headers via [helmet](https://helmetjs.github.io/), including a nonce-based Content Security Policy
- Subresource Integrity on the Bootstrap CDN files
- Errors are shown without stack traces or internal paths
- Contact form validation and spam filtering in the browser, plus a Web3Forms honeypot (botcheck) field

Notes:

- Rate limits are kept in memory, so they apply per server instance (or per Cloudflare Worker isolate), not globally.
- The contact form is sent from your browser directly to [Web3Forms](https://web3forms.com/), which emails it to the site owner. The Web3Forms access key in the page is public by design: it can only submit to this form's inbox.
- Use HTTPS in production. Cloudflare Workers provides it automatically.

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** EJS, Bootstrap 5, CSS3
- **PDF Processing:** pdf-merger-js (pdf-lib)
- **Contact form:** Web3Forms API (called from the browser)
- **Security:** helmet, express-rate-limit
- **Hosting:** Node.js, Docker, or Cloudflare Workers

## 📦 Installation

Requires Node.js 22 or newer.

1. **Clone the repository**
   ```bash
   git clone https://github.com/adilurrehman/pdf-merger.git
   cd pdf-merger
   ```

2. **Install dependencies**
   ```bash
   npm ci
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```
   Set `PORT` to use a different port.

## ☁️ Cloudflare Workers

The same app runs on Cloudflare Workers (see `wrangler.jsonc` and `worker.js`).

```bash
npm run worker:dev                     # local Workers runtime
npm run worker:deploy
```

## 🐳 Docker

```bash
# Build and run with Docker Compose
docker-compose up -d

# Or build manually
docker build -t pdf-merger .
docker run -p 3000:3000 --env-file .env pdf-merger
```

## 📁 Project Structure

```
PdfMerger/
├── .github/workflows/
│   ├── ci.yml              # Tests, security audit, Docker build
│   └── deploy.yml          # Runs CI, then deploys
├── public/assets/          # Static CSS and images (no PDFs)
├── scripts/
│   └── build-views.js      # Precompiles EJS views for Workers
├── test/                   # node:test suites
├── views/
│   ├── partials/
│   ├── about.ejs
│   ├── contact.ejs
│   ├── developer.ejs
│   └── index.ejs
├── app.js                  # Express app (routes, security, merge flow)
├── mergePDF.js             # In-memory PDF merging
├── server.js               # Node.js entry point
├── worker.js               # Cloudflare Workers entry point
├── wrangler.jsonc
├── Dockerfile
└── docker-compose.yml
```

## 📝 Scripts

```bash
npm start              # Start the Node.js server
npm run dev            # Start with nodemon (development)
npm test               # Run the test suite
npm run worker:dev     # Run on the local Cloudflare Workers runtime
npm run worker:deploy  # Deploy to Cloudflare Workers
```

## 🚀 Deployment

Production runs on Cloudflare Workers only. `deploy.yml` runs the full CI first and, if it passes, deploys from `main` with `wrangler deploy`. It needs the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets in the `production` environment.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 👨‍💻 Developer

**Adil ur Rehman Kakar**
- 🎓 Student at UET, Lahore, Pakistan
- 💼 Full Stack Web Developer

[![LinkedIn](https://img.shields.io/badge/LinkedIn-Connect-blue)](https://linkedin.com/in/adilurrehmanofficial)
[![Instagram](https://img.shields.io/badge/Instagram-Follow-pink)](https://instagram.com/adilurrehmanofficial)
[![GitHub](https://img.shields.io/badge/GitHub-Follow-black)](https://github.com/adilurrehman)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [pdf-merger-js](https://www.npmjs.com/package/pdf-merger-js) - PDF merging library
- [Bootstrap](https://getbootstrap.com/) - CSS framework
- [Bootstrap Icons](https://icons.getbootstrap.com/) - Icon library

---

⭐ Star this repo if you find it helpful!
