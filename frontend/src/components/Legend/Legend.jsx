import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from "react";
import {
  IconMap,
  IconAccessibility,
  IconMoon,
  IconBolt,
  IconWalk,
  IconCar,
  IconRuler,
  IconShare,
  IconWarning,
  IconInfo,
} from "../ui/icon";
import { useVoiceGuidance } from "../../hooks/useVoiceGuidance";
import "./Legend.css";
import "./LegendProfile.css";

// Formats metres into a readable distance string
function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

// Estimates time based on vehicle mode
function formatTravelTime(meters, vehicleMode = 'walk') {
  let speedKmh;
  if (vehicleMode === 'walk') speedKmh = 5;
  else if (vehicleMode === 'car') speedKmh = 30;
  else if (vehicleMode === 'motorcycle') speedKmh = 25;
  else speedKmh = 5;
  
  const minutes = Math.ceil(meters / (speedKmh * 1000 / 60));
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

// Get current traffic level
function getTrafficInfo() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  if (day === 0) {
    return {
      level: "Very Low",
      icon: "⚪",
      multiplier: 1.0,
      message: "Sunday — very light activity",
    };
  }
  if (day === 6) {
    return {
      level: "Low",
      icon: "🟢",
      multiplier: 1.1,
      message: "Saturday — light traffic",
    };
  }

  const peakHours = [8, 9, 12, 13, 16, 17];
  const isPeak = peakHours.includes(hour);

  if (isPeak) {
    return {
      level: "Heavy",
      icon: "🔴",
      multiplier: 1.5,
      message: "Peak hours — busy paths",
    };
  }
  if (hour >= 6 && hour < 18) {
    return {
      level: "Moderate",
      icon: "🟡",
      multiplier: 1.3,
      message: "Moderate traffic",
    };
  }

  return { level: "Low", icon: "⚫", multiplier: 1.0, message: "Low traffic" };
}

// Route profile config
const PROFILE_CONFIG = {
  standard: { label: "Standard", color: "#2563eb", icon: IconMap },
  accessible: { label: "Accessible", color: "#8b5cf6", icon: IconAccessibility },
  night: { label: "Night Safety", color: "#f59e0b", icon: IconMoon },
  fastest: { label: "Fastest", color: "#22c55e", icon: IconBolt },
};

const PROFILES = [
  { key: "standard", icon: IconMap, label: "Standard", color: "#2563eb" },
  { key: "accessible", icon: IconAccessibility, label: "Accessible", color: "#8b5cf6" },
  { key: "night", icon: IconMoon, label: "Night", color: "#f59e0b" },
  { key: "fastest", icon: IconBolt, label: "Fastest", color: "#22c55e" },
];

const Legend = forwardRef(function Legend({
  startText,
  destText,
  visible,
  route,
  activeProfile = "standard",
  vehicleMode = "walk",
  warnings = [],
  alternatives = [],
  onSelectAlternative,
  activeAlternativeIndex = 0,
  currentLocation,
  onExpandedChange,
  onProfileChange,
}, ref) {
  const [expanded, setExpanded] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef(0);
  const dragCurrentY = useRef(0);
  const dragStartExpanded = useRef(true);
  const dragVelocity = useRef(0);
  const lastDragTime = useRef(0);
  const sheetRef = useRef(null);
  const headerRef = useRef(null);
  const peekHeight = 70;

  // Voice guidance
  const { isVoiceEnabled, toggleVoice, speak, speakTurn } = useVoiceGuidance();

  useImperativeHandle(ref, () => ({
    collapse: () => {
      if (expanded) {
        setExpanded(false);
      }
    },
    expand: () => {
      if (!expanded) {
        setExpanded(true);
      }
    },
    isExpanded: () => expanded,
  }));

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  // Announce route when it loads and voice is enabled
  useEffect(() => {
    if (isVoiceEnabled && route && route.totalDistance) {
      const distance = formatDistance(route.totalDistance);
      const time = formatTravelTime(route.totalDistance, vehicleMode);
      speak(`Route calculated. ${distance}, about ${time}.`);
    }
  }, [route, isVoiceEnabled, vehicleMode, speak]);

  const traffic = getTrafficInfo();

  const handleShareLocation = () => {
    if (!currentLocation) {
      alert("Location not available yet. Please wait for GPS fix.");
      return;
    }

    const baseUrl = import.meta.env.PROD
      ? "https://ugnavigator.onrender.com"
      : window.location.origin;

    const link = `${baseUrl}?lat=${currentLocation.lat}&lng=${currentLocation.lng}&name=Shared%20Location`;

    navigator.clipboard.writeText(link);
    alert("Location link copied! Share it with your friends.");
  };

  // Drag handlers - now triggered from the entire header
  const handleDragStart = (e) => {
    e.stopPropagation();
    e.preventDefault();

    setIsDragging(true);
    dragStartY.current = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;
    dragCurrentY.current = dragStartY.current;
    dragStartExpanded.current = expanded;
    lastDragTime.current = Date.now();
    dragVelocity.current = 0;
    if (sheetRef.current) {
      sheetRef.current.classList.add("dragging");
      sheetRef.current.style.transition = "none";
    }
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;

    e.stopPropagation();
    e.preventDefault();

    const currentY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;
    const deltaY = currentY - dragStartY.current;
    const now = Date.now();
    const timeDelta = Math.max(1, now - lastDragTime.current);
    dragVelocity.current = (deltaY - (dragCurrentY.current - dragStartY.current)) / timeDelta;
    dragCurrentY.current = currentY;
    lastDragTime.current = now;
    const sheetHeight = sheetRef.current?.offsetHeight || 400;
    const maxDrag = sheetHeight - peekHeight;
    let newTranslateY = 0;
    if (dragStartExpanded.current) {
      newTranslateY = Math.min(maxDrag, Math.max(0, deltaY));
    } else {
      newTranslateY = Math.min(maxDrag, Math.max(0, maxDrag + deltaY));
    }
    if (sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${newTranslateY}px)`;
    }
  };

  const handleDragEnd = (e) => {
    if (!isDragging) return;

    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }

    const sheetHeight = sheetRef.current?.offsetHeight || 400;
    const maxDrag = sheetHeight - peekHeight;
    const currentTranslate = parseFloat(sheetRef.current?.style.transform?.match(/translateY\(([-\d.]+)px\)/)?.[1] || 0);
    let shouldExpand;
    if (Math.abs(dragVelocity.current) > 0.3) {
      shouldExpand = dragVelocity.current < 0;
    } else {
      shouldExpand = currentTranslate < maxDrag / 2;
    }
    setExpanded(shouldExpand);
    if (sheetRef.current) {
      sheetRef.current.style.transform = "";
      sheetRef.current.style.transition = "";
      sheetRef.current.classList.remove("dragging");
    }
    setIsDragging(false);
  };

  // Set up drag event listeners
  useEffect(() => {
    if (!isDragging) {
      document.body.classList.remove("dragging-legend");
      return;
    }

    document.body.classList.add("dragging-legend");

    const handleMouseMove = (e) => handleDragMove(e);
    const handleMouseUp = (e) => handleDragEnd(e);
    const handleTouchMove = (e) => handleDragMove(e);
    const handleTouchEnd = (e) => handleDragEnd(e);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    document.addEventListener("touchmove", handleTouchMove, { passive: false });
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.body.classList.remove("dragging-legend");
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isDragging]);

  useEffect(() => {
    if (!isDragging && sheetRef.current) {
      sheetRef.current.style.transform = "";
    }
  }, [expanded, isDragging]);

  if (!visible) return null;

  const hasRoute = route && route.totalDistance;
  const distMeters = hasRoute ? route.totalDistance : null;
  const isFallback = route?.isFallback || false;
  const profile = PROFILE_CONFIG[activeProfile] || PROFILE_CONFIG.standard;
  const hasWarnings = warnings.length > 0;
  const hasAlts = alternatives.length > 0;

  const estimatedTime = hasRoute ? formatTravelTime(distMeters, vehicleMode) : null;
  const carTime = hasRoute ? formatTravelTime(distMeters, 'car') : null;
  const walkTime = hasRoute ? formatTravelTime(distMeters, 'walk') : null;

  const getBarWidth = () => {
    const level = traffic.level;
    if (level === "Heavy") return "100%";
    if (level === "Moderate") return "70%";
    if (level === "Low") return "40%";
    if (level === "Very Low") return "20%";
    return "50%";
  };

  const ProfileIcon = profile.icon;
  const WalkIcon = IconWalk;
  const CarIcon = IconCar;
  const RulerIcon = IconRuler;
  const ShareIcon = IconShare;

  const vehicleDisplay = {
    walk: { icon: "🚶", label: "Walk" },
    car: { icon: "🚗", label: "Drive" },
    motorcycle: { icon: "🏍️", label: "Ride" },
  };
  const currentVehicle = vehicleDisplay[vehicleMode] || vehicleDisplay.walk;

  return (
    <div
      ref={sheetRef}
      className={`legend-sheet ${expanded ? "legend-sheet--expanded" : "legend-sheet--peek"}`}
    >
      {/* Entire header is now draggable - includes handle and peek area */}
      <div
        ref={headerRef}
        className="legend-drag-header"
        onMouseDown={handleDragStart}
        onTouchStart={handleDragStart}
        style={{ touchAction: "none", cursor: "grab" }}
      >
        <div className="legend-handle-wrap">
          <div className="legend-handle" />
        </div>

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
              <span className="peek-time-value">{estimatedTime}</span>
              <span className="peek-time-label">{currentVehicle.label}</span>
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="legend-body">
          <div className="legend-profile">
            <span className="profile-icon">
              <ProfileIcon className="w-4 h-4" color={profile.color} />
            </span>
            <span className="profile-label" style={{ color: profile.color }}>
              {profile.label} Route
            </span>
            {isFallback && <span className="legend-badge legend-badge--warn">Direct path</span>}
          </div>

          <div className="legend-profiles">
            {PROFILES.map((p) => {
              const IconComponent = p.icon;
              const isActive = activeProfile === p.key;
              return (
                <button
                  key={p.key}
                  data-profile={p.key}
                  className={`legend-profile-btn ${isActive ? "legend-profile-btn--active" : ""}`}
                  onClick={() => onProfileChange?.(p.key)}
                  title={p.label}
                >
                  <span className="legend-profile-icon">
                    <IconComponent className="w-4 h-4" color={isActive ? p.color : "currentColor"} />
                  </span>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          {/* Voice Guidance Toggle Button */}
          <button
            className={`legend-voice-btn ${isVoiceEnabled ? "legend-voice-btn--active" : ""}`}
            onClick={toggleVoice}
            title={isVoiceEnabled ? "Disable voice guidance" : "Enable voice guidance"}
          >
            
            <span className="voice-text">
              {isVoiceEnabled ? "Voice guidance ON" : "Voice guidance OFF"}
            </span>
            <span className="voice-status">{isVoiceEnabled ? "🔊" : "🔇"}</span>
          </button>

          <div className="legend-divider" />

          {hasRoute && (
            <>
              <div className="legend-stats-grid">
                <div className="legend-stat-card">
                  <span className="stat-card-icon">
                    <WalkIcon className="w-5 h-5" color="#22c55e" />
                  </span>
                  <div className="stat-card-info">
                    <span className="stat-card-value">{walkTime}</span>
                    <span className="stat-card-label">Walk</span>
                  </div>
                </div>
                <div className="legend-stat-divider" />
                <div className="legend-stat-card">
                  <span className="stat-card-icon">
                    <CarIcon className="w-5 h-5" color="#f59e0b" />
                  </span>
                  <div className="stat-card-info">
                    <span className="stat-card-value">{carTime}</span>
                    <span className="stat-card-label">Drive</span>
                  </div>
                </div>
                <div className="legend-stat-divider" />
                <div className="legend-stat-card">
                  <span className="stat-card-icon">
                    <RulerIcon className="w-5 h-5" color="#3b82f6" />
                  </span>
                  <div className="stat-card-info">
                    <span className="stat-card-value">{formatDistance(distMeters)}</span>
                    <span className="stat-card-label">Distance</span>
                  </div>
                </div>
              </div>

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
                    className={`legend-traffic-bar-fill ${traffic.level.toLowerCase().replace(" ", "-")}`}
                    style={{ width: getBarWidth() }}
                  />
                </div>
              </div>
            </>
          )}

          <button className="legend-share-btn" onClick={handleShareLocation}>
            <span className="share-icon"><ShareIcon className="w-4 h-4" color="#3b82f6" /></span>
            <span>Share my location</span>
          </button>

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
                    <span className="alt-time">{estimatedTime}</span>
                  </div>
                  <span className="alt-dist">{formatDistance(distMeters)}</span>
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
                      <span className="alt-time">{formatTravelTime(alt.totalDistance, vehicleMode)}</span>
                    </div>
                    <span className="alt-dist">{formatDistance(alt.totalDistance)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {hasWarnings && (
            <>
              <div className="legend-divider" />
              <div className="legend-warnings">
                {warnings.map((w, i) => {
                  const WarningIcon = w.type === "danger" ? IconWarning : IconInfo;
                  const warningColor = w.type === "danger" ? "#ef4444" : "#3b82f6";
                  return (
                    <div key={i} className={`legend-warning legend-warning--${w.type || "info"}`}>
                      <span className="warning-icon">
                        <WarningIcon className="w-4 h-4" color={warningColor} />
                      </span>
                      <span className="warning-text">{w.message}</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {isFallback && (
            <div className="legend-fallback-note">
              ⚡ Direct connection used — small gap in road data
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default Legend;