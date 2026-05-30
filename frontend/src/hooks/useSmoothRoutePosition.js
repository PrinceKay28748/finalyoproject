// hooks/useSmoothRoutePosition.js
import { useState, useEffect, useRef, useCallback } from 'react';
import { findClosestPointOnRoute } from '../function/utils/geometry';

const ANIMATION_DURATION_MS = 450; // Google Maps style
const LARGE_JUMP_THRESHOLD_M = 50; // Instant snap for jumps >50m
const UPDATE_DEBOUNCE_MS = 100;    // Don't process every single GPS tick

/**
 * Smoothly interpolates position along a route
 * Returns current position, index, and progress ratio for the route line
 */
export function useSmoothRoutePosition(routeCoordinates, currentLocation, isActive = true) {
  const [smoothedPosition, setSmoothedPosition] = useState(null);
  const [smoothedIndex, setSmoothedIndex] = useState(0);
  const [progressRatio, setProgressRatio] = useState(0);
  
  const targetPositionRef = useRef(null);
  const targetIndexRef = useRef(0);
  const animationRef = useRef(null);
  const animationStartTimeRef = useRef(null);
  const animationStartPositionRef = useRef(null);
  const animationStartIndexRef = useRef(0);
  const lastProcessedLocationRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const isAnimatingRef = useRef(false);

  // Calculate point on route at a given index (with interpolation)
  const getPointAtInterpolatedIndex = useCallback((index, coordinates) => {
    if (!coordinates?.length) return null;
    
    const integerIndex = Math.floor(index);
    const fractional = index - integerIndex;
    
    if (integerIndex >= coordinates.length - 1) {
      const last = coordinates[coordinates.length - 1];
      return { lat: last.lat, lng: last.lng, index: coordinates.length - 1 };
    }
    
    const p1 = coordinates[integerIndex];
    const p2 = coordinates[integerIndex + 1];
    
    // Linear interpolation between points
    return {
      lat: p1.lat + (p2.lat - p1.lat) * fractional,
      lng: p1.lng + (p2.lng - p1.lng) * fractional,
      index: integerIndex + fractional
    };
  }, []);

  // Find closest route index for a GPS location (with distance)
  const findClosestRouteInfo = useCallback((location, coordinates) => {
    if (!coordinates?.length || !location) return { index: 0, distance: 0 };
    
    const result = findClosestPointOnRoute(location.lat, location.lng, coordinates);
    
    // Convert distance along route to index ratio
    const totalDistance = result.totalDistance || 1;
    const indexRatio = result.distanceFromStart / totalDistance;
    const approximateIndex = indexRatio * (coordinates.length - 1);
    
    return {
      index: Math.max(0, Math.min(coordinates.length - 1, approximateIndex)),
      distance: result.distanceFromStart
    };
  }, []);

  // Animate from current to target position
  const animateToTarget = useCallback((targetIndex, targetPos, coordinates) => {
    if (!coordinates?.length) return;
    
    // Cancel existing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    
    const startIndex = smoothedIndex;
    const startPos = smoothedPosition || getPointAtInterpolatedIndex(startIndex, coordinates);
    
    if (!startPos) return;
    
    animationStartIndexRef.current = startIndex;
    targetIndexRef.current = targetIndex;
    animationStartPositionRef.current = startPos;
    targetPositionRef.current = targetPos;
    animationStartTimeRef.current = performance.now();
    isAnimatingRef.current = true;
    
    const animate = (now) => {
      const elapsed = now - animationStartTimeRef.current;
      let t = Math.min(1, elapsed / ANIMATION_DURATION_MS);
      
      // Ease in-out cubic (Google Maps style)
      const easeInOut = t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
      
      // Interpolate index
      const newIndex = animationStartIndexRef.current + (targetIndexRef.current - animationStartIndexRef.current) * easeInOut;
      
      // Interpolate position
      const newLat = animationStartPositionRef.current.lat + (targetPos.lat - animationStartPositionRef.current.lat) * easeInOut;
      const newLng = animationStartPositionRef.current.lng + (targetPos.lng - animationStartPositionRef.current.lng) * easeInOut;
      
      setSmoothedPosition({ lat: newLat, lng: newLng });
      setSmoothedIndex(newIndex);
      
      // Calculate progress ratio (0 = start, 1 = end)
      const newProgress = newIndex / (coordinates.length - 1);
      setProgressRatio(Math.max(0, Math.min(1, newProgress)));
      
      if (t < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Final snap to exact target
        setSmoothedPosition(targetPos);
        setSmoothedIndex(targetIndex);
        setProgressRatio(Math.max(0, Math.min(1, targetIndex / (coordinates.length - 1))));
        isAnimatingRef.current = false;
        animationRef.current = null;
      }
    };
    
    animationRef.current = requestAnimationFrame(animate);
  }, [smoothedIndex, smoothedPosition, getPointAtInterpolatedIndex]);

  // Process new GPS location
  const processNewLocation = useCallback((location, coordinates) => {
    if (!coordinates?.length || !location) return;
    
    const { index: targetRawIndex, distance } = findClosestRouteInfo(location, coordinates);
    const targetPos = getPointAtInterpolatedIndex(targetRawIndex, coordinates);
    
    if (!targetPos) return;
    
    // Check if this is a large jump (tunnel exit, GPS glitch)
    let isLargeJump = false;
    if (smoothedPosition) {
      const latDiff = targetPos.lat - smoothedPosition.lat;
      const lngDiff = targetPos.lng - smoothedPosition.lng;
      const distanceMeters = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111319;
      isLargeJump = distanceMeters > LARGE_JUMP_THRESHOLD_M;
    }
    
    if (isLargeJump || !isAnimatingRef.current) {
      // Instant snap for large jumps
      if (isLargeJump) {
        setSmoothedPosition(targetPos);
        setSmoothedIndex(targetRawIndex);
        setProgressRatio(targetRawIndex / (coordinates.length - 1));
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        isAnimatingRef.current = false;
      } else {
        // Start smooth animation
        animateToTarget(targetRawIndex, targetPos, coordinates);
      }
    }
    
    lastProcessedLocationRef.current = location;
  }, [smoothedPosition, findClosestRouteInfo, getPointAtInterpolatedIndex, animateToTarget]);

  // Debounced location handler
  const handleLocationUpdate = useCallback((location, coordinates) => {
    if (!isActive || !coordinates?.length || !location) return;
    
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    debounceTimerRef.current = setTimeout(() => {
      processNewLocation(location, coordinates);
      debounceTimerRef.current = null;
    }, UPDATE_DEBOUNCE_MS);
  }, [isActive, processNewLocation]);

  // Watch for location changes
  useEffect(() => {
    if (!isActive || !currentLocation || !routeCoordinates?.length) {
      // Reset when inactive
      if (!isActive) {
        setSmoothedPosition(null);
        setSmoothedIndex(0);
        setProgressRatio(0);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
          animationRef.current = null;
        }
        isAnimatingRef.current = false;
      }
      return;
    }
    
    // Initial position set
    if (!smoothedPosition && currentLocation) {
      const { index } = findClosestRouteInfo(currentLocation, routeCoordinates);
      const initialPos = getPointAtInterpolatedIndex(index, routeCoordinates);
      if (initialPos) {
        setSmoothedPosition(initialPos);
        setSmoothedIndex(index);
        setProgressRatio(index / (routeCoordinates.length - 1));
        targetPositionRef.current = initialPos;
        targetIndexRef.current = index;
      }
    }
    
    handleLocationUpdate(currentLocation, routeCoordinates);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [currentLocation, routeCoordinates, isActive, smoothedPosition, findClosestRouteInfo, getPointAtInterpolatedIndex, handleLocationUpdate]);

  // Cleanup animation on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return {
    position: smoothedPosition,
    index: smoothedIndex,
    progressRatio,
    isAnimating: isAnimatingRef.current
  };
}