# PDF Merger

A free, fast, and secure online tool to merge multiple PDF files into a single document.

![Node.js](https://img.shields.io/badge/Node.js-18+-green)
![Express](https://img.shields.io/badge/Express-5.x-blue)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

- 🚀 **Lightning Fast** - Merge PDFs in seconds
- 🔒 **100% Secure** - Files are auto-deleted after processing
- 📱 **Mobile Friendly** - Works on all devices
- 🎨 **Dark/Light Theme** - System preference aware
- 📄 **Page Selection** - Choose specific pages from each PDF
- 🔄 **Drag & Drop** - Easy file upload
- 💯 **Free Forever** - No hidden fees or limits

## 🛠️ Tech Stack

- **Backend:** Node.js, Express.js
- **Frontend:** EJS, Bootstrap 5, CSS3
- **PDF Processing:** pdf-merger-js
- **Email:** Nodemailer
- **Security:** express-rate-limit, express-validator

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/adilurrehman/pdf-merger.git
   cd pdf-merger
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables**
   ```env
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_app_password
   ```

5. **Start the server**
   ```bash
   npm start
   ```

6. **Open in browser**
   ```
   http://localhost:3000
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
├── .github/
│   └── workflows/
│       ├── ci.yml          # CI pipeline
│       └── deploy.yml      # CD pipeline
├── views/
│   ├── assets/
│   │   ├── images/
│   │   └── style.css
│   ├── partials/
│   │   ├── header.ejs
│   │   └── footer.ejs
│   ├── about.ejs
│   ├── contact.ejs
│   ├── developer.ejs
│   └── index.ejs
├── uploads/                # Temporary file storage
├── .env.example
├── .gitignore
├── Dockerfile
├── docker-compose.yml
├── mergePDF.js
├── package.json
├── server.js
└── README.md
```

## 🔐 Security Features

- ✅ No permanent file storage
- ✅ Automatic file deletion after processing
- ✅ Rate limiting on contact form
- ✅ Input validation and sanitization
- ✅ Spam detection
- ✅ HTTPS recommended for production

## 🚀 Deployment

The project includes CI/CD pipelines for:
- Vercel
- Railway
- Render
- Heroku
- VPS (via SSH)

See [.github/workflows/deploy.yml](.github/workflows/deploy.yml) for configuration.

## 📝 Scripts

```bash
npm start       # Start production server
npm run dev     # Start with nodemon (development)
npm test        # Run tests (if configured)
npm run lint    # Run linter (if configured)
```

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
