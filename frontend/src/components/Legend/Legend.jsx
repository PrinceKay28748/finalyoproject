// components/Legend/Legend.jsx
import { useState } from "react";
import "./Legend.css";

// Formats metres into a readable distance string
function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Estimates walking time at 5 km/h (83.33 m/min) — realistic campus pace
function formatWalkingTime(meters) {
  const minutes = Math.ceil(meters / 83.33);
  if (minutes < 1)  return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// Estimates driving time at 20 km/h on campus (slow campus roads)
function formatDrivingTime(meters) {
  const minutes = Math.ceil(meters / 333.33);
  if (minutes < 1)  return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// Route profile config — colour and label for each mode
const PROFILE_CONFIG = {
  standard:   { label: "Standard",     color: "#2563eb", icon: "🗺️" },
  accessible: { label: "Accessible",   color: "#8b5cf6", icon: "♿" },
  night:      { label: "Night Safety", color: "#f59e0b", icon: "🌙" },
  fastest:    { label: "Fastest",      color: "#22c55e", icon: "⚡" },
};

export default function Legend({
  startText,
  destText,
  visible,
  route,
  activeProfile = "standard",
  warnings = [],
  alternatives = [],
  onSelectAlternative,
  activeAlternativeIndex = 0,
}) {
  const [expanded, setExpanded] = useState(true);

  if (!visible) return null;

  const hasRoute    = route && route.totalDistance;
  const distMeters  = hasRoute ? route.totalDistance : null;
  const isFallback  = route?.isFallback || false;
  const profile     = PROFILE_CONFIG[activeProfile] || PROFILE_CONFIG.standard;
  const hasWarnings = warnings.length > 0;
  const hasAlts     = alternatives.length > 0;

  return (
    <div className={`legend-sheet ${expanded ? "legend-sheet--expanded" : "legend-sheet--peek"}`}>

      {/* Drag handle — tap to toggle expand/collapse */}
      <div className="legend-handle-wrap" onClick={() => setExpanded(!expanded)}>
        <div className="legend-handle" />
      </div>

      {/* Peek row — always visible even when collapsed */}
      <div className="legend-peek" onClick={() => setExpanded(!expanded)}>
        <div className="legend-peek-dots">
          <span className="peek-dot peek-dot--start" />
          <div className="peek-dot-line" />
          <span className="peek-dot peek-dot--dest" />
        </div>
        <div className="legend-peek-text">
          <span className="peek-from">{startText || "Start"}</span>
          <span className="peek-arrow">→</span>
          <span className="peek-to">{destText || "Destination"}</span>
        </div>
        {hasRoute && (
          <div className="legend-peek-time">
            <span className="peek-time-value">{formatWalkingTime(distMeters)}</span>
            <span className="peek-time-label">walk</span>
          </div>
        )}
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="legend-body">

          {/* Active profile badge */}
          <div className="legend-profile">
            <span className="profile-icon">{profile.icon}</span>
            <span className="profile-label" style={{ color: profile.color }}>
              {profile.label} Route
            </span>
            {isFallback && (
              <span className="legend-badge legend-badge--warn">Direct path</span>
            )}
          </div>

          <div className="legend-divider" />

          {/* Route stats — walking, driving, distance */}
          {hasRoute && (
            <div className="legend-stats-grid">
              <div className="legend-stat-card">
                <span className="stat-card-icon">🚶</span>
                <div className="stat-card-info">
                  <span className="stat-card-value">{formatWalkingTime(distMeters)}</span>
                  <span className="stat-card-label">Walking</span>
                </div>
              </div>
              <div className="legend-stat-divider" />
              <div className="legend-stat-card">
                <span className="stat-card-icon">🚗</span>
                <div className="stat-card-info">
                  <span className="stat-card-value">{formatDrivingTime(distMeters)}</span>
                  <span className="stat-card-label">Driving</span>
                </div>
              </div>
              <div className="legend-stat-divider" />
              <div className="legend-stat-card">
                <span className="stat-card-icon">📏</span>
                <div className="stat-card-info">
                  <span className="stat-card-value">{formatDistance(distMeters)}</span>
                  <span className="stat-card-label">Distance</span>
                </div>
              </div>
            </div>
          )}

          {/* Warnings — gate closures, poor lighting etc */}
          {hasWarnings && (
            <>
              <div className="legend-divider" />
              <div className="legend-warnings">
                {warnings.map((w, i) => (
                  <div key={i} className={`legend-warning legend-warning--${w.type || "info"}`}>
                    <span className="warning-icon">{w.icon || "⚠️"}</span>
                    <span className="warning-text">{w.message}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Alternative routes — wired up when Yen's algorithm is ready */}
          {hasAlts && (
            <>
              <div className="legend-divider" />
              <p className="legend-alts-label">Alternative routes</p>
              <div className="legend-alts">
                <div
                  className={`legend-alt ${activeAlternativeIndex === 0 ? "legend-alt--active" : ""}`}
                  onClick={() => onSelectAlternative?.(0)}
                >
                  <span className="alt-line alt-line--primary" />
                  <div className="alt-info">
                    <span className="alt-name">Recommended</span>
                    <span className="alt-time">{formatWalkingTime(distMeters)}</span>
                  </div>
                </div>
                {alternatives.map((alt, i) => (
                  <div
                    key={i}
                    className={`legend-alt ${activeAlternativeIndex === i + 1 ? "legend-alt--active" : ""}`}
                    onClick={() => onSelectAlternative?.(i + 1)}
                  >
                    <span className="alt-line alt-line--secondary" />
                    <div className="alt-info">
                      <span className="alt-name">Alternative {i + 1}</span>
                      <span className="alt-time">{formatWalkingTime(alt.totalDistance)}</span>
                    </div>
                    <span className="alt-dist">{formatDistance(alt.totalDistance)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Fallback note */}
          {isFallback && (
            <div className="legend-fallback-note">
              ⚡ Direct connection used — small gap in road data
            </div>
          )}
        </div>
      )}
    </div>
  );
}