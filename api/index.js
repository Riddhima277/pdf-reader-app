const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// Use memory storage so files stay in RAM (works on Vercel serverless)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"), false);
    }
  },
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "PDF Reader API is running" });
});

// Upload and parse PDF
app.post("/api/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const data = await pdfParse(req.file.buffer);

    res.json({
      success: true,
      filename: req.file.originalname,
      fileSize: req.file.size,
      numPages: data.numpages,
      text: data.text,
      info: data.info,
      metadata: data.metadata,
    });
  } catch (err) {
    console.error("PDF parse error:", err);
    res.status(500).json({ error: "Failed to parse PDF: " + err.message });
  }
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || "Internal Server Error" });
});

// For local dev
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Express API running on http://localhost:${PORT}`);
  });
}

module.exports = app;
