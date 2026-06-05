// frontend/src/components/Profile/ProfilePage.jsx
import { useState, useEffect } from "react";
import { useAuthContext } from "../../context/AuthContext";
import { API_URL } from "../../config";
import { loadPreferences } from "../../services/preferencesStore";
import EditProfileModal from "./EditProfileModal";
import ChangePasswordModal from "./ChangePasswordModal";
import DeleteAccountModal from "./DeleteAccountModal";
import "./ProfilePage.css";

// ... (keep all your SVG icons here, same as before)

export default function ProfilePage() {
  const { user, getAuthHeader } = useAuthContext();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  // Load dark mode from IndexedDB
  useEffect(() => {
    const loadDarkMode = async () => {
      try {
        const prefs = await loadPreferences();
        console.log("[ProfilePage] Loaded preferences:", prefs);
        setDarkMode(prefs.darkMode === true);
      } catch (err) {
        console.warn("[ProfilePage] Failed to load preferences:", err);
      }
    };
    
    loadDarkMode();
  }, []);

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

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const handleUsernameUpdate = (newUsername) => {
    setProfile(prev => ({ ...prev, username: newUsername }));
  };

  const handlePasswordUpdate = () => {
    console.log("[ProfilePage] Password updated");
  };

  const handleAccountDelete = () => {
    window.location.href = "/login";
  };

  if (isLoading) {
    return (
      <div className={`ug-root ${darkMode ? "dark" : ""}`}>
        <div className="profile-loading">
          <IconSpinner />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`ug-root ${darkMode ? "dark" : ""}`}>
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
      <div className={`ug-root ${darkMode ? "dark" : ""}`}>
        <div className="profile-error">
          <p>No profile data found</p>
          <button onClick={() => (window.location.href = "/")}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`ug-root ${darkMode ? "dark" : ""}`}>
      <div className="profile-container">
        <div className="profile-card">
          {/* Header */}
          <div className="profile-header">
            <button
              className="profile-back-btn"
              onClick={() => (window.location.href = "/")}
              aria-label="Go back"
            >
              <IconBack />
              <span>Back</span>
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

          {/* Account Settings */}
          <div className="profile-section">
            <h3>Account Settings</h3>
            <div className="profile-settings-list">
              <button 
                className="profile-setting-btn"
                onClick={() => setIsEditModalOpen(true)}
              >
                <span className="profile-setting-icon"><IconEdit /></span>
                <div className="profile-setting-info">
                  <strong>Edit Username</strong>
                  <span>Change your display name</span>
                </div>
                <span className="profile-setting-arrow"><IconArrowRight /></span>
              </button>

              <button 
                className="profile-setting-btn"
                onClick={() => setIsPasswordModalOpen(true)}
              >
                <span className="profile-setting-icon"><IconLock /></span>
                <div className="profile-setting-info">
                  <strong>Change Password</strong>
                  <span>Update your password</span>
                </div>
                <span className="profile-setting-arrow"><IconArrowRight /></span>
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="profile-section profile-danger-zone">
            <h3>Danger Zone</h3>
            <div className="profile-settings-list">
              <button 
                className="profile-setting-btn profile-danger-btn"
                onClick={() => setIsDeleteModalOpen(true)}
              >
                <span className="profile-setting-icon"><IconTrash /></span>
                <div className="profile-setting-info">
                  <strong>Delete Account</strong>
                  <span>Permanently delete your account and all data</span>
                </div>
                <span className="profile-setting-arrow"><IconArrowRight /></span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <EditProfileModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        currentUsername={profile.username}
        onUpdate={handleUsernameUpdate}
      />

      <ChangePasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        onSuccess={handlePasswordUpdate}
      />

      <DeleteAccountModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleAccountDelete}
      />
    </div>
  );
}