import { useState } from "react";
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

// Shared visual indicator fragments
const IconFrom = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="nav-icon-marker">
    <circle cx="12" cy="12" r="4" fill="currentColor" />
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
  </svg>
);

const IconTo = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="nav-icon-marker">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="currentColor" />
  </svg>
);

const IconArrowRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

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
}) {
  const [internalIsExpanded, setInternalIsExpanded] = useState(false);
  const [hasRoute, setHasRoute] = useState(false);
  const { logout, user } = useAuthContext();

  // Unified controller pattern
  const isExpanded = externalIsExpanded !== undefined ? externalIsExpanded : internalIsExpanded;
  
  const setIsExpanded = (value) => {
    if (onExpandRequest) {
      onExpandRequest(value);
    } else {
      setInternalIsExpanded(value);
    }
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

  const getAccuracyClass = (meters) => {
    if (meters < 20) return "nav-accuracy-good";
    if (meters < 50) return "nav-accuracy-ok";
    return "nav-accuracy-poor";
  };

  const isCompactView = hasRoute && startText && destText;

  return (
    <div 
      className={`nav-panel ${
        isCompactView 
          ? "nav-panel--compact" 
          : isExpanded 
            ? "nav-panel--expanded" 
            : "nav-panel--collapsed"
      }`}
      role="region"
      aria-label="Campus Navigation Control"
    >
      {/* ─── Global Panel Header ─── */}
      <div className="nav-header">
        <div className="nav-header-left">
          <div className="nav-logo" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="white" />
            </svg>
          </div>
          <div>
            <p className="nav-title">UG Navigator</p>
            <p className="nav-subtitle">
              University of Ghana · Legon
              {accuracy && (
                <span className={`nav-accuracy-badge ${getAccuracyClass(accuracy)}`}>
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
            aria-label={darkMode ? "Switch to light theme" : "Switch to dark theme"}
            title={`${user?.username || "User"} · ${darkMode ? "Light" : "Dark"} mode`}
          >
            <span className={`nav-mode-icon ${darkMode ? "nav-mode-icon--spin" : ""}`}>
              {darkMode ? <IconSun /> : <IconMoonNav />}
            </span>
          </button>
          
          <button
            className="nav-glass-btn nav-logout-btn"
            onClick={logout}
            title="Sign out"
            aria-label="Sign out of navigator"
          >
            <IconLogout />
          </button>
        </div>
      </div>

      {/* ─── Dynamic Main Body View Switcher ─── */}
      {isCompactView ? (
        /* ─── Compact Form Interface ─── */
        <div className="nav-compact-row">
          <button
            className="nav-compact-location"
            onClick={handleSearchFocus}
            aria-label="Modify current route paths"
          >
            <span className="nav-compact-dot nav-compact-dot--from" />
            <span className="nav-compact-start">{startText}</span>
            <span className="nav-compact-arrow" aria-hidden="true">
              <IconArrowRight />
            </span>
            <span className="nav-compact-dot nav-compact-dot--to" />
            <span className="nav-compact-dest">{destText}</span>
          </button>
          
          <button
            className="nav-glass-btn nav-compact-swap"
            onClick={onSwap}
            title="Reverse origin and destination positions"
            aria-label="Swap locations"
          >
            <IconSwap aria-hidden="true" />
          </button>
        </div>
      ) : (
        /* ─── Expanded Functional Routing Interface ─── */
        <div className="nav-routing-body">
          <div className="nav-search-fields">
            <div className="nav-field-input-group">
              <IconFrom />
              <SearchBox
                value={startText}
                onChange={onStartTextChange}
                onSelect={onStartSelect}
                placeholder="Choose starting point..."
                onFocus={handleSearchFocus}
                hasCurrentLocation={hasCurrentLocation}
                onUseCurrentLocation={onUseCurrentLocation}
              />
            </div>

            <div className="nav-field-input-group">
              <IconTo />
              <PortalSearchBox
                value={destText}
                onChange={onDestTextChange}
                onSelect={onDestSelect}
                placeholder="Search campus destination..."
                onFocus={handleSearchFocus}
              />
            </div>
          </div>

          {/* Interactive Status & Functional Buttons */}
          <div className="nav-footer-controls">
            <div className={`nav-status-banner ${locationError ? "error" : markersVisible ? "ready" : "idle"}`}>
              <span className="nav-status-indicator-dot" />
              <p className="nav-status-text">
                {locationError || (markersVisible ? "Route ready" : canShow ? "Ready — tap Directions" : startText && !destText ? "Now set your destination" : !startText && destText ? "Now set your start point" : "Tap the map or search to set locations")}
              </p>
            </div>

            <div className="nav-action-button-row">
              <button
                className={`nav-directions-btn ${canShow && !isResolving ? "ready" : "disabled"}`}
                disabled={!canShow || isResolving}
                onClick={handleDirectionsClick}
              >
                <IconDirections />
                <span>{isResolving ? "Calculating..." : "Get Directions"}</span>
              </button>

              {(startText || destText) && (
                <button
                  className="nav-reset-btn"
                  onClick={handleResetClick}
                  aria-label="Clear active routing forms"
                >
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
