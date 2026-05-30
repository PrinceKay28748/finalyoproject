// components/Map/RouteLayer.jsx

import { useEffect, useRef, useState, useCallback } from "react";
import { Polyline } from "react-leaflet";
import { ROUTE_COLORS } from "../../function/utils/colors";
import { useVoiceGuidance } from "../../hooks/useVoiceGuidance";
import { useFocus } from "../../context/FocusContext";
import { useSmoothRoutePosition } from "../../hooks/useSmoothRoutePosition";
import { generateDirections } from "../../services/directions";
import { findClosestPointOnRoute } from "../../function/utils/geometry";
import "./RouteLayer.css";

const MIN_DURATION_MS = 800;
const MAX_DURATION_MS = 2000;

function getAnimationDuration(totalPoints) {
  return Math.max(MIN_DURATION_MS, Math.min(MAX_DURATION_MS, MIN_DURATION_MS + totalPoints * 8));
}

function findClosestRouteIndexOptimized(coordinates, currentLocation, thresholdMeters = 50) {
  if (!coordinates?.length || !currentLocation) return -1;

  let closestIndex = -1;
  let minDistance  = Infinity;
  const step = Math.max(1, Math.floor(coordinates.length / 50));

  for (let i = 0; i < coordinates.length; i += step) {
    const p = coordinates[i];
    const d = Math.sqrt((p.lat - currentLocation.lat) ** 2 + (p.lng - currentLocation.lng) ** 2) * 111319;
    if (d < minDistance) { minDistance = d; closestIndex = i; }
  }

  const startIdx = Math.max(0, closestIndex - step);
  const endIdx   = Math.min(coordinates.length, closestIndex + step);
  for (let i = startIdx; i < endIdx; i++) {
    const p = coordinates[i];
    const d = Math.sqrt((p.lat - currentLocation.lat) ** 2 + (p.lng - currentLocation.lng) ** 2) * 111319;
    if (d < minDistance) { minDistance = d; closestIndex = i; }
  }

  return minDistance <= thresholdMeters ? closestIndex : -1;
}

const TURN_THRESHOLDS = [200, 100, 50];

export default function RouteLayer({
  route,
  visible = true,
  profile = "standard",
  currentLocation = null,
  showProgress = true,
  onTurnApproach = null,
  onRouteDirectionChange = null, // New: callback for parent to get direction
}) {
  const [displayedCoords,    setDisplayedCoords]    = useState([]);
  const [completedCoords,    setCompletedCoords]    = useState([]);
  const [remainingCoords,    setRemainingCoords]    = useState([]);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const [animationProgress,  setAnimationProgress]  = useState(0);
  const [instructions,       setInstructions]       = useState([]);
  const [hasAnnouncedArrival, setHasAnnouncedArrival] = useState(false);
  const [routeDirection, setRouteDirection] = useState(0);

  const animationRef          = useRef(null);
  const lastCompletedIndexRef = useRef(-1);
  const updateTimeoutRef      = useRef(null);
  const startTimeRef          = useRef(null);
  const progressIntervalRef   = useRef(null);

  const announcedTurnsRef = useRef(new Map());

  const mainColor      = ROUTE_COLORS[profile] || ROUTE_COLORS.standard;
  const completedColor = "#94a3b8";
  const remainingColor = mainColor;

  const { isVoiceEnabled, speakTurn, speakArrival } = useVoiceGuidance();
  const focus = useFocus();

  // Use smooth position hook
  const { position: smoothPosition, index: smoothIndex, progressRatio } = useSmoothRoutePosition(
    route?.coordinates,
    currentLocation,
    visible && showProgress
  );

  // Generate directions
  useEffect(() => {
    if (!visible || !route?.coordinates?.length) {
      setInstructions([]);
      announcedTurnsRef.current = new Map();
      setHasAnnouncedArrival(false);
      return;
    }
    const dirs = generateDirections(route.coordinates, route.roadNames || []);
    setInstructions(dirs);
    announcedTurnsRef.current = new Map();
    setHasAnnouncedArrival(false);
  }, [route, visible]);

  // Update completed/remaining based on smooth index
  useEffect(() => {
    if (!visible || !route?.coordinates?.length || !showProgress || smoothIndex === undefined) return;
    
    const intIndex = Math.floor(smoothIndex);
    if (intIndex >= 0 && intIndex !== lastCompletedIndexRef.current) {
      lastCompletedIndexRef.current = intIndex;
      setCompletedCoords(route.coordinates.slice(0, intIndex + 1).map((c) => [c.lat, c.lng]));
      setRemainingCoords(route.coordinates.slice(intIndex).map((c) => [c.lat, c.lng]));
    }
  }, [smoothIndex, route, visible, showProgress]);

  // Calculate route direction from smooth position for arrow
  useEffect(() => {
    if (!route?.coordinates?.length || !smoothPosition || !showProgress) return;
    
    const smoothIdx = smoothIndex;
    const nextIdx = Math.min(Math.floor(smoothIdx) + 1, route.coordinates.length - 1);
    
    if (nextIdx > Math.floor(smoothIdx)) {
      const currentPoint = route.coordinates[Math.floor(smoothIdx)];
      const nextPoint = route.coordinates[nextIdx];
      
      const lat1 = currentPoint.lat * Math.PI / 180;
      const lat2 = nextPoint.lat * Math.PI / 180;
      const lng1 = currentPoint.lng * Math.PI / 180;
      const lng2 = nextPoint.lng * Math.PI / 180;
      
      const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
      const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
      let bearing = Math.atan2(y, x) * 180 / Math.PI;
      bearing = (bearing + 360) % 360;
      
      setRouteDirection(bearing);
      
      // Notify parent component of direction for LocationMarker
      if (onRouteDirectionChange) {
        onRouteDirectionChange(bearing);
      }
    }
  }, [smoothPosition, smoothIndex, route, showProgress, onRouteDirectionChange]);

  // Progress monitoring + turn announcements (uses smooth position or raw location)
  useEffect(() => {
    if (!visible || !route?.coordinates?.length || !currentLocation || !isVoiceEnabled) return;

    const checkProgress = () => {
      // Use smooth position if available for turn announcements
      const posToUse = smoothPosition || currentLocation;
      
      const { distanceFromStart } = findClosestPointOnRoute(
        posToUse.lat,
        posToUse.lng,
        route.coordinates
      );

      const totalDistance = (route.totalDistanceKm ?? route.totalDistance / 1000) * 1000;
      const remaining     = totalDistance - distanceFromStart;

      if (remaining <= 30 && !hasAnnouncedArrival) {
        setHasAnnouncedArrival(true);
        speakArrival();
        return;
      }

      for (let i = 0; i < instructions.length; i++) {
        const turn = instructions[i];
        if (turn.isDestination) continue;

        const distanceToTurn = turn.distance - distanceFromStart;
        if (distanceToTurn < 0) continue;
        if (distanceToTurn > TURN_THRESHOLDS[0] + 20) continue;

        for (const threshold of TURN_THRESHOLDS) {
          if (distanceToTurn <= threshold) {
            const announced = announcedTurnsRef.current.get(i) || new Set();
            if (!announced.has(threshold)) {
              announced.add(threshold);
              announcedTurnsRef.current.set(i, announced);
              const instruction = turn.instruction || 'Continue';
              speakTurn(instruction, distanceToTurn, threshold <= 50 ? 'immediate' : 'normal');
              break;
            }
          }
        }
      }
    };

    checkProgress();
    progressIntervalRef.current = setInterval(checkProgress, 2000);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [currentLocation, smoothPosition, route, visible, isVoiceEnabled, instructions, speakTurn, speakArrival, hasAnnouncedArrival]);

  // Route draw animation — only runs when route/visible/profile changes
  useEffect(() => {
    if (!visible || !route?.coordinates?.length) {
      setDisplayedCoords([]);
      setIsAnimationComplete(false);
      setCompletedCoords([]);
      setRemainingCoords([]);
      setAnimationProgress(0);
      lastCompletedIndexRef.current = -1;
      if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; }
      return;
    }

    const coords   = route.coordinates.map((c) => [c.lat, c.lng]);
    const total    = coords.length;
    const duration = getAnimationDuration(total);

    setDisplayedCoords([]);
    setIsAnimationComplete(false);
    setAnimationProgress(0);
    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed      = timestamp - startTimeRef.current;
      const progress     = Math.min(1, elapsed / duration);
      const easedProgress = 1 - Math.pow(1 - progress, 2);
      setAnimationProgress(easedProgress);

      const pointsToShow = Math.floor(total * easedProgress);

      if (pointsToShow >= total) {
        setDisplayedCoords(coords);
        setIsAnimationComplete(true);
        setAnimationProgress(1);
        animationRef.current = null;
      } else {
        setDisplayedCoords(coords.slice(0, pointsToShow));
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; } };
  }, [route, visible, profile]);

  if (!visible || (displayedCoords.length < 2 && completedCoords.length < 2 && remainingCoords.length < 2)) {
    return null;
  }

  // Determine focus classes
  const isRouteFocused = focus.isFocused('route', route?.id);
  const routeFocusClass = isRouteFocused ? 'route--focused' : (focus.hasFocus ? 'route--blurred' : '');

  if (showProgress && isAnimationComplete && (completedCoords.length > 0 || remainingCoords.length > 0)) {
    return (
      <>
        {completedCoords.length >= 2 && (
          <Polyline
            positions={completedCoords}
            color={completedColor}
            weight={5}
            opacity={isRouteFocused ? 0.5 : 0.4}
            smoothFactor={2}
            lineCap="round"
            lineJoin="round"
            className={`route-completed ${routeFocusClass}`}
          />
        )}
        {remainingCoords.length >= 2 && (
          <>
            <Polyline
              positions={remainingCoords}
              color={remainingColor}
              weight={9}
              opacity={isRouteFocused ? 1 : 0.95}
              smoothFactor={2}
              lineCap="round"
              lineJoin="round"
              className={`route-remaining ${routeFocusClass}`}
              eventHandlers={!isRouteFocused ? { click: () => focus.setFocus('route', route?.id, 'tap') } : {}}
            />
            <Polyline
              positions={remainingCoords}
              color={remainingColor}
              weight={14}
              opacity={isRouteFocused ? 0.25 : 0.15}
              smoothFactor={2}
              lineCap="round"
              lineJoin="round"
              className={`route-remaining-glow ${routeFocusClass}`}
            />
          </>
        )}
      </>
    );
  }

  return (
    <>
      <Polyline
        positions={displayedCoords}
        color={mainColor}
        weight={14}
        opacity={0.1 * Math.min(1, animationProgress * 1.5)}
        smoothFactor={2}
        lineCap="round"
        lineJoin="round"
        className={`route-glow ${routeFocusClass}`}
      />
      <Polyline
        positions={displayedCoords}
        color={mainColor}
        weight={9}
        opacity={0.95}
        smoothFactor={2}
        lineCap="round"
        lineJoin="round"
        className={`${isAnimationComplete ? "route-main route-complete" : "route-main route-animating"} ${routeFocusClass}`}
        eventHandlers={!isRouteFocused ? { click: () => focus.setFocus('route', route?.id, 'tap') } : {}}
      />
    </>
  );
}