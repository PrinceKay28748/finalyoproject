import { useState } from "react";
import PortalSearchBox from "../Search/PortalSearchBox";
import "./NavPanel.css";

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
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasRoute, setHasRoute] = useState(false);

  // Detect when route is shown (Directions clicked)
  const handleDirectionsClick = () => {
    if (canShow && !isResolving) {
      onShowOnMap();
      setHasRoute(true);
      setIsExpanded(false);
    }
  };

  // Handle search focus - expand panel and reset route state
  const handleSearchFocus = () => {
    setHasRoute(false);
    setIsExpanded(true);
  };

  // Handle reset - collapse and clear
  const handleResetClick = () => {
    onReset();
    setHasRoute(false);
    setIsExpanded(false);
  };

  // Derive status message
  const statusClass = locationError ? "error" : markersVisible ? "ready" : "idle";
  const statusMsg = locationError
    ? `⚠️ ${locationError}`
    : markersVisible
    ? "✓ Route ready"
    : canShow
    ? "✓ Ready — tap Directions"
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
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
          <button className="nav-mode-btn" onClick={onToggleDarkMode}  title={darkMode ? "Light mode" : "Dark mode"}>
            {darkMode ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="5"/><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M21.64 15.95c-.183-1.465-.459-2.893-.973-4.213-1.291-3.602-4.109-6.41-7.711-7.697C12.07 2.85 10.954 2.5 9.742 2.5 5.88 2.5 2.73 5.65 2.73 9.512c0 2.554 1.64 4.717 3.93 5.607"/>
              </svg>
            )}
          </button>
        </div>

        <div className="nav-compact-row">
          <div 
            className="nav-compact-location"
            onClick={handleSearchFocus}
          >
            <span className="nav-compact-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.75.75 0 00.723 0l.028-.015.071-.041a60.856 60.856 0 002.6-1.951c2.165-1.73 4.583-4.032 6.332-6.51C21.75 11.561 24 8.531 24 5.75 24 2.468 21.53 0 18.75 0c-1.362 0-2.716.254-3.972.744C12.987.644 12.528.624 12 .624s-.987.02-1.778.12C8.22.744 6.866.5 5.25.5 2.47.5 0 2.968 0 6.25c0 2.78 2.25 5.81 3.955 7.793 1.75 2.478 4.168 4.78 6.332 6.51.886.705 1.754 1.393 2.6 1.952.181.127.389.196.598.196s.417-.069.598-.196.898-.517 1.754-1.393 4.168-4.032 6.332-6.51Z"/>
              </svg>
            </span>
            <span className="nav-compact-start">{startText}</span>
            <span className="nav-compact-arrow">→</span>
            <span className="nav-compact-dest">{destText}</span>
          </div>
          <button className="nav-compact-swap" onClick={onSwap} title="Swap locations">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 16V4m0 12l-3-3m3 3l3-3M17 8v12m0-12l3 3m-3-3l-3 3"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Expanded / collapsed view
  return (
    <div className={`nav-panel ${isExpanded ? "nav-panel--expanded" : "nav-panel--collapsed"}`}>
      {/* Header */}
      <div className="nav-header">
        <div className="nav-header-left">
          <div className="nav-logo">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
        <button className="nav-mode-btn" onClick={onToggleDarkMode}>
          {darkMode ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Collapsed state - only "Where to?" */}
      {!isExpanded && (
        <div className="nav-where-to" onClick={() => setIsExpanded(true)}>
          <div className="nav-where-to-icon">🔍</div>
          <span className="nav-where-to-text">Where to?</span>
        </div>
      )}

      {/* Expanded state - full search interface */}
      {isExpanded && (
        <div className="nav-expanded-content">
          {/* FROM section */}
          <div className="nav-input-section">
            <div className="nav-input-label">
              <span className="nav-input-icon">📍</span>
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

          {/* TO section */}
          <div className="nav-input-section">
            <div className="nav-input-label">
              <span className="nav-input-icon">📍</span>
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

          {/* Action buttons */}
          <div className="nav-action-row">
            <button className="nav-reset-btn" onClick={handleResetClick}>
              ✕ Reset
            </button>
            <button
              className={`nav-directions-btn ${canShow ? "ready" : "disabled"}`}
              onClick={handleDirectionsClick}
              disabled={!canShow || isResolving}
            >
              {isResolving ? (
                <>
                  <div className="nav-spinner" />
                  Finding...
                </>
              ) : (
                "Directions"
              )}
            </button>
          </div>

          {/* Status message */}
          <p className={`nav-status ${statusClass}`}>{statusMsg}</p>
        </div>
      )}
    </div>
  );
}