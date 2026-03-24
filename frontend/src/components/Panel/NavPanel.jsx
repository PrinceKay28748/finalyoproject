import SearchBox from "../Search/SearchBox";
import "./NavPanel.css";

// The top navigation panel — contains the header, search inputs,
// swap button, Show on Map action, and status message
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
  // Derive status message and style from current state
  const statusClass = locationError ? "error" : markersVisible ? "ready" : "idle";
  const statusMsg = locationError
    ? `⚠️ ${locationError}`
    : markersVisible
    ? "✓ Route points shown on map"
    : canShow
    ? "✓ Ready — tap \"Show on Map\""
    : startText && !destText
    ? "Now set your destination"
    : !startText && destText
    ? "Now set your start point"
    : "Tap the map or search to set locations";

  return (
    <div className="nav-panel">

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

        {/* Dark / light mode toggle */}
        <button className="nav-mode-btn" onClick={onToggleDarkMode}>
          {darkMode ? "☀️ Light" : "🌙 Dark"}
        </button>
      </div>

      {/* FROM search input */}
      <SearchBox
        placeholder="From — your start location"
        value={startText}
        onChange={onStartTextChange}
        onSelect={onStartSelect}
        onUseCurrentLocation={onUseCurrentLocation}
        showCurrentLocationOption={hasCurrentLocation}
        accentColor="#2563eb"
      />

      {/* Connector + swap button */}
      <div className="nav-connector">
        <div className="nav-connector-dots">
          {[0, 1, 2].map((i) => (
            <div key={i} className="nav-connector-dot" />
          ))}
        </div>
        <div className="nav-connector-line" />
        <button className="nav-swap-btn" onClick={onSwap}>
          ⇅ Swap
        </button>
        <div className="nav-connector-line" />
      </div>

      {/* TO search input */}
      <SearchBox
        placeholder="To — search or tap map"
        value={destText}
        onChange={onDestTextChange}
        onSelect={onDestSelect}
        onUseCurrentLocation={() => {}}
        showCurrentLocationOption={false}
        accentColor="#22c55e"
      />

      {/* Action buttons */}
      <div className="nav-action-row">
        <button
          className={`nav-show-btn ${canShow ? "ready" : "disabled"}`}
          onClick={onShowOnMap}
          disabled={!canShow || isResolving}
        >
          {isResolving ? (
            <>
              <div className="nav-spinner" />
              Resolving...
            </>
          ) : markersVisible ? (
            "Update Map"
          ) : (
            "Show on Map"
          )}
        </button>

        {/* Reset — only shown when at least one point is set */}
        {(startText || destText) && (
          <button className="nav-reset-btn" onClick={onReset}>
            ✕ Reset
          </button>
        )}
      </div>

      {/* Status message */}
      <p className={`nav-status ${statusClass}`}>{statusMsg}</p>
    </div>
  );
}