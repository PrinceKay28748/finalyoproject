// frontend/src/components/Auth/ForgotPasswordPage.jsx
// Forgot Password Page — Request password reset email (Backend proxy version)

import { useState } from "react";
import { API_URL } from "../../config";
import "./AuthPage.css";

export default function ForgotPasswordPage({ onBackToLogin }) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      // Backend always returns success message (rate limiting handled internally)
      if (response.ok) {
        setSuccess(true);
      } else {
        setError(data.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("[ForgotPassword] Error:", err);
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container-split">
      {/* Left side — Hero / Brand */}
      <div className="auth-hero">
        <div className="auth-hero-bg">UG</div>
        <img src="/icon-512.png" alt="UG Navigator" width={80} height={80} />
        <h1>
          Forgot
          <br />
          Password?
        </h1>
        <p>Don't worry — we'll send you a link to reset it.</p>
      </div>

      {/* Right side — Forgot Password Form */}
      <div className="auth-form-panel">
        <div className="auth-form-header">
          <h2>Reset your password</h2>
          <p>Enter your email address and we'll send you a reset link</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ERROR DISPLAY */}
          {error && (
            <div className="auth-error-split" role="alert">
              <span className="error-message">{error}</span>
            </div>
          )}

          {/* SUCCESS DISPLAY */}
          {success && (
            <div className="auth-success-split" role="alert">
              <span className="success-icon">✓</span>
              <div className="success-content">
                <span className="success-message">
                  Password reset email sent!
                </span>
                <span className="success-detail">
                  Check your inbox (and spam folder) for the reset link.
                </span>
              </div>
            </div>
          )}

          <div className="form-group-split">
            <input
              id="email"
              type="email"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || success}
              required
              autoComplete="email"
            />
            <label htmlFor="email">Email address</label>
          </div>

          <button
            type="submit"
            className="auth-button-split"
            disabled={isLoading || success}
          >
            {isLoading ? (
              <>
                <span className="button-spinner-split" />
                Sending...
              </>
            ) : (
              "Send reset link →"
            )}
          </button>
        </form>

        <button
          type="button"
          className="auth-secondary-split"
          onClick={onBackToLogin}
          disabled={isLoading}
        >
          ← Back to login
        </button>
      </div>
    </div>
  );
}