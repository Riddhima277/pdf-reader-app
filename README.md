# 📄 PDF Reader — Built for Digital Heroes

A powerful, free online PDF reader that lets you upload any PDF and instantly:
- 📖 **View every page** with a built-in page renderer
- 📝 **Extract all text** from the document
- 📊 **See document metadata** (pages, file size, word count, author)

**Built by:** Riddhima Gupta  
**Email:** guptariddhima75@gmail.com  
**Live:** [Deployed on Vercel]  
**Built for:** [Digital Heroes](https://digitalheroes.co)

---

## 🛠 Tech Stack

| Layer    | Technology              |
|----------|-------------------------|
| Frontend | React 18 + Vite + PDF.js|
| Backend  | Express.js (serverless) |
| Deploy   | Vercel                  |

---

## 🚀 Local Development

### 1. Install dependencies
```bash
# Root (Express API)
npm install

# Client (React)
cd client && npm install
```

### 2. Run the Express API
```bash
node api/index.js
# Runs on http://localhost:5000
```

### 3. Run the React client
```bash
cd client
npm run dev
# Runs on http://localhost:5173
```

---

## ☁️ Deploy to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your repo
3. Vercel auto-detects the `vercel.json` config
4. Click **Deploy** — done! ✅

---

## 📋 Mandatory Requirements ✅

- [x] Tool works and gives correct output
- [x] "Built for Digital Heroes" button → https://digitalheroes.co
- [x] Full name **Riddhima Gupta** visible on page
- [x] Email **guptariddhima75@gmail.com** visible on page
- [x] Deployed on Vercel free plan
- [x] £0 spent — no paid subscriptions
