// hooks/useRealtimeRoutes.js
// Manages all 4 routes, handles deviation detection, and auto-reroutes.
// Also logs route segments to the heatmap analytics endpoint after each
// successful route calculation.

import { useState, useEffect, useRef, useCallback } from "react";
import { getAllRoutes, findNearestNode } from "../services/routing";
import { getDistanceToRoute, distanceBetween, findClosestPointOnRoute } from "../function/utils/geometry";
import { logRouteSegments, resetHeatmapSession } from "../services/heatmapAnalytics";

const DEVIATION_THRESHOLD_METERS  = 25;
const REROUTE_DEBOUNCE_MS         = 2000;
const MIN_POSITION_CHANGE_METERS  = 5;
const PROGRESS_UPDATE_INTERVAL_MS = 1000;

export const ROUTE_PROFILES = {
  standard: {
    key:         "standard",
    label:       "Standard",
    icon:        "🗺️",
    color:       "#2563eb",
    description: "Balanced route — shortest with basic safety"
  },
  fastest: {
    key:         "fastest",
    label:       "Fastest",
    icon:        "⚡",
    color:       "#22c55e",
    description: "Pure shortest path — ignores comfort factors"
  },
  accessible: {
    key:         "accessible",
    label:       "Accessible",
    icon:        "♿",
    color:       "#8b5cf6",
    description: "Avoids steep inclines and unpaved surfaces"
  },
  night: {
    key:         "night",
    label:       "Night Safety",
    icon:        "🌙",
    color:       "#f59e0b",
    description: "Prioritises well-lit, busy roads"
  }
};

export function useRealtimeRoutes({
  graph,
  startNodeId,
  endNodeId,
  currentLocation,
  activeProfile,
  vehicleMode = 'walk',
  isActive
}) {
  const [routes, setRoutes] = useState({
    standard:   null,
    fastest:    null,
    accessible: null,
    night:      null
  });

  const [isLoading,         setIsLoading]         = useState(false);
  const [isRerouting,       setIsRerouting]       = useState(false);
  const [deviationDetected, setDeviationDetected] = useState(false);
  const [lastRouteUpdate,   setLastRouteUpdate]   = useState(null);
  const [routeProgress,     setRouteProgress]     = useState({
    completedDistance:  0,
    remainingDistance:  0,
    percentage:         0,
    closestPointIndex: -1
  });

  const lastRerouteTime           = useRef(0);
  const lastPositionRef           = useRef(null);
  const deviationTimerRef         = useRef(null);
  const progressUpdateIntervalRef = useRef(null);

  const calculateRoutes = useCallback(async (fromNodeId, reason = "initial") => {
    if (!graph || !fromNodeId || !endNodeId) return;

    const now = Date.now();
    if (now - lastRerouteTime.current < 500) return;

    const isReroute = reason !== "initial";
    if (isReroute) setIsRerouting(true);
    else           setIsLoading(true);

    lastRerouteTime.current = now;

    // Reset dedup on a fresh navigation session so the new route gets logged
    if (reason === "initial") resetHeatmapSession();

    try {
      const allRoutes = await getAllRoutes(graph, fromNodeId, endNodeId, activeProfile, vehicleMode);
      setRoutes(allRoutes);
      setLastRouteUpdate(now);

      setRouteProgress({
        completedDistance:  0,
        remainingDistance:  allRoutes[activeProfile]?.totalDistanceKm * 1000 || 0,
        percentage:         0,
        closestPointIndex: -1
      });

      // ── Heatmap logging ──────────────────────────────────────────────────
      // Log the standard route only — it's the most representative path and
      // avoids triple-counting when all 4 profiles return the same route.
      // logRouteSegments is fire-and-forget so it never blocks the UI.
      const routeToLog = allRoutes?.standard ?? allRoutes?.fastest;
      if (routeToLog?.coordinates?.length) {
        logRouteSegments(routeToLog.coordinates);
      }

    } catch (err) {
      console.error("[Routes] Calculation failed:", err);
    } finally {
      setIsLoading(false);
      setIsRerouting(false);
      setDeviationDetected(false);
    }
  }, [graph, endNodeId, activeProfile, vehicleMode]);

  const updateRouteProgress = useCallback(() => {
    const activeRoute = routes[activeProfile];
    if (!isActive || !currentLocation || !activeRoute?.coordinates?.length) return;

    const { lat, lng }                          = currentLocation;
    const { closestIndex, distanceFromStart }   = findClosestPointOnRoute(lat, lng, activeRoute.coordinates);

    const totalDistance = activeRoute.totalDistanceKm * 1000;
    const completed     = distanceFromStart;
    const remaining     = Math.max(0, totalDistance - completed);
    const percentage    = totalDistance > 0 ? (completed / totalDistance) * 100 : 0;

    setRouteProgress({
      completedDistance:  completed,
      remainingDistance:  remaining,
      percentage,
      closestPointIndex:  closestIndex,
      distanceToRoute:    0
    });
  }, [routes, activeProfile, isActive, currentLocation]);

  useEffect(() => {
    if (startNodeId && endNodeId && graph) {
      calculateRoutes(startNodeId, "initial");
    }
  }, [startNodeId, endNodeId, graph, calculateRoutes]);

  useEffect(() => {
    if (isActive && routes[activeProfile] && currentLocation) {
      updateRouteProgress();

      if (progressUpdateIntervalRef.current) clearInterval(progressUpdateIntervalRef.current);
      progressUpdateIntervalRef.current = setInterval(updateRouteProgress, PROGRESS_UPDATE_INTERVAL_MS);
    } else {
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
        progressUpdateIntervalRef.current = null;
      }
    }

    return () => {
      if (progressUpdateIntervalRef.current) {
        clearInterval(progressUpdateIntervalRef.current);
        progressUpdateIntervalRef.current = null;
      }
    };
  }, [isActive, routes, activeProfile, currentLocation, updateRouteProgress]);

  useEffect(() => {
    if (!isActive || !currentLocation || !routes[activeProfile] || !graph || !endNodeId) return;

    const activeRoute = routes[activeProfile];
    if (!activeRoute?.coordinates?.length) return;

    const { lat, lng } = currentLocation;

    if (lastPositionRef.current) {
      const moved = distanceBetween(lat, lng, lastPositionRef.current.lat, lastPositionRef.current.lng);
      if (moved < MIN_POSITION_CHANGE_METERS) return;
    }
    lastPositionRef.current = { lat, lng };

    const distanceToRoute = getDistanceToRoute(lat, lng, activeRoute.coordinates);

    if (distanceToRoute > DEVIATION_THRESHOLD_METERS) {
      if (!deviationDetected) setDeviationDetected(true);

      if (deviationTimerRef.current) clearTimeout(deviationTimerRef.current);

      deviationTimerRef.current = setTimeout(async () => {
        const nearestNode = findNearestNode(graph, lat, lng);
        if (nearestNode && nearestNode !== startNodeId) {
          await calculateRoutes(nearestNode, "deviation");
        }
        deviationTimerRef.current = null;
      }, REROUTE_DEBOUNCE_MS);

    } else {
      if (deviationDetected) setDeviationDetected(false);
      if (deviationTimerRef.current) {
        clearTimeout(deviationTimerRef.current);
        deviationTimerRef.current = null;
      }
    }

    return () => {
      if (deviationTimerRef.current) clearTimeout(deviationTimerRef.current);
    };
  }, [currentLocation, routes, activeProfile, graph, endNodeId, calculateRoutes, deviationDetected, startNodeId, isActive]);

  const getPrimaryRoute = useCallback(() => routes[activeProfile], [routes, activeProfile]);

  const getAlternativeRoutes = useCallback(() => {
    const alternatives  = [];
    const primaryRoute  = routes[activeProfile];

    for (const profile of ["standard", "fastest", "accessible", "night"]) {
      if (profile === activeProfile || !routes[profile]?.coordinates?.length) continue;

      const routeB      = routes[profile];
      const isIdentical = primaryRoute &&
        primaryRoute.totalDistance      === routeB.totalDistance &&
        primaryRoute.coordinates.length === routeB.coordinates.length &&
        Math.abs(primaryRoute.coordinates[0].lat - routeB.coordinates[0].lat) < 0.00001 &&
        Math.abs(primaryRoute.coordinates[0].lng - routeB.coordinates[0].lng) < 0.00001;

      if (!isIdentical) {
        alternatives.push({ profile, route: routeB, config: ROUTE_PROFILES[profile] });
      }
    }
    return alternatives;
  }, [routes, activeProfile]);

  const areRoutesIdentical = useCallback((profileA, profileB) => {
    const routeA = routes[profileA];
    const routeB = routes[profileB];
    if (!routeA || !routeB) return false;
    if (routeA.totalDistance      !== routeB.totalDistance)      return false;
    if (routeA.coordinates.length !== routeB.coordinates.length) return false;

    const firstA = routeA.coordinates[0];
    const firstB = routeB.coordinates[0];
    const lastA  = routeA.coordinates[routeA.coordinates.length - 1];
    const lastB  = routeB.coordinates[routeB.coordinates.length - 1];

    return (
      Math.abs(firstA.lat - firstB.lat) < 0.00001 &&
      Math.abs(firstA.lng - firstB.lng) < 0.00001 &&
      Math.abs(lastA.lat  - lastB.lat)  < 0.00001 &&
      Math.abs(lastA.lng  - lastB.lng)  < 0.00001
    );
  }, [routes]);

  return {
    routes,
    primaryRoute:       getPrimaryRoute(),
    alternativeRoutes:  getAlternativeRoutes(),
    isLoading,
    isRerouting,
    deviationDetected,
    lastRouteUpdate,
    routeProgress,
    areRoutesIdentical,
    refreshRoutes: () => {
      if (startNodeId && endNodeId) calculateRoutes(startNodeId, "manual");
    }
  };
}