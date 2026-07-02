// hooks/useSmoothRoutePosition.js
import { useState, useEffect, useRef } from 'react';
import { findClosestPointOnRoute, distanceBetween } from '../function/utils/geometry';

/**
 * Interpolates location along a route for a 60fps smooth "gliding" effect.
 * Duration: 450ms, Easing: cubic-bezier(0.2, 0.9, 0.4, 1.1)
 * Snaps instantly if GPS jump > 50 meters
 */
export function useSmoothRoutePosition(coordinates, rawLocation, isActive) {
  const [state, setState] = useState({
    position: rawLocation,
    index: 0,
    progressRatio: 0,
    isAnimating: false
  });

  const lastRawRef = useRef(null);
  const animationRef = useRef(null);
  const startTimeRef = useRef(0);
  const startPosRef = useRef(null);
  const targetPosRef = useRef(null);
  const isFirstRunRef = useRef(true);

  const DURATION = 450;
  const SNAP_THRESHOLD = 50; // meters

  // Easing: cubic-bezier(0.2, 0.9, 0.4, 1.1)
  const ease = (t) => {
    if (t < 0.5) {
      return 4.5 * t * t * t;
    }
    return 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  useEffect(() => {
    // Skip if not active or missing data
    if (!isActive || !rawLocation || !coordinates?.length) {
      setState(prev => ({ ...prev, isAnimating: false }));
      return;
    }

    // Find closest point on route
    const result = findClosestPointOnRoute(rawLocation.lat, rawLocation.lng, coordinates);
    const closestPoint = result.closestIndex >= 0 && coordinates[result.closestIndex] 
      ? coordinates[result.closestIndex] 
      : null;
    const closestIndex = result.closestIndex || 0;

    // If no closest point found, keep current state
    if (!closestPoint) {
      return;
    }

    // Check if this is first run or large jump
    let shouldSnap = isFirstRunRef.current;
    
    if (lastRawRef.current) {
      const dist = distanceBetween(
        rawLocation.lat, 
        rawLocation.lng,
        lastRawRef.current.lat,
        lastRawRef.current.lng
      );
      
      if (dist > SNAP_THRESHOLD) {
        shouldSnap = true;
      }
    }

    // Cancel any ongoing animation
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    // If first run or large jump, snap instantly
    if (shouldSnap) {
      setState({
        position: closestPoint,
        index: closestIndex,
        progressRatio: 1,
        isAnimating: false
      });
      
      lastRawRef.current = rawLocation;
      startPosRef.current = closestPoint;
      targetPosRef.current = closestPoint;
      isFirstRunRef.current = false;
      return;
    }

    // Store starting position (current state position or fallback)
    const startPosition = state.position || closestPoint;
    
    // If start and target are the same, no need to animate
    if (startPosition.lat === closestPoint.lat && startPosition.lng === closestPoint.lng) {
      setState({
        position: closestPoint,
        index: closestIndex,
        progressRatio: 1,
        isAnimating: false
      });
      lastRawRef.current = rawLocation;
      return;
    }

    // Start smooth animation
    startPosRef.current = startPosition;
    targetPosRef.current = closestPoint;
    startTimeRef.current = performance.now();
    lastRawRef.current = rawLocation;
    isFirstRunRef.current = false;

    const animate = (now) => {
      if (!startPosRef.current || !targetPosRef.current) {
        setState(prev => ({ ...prev, isAnimating: false }));
        return;
      }

      const elapsed = now - startTimeRef.current;
      const progress = Math.min(1, elapsed / DURATION);
      const eased = ease(progress);

      const lat = startPosRef.current.lat + (targetPosRef.current.lat - startPosRef.current.lat) * eased;
      const lng = startPosRef.current.lng + (targetPosRef.current.lng - startPosRef.current.lng) * eased;

      setState({
        position: { lat, lng },
        index: closestIndex,
        progressRatio: progress,
        isAnimating: progress < 1
      });

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        // Final snap to exact target
        setState({
          position: targetPosRef.current,
          index: closestIndex,
          progressRatio: 1,
          isAnimating: false
        });
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [
    rawLocation?.lat,
    rawLocation?.lng,
    coordinates,
    isActive,
    // Only include the raw location reference, not the entire object
  ]);

  return state;
}