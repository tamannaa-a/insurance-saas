import React, { useState } from "react";
import api, { authHeader } from "../api";
import { useAuth } from "./AuthContext";

const PolicySummary = () => {
  const { token } = useAuth();
  const [file, setFile] = useState(null);
  const [summary, setSummary] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    setFile(e.target.files[0] || null);
    setSummary("");
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSummary("");

    if (!file) {
      setError("Please select a policy document (PDF or text).");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      const res = await api.post("/policy-summary/summarize", formData, {
        ...authHeader(token),
        headers: {
          ...authHeader(token).headers,
          "Content-Type": "multipart/form-data"
        }
      });
      setSummary(res.data.summary);
      setWordCount(res.data.word_count);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.detail || "Failed to summarize policy document."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tool-container">
      <div className="tool-header">
        <h1>Policy Summary Assistant</h1>
        <p>
          Upload a lengthy insurance policy and get a concise, plain-language
          summary of coverage, exclusions, and limits.
        </p>
      </div>

      <form className="tool-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Policy Document (PDF or text)</label>
          <input type="file" accept=".pdf,.txt" onChange={handleFileChange} />
        </div>

        {error && <div className="alert error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? "Summarizing..." : "Generate Summary"}
        </button>
      </form>

      {summary && (
        <div className="result-card">
          <div className="result-header">
            <h2>Summary</h2>
            <span className="badge">~{wordCount} words</span>
          </div>
          <p className="result-text">{summary}</p>
        </div>
      )}
    </div>
  );
};

export default PolicySummary;
