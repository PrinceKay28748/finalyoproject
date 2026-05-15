// components/Panel/NavPanel.jsx
import { useState, useEffect } from "react";
import { useAuthContext } from "../../context/AuthContext";
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

// Inline SVG icons used only for buttons (no emoji replacements)
function IconFrom() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" fill="currentColor" />
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
    </svg>
  );
}

function IconTo() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

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
  // NEW PROP: Allow parent to control expansion
  isExpanded: externalIsExpanded,
  onExpandRequest,
}) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const [hasRoute, setHasRoute] = useState(false);
  const { logout, user } = useAuthContext();

  // Use external control if provided, otherwise use internal state
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
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

  // Compact view after route is set
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
              aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              title={`${user?.username || "User"} · ${darkMode ? "Light" : "Dark"} mode`}
            >
              <span className={`nav-mode-icon ${darkMode ? "nav-mode-icon--spin" : ""}`}>
                {darkMode ? (
                  <IconSun className="w-4 h-4" />
                ) : (
                  <IconMoonNav className="w-4 h-4" />
                )}
              </span>
            </button>
            <button
              className="nav-glass-btn nav-logout-btn"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <IconLogout className="w-4 h-4" />
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
            <span className="nav-compact-dot nav-compact-dot--from" aria-hidden="true" />
            <span className="nav-compact-start">{startText}</span>
            <span className="nav-compact-arrow" aria-hidden="true">
              <IconArrowRight />
            </span>
            <span className="nav-compact-dot nav-compact-dot--to" aria-hidden="true" />
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

  // Expanded / collapsed view
  return (
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
            aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            title={`${user?.username || "User"} · ${darkMode ? "Light" : "Dark"} mode`}
          >
            <span className={`nav-mode-icon ${darkMode ? "nav-mode-icon--spin" : ""}`}>
              {darkMode ? (
                <IconSun className="w-4 h-4" />
              ) : (
                <IconMoonNav className="w-4 h-4" />
              )}
            </span>
          </button>
          <button
            className="nav-glass-btn nav-logout-btn"
            onClick={handleLogout}
            aria-label="Sign out"
            title="Sign out"
          >
            <IconLogout className="w-4 h-4" />
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
              onSelect={onStartSelect}
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
              onSelect={onDestSelect}
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
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
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }}>
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {statusClass === "ready" && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ display: "inline", marginRight: 4, verticalAlign: "middle" }}>
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {statusMsg}
          </p>
        </div>
      )}
    </div>
  );
}