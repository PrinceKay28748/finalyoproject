// components/Panel/NavPanel.jsx
import { useState } from "react";
import SearchBox from "../Search/SearchBox";
import PortalSearchBox from "../Search/PortalSearchBox";
import {
  IconSun,
  IconMoonNav,
  IconSwap,
  IconSearch,
  IconDirections,
} from "../ui/icon";
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
          <button className="nav-mode-btn" onClick={onToggleDarkMode}>
            {darkMode ? <IconSun className="w-4 h-4" /> : <IconMoonNav className="w-4 h-4" />}
          </button>
        </div>

        <div className="nav-compact-row">
          <div 
            className="nav-compact-location"
            onClick={handleSearchFocus}
          >
            <span className="nav-compact-icon">📍</span>
            <span className="nav-compact-start">{startText}</span>
            <span className="nav-compact-arrow">→</span>
            <span className="nav-compact-dest">{destText}</span>
          </div>
          <button className="nav-compact-swap" onClick={onSwap} title="Swap">
            <IconSwap className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  // Expanded / collapsed view
  return (
    <div className={`nav-panel ${isExpanded ? "nav-panel--expanded" : "nav-panel--collapsed"}`}>
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
          {darkMode ? <IconSun className="w-4 h-4" /> : <IconMoonNav className="w-4 h-4" />}
        </button>
      </div>

      {!isExpanded && (
        <div className="nav-where-to" onClick={() => setIsExpanded(true)}>
          <div className="nav-where-to-icon"><IconSearch className="w-4 h-4" /></div>
          <span className="nav-where-to-text">Where to?</span>
        </div>
      )}

      {isExpanded && (
        <div className="nav-expanded-content">
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
                <>
                  <IconDirections className="w-4 h-4" />
                  Directions
                </>
              )}
            </button>
          </div>

          <p className={`nav-status ${statusClass}`}>{statusMsg}</p>
        </div>
      )}
    </div>
  );
}