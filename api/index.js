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

// Common English stop words to filter out from word cloud
const STOP_WORDS = new Set([
  "the", "of", "and", "to", "a", "in", "is", "that", "for", "it", "as", "on", "with", "his", "they", "i", 
  "at", "by", "this", "from", "but", "how", "an", "or", "are", "this", "was", "were", "be", "been", "has", 
  "have", "had", "do", "does", "did", "not", "you", "your", "we", "our", "he", "she", "him", "her", "their",
  "them", "about", "who", "which", "what", "where", "when", "why", "can", "will", "would", "could", "should",
  "if", "then", "else", "than", "so", "up", "down", "out", "into", "over", "under", "again", "further",
  "once", "here", "there", "all", "any", "both", "each", "few", "more", "most", "other", "some", "such",
  "no", "nor", "only", "own", "same", "too", "very", "just", "don", "should", "now", "also", "using", "use",
  "web", "development", "data", "file", "page", "application", "system", "into", "their", "about", "more"
]);

// Custom page renderer to inject page delimiters
const customPageRender = (pageData) => {
  return pageData.getTextContent({ normalizeWhitespace: true })
    .then((textContent) => {
      let text = "";
      let lastY;
      for (let item of textContent.items) {
        if (lastY === item.transform[5] || !lastY) {
          text += item.str;
        } else {
          text += "\n" + item.str;
        }
        lastY = item.transform[5];
      }
      return text + "\n---PAGE_SPLIT---";
    });
};

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "PDF Reader & Analyzer API is fully functional." });
});

// Upload and parse PDF
app.post("/api/upload", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No PDF file uploaded" });
    }

    const options = {
      pagerender: customPageRender
    };

    const data = await pdfParse(req.file.buffer, options);
    
    // Clean and split text into pages
    let rawText = data.text || "";
    let pages = rawText.split("\n---PAGE_SPLIT---");
    if (pages.length > 0 && pages[pages.length - 1].trim() === "") {
      pages.pop();
    }
    
    // Fallback if split fails or text is parsed differently
    if (pages.length === 0 && rawText.trim() !== "") {
      pages = [rawText];
    }

    const fullCleanText = pages.join("\n");

    // ─── Data Extraction ───
    // Emails
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const extractedEmails = Array.from(new Set(fullCleanText.match(emailRegex) || []));

    // Phone Numbers (various formats: +1-234-567-8901, (123) 456-7890, 1234567890, etc.)
    const phoneRegex = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const extractedPhones = Array.from(new Set(fullCleanText.match(phoneRegex) || []))
      .filter(num => num.replace(/\D/g, "").length >= 7); // Filter out false positives that are too short

    // URLs/Links
    const urlRegex = /https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+/g;
    const extractedUrls = Array.from(new Set(fullCleanText.match(urlRegex) || []));

    // ─── Text Statistics ───
    const characterCountWithSpaces = fullCleanText.length;
    const characterCountNoSpaces = fullCleanText.replace(/\s/g, "").length;
    
    const wordsArray = fullCleanText.trim().split(/\s+/).filter(Boolean);
    const wordCount = wordsArray.length;

    // Estimate sentences by punctuation split
    const sentenceCount = fullCleanText.split(/[.!?]+(?:[ \t\r\n]|$)/g).filter(s => s.trim().length > 0).length;

    // Estimate reading & speaking times
    const readingTimeMin = Math.ceil(wordCount / 200); // 200 words per minute
    const speakingTimeMin = Math.ceil(wordCount / 130); // 130 words per minute

    // ─── Keyword Extraction ───
    const wordFreq = {};
    const wordCloudRegex = /[a-zA-Z'-]{4,}/g; // words of 4+ characters
    const matchedWords = fullCleanText.toLowerCase().match(wordCloudRegex) || [];
    
    matchedWords.forEach((word) => {
      if (!STOP_WORDS.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    const keywords = Object.entries(wordFreq)
      .map(([text, value]) => ({ text, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 30); // Top 30 keywords

    res.json({
      success: true,
      filename: req.file.originalname,
      fileSize: req.file.size,
      numPages: pages.length || data.numpages || 1,
      pages: pages.map((pageText, idx) => ({
        pageNumber: idx + 1,
        text: pageText.trim()
      })),
      stats: {
        characterCountWithSpaces,
        characterCountNoSpaces,
        wordCount,
        sentenceCount,
        readingTimeMin,
        speakingTimeMin,
      },
      extracted: {
        emails: extractedEmails,
        phones: extractedPhones,
        urls: extractedUrls,
      },
      keywords,
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

