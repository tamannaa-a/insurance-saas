import React, { useState } from "react";
import api, { authHeader } from "../api";
import { useAuth } from "./AuthContext";

const FraudDetection = () => {
  const { token } = useAuth();
  const [form, setForm] = useState({
    claim_id: "",
    amount: "",
    description: "",
    is_third_party: false,
    previous_claims_count: 0
  });

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!form.claim_id || !form.amount || !form.description) {
      setError("Please fill in claim ID, amount and description.");
      return;
    }

    const payload = {
      claim_id: form.claim_id,
      amount: parseFloat(form.amount),
      description: form.description,
      is_third_party: form.is_third_party,
      previous_claims_count: parseInt(form.previous_claims_count || 0, 10)
    };

    try {
      setLoading(true);
      const res = await api.post(
        "/fraud-detection/score",
        payload,
        authHeader(token)
      );
      setResult(res.data);
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
          "Failed to score the claim for fraud risk."
      );
    } finally {
      setLoading(false);
    }
  };

  const getRiskClass = (level) => {
    if (level === "High") return "risk-high";
    if (level === "Medium") return "risk-medium";
    return "risk-low";
  };

  return (
    <div className="tool-container">
      <div className="tool-header">
        <h1>Fraud Detection Copilot</h1>
        <p>
          Analyze claims for potential fraud using rules / ML outputs. View
          risk as High, Medium, or Low with explanations.
        </p>
      </div>

      <form className="tool-form" onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Claim ID</label>
            <input
              name="claim_id"
              value={form.claim_id}
              onChange={handleChange}
              placeholder="CLAIM-12345"
              required
            />
          </div>
          <div className="form-group">
            <label>Claim Amount</label>
            <input
              name="amount"
              type="number"
              min="0"
              value={form.amount}
              onChange={handleChange}
              placeholder="500000"
              required
            />
          </div>
        </div>

        <div className="form-group">
          <label>Claim Description</label>
          <textarea
            name="description"
            rows={4}
            value={form.description}
            onChange={handleChange}
            placeholder="Describe the incident, damage, and circumstances..."
            required
          />
        </div>

        <div className="form-row">
          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                name="is_third_party"
                checked={form.is_third_party}
                onChange={handleChange}
              />
              Third-party claim
            </label>
          </div>

          <div className="form-group">
            <label>Number of Previous Claims</label>
            <input
              name="previous_claims_count"
              type="number"
              min="0"
              value={form.previous_claims_count}
              onChange={handleChange}
              placeholder="0"
            />
          </div>
        </div>

        {error && <div className="alert error">{error}</div>}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? "Scoring..." : "Score Fraud Risk"}
        </button>
      </form>

      {result && (
        <div className="result-card">
          <div className="result-header">
            <h2>Fraud Risk for {result.claim_id}</h2>
            <span className={`badge ${getRiskClass(result.risk_level)}`}>
              {result.risk_level} Risk · {Math.round(result.score)} / 100
            </span>
          </div>
          <ul className="reason-list">
            {result.reasons.map((r, idx) => (
              <li key={idx}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FraudDetection;
