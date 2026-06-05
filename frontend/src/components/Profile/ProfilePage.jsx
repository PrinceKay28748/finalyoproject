// frontend/src/components/Profile/ProfilePage.jsx
import { useState, useEffect } from "react";
import { useAuthContext } from "../../context/AuthContext";
import { API_URL } from "../../config";
import "./ProfilePage.css";

export default function ProfilePage() {
  const { user, getAuthHeader } = useAuthContext();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch user profile from backend
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/me`, {
          headers: {
            ...getAuthHeader(),
            "Content-Type": "application/json",
          },
        });

        if (!response.ok) {
          throw new Error("Failed to fetch profile");
        }

        const data = await response.json();
        setProfile(data.user);
      } catch (err) {
        console.error("[ProfilePage] Error:", err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [getAuthHeader]);

  // Format date for display
  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="profile-container">
        <div className="profile-loading">
          <div className="profile-spinner" />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="profile-container">
        <div className="profile-error">
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={() => window.location.reload()}>Try Again</button>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-container">
        <div className="profile-error">
          <p>No profile data found</p>
          <button onClick={() => (window.location.href = "/")}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        {/* Header with back button */}
        <div className="profile-header">
          <button
            className="profile-back-btn"
            onClick={() => (window.location.href = "/")}
            aria-label="Go back"
          >
            ← Back
          </button>
          <h1>My Profile</h1>
        </div>

        {/* Avatar Section */}
        <div className="profile-avatar-section">
          <img
            src={`https://api.navii.dev/avatar/${encodeURIComponent(profile.username || profile.email)}?size=120&motion=true`}
            alt="Profile avatar"
            className="profile-avatar"
          />
          <h2>{profile.username || "User"}</h2>
          <p className="profile-email">{profile.email}</p>
          <p className="profile-member-since">
            Member since {formatDate(profile.created_at)}
          </p>
        </div>

        {/* Account Settings Section */}
        <div className="profile-section">
          <h3>Account Settings</h3>
          <div className="profile-settings-list">
            <button className="profile-setting-btn">
              <span>✏️</span>
              <div className="profile-setting-info">
                <strong>Edit Username</strong>
                <span>Change your display name</span>
              </div>
              <span className="profile-setting-arrow">→</span>
            </button>

            <button className="profile-setting-btn">
              <span>🔒</span>
              <div className="profile-setting-info">
                <strong>Change Password</strong>
                <span>Update your password</span>
              </div>
              <span className="profile-setting-arrow">→</span>
            </button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="profile-section profile-danger-zone">
          <h3>Danger Zone</h3>
          <div className="profile-settings-list">
            <button className="profile-setting-btn profile-danger-btn">
              <span>🗑️</span>
              <div className="profile-setting-info">
                <strong>Delete Account</strong>
                <span>Permanently delete your account and all data</span>
              </div>
              <span className="profile-setting-arrow">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}