// hooks/useSmoothRoutePosition.js
import { useState, useEffect, useRef } from 'react';

// Dynamically import geometry functions to break circular dependency
let geometryModule = null;
let geometryLoading = false;
let geometryLoadPromise = null;

const loadGeometry = () => {
  if (geometryModule) return Promise.resolve(geometryModule);
  if (geometryLoading) return geometryLoadPromise;
  
  geometryLoading = true;
  geometryLoadPromise = import('../function/utils/geometry')
    .then((module) => {
      geometryModule = module;
      geometryLoading = false;
      return module;
    })
    .catch((err) => {
      console.error('[useSmoothRoutePosition] Failed to load geometry:', err);
      geometryLoading = false;
      throw err;
    });
  
  return geometryLoadPromise;
};

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
  const geometryRef = useRef(null);

  // Load geometry on first render
  useEffect(() => {
    loadGeometry()
      .then((module) => {
        geometryRef.current = module;
      })
      .catch((err) => {
        console.error('[useSmoothRoutePosition] Geometry load error:', err);
      });
  }, []);

  const DURATION = 450;
  const SNAP_THRESHOLD = 50; // meters

  // Easing: cubic-bezier(0.2, 0.9, 0.4, 1.1)
  const ease = (t) => {
    if (t < 0.5) {
      return 4.5 * t * t * t;
    }
    return 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Calculate distance between two points in meters (inline fallback)
  const distanceBetweenFallback = (lat1, lng1, lat2, lng2) => {
    const dx = (lat1 - lat2) * 111319;
    const dy = (lng1 - lng2) * 85200;
    return Math.sqrt(dx * dx + dy * dy);
  };

  // Find closest point on route (inline fallback)
  const findClosestPointFallback = (lat, lng, coords) => {
    if (!coords?.length) {
      return { closestIndex: -1, distanceToRoute: Infinity, distanceFromStart: 0 };
    }
    
    let closestIndex = 0;
    let minDistance = Infinity;
    
    for (let i = 0; i < coords.length; i++) {
      const d = distanceBetweenFallback(lat, lng, coords[i].lat, coords[i].lng);
      if (d < minDistance) {
        minDistance = d;
        closestIndex = i;
      }
    }
    
    return { 
      closestIndex, 
      distanceToRoute: minDistance, 
      distanceFromStart: 0 
    };
  };

  useEffect(() => {
    // Skip if not active or missing data
    if (!isActive || !rawLocation || !coordinates?.length) {
      setState(prev => ({ ...prev, isAnimating: false }));
      return;
    }

    // Use geometry module if loaded, otherwise fallback
    const geo = geometryRef.current;
    let result;
    let distFunc;
    
    if (geo) {
      result = geo.findClosestPointOnRoute(rawLocation.lat, rawLocation.lng, coordinates);
      distFunc = geo.distanceBetween || distanceBetweenFallback;
    } else {
      result = findClosestPointFallback(rawLocation.lat, rawLocation.lng, coordinates);
      distFunc = distanceBetweenFallback;
    }
    
    const closestIndex = result.closestIndex || 0;
    const closestPoint = coordinates[closestIndex] || null;

    // If no closest point found, keep current state
    if (!closestPoint) {
      return;
    }

    // Check if this is first run or large jump
    let shouldSnap = isFirstRunRef.current;
    
    if (lastRawRef.current) {
      const dist = distFunc(
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
    // Include geometry ref as dependency
    geometryRef.current
  ]);

  return state;
}