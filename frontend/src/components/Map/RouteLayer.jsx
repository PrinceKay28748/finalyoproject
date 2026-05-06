import { useEffect, useRef, useState, useCallback } from "react";
import { Polyline } from "react-leaflet";
import { ROUTE_COLORS } from "../../function/utils/colors";
import { useVoiceGuidance } from "../../hooks/useVoiceGuidance";
import { generateDirections, findNextTurn, hasReachedDestination } from "../../services/directions";
import { findClosestPointOnRoute } from "../../function/utils/geometry";
import "./RouteLayer.css";

const EASING = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const MIN_DURATION_MS = 800;
const MAX_DURATION_MS = 2000;

// Calculate animation duration based on route length
function getAnimationDuration(totalPoints) {
  const duration = Math.min(MAX_DURATION_MS, MIN_DURATION_MS + totalPoints * 8);
  return Math.max(MIN_DURATION_MS, duration);
}

// Find closest point on route to current location
function findClosestRouteIndexOptimized(
  coordinates,
  currentLocation,
  thresholdMeters = 50,
) {
  if (!coordinates?.length || !currentLocation) return -1;

  let closestIndex = -1;
  let minDistance = Infinity;

  const step = Math.max(1, Math.floor(coordinates.length / 50));

  for (let i = 0; i < coordinates.length; i += step) {
    const point = coordinates[i];
    const latDiff = point.lat - currentLocation.lat;
    const lngDiff = point.lng - currentLocation.lng;
    const distanceMeters =
      Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111319;

    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      closestIndex = i;
    }
  }

  const startIdx = Math.max(0, closestIndex - step);
  const endIdx = Math.min(coordinates.length, closestIndex + step);

  for (let i = startIdx; i < endIdx; i++) {
    const point = coordinates[i];
    const latDiff = point.lat - currentLocation.lat;
    const lngDiff = point.lng - currentLocation.lng;
    const distanceMeters =
      Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111319;

    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      closestIndex = i;
    }
  }

  return minDistance <= thresholdMeters ? closestIndex : -1;
}

export default function RouteLayer({
  route,
  visible = true,
  profile = "standard",
  currentLocation = null,
  showProgress = true,
  onTurnApproach = null,
}) {
  const [displayedCoords, setDisplayedCoords] = useState([]);
  const [completedCoords, setCompletedCoords] = useState([]);
  const [remainingCoords, setRemainingCoords] = useState([]);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [instructions, setInstructions] = useState([]);
  const [lastAnnouncedTurnIndex, setLastAnnouncedTurnIndex] = useState(-1);
  const [hasAnnouncedArrival, setHasAnnouncedArrival] = useState(false);
  
  const animationRef = useRef(null);
  const lastCompletedIndexRef = useRef(-1);
  const updateTimeoutRef = useRef(null);
  const startTimeRef = useRef(null);
  const progressIntervalRef = useRef(null);

  const mainColor = ROUTE_COLORS[profile] || ROUTE_COLORS.standard;
  const completedColor = "#94a3b8";
  const remainingColor = mainColor;

  const { isVoiceEnabled, speakTurn, speakArrival } = useVoiceGuidance();

  // Generate directions when route is ready
  useEffect(() => {
    if (!visible || !route?.coordinates?.length) {
      setInstructions([]);
      setLastAnnouncedTurnIndex(-1);
      setHasAnnouncedArrival(false);
      return;
    }

    const dirs = generateDirections(route.coordinates);
    setInstructions(dirs);
    setLastAnnouncedTurnIndex(-1);
    setHasAnnouncedArrival(false);
  }, [route, visible]);

  // Track user progress and announce turns
  useEffect(() => {
    if (!visible || !route?.coordinates?.length || !currentLocation || !isVoiceEnabled) {
      return;
    }

    const checkProgressAndTurns = () => {
      // Find current position on route
      const { distanceFromStart } = findClosestPointOnRoute(
        currentLocation.lat,
        currentLocation.lng,
        route.coordinates
      );
      
      const totalDistance = route.totalDistanceKm * 1000;
      const remaining = totalDistance - distanceFromStart;
      
      // Check if arrived at destination
      if (remaining <= 30 && !hasAnnouncedArrival) {
        setHasAnnouncedArrival(true);
        speakArrival();
        return;
      }
      
      // Find next upcoming turn
      if (instructions.length > 0) {
        for (let i = 0; i < instructions.length; i++) {
          const turn = instructions[i];
          if (turn.isDestination) continue;
          
          const distanceToTurn = turn.distance - distanceFromStart;
          
          // Announce when within 100 meters and not announced before
          if (distanceToTurn <= 100 && distanceToTurn > 0 && i > lastAnnouncedTurnIndex) {
            setLastAnnouncedTurnIndex(i);
            
            let urgency = 'normal';
            let distance = distanceToTurn;
            
            if (distanceToTurn <= 50) {
              urgency = 'immediate';
              distance = 0;
            }
            
            speakTurn(turn.instruction, distance, urgency);
            break;
          }
        }
      }
    };
    
    // Check immediately
    checkProgressAndTurns();
    
    // Set up interval for continuous monitoring
    progressIntervalRef.current = setInterval(checkProgressAndTurns, 2000);
    
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
    };
  }, [currentLocation, route, visible, isVoiceEnabled, instructions, lastAnnouncedTurnIndex, hasAnnouncedArrival, speakTurn, speakArrival]);

  // Debounced progress update
  const updateProgress = useCallback((coords, location) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      const closestIndex = findClosestRouteIndexOptimized(coords, location);

      if (
        closestIndex !== -1 &&
        closestIndex !== lastCompletedIndexRef.current
      ) {
        lastCompletedIndexRef.current = closestIndex;

        const completed = coords.slice(0, closestIndex + 1);
        const remaining = coords.slice(closestIndex);

        setCompletedCoords(completed.map((c) => [c.lat, c.lng]));
        setRemainingCoords(remaining.map((c) => [c.lat, c.lng]));
      }
      updateTimeoutRef.current = null;
    }, 100);
  }, []);

  // Smooth animation using requestAnimationFrame
  useEffect(() => {
    if (!visible || !route?.coordinates?.length) {
      setDisplayedCoords([]);
      setIsAnimationComplete(false);
      setCompletedCoords([]);
      setRemainingCoords([]);
      setAnimationProgress(0);
      lastCompletedIndexRef.current = -1;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      return;
    }

    const coords = route.coordinates.map((c) => [c.lat, c.lng]);
    const total = coords.length;
    const duration = getAnimationDuration(total);

    setDisplayedCoords([]);
    setIsAnimationComplete(false);
    setAnimationProgress(0);
    startTimeRef.current = null;

    const animate = (timestamp) => {
      if (!startTimeRef.current) {
        startTimeRef.current = timestamp;
      }

      const elapsed = timestamp - startTimeRef.current;
      let progress = Math.min(1, elapsed / duration);

      // Apply easing for smoother motion
      const easedProgress = 1 - Math.pow(1 - progress, 2);
      setAnimationProgress(easedProgress);

      const pointsToShow = Math.floor(total * easedProgress);

      if (pointsToShow >= total) {
        setDisplayedCoords(coords);
        setIsAnimationComplete(true);
        setAnimationProgress(1);

        if (currentLocation && showProgress) {
          const closestIndex = findClosestRouteIndexOptimized(
            route.coordinates,
            currentLocation,
          );
          if (closestIndex !== -1) {
            lastCompletedIndexRef.current = closestIndex;
            const completed = route.coordinates.slice(0, closestIndex + 1);
            const remaining = route.coordinates.slice(closestIndex);
            setCompletedCoords(completed.map((c) => [c.lat, c.lng]));
            setRemainingCoords(remaining.map((c) => [c.lat, c.lng]));
          }
        }

        animationRef.current = null;
      } else {
        setDisplayedCoords(coords.slice(0, pointsToShow));
        animationRef.current = requestAnimationFrame(animate);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [route, visible, profile, currentLocation, showProgress]);

  useEffect(() => {
    if (
      !visible ||
      !route?.coordinates?.length ||
      !showProgress ||
      !currentLocation
    ) {
      return;
    }

    updateProgress(route.coordinates, currentLocation);
  }, [route, visible, currentLocation, showProgress, updateProgress]);

  if (
    !visible ||
    (displayedCoords.length < 2 &&
      completedCoords.length < 2 &&
      remainingCoords.length < 2)
  ) {
    return null;
  }

  if (
    showProgress &&
    isAnimationComplete &&
    (completedCoords.length > 0 || remainingCoords.length > 0)
  ) {
    return (
      <>
        {completedCoords.length >= 2 && (
          <>
            <Polyline
              positions={completedCoords}
              color={completedColor}
              weight={5}
              opacity={0.4}
              smoothFactor={2}
              lineCap="round"
              lineJoin="round"
              className="route-completed"
            />
            <Polyline
              positions={completedCoords}
              color={completedColor}
              weight={5}
              opacity={0.2}
              smoothFactor={2}
              lineCap="round"
              lineJoin="round"
              dashArray="5, 10"
              className="route-completed-dashed"
            />
          </>
        )}

        {remainingCoords.length >= 2 && (
          <>
            <Polyline
              positions={remainingCoords}
              color={remainingColor}
              weight={6}
              opacity={0.95}
              smoothFactor={2}
              lineCap="round"
              lineJoin="round"
              className="route-remaining"
            />
            <Polyline
              positions={remainingCoords}
              color={remainingColor}
              weight={14}
              opacity={0.15}
              smoothFactor={2}
              lineCap="round"
              lineJoin="round"
              className="route-remaining-glow"
            />
          </>
        )}
      </>
    );
  }

  // Animated route with fade-in effect based on progress
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
        className={
          isAnimationComplete
            ? "route-main route-complete"
            : "route-main route-animating"
        }
      />
    </>
  );
}