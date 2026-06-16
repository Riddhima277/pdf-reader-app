import { useState, useRef, useCallback, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import axios from "axios";

// Point PDF.js worker to CDN so it works in both dev and production
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const AUTHOR = { name: "Riddhima Gupta", email: "guptariddhima75@gmail.com" };

/* ─── Utility: format bytes ─── */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/* ─── PDF Canvas Renderer ─── */
function PdfViewer({ file }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef(null);

  // Load PDF from File object
  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      const typedArray = new Uint8Array(e.target.result);
      const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      setCurrentPage(1);
    };
    reader.readAsArrayBuffer(file);
  }, [file]);

  // Render page whenever pdfDoc or currentPage changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    const render = async () => {
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      } catch (err) {
        console.error("Render error:", err);
      }
      if (!cancelled) setRendering(false);
    };

    render();
    return () => { cancelled = true; };
  }, [pdfDoc, currentPage]);

  if (!pdfDoc) return <div style={{ padding: "2rem", color: "var(--text-muted)", textAlign: "center" }}>Loading viewer…</div>;

  return (
    <div>
      {/* Controls */}
      <div className="page-controls" style={{ marginBottom: "1rem" }}>
        <button
          id="prev-page-btn"
          className="ctrl-btn"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1 || rendering}
        >
          ← Prev
        </button>
        <span className="page-indicator">
          {currentPage} / {totalPages}
        </span>
        <button
          id="next-page-btn"
          className="ctrl-btn"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages || rendering}
        >
          Next →
        </button>
      </div>

      {/* Canvas */}
      <div className="pdf-canvas-container">
        <div className="pdf-page-wrapper">
          <canvas ref={canvasRef} />
          <span className="page-label">Page {currentPage}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Main App ─── */
export default function App() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [activeTab, setActiveTab] = useState("viewer");
  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.type !== "application/pdf") {
      setError("Please upload a valid PDF file.");
      return;
    }

    setFile(selectedFile);
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("pdf", selectedFile);

      const response = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(response.data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to process PDF. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      const dropped = e.dataTransfer.files[0];
      if (dropped) handleFile(dropped);
    },
    [handleFile]
  );

  const reset = () => {
    setFile(null);
    setResult(null);
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="app-wrapper">
      {/* ── Header ── */}
      <header>
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">📄</div>
            <span className="logo-text">PDFReader</span>
          </div>
          <div className="header-badge">
            <div className="badge-author">
              <span>{AUTHOR.name}</span>
              <a href={`mailto:${AUTHOR.email}`} style={{ color: "var(--accent-purple)", fontSize: "0.75rem" }}>
                {AUTHOR.email}
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="hero">
        <div className="hero-eyebrow">Free Online Tool</div>
        <h1>
          Read Any PDF <br />
          <span className="gradient-text">Instantly & Beautifully</span>
        </h1>
        <p>
          Upload any PDF file and instantly view every page, extract all text,
          and get detailed document insights — no sign-up required.
        </p>
      </section>

      {/* ── Main ── */}
      <main>
        {/* Upload zone */}
        {!file && !loading && (
          <div
            id="upload-zone"
            className={`upload-zone ${dragOver ? "drag-over" : ""}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <span className="upload-icon">📂</span>
            <h2>Drop your PDF here</h2>
            <p>or click to browse from your device</p>
            <button id="browse-btn" className="upload-btn" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}>
              📎 Choose PDF File
            </button>
            <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              Supports files up to 20 MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              style={{ display: "none" }}
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="error-box" style={{ marginBottom: "1.5rem" }}>
            <span style={{ fontSize: "1.4rem" }}>⚠️</span>
            <div>
              <strong>Error:</strong> {error}
              <br />
              <button className="reset-btn" style={{ marginTop: "0.5rem" }} onClick={reset}>Try Again</button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>Reading your PDF… extracting text & metadata</p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="result-panel">
            {/* Stats */}
            <div className="file-info">
              <div className="card-header">
                <span className="card-title"><span className="icon">📊</span> Document Info</span>
                <button id="new-file-btn" className="reset-btn" onClick={reset}>+ New File</button>
              </div>
              <div className="info-grid">
                <div className="info-item">
                  <div className="info-label">File Name</div>
                  <div className="info-value" style={{ fontSize: "0.9rem", wordBreak: "break-all" }}>{result.filename}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">File Size</div>
                  <div className="info-value">{formatBytes(result.fileSize)}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Total Pages</div>
                  <div className="info-value" style={{ color: "var(--accent-purple)" }}>{result.numPages}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Characters</div>
                  <div className="info-value">{result.text?.length?.toLocaleString() || 0}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Words</div>
                  <div className="info-value">{result.text?.trim().split(/\s+/).filter(Boolean).length?.toLocaleString() || 0}</div>
                </div>
                <div className="info-item">
                  <div className="info-label">Author</div>
                  <div className="info-value" style={{ fontSize: "0.85rem" }}>
                    {result.info?.Author || result.info?.Creator || "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* PDF Viewer */}
            <div className="viewer-card">
              <div className="card-header">
                <span className="card-title"><span className="icon">👁️</span> PDF Viewer</span>
              </div>
              <div className="card-body">
                <PdfViewer file={file} />
              </div>
            </div>

            {/* Tabs: Extracted Text */}
            <div className="text-card">
              <div className="card-header">
                <span className="card-title"><span className="icon">📝</span> Extracted Text</span>
                <span style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                  {result.text?.trim().split(/\s+/).filter(Boolean).length?.toLocaleString()} words
                </span>
              </div>
              <div className="card-body">
                {result.text?.trim() ? (
                  <pre className="extracted-text">{result.text}</pre>
                ) : (
                  <p style={{ color: "var(--text-muted)", textAlign: "center", padding: "2rem" }}>
                    No extractable text found — this PDF may be image-based or scanned.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer>
        <div className="footer-inner">
          <a
            id="digital-heroes-btn"
            href="https://digitalheroes.co"
            target="_blank"
            rel="noopener noreferrer"
            className="dh-btn"
          >
            🦸 Built for Digital Heroes
            <span className="arrow">→</span>
          </a>

          <div className="footer-credits">
            <p>
              Built by <strong style={{ color: "var(--text-primary)" }}>{AUTHOR.name}</strong>{" "}
              &nbsp;·&nbsp;{" "}
              <a href={`mailto:${AUTHOR.email}`}>{AUTHOR.email}</a>
            </p>
            <p style={{ marginTop: "0.4rem" }}>
              Powered by <strong>Express.js</strong> + <strong>React</strong> · Deployed on <strong>Vercel</strong>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
