// hooks/useRouteProgress.js
// Tracks user position along route and detects upcoming turns

import { useState, useEffect, useRef, useCallback } from 'react';
import { findClosestPointOnRoute } from '../function/utils/geometry';
import { generateDirections, findNextTurn, hasReachedDestination } from '../services/directions';

export function useRouteProgress(route, currentLocation, isActive) {
  const [instructions, setInstructions] = useState([]);
  const [nextTurn, setNextTurn] = useState(null);
  const [progress, setProgress] = useState({
    completedDistance: 0,
    remainingDistance: 0,
    percentage: 0,
    closestPointIndex: -1,
    hasArrived: false
  });
  
  const announcedTurnsRef = useRef(new Set());
  const arrivalAnnouncedRef = useRef(false);

  // Generate instructions when route changes
  useEffect(() => {
    if (!isActive || !route?.coordinates?.length) {
      setInstructions([]);
      return;
    }
    
    const dirs = generateDirections(route.coordinates);
    setInstructions(dirs);
    announcedTurnsRef.current.clear();
    arrivalAnnouncedRef.current = false;
  }, [route, isActive]);

  // Update progress and check for upcoming turns
  useEffect(() => {
    if (!isActive || !currentLocation || !route?.coordinates?.length) return;
    
    const { lat, lng } = currentLocation;
    const { closestIndex, distanceFromStart } = findClosestPointOnRoute(lat, lng, route.coordinates);
    
    const totalDistance = route.totalDistanceKm * 1000;
    const completed = distanceFromStart;
    const remaining = Math.max(0, totalDistance - completed);
    const percentage = totalDistance > 0 ? (completed / totalDistance) * 100 : 0;
    const hasArrived = hasReachedDestination(completed, totalDistance, 30);
    
    setProgress({
      completedDistance: completed,
      remainingDistance: remaining,
      percentage,
      closestPointIndex: closestIndex,
      hasArrived
    });
    
    // Find next turn
    if (instructions.length > 0 && !hasArrived) {
      const next = findNextTurn(instructions, completed, 300);
      setNextTurn(next);
    } else {
      setNextTurn(null);
    }
  }, [currentLocation, route, isActive, instructions]);

  /**
   * Check if a turn should be announced now
   * @param {number} distanceThreshold - Distance threshold for announcement (default 50m)
   * @returns {Object|null} Turn to announce, or null if none
   */
  const getTurnToAnnounce = useCallback((distanceThreshold = 50) => {
    if (!nextTurn || nextTurn.isDestination) return null;
    
    const distanceRemaining = nextTurn.distanceRemaining;
    const turnId = `${nextTurn.index}-${Math.floor(distanceRemaining / 10) * 10}`;
    
    // Announce when distance is within threshold and not announced before
    if (distanceRemaining <= distanceThreshold && 
        distanceRemaining > 0 &&
        !announcedTurnsRef.current.has(turnId)) {
      
      // For turns at very close distance, announce immediately
      if (distanceRemaining <= 20) {
        announcedTurnsRef.current.add(turnId);
        return { ...nextTurn, urgency: 'immediate' };
      }
      
      // For turns within threshold, announce
      announcedTurnsRef.current.add(turnId);
      return { ...nextTurn, urgency: 'normal' };
    }
    
    return null;
  }, [nextTurn]);

  /**
   * Check if destination arrival should be announced
   * @returns {boolean}
   */
  const getArrivalToAnnounce = useCallback(() => {
    if (progress.hasArrived && !arrivalAnnouncedRef.current) {
      arrivalAnnouncedRef.current = true;
      return true;
    }
    return false;
  }, [progress.hasArrived]);

  /**
   * Reset announcement tracking (for new route)
   */
  const resetAnnouncements = useCallback(() => {
    announcedTurnsRef.current.clear();
    arrivalAnnouncedRef.current = false;
  }, []);

  return {
    instructions,
    nextTurn,
    progress,
    getTurnToAnnounce,
    getArrivalToAnnounce,
    resetAnnouncements
  };
}