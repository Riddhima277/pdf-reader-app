import { useState, useRef, useCallback, useEffect } from "react";
import * as pdfjsLib from "pdfjs-dist";
import axios from "axios";
import { 
  FileText, Upload, AlertCircle, Play, Pause, Square, 
  Volume2, Search, Mail, Phone, Link2, Copy, Check, 
  Download, BarChart2, BookOpen, Clock, FileKey, 
  RefreshCw, ChevronLeft, ChevronRight, Hash, Compass,
  Layers, Info, FileSpreadsheet
} from "lucide-react";

// Point PDF.js worker to CDN so it works in both dev and production
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

const AUTHOR = { name: "Riddhima Gupta", email: "guptariddhima75@gmail.com" };

/* ─── Utility: format bytes ─── */
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}

/* ─── PDF Canvas Renderer (Synchronized) ─── */
function PdfViewer({ file, currentPage, setCurrentPage, totalPages, setTotalPages }) {
  const [pdfDoc, setPdfDoc] = useState(null);
  const [rendering, setRendering] = useState(false);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Load PDF from File object
  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        setPdfDoc(pdf);
        setTotalPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err) {
        console.error("PDF loading error:", err);
      }
    };
    reader.readAsArrayBuffer(file);
  }, [file, setTotalPages, setCurrentPage]);

  // Render page whenever pdfDoc or currentPage changes
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;
    let cancelled = false;

    const render = async () => {
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(currentPage);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        
        const context = canvas.getContext("2d");
        
        // Calculate viewport scale based on parent container width
        const parentWidth = canvas.parentElement.clientWidth || 550;
        const originalViewport = page.getViewport({ scale: 1.0 });
        const scale = (parentWidth - 30) / originalViewport.width;
        const viewport = page.getViewport({ scale: Math.min(scale, 1.4) });

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Cancel running render task if any
        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        
        await renderTask.promise;
      } catch (err) {
        if (err.name !== "RenderingCancelledException") {
          console.error("Canvas render error:", err);
        }
      }
      if (!cancelled) setRendering(false);
    };

    render();
    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, currentPage]);

  if (!pdfDoc) {
    return (
      <div className="empty-reader">
        <div className="spinner-ring" />
        <p style={{ marginTop: "1rem" }}>Initializing visual renderer...</p>
      </div>
    );
  }

  return (
    <div className="canvas-viewer-wrapper">
      <div className="viewer-controls">
        <button
          className="pager-btn"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage === 1 || rendering}
          title="Previous Page"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="pager-label">
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="pager-btn"
          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages || rendering}
          title="Next Page"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="canvas-viewport">
        <div className="canvas-container-box">
          <canvas ref={canvasRef} />
          <span className="page-tag">Page {currentPage}</span>
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
  
  // Synced PDF reader page state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Speech State (Web Speech API)
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [speechRate, setSpeechRate] = useState(1.0);
  const speechUtteranceRef = useRef(null);

  // Clipboard Copied State
  const [copiedText, setCopiedText] = useState("");

  const fileInputRef = useRef(null);

  const handleFile = useCallback(async (selectedFile) => {
    if (!selectedFile) return;
    if (selectedFile.type !== "application/pdf") {
      setError("Please upload a valid PDF file. The application only accepts standard PDF documents.");
      return;
    }

    setFile(selectedFile);
    setError("");
    setResult(null);
    setLoading(true);
    setCurrentPage(1);
    setTotalPages(0);
    setSearchQuery("");
    
    // Reset Speech
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);

    try {
      const formData = new FormData();
      formData.append("pdf", selectedFile);

      const response = await axios.post("/api/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setResult(response.data);
      if (response.data.numPages) {
        setTotalPages(response.data.numPages);
      }
    } catch (err) {
      setError(err.response?.data?.error || "Failed to parse PDF document. The server encountered an issue.");
      setFile(null);
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
    window.speechSynthesis.cancel();
    setFile(null);
    setResult(null);
    setError("");
    setCurrentPage(1);
    setTotalPages(0);
    setSearchQuery("");
    setIsSpeaking(false);
    setIsPaused(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ─── Web Speech Synthesis Controls ───
  const speakPageText = () => {
    if (!result || !result.pages || result.pages.length === 0) return;

    if (isSpeaking) {
      if (isPaused) {
        window.speechSynthesis.resume();
        setIsPaused(false);
      } else {
        window.speechSynthesis.pause();
        setIsPaused(true);
      }
      return;
    }

    window.speechSynthesis.cancel();

    const pageText = result.pages[currentPage - 1]?.text;
    if (!pageText || pageText.trim() === "") {
      const alertUtterance = new SpeechSynthesisUtterance("This page does not contain readable text.");
      window.speechSynthesis.speak(alertUtterance);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(pageText);
    utterance.rate = speechRate;
    
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };
    
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    speechUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  // Sync speech state changes on slider change
  useEffect(() => {
    if (isSpeaking && speechUtteranceRef.current) {
      // Need to restart speaking to apply rate changes smoothly
      const wasPaused = isPaused;
      window.speechSynthesis.cancel();
      
      const pageText = result?.pages[currentPage - 1]?.text;
      if (pageText) {
        const utterance = new SpeechSynthesisUtterance(pageText);
        utterance.rate = speechRate;
        utterance.onstart = () => {
          setIsSpeaking(true);
          setIsPaused(wasPaused);
          if (wasPaused) {
            window.speechSynthesis.pause();
          }
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          setIsPaused(false);
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          setIsPaused(false);
        };
        speechUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, [speechRate]);

  // Stop speaking on tab change, file reset, or page swap
  useEffect(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, [activeTab, currentPage]);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // ─── Search Highlight Renderer ───
  const renderHighlightedText = (text, query) => {
    if (!query || query.trim() === "") return <p>{text}</p>;
    
    const escapedQuery = query.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`(${escapedQuery})`, "gi");
    const parts = text.split(regex);

    return (
      <p>
        {parts.map((part, index) => 
          regex.test(part) ? (
            <mark key={index} className="search-highlight">{part}</mark>
          ) : (
            part
          )
        )}
      </p>
    );
  };

  // Get search matches on the current page
  const getPageSearchMatches = () => {
    if (!result || !searchQuery || searchQuery.trim() === "") return 0;
    const pageText = result.pages[currentPage - 1]?.text || "";
    const escapedQuery = searchQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(escapedQuery, "gi");
    const matches = pageText.match(regex);
    return matches ? matches.length : 0;
  };

  // ─── Clipboard Copy Actions ───
  const copyValue = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(""), 2000);
  };

  // ─── Export Functions ───
  const downloadTextReport = () => {
    if (!result) return;
    const separator = "=".repeat(60);
    let content = `PDF TEXT REPORT: ${result.filename}\n`;
    content += `Extracted by Antigravity PDF Analyzer\n`;
    content += `Developer: ${AUTHOR.name} (${AUTHOR.email})\n`;
    content += `Date: ${new Date().toLocaleString()}\n`;
    content += `${separator}\n\n`;

    result.pages.forEach((page) => {
      content += `[ PAGE ${page.pageNumber} OF ${result.numPages} ]\n`;
      content += `${page.text}\n\n`;
      content += `${"-".repeat(30)}\n\n`;
    });

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.filename.replace(/\.[^/.]+$/, "")}_text_dump.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadJsonReport = () => {
    if (!result) return;
    const reportData = {
      app: "Antigravity PDF Reader & Analyzer",
      developer: AUTHOR,
      exportedAt: new Date().toISOString(),
      document: {
        filename: result.filename,
        fileSize: result.fileSize,
        totalPages: result.numPages,
        metadata: result.info,
      },
      statistics: result.stats,
      extractions: result.extracted,
      keywords: result.keywords
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${result.filename.replace(/\.[^/.]+$/, "")}_analytics_report.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Helper to get formatted metadata dates
  const formatPdfDate = (dateStr) => {
    if (!dateStr) return "—";
    // Check if it's a standard PDF Date format: D:YYYYMMDDHHmmSS...
    if (dateStr.startsWith("D:")) {
      const year = dateStr.substring(2, 6);
      const month = dateStr.substring(6, 8);
      const day = dateStr.substring(8, 10);
      const hour = dateStr.substring(10, 12);
      const min = dateStr.substring(12, 14);
      if (year && month && day) {
        return `${day}/${month}/${year} ${hour}:${min || "00"}`;
      }
    }
    return dateStr;
  };

  return (
    <div className="app-wrapper">
      {/* ─── Header ─── */}
      <header>
        <div className="header-inner">
          <a href="/" className="logo" onClick={(e) => { e.preventDefault(); reset(); }}>
            <div className="logo-icon">
              <FileText size={20} />
            </div>
            <span className="logo-text">PDF Insight</span>
          </a>

          <div className="header-meta">
            <div className="developer-badge">
              <span className="label">Developer</span>
              <span className="name">{AUTHOR.name}</span>
              <a href={`mailto:${AUTHOR.email}`} className="email">
                {AUTHOR.email}
              </a>
            </div>

            <a
              id="digital-heroes-btn"
              href="https://digitalheroesco.com"
              target="_blank"
              rel="noopener noreferrer"
              className="dh-btn"
              style={{ padding: "10px 22px", fontSize: "0.85rem", boxShadow: "0 4px 14px rgba(124, 58, 237, 0.3)" }}
            >
              Built for Digital Heroes
              <ChevronRight size={14} style={{ marginLeft: "4px" }} />
            </a>
          </div>
        </div>
      </header>

      {/* ─── Hero Banner ─── */}
      <section className="hero">
        <div className="hero-eyebrow">Digital Trials 2026</div>
        <h1>
          Extract Every Detail <br />
          <span className="gradient-text">Of Your PDF Documents</span>
        </h1>
        <p>
          Analyze and search pages, listen to spoken audio text-to-speech, and instantly 
          extract key communication details like emails, websites, and phone coordinates.
        </p>
      </section>

      {/* ─── Main Content Container ─── */}
      <main>
        {/* Upload dropzone */}
        {!file && !loading && (
          <div className="upload-container">
            <div
              id="upload-zone"
              className={`upload-zone ${dragOver ? "drag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="upload-zone-content">
                <div className="upload-icon-wrapper">
                  <Upload size={38} />
                </div>
                <h2>Drag & drop your PDF file here</h2>
                <p>or click to browse local files from your computer storage</p>
                <button
                  id="browse-btn"
                  className="upload-btn"
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                >
                  <FileText size={16} />
                  Choose PDF File
                </button>
                <p style={{ marginTop: "1.2rem", fontSize: "0.78rem" }}>
                  Supports documents up to 20 Megabytes (MB)
                </p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                style={{ display: "none" }}
                onChange={(e) => handleFile(e.target.files[0])}
              />
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-box">
            <AlertCircle size={20} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div className="error-details">
              <strong>Processing Failed</strong>
              <p>{error}</p>
              <button onClick={reset}>Clear Error & Try Again</button>
            </div>
          </div>
        )}

        {/* Loading/Parsing State */}
        {loading && (
          <div className="loading-box">
            <div className="spinner-ring" />
            <div style={{ marginTop: "1rem" }}>
              <h3 style={{ fontFamily: "Space Grotesk", fontWeight: 600, fontSize: "1.1rem" }}>
                Parsing PDF Content...
              </h3>
              <p style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "4px" }}>
                Reading raw streams, splitting pages, and mapping contact intelligence.
              </p>
            </div>
          </div>
        )}

        {/* Results Panel */}
        {result && !loading && (
          <div className="dashboard-grid">
            {/* Dashboard Sub-Header */}
            <div className="dashboard-header">
              <div className="dashboard-meta">
                <span className="dashboard-title">{result.filename}</span>
                <span className="meta-size-tag">{formatBytes(result.fileSize)}</span>
              </div>

              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <div className="tabs-nav">
                  <button
                    className={`tab-btn ${activeTab === "viewer" ? "active" : ""}`}
                    onClick={() => setActiveTab("viewer")}
                  >
                    <Layers size={14} />
                    Original PDF
                  </button>
                  <button
                    className={`tab-btn ${activeTab === "reader" ? "active" : ""}`}
                    onClick={() => setActiveTab("reader")}
                  >
                    <BookOpen size={14} />
                    Interactive Reader
                  </button>
                  <button
                    className={`tab-btn ${activeTab === "extraction" ? "active" : ""}`}
                    onClick={() => setActiveTab("extraction")}
                  >
                    <Compass size={14} />
                    Extracted Details
                  </button>
                  <button
                    className={`tab-btn ${activeTab === "insights" ? "active" : ""}`}
                    onClick={() => setActiveTab("insights")}
                  >
                    <BarChart2 size={14} />
                    Text Insights
                  </button>
                </div>

                <button id="new-file-btn" className="btn-secondary" onClick={reset}>
                  <RefreshCw size={14} />
                  New File
                </button>
              </div>
            </div>

            {/* TAB CONTENT: 1. Visual PDF Viewer */}
            {activeTab === "viewer" && (
              <div className="split-layout">
                {/* Left side: Canvas renderer */}
                <div className="panel-card">
                  <div className="card-title-bar">
                    <span className="card-title-text">
                      <Layers size={16} />
                      Rendered Layout
                    </span>
                  </div>
                  <div className="card-body-content">
                    <PdfViewer
                      file={file}
                      currentPage={currentPage}
                      setCurrentPage={setCurrentPage}
                      totalPages={totalPages}
                      setTotalPages={setTotalPages}
                    />
                  </div>
                </div>

                {/* Right side: Structural details */}
                <div className="panel-card">
                  <div className="card-title-bar">
                    <span className="card-title-text">
                      <Info size={16} />
                      Document Statistics
                    </span>
                  </div>
                  <div className="card-body-content">
                    <div className="stats-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      <div className="stat-item">
                        <div className="stat-icon"><BookOpen size={16} /></div>
                        <div className="stat-label">Total Pages</div>
                        <div className="stat-value" style={{ color: "var(--accent-purple)" }}>
                          {result.numPages}
                        </div>
                      </div>
                      <div className="stat-item">
                        <div className="stat-icon"><FileSpreadsheet size={16} /></div>
                        <div className="stat-label">Word Count</div>
                        <div className="stat-value" style={{ color: "var(--accent-pink)" }}>
                          {result.stats.wordCount.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="metadata-list" style={{ marginTop: "1rem" }}>
                      <h4 style={{ fontFamily: "Space Grotesk", fontSize: "0.85rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: "8px" }}>
                        Format Metadata
                      </h4>
                      <div className="metadata-row">
                        <span className="meta-key">PDF Version</span>
                        <span className="meta-val">{result.info?.PDFFormatVersion || "1.4"}</span>
                      </div>
                      <div className="metadata-row">
                        <span className="meta-key">Title</span>
                        <span className="meta-val">{result.info?.Title || result.filename}</span>
                      </div>
                      <div className="metadata-row">
                        <span className="meta-key">Author</span>
                        <span className="meta-val">{result.info?.Author || "—"}</span>
                      </div>
                      <div className="metadata-row">
                        <span className="meta-key">Producer</span>
                        <span className="meta-val">{result.info?.Producer || "—"}</span>
                      </div>
                      <div className="metadata-row">
                        <span className="meta-key">Creation Date</span>
                        <span className="meta-val">{formatPdfDate(result.info?.CreationDate)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 2. Interactive Page Text Reader (with TTS & Search) */}
            {activeTab === "reader" && (
              <div className="panel-card">
                <div className="card-title-bar">
                  <span className="card-title-text">
                    <BookOpen size={16} />
                    Page Text Reader
                  </span>
                  
                  {/* Pager controller synced with PDF */}
                  <div className="page-controls" style={{ gap: "8px" }}>
                    <button
                      className="ctrl-btn"
                      style={{ padding: "4px 10px" }}
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      ← Prev
                    </button>
                    <span className="page-indicator" style={{ minWidth: "80px" }}>
                      Page {currentPage} / {result.numPages}
                    </span>
                    <button
                      className="ctrl-btn"
                      style={{ padding: "4px 10px" }}
                      onClick={() => setCurrentPage(p => Math.min(result.numPages, p + 1))}
                      disabled={currentPage === result.numPages}
                    >
                      Next →
                    </button>
                  </div>
                </div>

                <div className="card-body-content">
                  {/* Controls Header: Speech and Search */}
                  <div className="reader-controls-bar">
                    {/* Speech synthesis controller */}
                    <div className="speech-control-panel">
                      <div className={`speech-status-indicator ${isSpeaking ? "speaking" : ""}`}>
                        <Volume2 size={15} />
                        {isSpeaking ? (isPaused ? "Paused" : "Speaking") : "TTS Audio"}
                      </div>
                      
                      <div className="speech-btn-group">
                        <button 
                          className={`speech-action-btn ${isSpeaking && !isPaused ? "active-play" : ""}`}
                          onClick={speakPageText}
                          title={isSpeaking ? (isPaused ? "Resume Audio" : "Pause Audio") : "Listen to Page Text"}
                        >
                          {isSpeaking && !isPaused ? <Pause size={15} /> : <Play size={15} />}
                        </button>
                        
                        <button 
                          className="speech-action-btn"
                          onClick={stopSpeaking}
                          disabled={!isSpeaking}
                          title="Stop Audio"
                        >
                          <Square size={14} />
                        </button>
                      </div>

                      <div className="speech-speed-slider">
                        <span>Speed</span>
                        <input
                          type="range"
                          min="0.6"
                          max="2.0"
                          step="0.2"
                          value={speechRate}
                          onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                        />
                        <span style={{ minWidth: "25px" }}>{speechRate.toFixed(1)}x</span>
                      </div>
                    </div>

                    {/* Search Field */}
                    <div className="search-control-panel">
                      <div className="search-input-wrapper">
                        <Search size={15} className="search-input-icon" />
                        <input
                          type="text"
                          className="search-input"
                          placeholder="Search keywords on this page..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                          <span className="search-match-count">
                            {getPageSearchMatches()} matches
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Text screen display */}
                  <div className={`text-reader-screen ${isSpeaking && !isPaused ? "speaking-active" : ""}`}>
                    {result.pages[currentPage - 1]?.text ? (
                      renderHighlightedText(result.pages[currentPage - 1].text, searchQuery)
                    ) : (
                      <div className="empty-reader" style={{ height: "200px" }}>
                        <AlertCircle size={24} />
                        <p style={{ marginTop: "8px" }}>No readable text exists on Page {currentPage}.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 3. Extracted Details (Email, Phone, URL grid) */}
            {activeTab === "extraction" && (
              <div className="extraction-grid">
                {/* 1. Emails Card */}
                <div className="panel-card">
                  <div className="card-title-bar">
                    <span className="card-title-text">
                      <Mail size={16} />
                      Extracted Emails ({result.extracted.emails.length})
                    </span>
                  </div>
                  <div className="card-body-content" style={{ padding: 0 }}>
                    {result.extracted.emails.length > 0 ? (
                      <div className="extraction-table-wrapper">
                        <table className="extraction-table">
                          <thead>
                            <tr>
                              <th>Email Address</th>
                              <th className="cell-actions">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.extracted.emails.map((email, idx) => (
                              <tr key={idx}>
                                <td>
                                  <a href={`mailto:${email}`} className="ext-value-link">
                                    {email}
                                  </a>
                                </td>
                                <td className="cell-actions">
                                  <button
                                    className={`mini-copy-btn ${copiedText === email ? "copied" : ""}`}
                                    onClick={() => copyValue(email)}
                                    title="Copy email to clipboard"
                                  >
                                    {copiedText === email ? <Check size={13} /> : <Copy size={13} />}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-extraction-alert">
                        No contact emails were detected in the document stream.
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Phone Numbers Card */}
                <div className="panel-card">
                  <div className="card-title-bar">
                    <span className="card-title-text">
                      <Phone size={16} />
                      Extracted Phones ({result.extracted.phones.length})
                    </span>
                  </div>
                  <div className="card-body-content" style={{ padding: 0 }}>
                    {result.extracted.phones.length > 0 ? (
                      <div className="extraction-table-wrapper">
                        <table className="extraction-table">
                          <thead>
                            <tr>
                              <th>Phone Connection</th>
                              <th className="cell-actions">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.extracted.phones.map((phone, idx) => (
                              <tr key={idx}>
                                <td>
                                  <span className="ext-value-text">{phone}</span>
                                </td>
                                <td className="cell-actions">
                                  <button
                                    className={`mini-copy-btn ${copiedText === phone ? "copied" : ""}`}
                                    onClick={() => copyValue(phone)}
                                    title="Copy phone to clipboard"
                                  >
                                    {copiedText === phone ? <Check size={13} /> : <Copy size={13} />}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-extraction-alert">
                        No phone connection coordinates were detected in the text.
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Links and URLs Card */}
                <div className="panel-card">
                  <div className="card-title-bar">
                    <span className="card-title-text">
                      <Link2 size={16} />
                      Extracted Links/URLs ({result.extracted.urls.length})
                    </span>
                  </div>
                  <div className="card-body-content" style={{ padding: 0 }}>
                    {result.extracted.urls.length > 0 ? (
                      <div className="extraction-table-wrapper">
                        <table className="extraction-table">
                          <thead>
                            <tr>
                              <th>Hyperlink Destination URL</th>
                              <th className="cell-actions">Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {result.extracted.urls.map((url, idx) => (
                              <tr key={idx}>
                                <td>
                                  <a href={url} target="_blank" rel="noopener noreferrer" className="ext-value-link">
                                    {url}
                                  </a>
                                </td>
                                <td className="cell-actions">
                                  <button
                                    className={`mini-copy-btn ${copiedText === url ? "copied" : ""}`}
                                    onClick={() => copyValue(url)}
                                    title="Copy link to clipboard"
                                  >
                                    {copiedText === url ? <Check size={13} /> : <Copy size={13} />}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="empty-extraction-alert">
                        No hyperlinks or URLs were found in the parsed text.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT: 4. Text Insights (Statistics, Word Cloud, Metadata, Export) */}
            {activeTab === "insights" && (
              <div className="insights-layout">
                {/* Left column: Word stats and metadata */}
                <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
                  <div className="panel-card">
                    <div className="card-title-bar">
                      <span className="card-title-text">
                        <BarChart2 size={16} />
                        Readability Statistics
                      </span>
                    </div>
                    <div className="card-body-content">
                      <div className="metadata-list">
                        <div className="metadata-row">
                          <span className="meta-key">Total Words</span>
                          <span className="meta-val">{result.stats.wordCount.toLocaleString()}</span>
                        </div>
                        <div className="metadata-row">
                          <span className="meta-key">Total Sentences</span>
                          <span className="meta-val">{result.stats.sentenceCount.toLocaleString()}</span>
                        </div>
                        <div className="metadata-row">
                          <span className="meta-key">Characters (With spaces)</span>
                          <span className="meta-val">{result.stats.characterCountWithSpaces.toLocaleString()}</span>
                        </div>
                        <div className="metadata-row">
                          <span className="meta-key">Characters (No spaces)</span>
                          <span className="meta-val">{result.stats.characterCountNoSpaces.toLocaleString()}</span>
                        </div>
                        <div className="metadata-row" style={{ color: "var(--accent-cyan)", borderTop: "1px dashed var(--border)", paddingTop: "12px", marginTop: "4px" }}>
                          <span className="meta-key" style={{ color: "var(--accent-cyan)" }}>
                            <Clock size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                            Reading Duration
                          </span>
                          <span className="meta-val" style={{ fontWeight: 700 }}>
                            ~ {result.stats.readingTimeMin} min
                          </span>
                        </div>
                        <div className="metadata-row" style={{ color: "var(--accent-purple)", borderBottom: "none" }}>
                          <span className="meta-key" style={{ color: "var(--accent-purple)" }}>
                            <Volume2 size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                            Speaking Duration
                          </span>
                          <span className="meta-val" style={{ fontWeight: 700 }}>
                            ~ {result.stats.speakingTimeMin} min
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="panel-card">
                    <div className="card-title-bar">
                      <span className="card-title-text">
                        <Download size={16} />
                        Export Formats
                      </span>
                    </div>
                    <div className="card-body-content">
                      <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1rem" }}>
                        Download the full extracted text details or metadata-extraction JSON report locally.
                      </p>
                      <div className="export-actions-list">
                        <button className="btn-export" onClick={downloadTextReport}>
                          <Download size={18} />
                          <span>Download TXT</span>
                        </button>
                        <button className="btn-export" onClick={downloadJsonReport}>
                          <FileKey size={18} />
                          <span>Download JSON</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right column: Word frequency cloud */}
                <div className="panel-card">
                  <div className="card-title-bar">
                    <span className="card-title-text">
                      <Compass size={16} />
                      Keyword Frequency Map
                    </span>
                  </div>
                  <div className="card-body-content cloud-card-body">
                    <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1.2rem" }}>
                      This map highlights key vocabulary terms identified in the PDF content. Sizing indicates relative word frequency count.
                    </p>

                    {result.keywords && result.keywords.length > 0 ? (
                      <div>
                        <div className="word-cloud-container">
                          {result.keywords.map((word, idx) => {
                            const maxVal = Math.max(...result.keywords.map((w) => w.value), 1);
                            const factor = word.value / maxVal;
                            
                            // Size range from 0.85rem to 2.1rem
                            const fontSize = 0.85 + factor * 1.25;
                            
                            // Map frequencies to colors
                            let tagColor = "var(--text-secondary)";
                            if (factor > 0.75) tagColor = "var(--accent-pink)";
                            else if (factor > 0.45) tagColor = "var(--accent-purple)";
                            else if (factor > 0.2) tagColor = "var(--accent-cyan)";

                            return (
                              <span
                                key={idx}
                                className="cloud-tag"
                                style={{
                                  fontSize: `${fontSize}rem`,
                                  color: tagColor,
                                  opacity: 0.6 + factor * 0.4,
                                }}
                                title={`${word.text}: ${word.value} matches`}
                              >
                                {word.text}
                              </span>
                            );
                          })}
                        </div>

                        <div style={{ marginTop: "1.25rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                          <h4 style={{ fontFamily: "Space Grotesk", fontSize: "0.82rem", textTransform: "uppercase", color: "var(--text-muted)", letterSpacing: "0.05em", marginBottom: "8px" }}>
                            Top Keyword Counts
                          </h4>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {result.keywords.slice(0, 8).map((word, idx) => (
                              <span
                                key={idx}
                                style={{
                                  fontSize: "0.78rem",
                                  background: "rgba(255,255,255,0.03)",
                                  border: "1px solid var(--border)",
                                  padding: "4px 10px",
                                  borderRadius: "100px",
                                  color: "var(--text-secondary)"
                                }}
                              >
                                <strong style={{ color: "var(--text-primary)" }}>{word.text}</strong>: {word.value}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="empty-reader" style={{ height: "200px" }}>
                        <AlertCircle size={20} />
                        <p>No suitable keywords could be extracted.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer>
        <div className="footer-inner">
          <a
            id="digital-heroes-btn-footer"
            href="https://digitalheroesco.com"
            target="_blank"
            rel="noopener noreferrer"
            className="dh-btn"
          >
            Built for Digital Heroes
            <ChevronRight size={16} style={{ marginLeft: "4px" }} />
          </a>

          <div className="footer-credits">
            <p>
              Developed by <strong>{AUTHOR.name}</strong> · Reach me at{" "}
              <a href={`mailto:${AUTHOR.email}`}>{AUTHOR.email}</a>
            </p>
            <p style={{ marginTop: "6px", fontSize: "0.78rem" }}>
              React 18 & Express Serverless Engine · Vercel Deployment Stack · ₹0 Spent (Hobby Free Tiers Only)
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

