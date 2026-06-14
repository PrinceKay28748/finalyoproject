// frontend/src/components/Profile/ProfilePage.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthContext } from "../../context/AuthContext";
import { API_URL } from "../../config";
import { loadPreferences } from "../../services/preferencesStore";
import { isTokenValid } from "./auth";
import EditProfileModal from "./EditProfileModal";
import ChangePasswordModal from "./ChangePasswordModal";
import DeleteAccountModal from "./DeleteAccountModal";
import LogoutConfirmationModal from "./LogoutConfirmationModal";
import HelpGuideModal from "./HelpGuideModal";
import "./ProfilePage.css";

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

const IconHelp = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const IconLogout = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const ProfileSkeleton = () => (
  <div className="profile-skeleton">
    <div className="profile-header">
      <div className="skeleton-shimmer skeleton-back"></div>
      <div className="skeleton-shimmer skeleton-title-text"></div>
    </div>

    <div className="profile-avatar-section">
      <div className="skeleton-shimmer skeleton-avatar"></div>
      <div className="skeleton-shimmer skeleton-name"></div>
      <div className="skeleton-shimmer skeleton-email"></div>
      <div className="skeleton-shimmer skeleton-date"></div>
    </div>

    <div className="profile-section">
      <div className="skeleton-shimmer skeleton-subtitle"></div>
      <div className="skeleton-shimmer skeleton-item"></div>
      <div className="skeleton-shimmer skeleton-item"></div>
    </div>
    <div className="profile-section">
      <div className="skeleton-shimmer skeleton-subtitle"></div>
      <div className="skeleton-shimmer skeleton-item"></div>
    </div>
  </div>
);

export default function ProfilePage() {
  const { user, getAuthHeader, logout } = useAuthContext();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dark mode state
  const [darkMode, setDarkMode] = useState(false);
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

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
  const fetchProfile = useCallback(async () => {
    // Robust check: Ensure token is present and is not a "junk" string
    const token = sessionStorage.getItem('accessToken');
    if (!isTokenValid(token)) {
      console.warn("[ProfilePage] No access token found. Redirecting to login.");
      navigate("/login");
      return;
    }

    try {
      setIsLoading(true);
      const headers = getAuthHeader();
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: { ...headers, "Content-Type": "application/json" },
      });

      if (response.status === 401 || response.status === 403) {
        // Handle expired or malformed session
        console.error(`[ProfilePage] Session error (${response.status}).`);
        sessionStorage.removeItem('accessToken');
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const data = await response.json();
      // Ensure we handle both direct user object or wrapped { user } response
      setProfile(data.user || data);
      setError(null);
    } catch (err) {
      console.error("[ProfilePage] Error:", err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthHeader, navigate]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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
    // Use navigate for smoother transition
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div className={`ug-root ${darkMode ? "dark" : ""}`}>
        <ProfileSkeleton />
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
          <button onClick={() => navigate("/")}>Go Home</button>
        </div>
      </div>
    );
  }

  // DIRECT CONTENT - NO profile-container, NO profile-card
  return (
    <div className={`ug-root ${darkMode ? "dark" : ""}`}>
      {/* Header */}
      <div className="profile-header">
        <button
          className="profile-back-btn"
          onClick={() => navigate("/")}
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

      {/* Support & Feedback */}
      <div className="profile-section">
        <h3>Support & Feedback</h3>
        <div className="profile-settings-list">
          <button 
            className="profile-setting-btn"
            onClick={() => setIsHelpModalOpen(true)}
          >
            <span className="profile-setting-icon"><IconHelp /></span>
            <div className="profile-setting-info">
              <strong>User Guide</strong>
              <span>How to navigate Legon & Accra</span>
            </div>
            <span className="profile-setting-arrow"><IconArrowRight /></span>
          </button>
        </div>
      </div>

      {/* Session Management */}
      <div className="profile-section">
        <h3>Session</h3>
        <div className="profile-settings-list">
          <button 
            className="profile-setting-btn"
            onClick={() => setIsLogoutModalOpen(true)}
          >
            <span className="profile-setting-icon"><IconLogout /></span>
            <div className="profile-setting-info">
              <strong>Sign Out</strong>
              <span>Logout from your current session</span>
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

      <HelpGuideModal
        isOpen={isHelpModalOpen}
        onClose={() => setIsHelpModalOpen(false)}
      />

      <LogoutConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={logout}
      />
    </div>
  );
}