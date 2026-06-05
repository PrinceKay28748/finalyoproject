// components/Panel/NavPanel.jsx
import { useState, useEffect } from "react";
import { useAuthContext } from "../../context/AuthContext";
import { useFocus } from "../../context/FocusContext";
import SearchBox from "../Search/SearchBox";
import PortalSearchBox from "../Search/PortalSearchBox";
import {
  IconSun,
  IconMoonNav,
  IconSwap,
  IconSearch,
  IconDirections,
  IconLogout,
} from "../ui/icon";
import "./NavPanel.css";

// Avatar component using Navii (CORRECTED URL)
function Avatar({ username, size = 32, onClick }) {
  const seed = username || "guest";
  // FIXED: Use api.navii.dev/avatar/{seed} format
  const avatarUrl = `https://api.navii.dev/avatar/${encodeURIComponent(seed)}?size=${size}&motion=true`;

  return (
    <button
      className="nav-avatar-btn"
      onClick={onClick}
      aria-label="Profile settings"
      title={`${username || "User"} · Click to edit profile`}
      style={{ width: size, height: size }}
    >
      <img src={avatarUrl} alt={username || "Avatar"} />
    </button>
  );
}

// ─── Inline SVG icons ──────────────────────────────────────────────────────

function IconFrom() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <circle
        cx="12"
        cy="12"
        r="7.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        opacity="0.35"
      />
    </svg>
  );
}

function IconTo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 12h14M13 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSunInline() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMoonInline() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M21 12.79A9 9 0 1111.21 3a7 7 0 109.79 9.79z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLogoutInline() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polyline
        points="16 17 21 12 16 7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="21"
        y1="12"
        x2="9"
        y2="12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────

export default function NavPanel({
  startText,
  destText,
  onStartTextChange,
  onDestTextChange,
  onStartSelect,
  onDestSelect,
  onUseCurrentLocation,
  onSwap,
  onShowOnMap,
  onReset,
  hasCurrentLocation,
  canShow,
  isResolving,
  markersVisible,
  accuracy,
  locationError,
  darkMode,
  onToggleDarkMode,
  // Allow parent to control expansion
  isExpanded: externalIsExpanded,
  onExpandRequest,
  onClose,
}) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const [hasRoute, setHasRoute] = useState(false);
  const { logout, user } = useAuthContext();
  const focus = useFocus();

  // Use external control if provided, otherwise use internal state
  const isExpanded =
    externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
  const setIsExpanded = (value) => {
    if (onExpandRequest) {
      onExpandRequest(value);
    } else {
      setInternalIsExpanded(value);
    }
  };

  const handleLogout = async () => {
    await logout();
  };

  const handleDirectionsClick = () => {
    if (canShow && !isResolving) {
      onShowOnMap();
      setHasRoute(true);
      setIsExpanded(false);
    }
  };

  const handleSearchFocus = () => {
    setHasRoute(false);
    setIsExpanded(true);
  };

  const handleResetClick = () => {
    onReset();
    setHasRoute(false);
    setIsExpanded(false);
  };

  const handleClose = () => {
    setIsExpanded(false);
    if (onClose) onClose();
  };

  const statusClass = locationError
    ? "error"
    : markersVisible
      ? "ready"
      : "idle";

  const statusMsg = locationError
    ? locationError
    : markersVisible
      ? "Route ready"
      : canShow
        ? "Ready — tap Directions"
        : startText && !destText
          ? "Now set your destination"
          : !startText && destText
            ? "Now set your start point"
            : "Tap the map or search to set locations";

  // ─── Compact view (after route is set) ──────────────────────────────────
  if (hasRoute && startText && destText) {
    return (
      <div className="nav-panel nav-panel--compact">
        <div className="nav-header">
          <div className="nav-header-left">
            <div className="nav-logo">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-label="UG Navigator logo"
              >
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
                  fill="white"
                />
              </svg>
            </div>

            {/* Avatar in COMPACT view */}
            <Avatar
              username={user?.username}
              size={32}
              onClick={() => (window.location.href = "/profile")}
            />

            <div>
              <p className="nav-title">UG Navigator</p>
              <p className="nav-subtitle">
                University of Ghana · Legon
                {accuracy && (
                  <span
                    className={
                      accuracy < 20
                        ? "nav-accuracy-good"
                        : accuracy < 50
                          ? "nav-accuracy-ok"
                          : "nav-accuracy-poor"
                    }
                  >
                    · GPS ±{accuracy}m
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="nav-header-buttons">
            <button
              className="nav-glass-btn nav-mode-btn"
              onClick={onToggleDarkMode}
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              title={`${user?.username || "User"} · ${darkMode ? "Light" : "Dark"} mode`}
            >
              <span
                className={`nav-mode-icon ${darkMode ? "nav-mode-icon--spin" : ""}`}
              >
                {darkMode ? <IconSunInline /> : <IconMoonInline />}
              </span>
            </button>
            <button
              className="nav-glass-btn nav-logout-btn"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <IconLogoutInline />
            </button>
          </div>
        </div>

        <div className="nav-compact-row">
          <div
            className="nav-compact-location"
            onClick={handleSearchFocus}
            role="button"
            tabIndex={0}
            aria-label="Edit route"
            onKeyDown={(e) => e.key === "Enter" && handleSearchFocus()}
          >
            <span
              className="nav-compact-dot nav-compact-dot--from"
              aria-hidden="true"
            />
            <span className="nav-compact-start">{startText}</span>
            <span className="nav-compact-arrow" aria-hidden="true">
              <IconArrowRight />
            </span>
            <span
              className="nav-compact-dot nav-compact-dot--to"
              aria-hidden="true"
            />
            <span className="nav-compact-dest">{destText}</span>
          </div>
          <button
            className="nav-glass-btn nav-compact-swap"
            onClick={onSwap}
            title="Swap"
            aria-label="Swap start and destination"
          >
            <IconSwap className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }

  // ─── Expanded / collapsed view ───────────────────────────────────────────
  return (
    <>
      {/* Click-outside backdrop — only visible when expanded */}
      {isExpanded && (
        <div
          className="nav-backdrop"
          onClick={handleClose}
          aria-hidden="true"
        />
      )}

      <div
        className={`nav-panel ${isExpanded ? "nav-panel--expanded" : "nav-panel--collapsed"}`}
      >
        <div className="nav-header">
          <div className="nav-header-left">
            <div className="nav-logo">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                aria-label="UG Navigator logo"
              >
                <path
                  d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
                  fill="white"
                />
              </svg>
            </div>

            {/* Avatar in EXPANDED view */}
            <Avatar
              username={user?.username}
              size={32}
              onClick={() => (window.location.href = "/profile")}
            />

            <div>
              <p className="nav-title">UG Navigator</p>
              <p className="nav-subtitle">
                University of Ghana · Legon
                {accuracy && (
                  <span
                    className={
                      accuracy < 20
                        ? "nav-accuracy-good"
                        : accuracy < 50
                          ? "nav-accuracy-ok"
                          : "nav-accuracy-poor"
                    }
                  >
                    · GPS ±{accuracy}m
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="nav-header-buttons">
            <button
              className="nav-glass-btn nav-mode-btn"
              onClick={onToggleDarkMode}
              aria-label={
                darkMode ? "Switch to light mode" : "Switch to dark mode"
              }
              title={`${user?.username || "User"} · ${darkMode ? "Light" : "Dark"} mode`}
            >
              <span
                className={`nav-mode-icon ${darkMode ? "nav-mode-icon--spin" : ""}`}
              >
                {darkMode ? <IconSunInline /> : <IconMoonInline />}
              </span>
            </button>
            <button
              className="nav-glass-btn nav-logout-btn"
              onClick={handleLogout}
              aria-label="Sign out"
              title="Sign out"
            >
              <IconLogoutInline />
            </button>
          </div>
        </div>

        {!isExpanded && (
          <button
            className="nav-where-to"
            onClick={() => setIsExpanded(true)}
            aria-label="Search for destination"
          >
            <div className="nav-where-to-icon" aria-hidden="true">
              <IconSearch className="w-4 h-4" />
            </div>
            <span className="nav-where-to-text">Where to?</span>
          </button>
        )}

        {isExpanded && (
          <div className="nav-expanded-content">
            <div className="nav-input-section">
              <div className="nav-input-label">
                <span className="nav-input-icon from-icon" aria-hidden="true">
                  <IconFrom />
                </span>
                <span className="nav-input-label-text from-label">From</span>
              </div>
              <PortalSearchBox
                placeholder="Your location"
                value={startText}
                onChange={onStartTextChange}
                onSelect={(location) => {
                  focus.setFocus(
                    "location",
                    location.name || location.lat.toFixed(4),
                    "search",
                  );
                  onStartSelect(location);
                }}
                onUseCurrentLocation={onUseCurrentLocation}
                showCurrentLocationOption={hasCurrentLocation}
                accentColor="#2563eb"
                onFocus={handleSearchFocus}
              />
            </div>

            <div className="nav-input-section">
              <div className="nav-input-label">
                <span className="nav-input-icon to-icon" aria-hidden="true">
                  <IconTo />
                </span>
                <span className="nav-input-label-text to-label">To</span>
              </div>
              <PortalSearchBox
                placeholder="Where to?"
                value={destText}
                onChange={onDestTextChange}
                onSelect={(location) => {
                  focus.setFocus(
                    "location",
                    location.name || location.lat.toFixed(4),
                    "search",
                  );
                  onDestSelect(location);
                }}
                onUseCurrentLocation={() => {}}
                showCurrentLocationOption={false}
                accentColor="#22c55e"
                onFocus={handleSearchFocus}
              />
            </div>

            <div className="nav-action-row">
              <button
                className="nav-reset-btn"
                onClick={handleResetClick}
                aria-label="Reset route"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M3 12a9 9 0 109-9 9 9 0 00-6.16 2.42L3 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3 3v5h5"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                Reset
              </button>

              <button
                className={`nav-directions-btn ${canShow ? "ready" : "disabled"}`}
                onClick={handleDirectionsClick}
                disabled={!canShow || isResolving}
                aria-label="Get directions"
              >
                {isResolving ? (
                  <>
                    <div className="nav-spinner" aria-hidden="true" />
                    Finding…
                  </>
                ) : (
                  <>
                    <IconDirections className="w-4 h-4" aria-hidden="true" />
                    Directions
                  </>
                )}
              </button>
            </div>

            <p className={`nav-status ${statusClass}`}>
              {statusClass === "error" && (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                >
                  <path
                    d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {statusClass === "ready" && (
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                  style={{
                    display: "inline",
                    marginRight: 4,
                    verticalAlign: "middle",
                  }}
                >
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {statusMsg}
            </p>
          </div>
        )}
      </div>
    </>
  );
}