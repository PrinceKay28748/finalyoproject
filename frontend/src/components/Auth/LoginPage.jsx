// frontend/src/components/Auth/LoginPage.jsx
import { useState } from "react";
import { useAuthContext } from "../../context/AuthContext";
import "./AuthPage.css";

export default function LoginPage({ onSwitchToRegister, onForgotPassword }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuthContext();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await login(email, password);

      if (!result.success) {
        // Error returned — show it, stop spinner
        setError(result.error || "Login failed");
        setIsLoading(false);
      } else {
        // Success — show success state briefly before app re-renders
        setSuccess(true);
        setIsLoading(false);
        // App will automatically re-render to the map via ProtectedRoute
      }
    } catch (err) {
      setError(err.message || "Login failed");
      setIsLoading(false);
    }
  };

  const getTimeOfDay = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  };

  return (
    <div className="auth-container-split">
      {/* Left side — Hero */}
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

      {/* Right side — Form */}
      <div className="auth-form-panel">
        <div className="auth-form-header">
          <h2>Good {getTimeOfDay()},</h2>
          <p>Sign in to continue your journey</p>
        </div>

        {/* SUCCESS STATE */}
        {success && (
          <div className="auth-success-split" role="status">
            <span className="success-icon">✓</span>
            <div className="success-text">
              <strong>Welcome back!</strong>
              <span>Loading your map...</span>
            </div>
            <div className="success-spinner" />
          </div>
        )}

        {/* ERROR MESSAGE */}
        {error && !success && (
          <div className="auth-error-split" role="alert">
            <span className="error-message">{error}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          style={{
            opacity: success ? 0.5 : 1,
            pointerEvents: success ? "none" : "auto",
          }}
        >
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

          <div className="form-group-split">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading || success}
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
            className={`auth-button-split ${isLoading ? "loading" : ""}`}
            disabled={isLoading || success}
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
          disabled={isLoading || success}
        >
          Create an account
        </button>
      </div>
    </div>
  );
}
