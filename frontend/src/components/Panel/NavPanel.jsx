// components/Panel/NavPanel.jsx
import { useState, useEffect, useRef } from "react";  // ← ADDED useRef
import { useAuthContext } from "../../context/AuthContext";
import { useFocus } from "../../context/FocusContext";
import SearchBox from "../Search/SearchBox";
import PortalSearchBox from "../Search/PortalSearchBox";
import LogoutConfirmationModal from "../Profile/LogoutConfirmationModal";
import { useNavigate } from "react-router-dom";
import {
  IconSun,
  IconMoonNav,
  IconSwap,
  IconSearch,
  IconDirections,
  IconLogout,
} from "../ui/icon";
import "./NavPanel.css";

// ... (all icon components unchanged) ...

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
  isExpanded: externalIsExpanded,
  onExpandRequest,
  onClose,
}) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [hasRoute, setHasRoute] = useState(false);
  
  // ─── FIX: Track whether route was explicitly set by user action ─────────
  const userExplicitlySetRoute = useRef(false);
  const isInitialMount = useRef(true);
  
  const { logout, user } = useAuthContext();
  const focus = useFocus();
  const navigate = useNavigate();

  // ─── FIX: On initial mount, if both startText and destText exist,
  // assume page was refreshed with a saved route and show compact view ───────
  useEffect(() => {
    if (isInitialMount.current && startText && destText && !userExplicitlySetRoute.current) {
      setHasRoute(true);
      isInitialMount.current = false;
    }
  }, [startText, destText]);

  const isExpanded =
    externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
  const setIsExpanded = (value) => {
    if (onExpandRequest) {
      onExpandRequest(value);
    } else {
      setInternalIsExpanded(value);
    }
  };

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const handleLogoutConfirm = async () => {
    setShowLogoutModal(false);
    await logout();
  };

  const handleDirectionsClick = () => {
    if (canShow && !isResolving) {
      onShowOnMap();
      userExplicitlySetRoute.current = true;  // ← FIX: Mark as user-initiated
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
    userExplicitlySetRoute.current = false;  // ← FIX: Clear user-initiated flag
    setHasRoute(false);
    setIsExpanded(false);
  };

  const handleClose = () => {
    setIsExpanded(false);
    if (onClose) onClose();
  };

  // ─── FIX: When user selects from dropdown, mark route as set ─────────────
  const handleStartSelect = (location) => {
    focus.setFocus(
      "location",
      location.name || location.lat.toFixed(4),
      "search",
    );
    onStartSelect(location);
    // If destText already exists, this completes the route
    if (destText) {
      userExplicitlySetRoute.current = true;
      setHasRoute(true);
      setIsExpanded(false);
    }
  };

  const handleDestSelect = (location) => {
    focus.setFocus(
      "location",
      location.name || location.lat.toFixed(4),
      "search",
    );
    onDestSelect(location);
    // If startText already exists, this completes the route
    if (startText) {
      userExplicitlySetRoute.current = true;
      setHasRoute(true);
      setIsExpanded(false);
    }
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
            <Avatar
              username={user?.username}
              size={44}
              onClick={() => navigate("/profile")}
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
              onClick={handleLogoutClick}
              aria-label="Sign out"
              title="Sign out"
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
            <Avatar
              username={user?.username}
              size={44}
              onClick={() => navigate("/profile")}
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
              onClick={handleLogoutClick}
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
                onSelect={handleStartSelect}  // ← FIX: Use wrapped handler
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
                onSelect={handleDestSelect}  // ← FIX: Use wrapped handler
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

      <LogoutConfirmationModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogoutConfirm}
      />
    </>
  );
}