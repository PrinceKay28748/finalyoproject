// components/Map/RouteLayer.jsx

import { useEffect, useRef, useState } from "react";
import { Polyline } from "react-leaflet";
import { ROUTE_COLORS } from "../../function/utils/colors";
import "./RouteLayer.css";

const ANIMATION_DURATION_MS = 1200; // Slightly longer for smoother effect
const ANIMATION_STEPS = 60; // More steps for smoother drawing

// Helper function to find closest point on route to current location
function findClosestRouteIndex(coordinates, currentLocation, thresholdMeters = 50) {
  if (!coordinates?.length || !currentLocation) return -1;
  
  let closestIndex = -1;
  let minDistance = Infinity;
  
  for (let i = 0; i < coordinates.length; i++) {
    const point = coordinates[i];
    const latDiff = point.lat - currentLocation.lat;
    const lngDiff = point.lng - currentLocation.lng;
    // Rough Euclidean distance (in degrees) - convert to meters (approximately)
    const distanceMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111319;
    
    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      closestIndex = i;
    }
  }
  
  // If user is within threshold of the route, return the closest point index
  if (minDistance <= thresholdMeters) {
    return closestIndex;
  }
  
  return -1;
}

export default function RouteLayer({ 
  route, 
  visible = true, 
  profile = "standard",
  currentLocation = null,     // New prop: user's current location
  showProgress = true         // New prop: whether to show completed vs remaining
}) {
  const [displayedCoords, setDisplayedCoords] = useState([]);
  const [completedCoords, setCompletedCoords] = useState([]);
  const [remainingCoords, setRemainingCoords] = useState([]);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const animationRef = useRef(null);
  const lastCompletedIndexRef = useRef(-1);

  const mainColor = ROUTE_COLORS[profile] || ROUTE_COLORS.standard;
  const shadowColor = mainColor;
  const completedColor = "#94a3b8"; // Gray for completed portion
  const remainingColor = mainColor;   // Keep main color for remaining

  // Update route progress based on current location
  useEffect(() => {
    if (!visible || !route?.coordinates?.length || !showProgress || !currentLocation) {
      return;
    }
    
    const coords = route.coordinates;
    const closestIndex = findClosestRouteIndex(coords, currentLocation);
    
    if (closestIndex !== -1 && closestIndex !== lastCompletedIndexRef.current) {
      lastCompletedIndexRef.current = closestIndex;
      
      // Split route into completed and remaining
      const completed = coords.slice(0, closestIndex + 1);
      const remaining = coords.slice(closestIndex);
      
      setCompletedCoords(completed.map(c => [c.lat, c.lng]));
      setRemainingCoords(remaining.map(c => [c.lat, c.lng]));
    }
  }, [route, visible, currentLocation, showProgress]);

  // Initial route animation (only when route first loads)
  useEffect(() => {
    // Kill any existing animation
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }

    if (!visible || !route?.coordinates?.length) {
      setDisplayedCoords([]);
      setIsAnimationComplete(false);
      setCompletedCoords([]);
      setRemainingCoords([]);
      lastCompletedIndexRef.current = -1;
      return;
    }

    const coords = route.coordinates.map(c => [c.lat, c.lng]);
    const total = coords.length;

    // Start fresh
    setDisplayedCoords([]);
    setIsAnimationComplete(false);

    const stepInterval = ANIMATION_DURATION_MS / ANIMATION_STEPS;
    const coordsPerStep = Math.max(1, Math.ceil(total / ANIMATION_STEPS));
    let currentIndex = 0;

    animationRef.current = setInterval(() => {
      currentIndex += coordsPerStep;
      if (currentIndex >= total) {
        setDisplayedCoords(coords);
        setIsAnimationComplete(true);
        
        // If we have current location, set up progress tracking after animation
        if (currentLocation && showProgress) {
          const closestIndex = findClosestRouteIndex(route.coordinates, currentLocation);
          if (closestIndex !== -1) {
            lastCompletedIndexRef.current = closestIndex;
            const completed = route.coordinates.slice(0, closestIndex + 1);
            const remaining = route.coordinates.slice(closestIndex);
            setCompletedCoords(completed.map(c => [c.lat, c.lng]));
            setRemainingCoords(remaining.map(c => [c.lat, c.lng]));
          }
        }
        
        clearInterval(animationRef.current);
        animationRef.current = null;
      } else {
        setDisplayedCoords(coords.slice(0, currentIndex));
      }
    }, stepInterval);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [route, visible, profile]); // Only re-run on route/visibility/profile change

  // Don't render if not visible or no coordinates
  if (!visible || (displayedCoords.length < 2 && completedCoords.length < 2 && remainingCoords.length < 2)) {
    return null;
  }

  // If we have progress tracking and the route animation is complete
  if (showProgress && isAnimationComplete && (completedCoords.length > 0 || remainingCoords.length > 0)) {
    return (
      <>
        {/* Completed route portion (behind you) — grayed out */}
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
            {/* Dash pattern for completed portion (optional) */}
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
        
        {/* Remaining route portion (ahead of you) — bright and bold */}
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
            {/* Glow effect for remaining route */}
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

  // Initial animation or no progress tracking — show full route with animation
  return (
    <>
      {/* Shadow layer - creates depth effect */}
      <Polyline
        positions={displayedCoords}
        color={shadowColor}
        weight={10}
        opacity={0.15}
        smoothFactor={2}
        lineCap="round"
        lineJoin="round"
        className="route-shadow"
      />
      
      {/* Glow/blur layer - modern ambient effect */}
      <Polyline
        positions={displayedCoords}
        color={mainColor}
        weight={14}
        opacity={0.1}
        smoothFactor={2}
        lineCap="round"
        lineJoin="round"
        className="route-glow"
      />
      
      {/* Main route line - bright and smooth */}
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