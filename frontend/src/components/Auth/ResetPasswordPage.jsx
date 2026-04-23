// frontend/src/components/Auth/ResetPasswordPage.jsx
// Reset Password Page — Enter new password

import { useState, useEffect } from "react";
import "./AuthPage.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export default function ResetPasswordPage({ token, onComplete }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const checkPasswordStrength = (pwd) => {
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (/[a-z]/.test(pwd)) strength++;
    if (/[A-Z]/.test(pwd)) strength++;
    if (/\d/.test(pwd)) strength++;
    setPasswordStrength(strength);
  };

  const handlePasswordChange = (e) => {
    const pwd = e.target.value;
    setPassword(pwd);
    checkPasswordStrength(pwd);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (passwordStrength < 3) {
      setError(
        "Password is too weak. Include uppercase, lowercase, and numbers.",
      );
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to reset password");
      } else {
        setSuccess(true);
        setTimeout(() => {
          onComplete();
        }, 2000);
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];

  return (
    <div className="auth-container-split">
      <div className="auth-hero">
        <div className="auth-hero-bg">UG</div>
        <img src="/icon-512.png" alt="UG Navigator" width={80} height={80} />
        <h1>
          Create new
          <br />
          password
        </h1>
        <p>Choose a strong password for your account.</p>
      </div>

      <div className="auth-form-panel">
        <div className="auth-form-header">
          <h2>New password</h2>
          <p>
            Must be at least 8 characters with uppercase, lowercase, and numbers
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error-split" role="alert">
              <span className="error-message">{error}</span>
            </div>
          )}

          {success && (
            <div className="auth-success-split" role="alert">
              <span className="success-icon">✓</span>
              <span className="success-message">
                Password reset successfully! Redirecting to login...
              </span>
            </div>
          )}

          <div className="form-group-split">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder=" "
              value={password}
              onChange={handlePasswordChange}
              disabled={isLoading}
              required
              autoComplete="new-password"
            />
            <label htmlFor="password">New password</label>
            <button
              type="button"
              className="password-toggle-split"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {password && (
            <div className="password-strength-split">
              <div className="strength-bar-split">
                <div
                  className="strength-fill-split"
                  style={{
                    width: `${(passwordStrength / 4) * 100}%`,
                    backgroundColor:
                      strengthColors[passwordStrength - 1] || "#ef4444",
                  }}
                />
              </div>
              <span className="strength-label-split">
                Password strength:{" "}
                <strong>
                  {strengthLabels[passwordStrength - 1] || "Weak"}
                </strong>
              </span>
            </div>
          )}

          <div className="form-group-split">
            <input
              id="confirmPassword"
              type={showPassword ? "text" : "password"}
              placeholder=" "
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="new-password"
            />
            <label htmlFor="confirmPassword">Confirm password</label>
          </div>

          <button
            type="submit"
            className="auth-button-split"
            disabled={isLoading || passwordStrength < 3}
          >
            {isLoading ? (
              <>
                <span className="button-spinner-split" />
                Resetting...
              </>
            ) : (
              "Reset password →"
            )}
          </button>
        </form>

        <button
          type="button"
          className="auth-secondary-split"
          onClick={onComplete}
          disabled={isLoading}
        >
          ← Back to login
        </button>
      </div>
    </div>
  );
}
