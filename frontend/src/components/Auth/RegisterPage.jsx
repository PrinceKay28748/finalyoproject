// frontend/src/components/Auth/RegisterPage.jsx
import { useState } from "react";
import { useAuthContext } from "../../context/AuthContext";
import "./AuthPage.css";

export default function RegisterPage({ onSwitchToLogin }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);

  const { register } = useAuthContext();

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

    if (passwordStrength < 3) {
      setError(
        "Password is too weak. Include uppercase, lowercase, and numbers."
      );
      return;
    }

    setIsLoading(true);

    try {
      const result = await register(email, username, password);

      if (!result.success) {
        setError(result.error || "Registration failed");
        setIsLoading(false);
      } else {
        // Check if email confirmation is required
        if (result.needsEmailConfirmation) {
          setNeedsEmailConfirmation(true);
        }
        setSuccess(true);
        setIsLoading(false);
      }
    } catch (err) {
      setError(err.message || "Registration failed");
      setIsLoading(false);
    }
  };

  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["#ef4444", "#f97316", "#eab308", "#22c55e"];

  // If email confirmation is needed, show different message
  if (needsEmailConfirmation) {
    return (
      <div className="auth-container-split">
        <div className="auth-hero">
          <div className="auth-hero-bg">UG</div>
          <img src="/icon-512.png" alt="UG Navigator" width={80} height={80} />
          <h1>
            Verify your
            <br />
            email.
          </h1>
          <p>You're almost there!</p>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-header">
            <h2>Check your inbox</h2>
            <p>We sent a confirmation link to {email}</p>
          </div>
          
          <div className="auth-success-split" style={{ marginBottom: '24px' }}>
            <span className="success-icon">📧</span>
            <div className="success-text">
              <strong>Verify your email address</strong>
              <span>Click the link in the email to activate your account.</span>
            </div>
          </div>

          <button
            type="button"
            className="auth-secondary-split"
            onClick={onSwitchToLogin}
          >
            Back to Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container-split">
      {/* Left side — Hero */}
      <div className="auth-hero">
        <div className="auth-hero-bg">UG</div>
        <img src="/icon-512.png" alt="UG Navigator" width={80} height={80} />
        <h1>
          Join the
          <br />
          community.
        </h1>
        <p>
          Create an account and start navigating Legon campus with confidence.
        </p>
      </div>

      {/* Right side — Form */}
      <div className="auth-form-panel">
        <div className="auth-form-header">
          <h2>Get started</h2>
          <p>Join UG Navigator today</p>
        </div>

        {/* SUCCESS STATE - No loading spinner, just success message */}
        {success && (
          <div className="auth-success-split" role="status">
            <span className="success-icon">✓</span>
            <div className="success-text">
              <strong>Account created!</strong>
              <span>Please check your email to confirm your account.</span>
            </div>
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
              id="reg-email"
              type="email"
              placeholder=" "
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading || success}
              required
              autoComplete="email"
            />
            <label htmlFor="reg-email">Email address</label>
          </div>

          <div className="form-group-split">
            <input
              id="reg-username"
              type="text"
              placeholder=" "
              value={username}
              onChange={(e) => setUsername(e.target.value.slice(0, 50))}
              disabled={isLoading || success}
              required
            />
            <label htmlFor="reg-username">Username</label>
          </div>

          <div className="form-group-split">
            <input
              id="reg-password"
              type={showPassword ? "text" : "password"}
              placeholder=" "
              value={password}
              onChange={handlePasswordChange}
              disabled={isLoading || success}
              required
              autoComplete="new-password"
            />
            <label htmlFor="reg-password">Password</label>
            <button
              type="button"
              className="password-toggle-split"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
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

          <button
            type="submit"
            className={`auth-button-split ${isLoading ? "loading" : ""}`}
            disabled={isLoading || success || passwordStrength < 3}
          >
            {isLoading ? (
              <>
                <span className="button-spinner-split" />
                Creating account...
              </>
            ) : (
              "Create account →"
            )}
          </button>
        </form>

        <button
          type="button"
          className="auth-secondary-split"
          onClick={onSwitchToLogin}
          disabled={isLoading || success}
        >
          Already have an account? Sign in
        </button>
      </div>
    </div>
  );
}