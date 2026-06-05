// frontend/src/components/Profile/ProfilePage.jsx
import { useState, useEffect } from "react";
import { useAuthContext } from "../../context/AuthContext";
import { API_URL } from "../../config";
import EditProfileModal from "./EditProfileModal";
import ChangePasswordModal from "./ChangePasswordModal";
import DeleteAccountModal from "./DeleteAccountModal";
import "./ProfilePage.css";

// ── Read dark mode from persisted preferences ──────────────────────────────
// ProfilePage renders outside the App.jsx ug-root wrapper (separate route),
// so CSS variables like --bg / --text are not inherited. We apply ug-root
// directly on this page's root element using the saved preference.
function useDarkModeFromStorage() {
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const raw = localStorage.getItem("ug_preferences");
      if (raw) {
        const prefs = JSON.parse(raw);
        return prefs.darkMode === true;
      }
    } catch {}
    return false;
  });

  // Keep in sync if another tab or the main app changes the preference
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "ug_preferences") {
        try {
          const prefs = JSON.parse(e.newValue);
          setDarkMode(prefs.darkMode === true);
        } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return darkMode;
}

// Modern SVG Icons
const IconBack = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const IconEdit = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3l4 4-7 7-4-4 7-7z" />
    <path d="M4 20l4-4 4 4" />
    <path d="M3 21h18" />
  </svg>
);

const IconLock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconTrash = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <line x1="10" y1="11" x2="10" y2="17" />
    <line x1="14" y1="11" x2="14" y2="17" />
  </svg>
);

const IconArrowRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconSpinner = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="profile-spinner-icon">
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

export default function ProfilePage() {
  const { user, getAuthHeader } = useAuthContext();
  const darkMode = useDarkModeFromStorage();

  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

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

  const handleUsernameUpdate = (newUsername) => {
    setProfile(prev => ({ ...prev, username: newUsername }));
  };

  const handlePasswordUpdate = () => {
    console.log("[ProfilePage] Password updated");
  };

  const handleAccountDelete = () => {
    window.location.href = "/login";
  };

  // Root class — applies ug-root + dark so CSS variables resolve correctly
  const rootClass = `ug-root${darkMode ? " dark" : ""} profile-container`;

  if (isLoading) {
    return (
      <div className={rootClass}>
        <div className="profile-loading">
          <IconSpinner />
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={rootClass}>
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
      <div className={rootClass}>
        <div className="profile-error">
          <p>No profile data found</p>
          <button onClick={() => (window.location.href = "/")}>Go Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <div className="profile-card">
        {/* Header with back button */}
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

        {/* Account Settings Section */}
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