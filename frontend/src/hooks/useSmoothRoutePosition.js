import { useState, useEffect, useRef } from 'react';
import { findClosestPointOnRoute } from '../function/utils/geometry';

/**
 * Interpolates location along a route for a 60fps smooth "gliding" effect.
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

  const DURATION = 450;
  const SNAP_THRESHOLD = 50; // meters

  // Easing: cubic-bezier(0.2, 0.9, 0.4, 1.1)
  const ease = (t) => {
    return t < 0.5 
      ? 4.5 * t * t * t 
      : 1 - Math.pow(-2 * t + 2, 3) / 2; // Approximated
  };

  useEffect(() => {
    if (!isActive || !rawLocation || !coordinates?.length) return;

    // Defensive check for geometry result
    const result = findClosestPointOnRoute(rawLocation.lat, rawLocation.lng, coordinates) || {};
    const closestPoint = result.closestPoint;
    const closestIndex = result.closestIndex || 0;

    const hasValidPosition = state.position && typeof state.position.lat === 'number';

    // If point not found or large jump/initial state, snap instead of glide
    const dist = lastRawRef.current ? Math.sqrt(
      Math.pow(rawLocation.lat - lastRawRef.current.lat, 2) + 
      Math.pow(rawLocation.lng - lastRawRef.current.lng, 2)
    ) * 111319 : 0;

    if (!closestPoint || dist > SNAP_THRESHOLD || !hasValidPosition) {
      // Fallback to rawLocation if closestPoint is undefined to prevent poisoning state with undefined
      setState({ 
        position: closestPoint || rawLocation, 
        index: closestIndex, 
        progressRatio: 0, 
        isAnimating: false 
      });
      lastRawRef.current = rawLocation;
      return;
    }

    // Start transition
    startPosRef.current = state.position;
    targetPosRef.current = closestPoint;
    startTimeRef.current = performance.now();
    lastRawRef.current = rawLocation;

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
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationRef.current);
  }, [rawLocation?.lat, rawLocation?.lng, coordinates, isActive]);

  return state;
}