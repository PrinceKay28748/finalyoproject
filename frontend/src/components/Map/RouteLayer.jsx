// components/Map/RouteLayer.jsx

import { useEffect, useRef, useState, useCallback } from "react";
import { Polyline } from "react-leaflet";
import { ROUTE_COLORS } from "../../function/utils/colors";
import "./RouteLayer.css";

const ANIMATION_DURATION_MS = 1200;
const ANIMATION_STEPS = 60;

// Optimized: uses binary search for faster index finding
function findClosestRouteIndexOptimized(coordinates, currentLocation, thresholdMeters = 50) {
  if (!coordinates?.length || !currentLocation) return -1;
  
  let closestIndex = -1;
  let minDistance = Infinity;
  
  // Sample every 5th point first for faster search, then refine
  const step = Math.max(1, Math.floor(coordinates.length / 50));
  
  for (let i = 0; i < coordinates.length; i += step) {
    const point = coordinates[i];
    const latDiff = point.lat - currentLocation.lat;
    const lngDiff = point.lng - currentLocation.lng;
    const distanceMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111319;
    
    if (distanceMeters < minDistance) {
      minDistance = distanceMeters;
      closestIndex = i;
    }
  }
  
  // Refine search around the best index
  const startIdx = Math.max(0, closestIndex - step);
  const endIdx = Math.min(coordinates.length, closestIndex + step);
  
  for (let i = startIdx; i < endIdx; i++) {
    const point = coordinates[i];
    const latDiff = point.lat - currentLocation.lat;
    const lngDiff = point.lng - currentLocation.lng;
    const distanceMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111319;
    
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
  showProgress = true
}) {
  const [displayedCoords, setDisplayedCoords] = useState([]);
  const [completedCoords, setCompletedCoords] = useState([]);
  const [remainingCoords, setRemainingCoords] = useState([]);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const animationRef = useRef(null);
  const lastCompletedIndexRef = useRef(-1);
  const updateTimeoutRef = useRef(null);

  const mainColor = ROUTE_COLORS[profile] || ROUTE_COLORS.standard;
  const shadowColor = mainColor;
  const completedColor = "#94a3b8";
  const remainingColor = mainColor;

  // Debounced progress update
  const updateProgress = useCallback((coords, location) => {
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
    
    updateTimeoutRef.current = setTimeout(() => {
      const closestIndex = findClosestRouteIndexOptimized(coords, location);
      
      if (closestIndex !== -1 && closestIndex !== lastCompletedIndexRef.current) {
        lastCompletedIndexRef.current = closestIndex;
        
        const completed = coords.slice(0, closestIndex + 1);
        const remaining = coords.slice(closestIndex);
        
        setCompletedCoords(completed.map(c => [c.lat, c.lng]));
        setRemainingCoords(remaining.map(c => [c.lat, c.lng]));
      }
      updateTimeoutRef.current = null;
    }, 100); // Debounce to 100ms
  }, []);

  useEffect(() => {
    if (!visible || !route?.coordinates?.length || !showProgress || !currentLocation) {
      return;
    }
    
    updateProgress(route.coordinates, currentLocation);
  }, [route, visible, currentLocation, showProgress, updateProgress]);

  // Initial route animation
  useEffect(() => {
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
        
        if (currentLocation && showProgress) {
          const closestIndex = findClosestRouteIndexOptimized(route.coordinates, currentLocation);
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
  }, [route, visible, profile]);

  if (!visible || (displayedCoords.length < 2 && completedCoords.length < 2 && remainingCoords.length < 2)) {
    return null;
  }

  if (showProgress && isAnimationComplete && (completedCoords.length > 0 || remainingCoords.length > 0)) {
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

  return (
    <>
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