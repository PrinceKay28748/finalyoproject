// src/components/ProtectedRoute.jsx
// Wrapper component that checks authentication before rendering content

import { useAuthContext } from "../context/AuthContext";
import AuthPage from "./Auth/AuthPage";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthContext();

  // Only show loading if we're restoring a session
  if (isLoading && !isAuthenticated) {
    const hasStoredSession =
      sessionStorage.getItem("accessToken") && sessionStorage.getItem("user");

    if (hasStoredSession) {
      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100vh",
            backgroundColor: "#f5f5f5",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                width: "50px",
                height: "50px",
                border: "4px solid #e0e0e0",
                borderTop: "4px solid #1a6d8f",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
                margin: "0 auto 20px",
              }}
            />
            <p style={{ color: "#666", margin: 0 }}>Loading session...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      );
    }
  }

  // Show login/register if not authenticated
  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Show protected content if authenticated
  return children;
}