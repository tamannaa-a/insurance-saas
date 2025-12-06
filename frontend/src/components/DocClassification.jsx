import React, { useState } from "react";
import api, { authHeader } from "../api";
import { useAuth } from "./AuthContext";

const DocClassification = () => {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (fileObj) => {
    setFile(fileObj || null);
    setResult(null);
    setError("");
  };

  const handleInputChange = (e) => {
    handleFileChange(e.target.files[0]);
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
      handleFileChange(droppedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!file) {
      setError("Please select or drop a document.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await api.post("/doc-classify/classify", formData, {
        ...authHeader(token),
        headers: {
          ...authHeader(token).headers,
          "Content-Type": "multipart/form-data"
        }
      });
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.detail || "Failed to classify document type."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tool-container">
      <div className="tool-header">
        <h1>Document Classification Agent</h1>
        <p>
          Drag &amp; drop insurance documents (claim forms, inspection reports,
          invoices, etc.) to auto-classify them by type.
        </p>
      </div>

      <form className="tool-form" onSubmit={handleSubmit}>
        <div
          className={`dropzone ${dragActive ? "active" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <p>
            {file
              ? `Selected: ${file.name}`
              : "Drag & drop a PDF or text file here, or click to browse"}
          </p>
          <input type="file" accept=".pdf,.txt" onChange={handleInputChange} />
        </div>

        {error && <div className="alert error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? "Classifying..." : "Classify Document"}
        </button>
      </form>

      {result && (
        <div className="result-card">
          <div className="result-header">
            <h2>Classification Result</h2>
            <span className="badge">
              {result.doc_type} · {Math.round(result.confidence * 100)}% confident
            </span>
          </div>
          {result.keywords_matched?.length > 0 ? (
            <p className="result-text">
              Matched keywords: {result.keywords_matched.join(", ")}
            </p>
          ) : (
            <p className="result-text">No specific keywords matched.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default DocClassification;
