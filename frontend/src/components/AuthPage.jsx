import React, { useState } from "react";
import api from "../api";
import { useAuth } from "./AuthContext";

const AuthPage = () => {
  const { login } = useAuth();
  const [isLoginMode, setIsLoginMode] = useState(true);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    tenant_name: ""
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleChange = (e) => {
    setForm((prev) => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const toggleMode = () => {
    setError("");
    setSuccessMsg("");
    setIsLoginMode((prev) => !prev);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");
    setLoading(true);

    try {
      if (isLoginMode) {
        await login(form.email, form.password);
      } else {
        // Register then auto-login
        await api.post("/auth/register", {
          full_name: form.full_name,
          email: form.email,
          password: form.password,
          tenant_name: form.tenant_name
        });
        setSuccessMsg("Registration successful. Logging you in...");
        await login(form.email, form.password);
      }
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.detail ||
          "Something went wrong. Please check your inputs."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Insurance Intelligence Portal</h1>
          <p>Multi-tenant AI tools for modern insurers</p>
        </div>

        <div className="auth-toggle">
          <button
            type="button"
            className={isLoginMode ? "active" : ""}
            onClick={() => setIsLoginMode(true)}
          >
            Login
          </button>
          <button
            type="button"
            className={!isLoginMode ? "active" : ""}
            onClick={() => setIsLoginMode(false)}
          >
            Sign Up
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLoginMode && (
            <>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  name="full_name"
                  value={form.full_name}
                  onChange={handleChange}
                  placeholder="John Doe"
                  required
                />
              </div>

              <div className="form-group">
                <label>Tenant / Company Name</label>
                <input
                  name="tenant_name"
                  value={form.tenant_name}
                  onChange={handleChange}
                  placeholder="Acme Insurance"
                  required
                />
                <small>
                  Use the same tenant name for everyone in the same company.
                </small>
              </div>
            </>
          )}

          <div className="form-group">
            <label>Email</label>
            <input
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@company.com"
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          {error && <div className="alert error">{error}</div>}
          {successMsg && <div className="alert success">{successMsg}</div>}

          <button type="submit" className="primary-btn" disabled={loading}>
            {loading
              ? "Please wait..."
              : isLoginMode
              ? "Login"
              : "Create Account"}
          </button>
        </form>

        <p className="auth-footer-text">
          {isLoginMode ? "New here?" : "Already have an account?"}{" "}
          <button className="link-btn" onClick={toggleMode} type="button">
            {isLoginMode ? "Create an account" : "Back to login"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
