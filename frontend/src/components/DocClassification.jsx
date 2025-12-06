import React, { useState } from "react";
import api, { authHeader } from "../api";
import { useAuth } from "./AuthContext";

const DocClassification = () => {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [rawTextPreview, setRawTextPreview] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileSelect = (fileObj) => {
    setFile(fileObj || null);
    setAnalysis(null);
    setRawTextPreview("");
    setError("");
  };

  const handleInputChange = (e) => {
    handleFileSelect(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setAnalysis(null);
    setRawTextPreview("");

    if (!file) {
      setError("Please select or drop a document.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await api.post("/doc-classify/analyze", formData, {
        ...authHeader(token),
        headers: {
          ...authHeader(token).headers,
          "Content-Type": "multipart/form-data"
        }
      });

      setAnalysis(res.data);

      if (file.type === "text/plain") {
        const reader = new FileReader();
        reader.onload = (ev) => {
          setRawTextPreview(ev.target.result.toString().slice(0, 4000));
        };
        reader.readAsText(file);
      } else {
        setRawTextPreview(
          "Text-based preview is limited for PDFs in this demo. Classification, tags, and extractions are based on the full document."
        );
      }
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.detail || "Failed to analyze document. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const highlightPreview = () => {
    if (!rawTextPreview || !analysis?.highlight_phrases?.length) {
      return rawTextPreview;
    }

    let text = rawTextPreview;
    const phrases = [...analysis.highlight_phrases].sort(
      (a, b) => b.length - a.length
    );

    phrases.forEach((phrase, idx) => {
      if (!phrase) return;
      const safePhrase = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(safePhrase, "gi");
      text = text.replace(
        re,
        (match) => `<<<H${idx}>>>${match}<<<ENDH${idx}>>>`
      );
    });

    const parts = text.split(/(<<<H\d+>>>|<<<ENDH\d+>>>)/g);
    const spans = [];
    let highlightOn = false;
    let highlightIndex = 0;

    parts.forEach((part) => {
      if (part.startsWith("<<<H")) {
        highlightOn = true;
        const num = part.match(/\d+/)?.[0];
        highlightIndex = Number(num || 0);
        return;
      }
      if (part.startsWith("<<<ENDH")) {
        highlightOn = false;
        return;
      }
      if (!part) return;
      if (highlightOn) {
        spans.push(
          <span key={`${highlightIndex}-${spans.length}`} className="highlight-chip">
            {part}
          </span>
        );
      } else {
        spans.push(<span key={`plain-${spans.length}`}>{part}</span>);
      }
    });

    return spans;
  };

  const confidencePercent = (analysis?.confidence || 0) * 100;

  return (
    <div className="tool-container">
      <div className="tool-header">
        <h1>Document Intelligence Hub</h1>
        <p>
          Spotlight module for automatic classification, field extraction, fraud
          insights, and smart routing — designed for insurance workflows.
        </p>
      </div>

      <form className="tool-form glass-form" onSubmit={handleSubmit}>
        <div
          className={`dropzone premium ${dragActive ? "active" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p className="dropzone-title">
            {file ? file.name : "Drag & drop a PDF or text file here"}
          </p>
          <p className="dropzone-subtitle">
            Or click to browse. The system will classify the document, extract
            key fields, and flag potential issues.
          </p>
          <input type="file" accept=".pdf,.txt" onChange={handleInputChange} />
        </div>

        {error && <div className="alert error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? "Analyzing..." : "Analyze Document"}
        </button>
      </form>

      {analysis && (
        <div className="spotlight-grid">
          <div className="glass-card">
            <div className="result-header">
              <div>
                <h2>{analysis.doc_type}</h2>
                <p className="muted">
                  AI-predicted document type for this upload.
                </p>
              </div>
              <div className="confidence-circle">
                <span>{Math.round(confidencePercent)}%</span>
                <p>Confidence</p>
              </div>
            </div>

            <div className="engine-breakdown">
              <h3>How the AI decided</h3>
              <div className="engine-bars">
                {["keyword_engine", "semantic_engine", "layout_engine"].map(
                  (key) => (
                    <div className="engine-row" key={key}>
                      <span className="engine-label">
                        {key === "keyword_engine"
                          ? "Keyword Engine"
                          : key === "semantic_engine"
                          ? "Semantic Model"
                          : "Layout Heuristics"}
                      </span>
                      <div className="engine-bar-track">
                        <div
                          className="engine-bar-fill"
                          style={{
                            width: `${
                              (analysis.engine_breakdown?.[key] || 0) * 100
                            }%`
                          }}
                        />
                      </div>
                      <span className="engine-value">
                        {Math.round(
                          (analysis.engine_breakdown?.[key] || 0) * 100
                        )}
                        %
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            <div className="tags-section">
              <h3>Smart tags</h3>
              <div className="tag-row">
                {analysis.tags?.map((t) => (
                  <span key={t} className="tag-pill">
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="quality-section">
              <h3>Document quality</h3>
              <p className="muted small">
                Indicates how readable and complete the document appears for AI
                processing.
              </p>
              <div className="quality-bar">
                <div
                  className="quality-fill"
                  style={{ width: `${analysis.quality_score}%` }}
                />
              </div>
              <p className="quality-score">
                {Math.round(analysis.quality_score)} / 100
              </p>
            </div>

            <div className="pages-section">
              <h3>Page map</h3>
              <div className="page-chip-row">
                {analysis.page_map?.map((p) => (
                  <div key={p.page_number} className="page-chip">
                    <span className="page-index">Page {p.page_number}</span>
                    <span className="page-type">{p.doc_type}</span>
                    <span className="page-conf">
                      {Math.round(p.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="right-column">
            <div className="glass-card">
              <h3>Extracted fields</h3>
              <p className="muted small">
                Key business fields automatically parsed from the document.
              </p>
              <div className="field-list">
                {analysis.extracted_fields?.map((f, idx) => (
                  <div key={idx} className="field-row">
                    <span className="field-name">{f.name}</span>
                    <span className="field-value">
                      {f.value || <span className="placeholder">Not found</span>}
                    </span>
                    <span className="field-conf">
                      {Math.round(f.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card">
              <h3>Fraud & anomalies</h3>
              {analysis.fraud_signals?.length ? (
                <ul className="fraud-list">
                  {analysis.fraud_signals.map((s, idx) => (
                    <li key={idx} className={`fraud-item fraud-${s.severity}`}>
                      <div className="fraud-label">
                        {s.severity === "high" ? "⚠" : "!"} {s.label}
                      </div>
                      <p className="fraud-desc">{s.description}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="muted small">No obvious fraud indicators found.</p>
              )}
            </div>

            <div className="glass-card">
              <h3>Similar documents (same tenant)</h3>
              {analysis.similar_docs?.length ? (
                <div className="similar-docs">
                  {analysis.similar_docs.map((d) => (
                    <div key={d.id} className="similar-row">
                      <div>
                        <p className="similar-name">{d.filename}</p>
                        <p className="similar-meta">
                          {d.doc_type} ·{" "}
                          {Math.round(d.similarity * 100)}% overlap
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted small">
                  This is the first document of this type for this tenant, so
                  there are no close historical matches yet.
                </p>
              )}
            </div>

            <div className="glass-card preview-card">
              <h3>Text preview & highlights</h3>
              <p className="muted small">
                Highlighted phrases show where the AI latched on for
                classification and extraction.
              </p>
              <div className="preview-box">
                {rawTextPreview ? (
                  <p>{highlightPreview()}</p>
                ) : (
                  <p className="muted small">
                    Raw text preview is limited for non-text uploads, but the AI
                    operates on full extracted text behind the scenes.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocClassification;
