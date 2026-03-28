// components/Legend/Legend.jsx
import { useState, useRef, useEffect } from "react";
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

// Get current traffic level based on hour and day of week
function getTrafficInfo() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0 = Sunday, 6 = Saturday
  
  // Sunday — very quiet
  if (day === 0) {
    return { level: "Very Low", icon: "⚪", multiplier: 1.0, message: "Sunday — very light activity" };
  }
  
  // Saturday — low activity
  if (day === 6) {
    return { level: "Low", icon: "🟢", multiplier: 1.1, message: "Saturday — light traffic" };
  }
  
  // Weekday peak hours (Monday - Friday)
  const peakHours = [8, 9, 12, 13, 16, 17];
  const isPeak = peakHours.includes(hour);
  
  if (isPeak) {
    return { level: "Heavy", icon: "🔴", multiplier: 1.5, message: "Peak hours — busy paths" };
  }
  
  // Weekday non-peak (daytime)
  if (hour >= 6 && hour < 18) {
    return { level: "Moderate", icon: "🟡", multiplier: 1.3, message: "Moderate traffic" };
  }
  
  // Night time
  return { level: "Low", icon: "⚫", multiplier: 1.0, message: "Low traffic" };
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
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragStartExpanded = useRef(true);
  const sheetRef = useRef(null);

  // Get current traffic info
  const traffic = getTrafficInfo();

  // Touch/mouse drag handlers
  const handleDragStart = (e) => {
    setIsDragging(true);
    dragStartY.current = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    dragStartExpanded.current = expanded;
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;

    const currentY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
    const deltaY = currentY - dragStartY.current;

    if (deltaY > 50 && dragStartExpanded.current) {
      setExpanded(false);
    } else if (deltaY < -50 && !dragStartExpanded.current) {
      setExpanded(true);
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => handleDragMove(e);
    const handleMouseUp = () => handleDragEnd();

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  if (!visible) return null;

  const hasRoute    = route && route.totalDistance;
  const distMeters  = hasRoute ? route.totalDistance : null;
  const isFallback  = route?.isFallback || false;
  const profile     = PROFILE_CONFIG[activeProfile] || PROFILE_CONFIG.standard;
  const hasWarnings = warnings.length > 0;
  const hasAlts     = alternatives.length > 0;

  // Determine bar width based on traffic level
  const getBarWidth = () => {
    const level = traffic.level;
    if (level === "Heavy") return "100%";
    if (level === "Moderate") return "70%";
    if (level === "Low") return "40%";
    if (level === "Very Low") return "20%";
    return "50%";
  };

  return (
    <div 
      ref={sheetRef}
      className={`legend-sheet ${expanded ? "legend-sheet--expanded" : "legend-sheet--peek"}`}
    >
      {/* Drag handle */}
      <div 
        className="legend-handle-wrap"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        <div className="legend-handle" />
      </div>

      {/* Peek row — always visible */}
      <div className="legend-peek">
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

          {/* Route stats — walking, driving, distance, traffic */}
          {hasRoute && (
            <>
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

              {/* Traffic indicator */}
              <div className="legend-traffic">
                <div className="legend-traffic-icon">
                  <span>{traffic.icon}</span>
                </div>
                <div className="legend-traffic-info">
                  <span className="legend-traffic-label">Traffic</span>
                  <span className="legend-traffic-value">{traffic.level}</span>
                </div>
                <div className="legend-traffic-bar">
                  <div 
                    className={`legend-traffic-bar-fill ${traffic.level.toLowerCase().replace(' ', '-')}`}
                    style={{ width: getBarWidth() }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Alternative routes */}
          {hasAlts && (
            <>
              <div className="legend-divider" />
              <p className="legend-alts-label">Alternative routes</p>
              <div className="legend-alts">
                {/* Recommended route */}
                <div
                  className={`legend-alt ${activeAlternativeIndex === 0 ? "legend-alt--active" : ""}`}
                  onClick={() => onSelectAlternative?.(0)}
                >
                  <span className="alt-line alt-line--primary" />
                  <div className="alt-info">
                    <span className="alt-name">Recommended</span>
                    <span className="alt-time">{formatWalkingTime(distMeters)}</span>
                  </div>
                  <span className="alt-dist">{formatDistance(distMeters)}</span>
                </div>

                {/* Alternative routes */}
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

          {/* Warnings */}
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