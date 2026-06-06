// components/Legend/Legend.jsx

import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
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
import { useFocus } from "../../context/FocusContext";
import { generateDirections } from "../../services/directions";
import WeatherBanner from "./WeatherBanner";
import "./Legend.css";
import "./LegendProfile.css";

function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatTravelTime(meters, vehicleMode = "walk") {
  let speedKmh;
  if (vehicleMode === "walk") speedKmh = 5;
  else if (vehicleMode === "car") speedKmh = 30;
  else if (vehicleMode === "motorcycle") speedKmh = 25;
  else speedKmh = 5;

  const minutes = Math.ceil(meters / ((speedKmh * 1000) / 60));
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

const DirectionIcon = {
  start: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polygon points="12 6 12 18" />
      <polygon points="8 10 12 6 16 10" />
    </svg>
  ),
  straight: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="4" x2="12" y2="20" />
      <polyline points="16 16 12 20 8 16" />
    </svg>
  ),
  "slight-right": () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M7 17 L14 17 L14 10" />
      <path d="M14 17 L19 12 L14 7" />
    </svg>
  ),
  "turn-right": () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 19 L5 11 L14 11" />
      <path d="M10 6 L14 11 L10 16" />
    </svg>
  ),
  "sharp-right": () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 19 L5 9 L15 9" />
      <polyline points="11 5 15 9 11 13" />
    </svg>
  ),
  "slight-left": () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M17 17 L10 17 L10 10" />
      <path d="M10 17 L5 12 L10 7" />
    </svg>
  ),
  "turn-left": () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 19 L19 11 L10 11" />
      <path d="M14 6 L10 11 L14 16" />
    </svg>
  ),
  "sharp-left": () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M19 19 L19 9 L9 9" />
      <polyline points="13 5 9 9 13 13" />
    </svg>
  ),
  destination: () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#22c55e"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="3" fill="#22c55e" />
    </svg>
  ),
};

function getFallbackArrow(maneuver) {
  const arrowMap = {
    straight: "↑",
    "slight-right": "↗",
    "turn-right": "→",
    "sharp-right": "↘",
    "slight-left": "↖",
    "turn-left": "←",
    "sharp-left": "↙",
    destination: "📍",
    start: "🚗",
  };
  return arrowMap[maneuver] || "•";
}

function getDirectionIcon(maneuver, isFirst, isLast) {
  if (isFirst) {
    const I = DirectionIcon.start;
    return <I />;
  }
  if (isLast) {
    const I = DirectionIcon.destination;
    return <I />;
  }
  const I = DirectionIcon[maneuver];
  if (I) return <I />;
  return (
    <span style={{ fontSize: "18px", fontWeight: 500 }}>
      {getFallbackArrow(maneuver)}
    </span>
  );
}

function getTrafficInfo() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  if (day === 0)
    return {
      level: "Very Low",
      icon: "⚪",
      multiplier: 1.0,
      message: "Sunday — very light activity",
    };
  if (day === 6)
    return {
      level: "Low",
      icon: "🟢",
      multiplier: 1.1,
      message: "Saturday — light traffic",
    };

  const peakHours = [8, 9, 12, 13, 16, 17];
  if (peakHours.includes(hour))
    return {
      level: "Heavy",
      icon: "🔴",
      multiplier: 1.5,
      message: "Peak hours — busy paths",
    };
  if (hour >= 6 && hour < 18)
    return {
      level: "Moderate",
      icon: "🟡",
      multiplier: 1.3,
      message: "Moderate traffic",
    };
  return { level: "Low", icon: "⚫", multiplier: 1.0, message: "Low traffic" };
}

const PROFILE_CONFIG = {
  standard: { label: "Standard", color: "#2563eb", icon: IconMap },
  accessible: {
    label: "Accessible",
    color: "#8b5cf6",
    icon: IconAccessibility,
  },
  night: { label: "Night Safety", color: "#f59e0b", icon: IconMoon },
  fastest: { label: "Fastest", color: "#22c55e", icon: IconBolt },
};

const PROFILES = [
  { key: "standard", icon: IconMap, label: "Standard", color: "#2563eb" },
  {
    key: "accessible",
    icon: IconAccessibility,
    label: "Accessible",
    color: "#8b5cf6",
  },
  { key: "night", icon: IconMoon, label: "Night", color: "#f59e0b" },
  { key: "fastest", icon: IconBolt, label: "Fastest", color: "#22c55e" },
];

const Legend = forwardRef(function Legend(
  {
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
    autoCollapse = false,
    disableDrag = false,
    onNavPanelClose,
    onDragProgress,
  },
  ref,
) {
  const [expanded, setExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [directions, setDirections] = useState([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(-1);
  const [wasExpandedBeforeCollapse, setWasExpandedBeforeCollapse] =
    useState(true);

  // ── Drag state refs (never cause re-renders) ─────────────────────────────
  const dragStartY = useRef(0);
  const dragStartScrollTop = useRef(0);
  const dragCurrentY = useRef(0);
  const dragStartExpanded = useRef(true);
  const dragVelocity = useRef(0);
  const lastDragTime = useRef(0);
  const lastDragY = useRef(0);
  const expandedTranslateY = useRef(0);
  const peekTranslateY = useRef(0);
  const userManuallyPeeked = useRef(false);

  const sheetRef = useRef(null);
  const headerRef = useRef(null);
  const directionsRef = useRef(null);
  const peekHeight = 70;

  const lastAnnouncedRouteIdRef = useRef(null);
  const pendingRouteSummaryRef = useRef(null);

  const { isVoiceEnabled, toggleVoice, speak } = useVoiceGuidance();
  const focus = useFocus();

  // ── Helper to get safe area bottom inset ─────────────────────────────────
  const getSafeAreaBottom = () => {
    const style = getComputedStyle(document.documentElement);
    const safeArea = style.getPropertyValue('padding-bottom');
    return parseInt(safeArea) || 0;
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  const setTranslate = (y) => {
    if (sheetRef.current) {
      const isDesktop = window.innerWidth >= 1024;
      if (isDesktop) {
        sheetRef.current.style.transform = `translateX(-50%) translateY(${y}px)`;
      } else {
        sheetRef.current.style.transform = `translateY(${y}px)`;
      }
    }
  };

  const snapTo = (targetY) => {
    const el = sheetRef.current;
    if (!el) return;
    el.classList.add("legend-sheet--snapping");
    const isDesktop = window.innerWidth >= 1024;
    const safeAreaBottom = getSafeAreaBottom();
    // Adjust target if snapping to peek position
    const adjustedTarget = targetY === peekTranslateY.current ? targetY + safeAreaBottom : targetY;
    if (isDesktop) {
      el.style.transform = `translateX(-50%) translateY(${adjustedTarget}px)`;
    } else {
      el.style.transform = `translateY(${adjustedTarget}px)`;
    }
    const onEnd = () => {
      el.classList.remove("legend-sheet--snapping");
      el.removeEventListener("transitionend", onEnd);
    };
    el.addEventListener("transitionend", onEnd);
  };

  const recalcPositions = () => {
    if (!sheetRef.current) return;
    const h = sheetRef.current.offsetHeight;
    const safeAreaBottom = getSafeAreaBottom();
    peekTranslateY.current = Math.max(0, h - peekHeight + safeAreaBottom);
    expandedTranslateY.current = 0;
  };

  // ── Mount: NO AUTO-SLIDE ANIMATION - Legend starts at peek position ──────
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    
    // Ensure legend starts at peek position (bottom) without animation
    requestAnimationFrame(() => {
      recalcPositions();
      snapTo(peekTranslateY.current);
    });
  }, []);

  // ── Recalc peek position whenever expanded changes ───────────────────────
  useEffect(() => {
    requestAnimationFrame(() => {
      recalcPositions();
      snapTo(expanded ? expandedTranslateY.current : peekTranslateY.current);
    });
  }, [expanded]);

  // ── Voice ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (route?.totalDistance) {
      pendingRouteSummaryRef.current = {
        distance: formatDistance(route.totalDistance),
        time: formatTravelTime(route.totalDistance, vehicleMode),
      };
    } else {
      pendingRouteSummaryRef.current = null;
    }
  }, [route, vehicleMode]);

  const handleVoiceToggle = () => {
    const wasEnabled = isVoiceEnabled;
    toggleVoice();
    if (!wasEnabled && pendingRouteSummaryRef.current) {
      const { distance, time } = pendingRouteSummaryRef.current;
      setTimeout(
        () => speak(`Route calculated. ${distance}, about ${time}.`),
        100,
      );
    }
  };

  // ── Auto-collapse when NavPanel opens ────────────────────────────────────
  useEffect(() => {
    if (autoCollapse && expanded) {
      setWasExpandedBeforeCollapse(true);
      setExpanded(false);
    } else if (!autoCollapse && wasExpandedBeforeCollapse && !expanded) {
      if (!userManuallyPeeked.current) {
        setExpanded(true);
      }
      setWasExpandedBeforeCollapse(false);
      userManuallyPeeked.current = false;
    }
  }, [autoCollapse]);

  // ── Directions ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (route?.coordinates?.length > 0) {
      const dirs = generateDirections(route.coordinates, route.roadNames || []);
      setDirections(dirs);
      setCurrentStepIndex(-1);
    } else {
      setDirections([]);
      setCurrentStepIndex(-1);
    }
  }, [route]);

  useEffect(() => {
    if (currentStepIndex >= 0 && directionsRef.current) {
      const el = directionsRef.current.querySelector(
        `[data-step-index="${currentStepIndex}"]`,
      );
      el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [currentStepIndex]);

  useEffect(() => {
    if (
      !currentLocation ||
      !route?.coordinates?.length ||
      directions.length === 0
    )
      return;
    let minDist = Infinity,
      closestIndex = 0;
    for (let i = 0; i < route.coordinates.length; i++) {
      const p = route.coordinates[i];
      const d =
        Math.sqrt(
          (p.lat - currentLocation.lat) ** 2 +
            (p.lng - currentLocation.lng) ** 2,
        ) * 111319;
      if (d < minDist) {
        minDist = d;
        closestIndex = i;
      }
    }
    let distFromStart = 0;
    for (let i = 1; i <= closestIndex; i++) {
      const a = route.coordinates[i - 1],
        b = route.coordinates[i];
      distFromStart +=
        Math.sqrt((a.lat - b.lat) ** 2 + (a.lng - b.lng) ** 2) * 111319;
    }
    for (let i = 0; i < directions.length; i++) {
      if (
        directions[i].distance > distFromStart ||
        directions[i].isDestination
      ) {
        setCurrentStepIndex(i);
        break;
      }
    }
  }, [currentLocation, route, directions]);

  // ── Imperative handle ────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    collapse: () => {
      if (expanded) setExpanded(false);
    },
    expand: () => {
      if (!expanded) setExpanded(true);
    },
    isExpanded: () => expanded,
  }));

  useEffect(() => {
    onExpandedChange?.(expanded);
  }, [expanded, onExpandedChange]);

  useEffect(() => {
    if (!isVoiceEnabled || !route?.totalDistance) return;
    const routeId = `${route.totalDistance}-${route.coordinates?.length ?? 0}`;
    if (lastAnnouncedRouteIdRef.current === routeId) return;
    lastAnnouncedRouteIdRef.current = routeId;
    speak(
      `Route calculated. ${formatDistance(route.totalDistance)}, about ${formatTravelTime(route.totalDistance, vehicleMode)}.`,
    );
  }, [route, isVoiceEnabled, vehicleMode, speak]);

  // ── Report drag progress for map blur ────────────────────────────────────
  const reportDragProgress = (currentY) => {
    if (!onDragProgress) return;
    const minY = expandedTranslateY.current;
    const maxY = peekTranslateY.current;
    const range = maxY - minY;
    if (range <= 0) {
      onDragProgress(0);
      return;
    }
    const progress = 1 - Math.max(0, Math.min(1, (currentY - minY) / range));
    onDragProgress(progress);
  };

  // ── DRAG HANDLERS ────────────────────────────────────────────────────────

  const handleDragStart = (e) => {
    if (disableDrag) return;
    e.stopPropagation();
    e.preventDefault();

    recalcPositions();

    const clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragCurrentY.current = clientY;
    lastDragY.current = clientY;
    lastDragTime.current = performance.now();
    dragVelocity.current = 0;
    dragStartExpanded.current = expanded;

    dragStartScrollTop.current = expanded
      ? expandedTranslateY.current
      : peekTranslateY.current;

    setIsDragging(true);

    const el = sheetRef.current;
    if (el) {
      el.classList.remove("legend-sheet--snapping");
      el.classList.add("dragging");
    }
  };

  const handleDragMove = (e) => {
    if (!isDragging) return;
    e.stopPropagation();
    e.preventDefault();

    const clientY = e.type.includes("touch") ? e.touches[0].clientY : e.clientY;
    const now = performance.now();
    const dt = Math.max(1, now - lastDragTime.current);

    dragVelocity.current =
      0.7 * dragVelocity.current + 0.3 * ((clientY - lastDragY.current) / dt);
    lastDragY.current = clientY;
    lastDragTime.current = now;

    const delta = clientY - dragStartY.current;
    const rawY = dragStartScrollTop.current + delta;

    const minY = expandedTranslateY.current;
    const maxY = peekTranslateY.current;

    let clampedY;
    if (rawY < minY) {
      clampedY = minY + (rawY - minY) / 3;
    } else if (rawY > maxY) {
      clampedY = maxY + (rawY - maxY) / 3;
    } else {
      clampedY = rawY;
    }

    setTranslate(clampedY);

    const currentY = parseFloat(
      sheetRef.current?.style.transform?.match(/translateY\(([-\d.]+)px\)/)?.[1] ?? "0"
    );
    reportDragProgress(currentY);
  };

  const handleDragEnd = (e) => {
    if (!isDragging) return;
    e?.stopPropagation();
    e?.preventDefault();

    const el = sheetRef.current;
    if (el) el.classList.remove("dragging");
    setIsDragging(false);

    const currentY = parseFloat(
      el?.style.transform?.match(/translateY\(([-\d.]+)px\)/)?.[1] ?? "0",
    );

    const minY = expandedTranslateY.current;
    const maxY = peekTranslateY.current;
    const mid = (minY + maxY) / 2;

    let shouldExpand;
    if (Math.abs(dragVelocity.current) > 0.4) {
      shouldExpand = dragVelocity.current < 0;
    } else {
      shouldExpand = currentY < mid;
    }

    snapTo(shouldExpand ? minY : maxY);

    if (onDragProgress) {
      onDragProgress(shouldExpand ? 1 : 0);
    }

    if (shouldExpand !== expanded) {
      if (!shouldExpand) {
        userManuallyPeeked.current = true;
      }
      setExpanded(shouldExpand);
      if (shouldExpand && onNavPanelClose) onNavPanelClose();
    }
  };

  // ── Global move/up listeners while dragging ──────────────────────────────
  useEffect(() => {
    if (!isDragging) {
      document.body.classList.remove("dragging-legend");
      return;
    }
    document.body.classList.add("dragging-legend");

    const onMove = (e) => handleDragMove(e);
    const onUp = (e) => handleDragEnd(e);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onUp);

    return () => {
      document.body.classList.remove("dragging-legend");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };
  }, [isDragging]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (!visible) return null;

  const hasRoute = route && route.totalDistance;
  const distMeters = hasRoute ? route.totalDistance : null;
  const isFallback = route?.isFallback || false;
  const profile = PROFILE_CONFIG[activeProfile] || PROFILE_CONFIG.standard;
  const hasWarnings = warnings.length > 0;
  const hasAlts = alternatives.length > 0;
  const estimatedTime = hasRoute
    ? formatTravelTime(distMeters, vehicleMode)
    : null;
  const carTime = hasRoute ? formatTravelTime(distMeters, "car") : null;
  const walkTime = hasRoute ? formatTravelTime(distMeters, "walk") : null;
  const traffic = getTrafficInfo();

  const getBarWidth = () => {
    if (traffic.level === "Heavy") return "100%";
    if (traffic.level === "Moderate") return "70%";
    if (traffic.level === "Low") return "40%";
    if (traffic.level === "Very Low") return "20%";
    return "50%";
  };

  const ProfileIcon = profile.icon;
  const currentVehicle = {
    walk: { icon: "🚶", label: "Walk" },
    car: { icon: "🚗", label: "Drive" },
    motorcycle: { icon: "🏍️", label: "Ride" },
  }[vehicleMode] || { icon: "🚶", label: "Walk" };

  return (
    <div
      ref={sheetRef}
      className={`legend-sheet ${expanded ? "legend-sheet--expanded" : "legend-sheet--peek"}`}
    >
      {/* ── Drag zone (handle + peek row) ──────────────────────────────── */}
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

      {/* ── Expanded body ───────────────────────────────────────────────── */}
      {expanded && (
        <div className="legend-body">
          <div className="legend-profile">
            <span className="profile-icon">
              <ProfileIcon className="w-4 h-4" color={profile.color} />
            </span>
            <span className="profile-label" style={{ color: profile.color }}>
              {profile.label} Route
            </span>
            {isFallback && (
              <span className="legend-badge legend-badge--warn">
                Direct path
              </span>
            )}
          </div>

          <div className="legend-profiles">
            {PROFILES.map((p) => {
              const IconComponent = p.icon;
              const isActive = activeProfile === p.key;
              const isFocused = focus.isFocused('legendItem', `profile-${p.key}`);
              return (
                <button
                  key={p.key}
                  data-profile={p.key}
                  className={`legend-profile-btn ${isActive ? "legend-profile-btn--active" : ""} ${isFocused ? "item--focused" : ""}`}
                  onClick={() => {
                    focus.setFocus('legendItem', `profile-${p.key}`, 'legend');
                    onProfileChange?.(p.key);
                  }}
                  title={p.label}
                >
                  <span className="legend-profile-icon">
                    <IconComponent
                      className="w-4 h-4"
                      color={isActive ? p.color : "currentColor"}
                    />
                  </span>
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>

          <button
            className={`legend-voice-btn ${isVoiceEnabled ? "legend-voice-btn--active" : ""}`}
            onClick={handleVoiceToggle}
            title={
              isVoiceEnabled
                ? "Disable voice guidance"
                : "Enable voice guidance"
            }
            aria-pressed={isVoiceEnabled}
          >
            <span className="voice-text">
              {isVoiceEnabled ? "Voice guidance ON" : "Voice guidance OFF"}
            </span>
            <span className="voice-status">{isVoiceEnabled ? "🔊" : "🔇"}</span>
          </button>

          <WeatherBanner />

          <div className="legend-divider" />

          {hasRoute && (
            <>
              <div className="legend-stats-grid">
                <div className="legend-stat-card">
                  <span className="stat-card-icon">
                    <IconWalk className="w-5 h-5" color="#22c55e" />
                  </span>
                  <div className="stat-card-info">
                    <span className="stat-card-value">{walkTime}</span>
                    <span className="stat-card-label">Walk</span>
                  </div>
                </div>
                <div className="legend-stat-divider" />
                <div className="legend-stat-card">
                  <span className="stat-card-icon">
                    <IconCar className="w-5 h-5" color="#f59e0b" />
                  </span>
                  <div className="stat-card-info">
                    <span className="stat-card-value">{carTime}</span>
                    <span className="stat-card-label">Drive</span>
                  </div>
                </div>
                <div className="legend-stat-divider" />
                <div className="legend-stat-card">
                  <span className="stat-card-icon">
                    <IconRuler className="w-5 h-5" color="#3b82f6" />
                  </span>
                  <div className="stat-card-info">
                    <span className="stat-card-value">
                      {formatDistance(distMeters)}
                    </span>
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

          {directions.length > 0 && (
            <div className="legend-directions-section">
              <div className="legend-directions-header">
                <span className="directions-title">Directions</span>
                <span className="directions-steps-count">
                  {directions.length - 1} turns
                </span>
              </div>
              <div className="legend-directions-list" ref={directionsRef}>
                {directions.map((step, idx) => (
                  <div
                    key={idx}
                    data-step-index={idx}
                    className={`legend-direction-step
                      ${currentStepIndex === idx ? "legend-direction-step--active" : ""}
                      ${step.isDestination ? "legend-direction-step--destination" : ""}`}
                  >
                    <div className="direction-icon">
                      {getDirectionIcon(
                        step.maneuver,
                        idx === 0,
                        step.isDestination,
                      )}
                    </div>
                    <div className="direction-content">
                      <div className="direction-instruction">
                        {step.instruction}
                      </div>
                      {!step.isDestination && step.distance > 0 && (
                        <div className="direction-distance">
                          {formatDistance(step.distance)}
                        </div>
                      )}
                    </div>
                    {currentStepIndex === idx && (
                      <div className="direction-active-indicator" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <button className="legend-share-btn" onClick={handleShareLocation}>
            <span className="share-icon">
              <IconShare className="w-4 h-4" color="#3b82f6" />
            </span>
            <span>Share my location</span>
          </button>

          {hasAlts && (
            <>
              <div className="legend-divider" />
              <p className="legend-alts-label">Alternative routes</p>
              <div className="legend-alts">
                <div
                  className={`legend-alt ${activeAlternativeIndex === 0 ? "legend-alt--active" : ""} ${focus.isFocused('legendItem', 'alt-0') ? 'item--focused' : ''}`}
                  onClick={() => {
                    focus.setFocus('legendItem', 'alt-0', 'legend');
                    onSelectAlternative?.(0);
                  }}
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
                    className={`legend-alt ${activeAlternativeIndex === i + 1 ? "legend-alt--active" : ""} ${focus.isFocused('legendItem', `alt-${i + 1}`) ? 'item--focused' : ''}`}
                    onClick={() => {
                      focus.setFocus('legendItem', `alt-${i + 1}`, 'legend');
                      onSelectAlternative?.(i + 1);
                    }}
                  >
                    <span className="alt-line alt-line--secondary" />
                    <div className="alt-info">
                      <span className="alt-name">Alternative {i + 1}</span>
                      <span className="alt-time">
                        {formatTravelTime(alt.totalDistance, vehicleMode)}
                      </span>
                    </div>
                    <span className="alt-dist">
                      {formatDistance(alt.totalDistance)}
                    </span>
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
                  const WarningIcon =
                    w.type === "danger" ? IconWarning : IconInfo;
                  const warningColor =
                    w.type === "danger" ? "#ef4444" : "#3b82f6";
                  return (
                    <div
                      key={i}
                      className={`legend-warning legend-warning--${w.type || "info"}`}
                    >
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

  function handleShareLocation() {
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
  }
});

export default Legend;