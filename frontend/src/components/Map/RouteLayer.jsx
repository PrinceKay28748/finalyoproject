// components/Map/RouteLayer.jsx

import { useEffect, useRef, useState, useCallback } from "react";
import { Polyline } from "react-leaflet";
import { ROUTE_COLORS } from "../../function/utils/colors";
import { useVoiceGuidance } from "../../hooks/useVoiceGuidance";
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

// Three announcement thresholds in descending order (metres)
const TURN_THRESHOLDS = [200, 100, 50];

export default function RouteLayer({
  route,
  visible = true,
  profile = "standard",
  currentLocation = null,
  showProgress = true,
  onTurnApproach = null,
}) {
  const [displayedCoords,    setDisplayedCoords]    = useState([]);
  const [completedCoords,    setCompletedCoords]    = useState([]);
  const [remainingCoords,    setRemainingCoords]    = useState([]);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const [animationProgress,  setAnimationProgress]  = useState(0);
  const [instructions,       setInstructions]       = useState([]);
  const [hasAnnouncedArrival, setHasAnnouncedArrival] = useState(false);

  const animationRef          = useRef(null);
  const lastCompletedIndexRef = useRef(-1);
  const updateTimeoutRef      = useRef(null);
  const startTimeRef          = useRef(null);
  const progressIntervalRef   = useRef(null);

  // Ref-based announced turn tracking: Map<turnIndex, Set<threshold>>
  // Using a ref (not state) prevents stale closures inside setInterval.
  const announcedTurnsRef = useRef(new Map());

  const mainColor      = ROUTE_COLORS[profile] || ROUTE_COLORS.standard;
  const completedColor = "#94a3b8";
  const remainingColor = mainColor;

  const { isVoiceEnabled, speakTurn, speakArrival } = useVoiceGuidance();

  // Generate directions (pass roadNames so instructions include street names)
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

  // Progress monitoring + turn announcements
  useEffect(() => {
    if (!visible || !route?.coordinates?.length || !currentLocation || !isVoiceEnabled) return;

    const checkProgress = () => {
      const { distanceFromStart } = findClosestPointOnRoute(
        currentLocation.lat,
        currentLocation.lng,
        route.coordinates
      );

      const totalDistance = (route.totalDistanceKm ?? route.totalDistance / 1000) * 1000;
      const remaining     = totalDistance - distanceFromStart;

      // Arrival check
      if (remaining <= 30 && !hasAnnouncedArrival) {
        setHasAnnouncedArrival(true);
        speakArrival();
        return;
      }

      // Turn announcements — iterate all upcoming turns
      for (let i = 0; i < instructions.length; i++) {
        const turn = instructions[i];
        if (turn.isDestination) continue;

        const distanceToTurn = turn.distance - distanceFromStart;

        // Skip turns already passed
        if (distanceToTurn < 0) continue;
        // Skip turns too far away (beyond our outermost threshold)
        if (distanceToTurn > TURN_THRESHOLDS[0] + 20) continue;

        // Check each threshold from largest to smallest
        for (const threshold of TURN_THRESHOLDS) {
          if (distanceToTurn <= threshold) {
            const announced = announcedTurnsRef.current.get(i) || new Set();
            if (!announced.has(threshold)) {
              announced.add(threshold);
              announcedTurnsRef.current.set(i, announced);

              // Build the instruction text with road name if available
              const instruction = turn.instruction || 'Continue';
              speakTurn(instruction, distanceToTurn, threshold <= 50 ? 'immediate' : 'normal');

              // Only announce the closest unannounced threshold per interval tick
              break;
            }
          }
        }
      }
    };

    // Run immediately then on interval
    checkProgress();
    progressIntervalRef.current = setInterval(checkProgress, 2000);

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
    // hasAnnouncedArrival intentionally excluded — we read it inside via closure
    // but don't want to restart the interval every time it flips.
  }, [currentLocation, route, visible, isVoiceEnabled, instructions, speakTurn, speakArrival]);

  // Debounced progress update (completed/remaining split)
  const updateProgress = useCallback((coords, location) => {
    if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    updateTimeoutRef.current = setTimeout(() => {
      const closestIndex = findClosestRouteIndexOptimized(coords, location);
      if (closestIndex !== -1 && closestIndex !== lastCompletedIndexRef.current) {
        lastCompletedIndexRef.current = closestIndex;
        setCompletedCoords(coords.slice(0, closestIndex + 1).map((c) => [c.lat, c.lng]));
        setRemainingCoords(coords.slice(closestIndex).map((c) => [c.lat, c.lng]));
      }
      updateTimeoutRef.current = null;
    }, 100);
  }, []);

  // Route draw animation
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
        if (currentLocation && showProgress) {
          const ci = findClosestRouteIndexOptimized(route.coordinates, currentLocation);
          if (ci !== -1) {
            lastCompletedIndexRef.current = ci;
            setCompletedCoords(route.coordinates.slice(0, ci + 1).map((c) => [c.lat, c.lng]));
            setRemainingCoords(route.coordinates.slice(ci).map((c) => [c.lat, c.lng]));
          }
        }
        animationRef.current = null;
      } else {
        setDisplayedCoords(coords.slice(0, pointsToShow));
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => { if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = null; } };
  }, [route, visible, profile, currentLocation, showProgress]);

  // Keep completed/remaining in sync with GPS movement
  useEffect(() => {
    if (!visible || !route?.coordinates?.length || !showProgress || !currentLocation) return;
    updateProgress(route.coordinates, currentLocation);
  }, [route, visible, currentLocation, showProgress, updateProgress]);

  if (!visible || (displayedCoords.length < 2 && completedCoords.length < 2 && remainingCoords.length < 2)) {
    return null;
  }

  if (showProgress && isAnimationComplete && (completedCoords.length > 0 || remainingCoords.length > 0)) {
    return (
      <>
        {completedCoords.length >= 2 && (
          <>
            <Polyline positions={completedCoords} color={completedColor} weight={5}  opacity={0.4}  smoothFactor={2} lineCap="round" lineJoin="round" className="route-completed" />
            <Polyline positions={completedCoords} color={completedColor} weight={5}  opacity={0.2}  smoothFactor={2} lineCap="round" lineJoin="round" dashArray="5, 10" className="route-completed-dashed" />
          </>
        )}
        {remainingCoords.length >= 2 && (
          <>
            <Polyline positions={remainingCoords} color={remainingColor} weight={6}  opacity={0.95} smoothFactor={2} lineCap="round" lineJoin="round" className="route-remaining" />
            <Polyline positions={remainingCoords} color={remainingColor} weight={14} opacity={0.15} smoothFactor={2} lineCap="round" lineJoin="round" className="route-remaining-glow" />
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
        className="route-glow"
      />
      <Polyline
        positions={displayedCoords}
        color={mainColor}
        weight={5}
        opacity={0.95}
        smoothFactor={2}
        lineCap="round"
        lineJoin="round"
        className={isAnimationComplete ? "route-main route-complete" : "route-main route-animating"}
      />
    </>
  );
}