// frontend/src/components/Auth/LoginPage.jsx
// Bold & Minimal — Swiss Design for UG Navigator

import { useState } from "react";
import { useAuthContext } from "../../context/AuthContext";
import "./AuthPage.css";

export default function LoginPage({ onSwitchToRegister, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuthContext();

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (!result.success) {
        setError(result.error || "Login failed");
      }
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Get time of day for greeting
  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  };

  return (
    <div className="auth-container-split">
      {/* Left side — Hero / Brand */}
      <div className="auth-hero">
        <div className="auth-hero-bg">UG</div>
        <img src="/icon-512.png" alt="UG Navigator" width={80} height={80} />
        <h1>
          Navigate
          <br />
          Legon.
        </h1>
        <p>
          Context-aware routing for University of Ghana — accessible, safe, and
          fast.
        </p>
      </div>

      {/* Right side — Login Form */}
      <div className="auth-form-panel">
        <div className="auth-form-header">
          <h2>Good {getTimeOfDay()},</h2>
          <p>Sign in to continue your journey</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* ERROR DISPLAY */}
          {error && (
            <div className="auth-error-split" role="alert">
              <span className="error-icon">⚠️</span>
              <span className="error-message">{error}</span>
            </div>
          )}

          <div className="form-group-split">
            <input
              id="email"
              type="email"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="email"
            />
            <label htmlFor="email">Email address</label>
          </div>

          <div className="form-group-split">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              autoComplete="current-password"
            />
            <label htmlFor="password">Password</label>
            <button
              type="button"
              className="password-toggle-split"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {/* Forgot Password Link */}
          <div className="forgot-password-link">
            <button
              type="button"
              onClick={onForgotPassword}
              className="forgot-password-btn"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            className="auth-button-split"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <span className="button-spinner-split" />
                Signing in...
              </>
            ) : (
              "Sign in →"
            )}
          </button>
        </form>

        <button
          type="button"
          className="auth-secondary-split"
          onClick={onSwitchToRegister}
          disabled={isLoading}
        >
          Create an account
        </button>
      </div>
    </div>
  );
}