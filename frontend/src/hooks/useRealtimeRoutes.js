// hooks/useRealtimeRoutes.js
// Manages all 4 routes, handles deviation detection, and auto-reroutes
import { useState, useEffect, useRef, useCallback } from "react";
import { getAllRoutes, findNearestNode } from "../services/routing";
import { getDistanceToRoute, distanceBetween } from "../function/utils/geometry";

// Configuration constants
const DEVIATION_THRESHOLD_METERS = 25;  // Google Maps standard
const REROUTE_DEBOUNCE_MS = 2000;      // Wait 2 seconds before recalculating
const MIN_POSITION_CHANGE_METERS = 10;  // Ignore small GPS jitters

// Profile configuration for display
export const ROUTE_PROFILES = {
  standard: {
    key: "standard",
    label: "Standard",
    icon: "🗺️",
    color: "#2563eb",
    description: "Balanced route — shortest with basic safety"
  },
  fastest: {
    key: "fastest",
    label: "Fastest",
    icon: "⚡",
    color: "#22c55e",
    description: "Pure shortest path — ignores comfort factors"
  },
  accessible: {
    key: "accessible",
    label: "Accessible",
    icon: "♿",
    color: "#8b5cf6",
    description: "Avoids steep inclines and unpaved surfaces"
  },
  night: {
    key: "night",
    label: "Night Safety",
    icon: "🌙",
    color: "#f59e0b",
    description: "Prioritises well-lit, busy roads"
  }
};

export function useRealtimeRoutes({ 
  graph, 
  startNodeId, 
  endNodeId, 
  currentLocation, 
  activeProfile,
  isActive  // When true, starts watching for deviations
}) {
  // State for all 4 routes
  const [routes, setRoutes] = useState({
    standard: null,
    fastest: null,
    accessible: null,
    night: null
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [deviationDetected, setDeviationDetected] = useState(false);
  const [lastRouteUpdate, setLastRouteUpdate] = useState(null);
  
  // Refs for tracking
  const lastRerouteTime = useRef(0);
  const lastPositionRef = useRef(null);
  const deviationTimerRef = useRef(null);

  /**
   * Calculate all 4 routes from a given node to destination
   */
  const calculateRoutes = useCallback(async (fromNodeId, reason = "initial") => {
    if (!graph || !fromNodeId || !endNodeId) return;
    
    // Rate limit to prevent spam
    const now = Date.now();
    if (now - lastRerouteTime.current < 500) return;
    
    const isReroute = reason !== "initial";
    if (isReroute) setIsRerouting(true);
    else setIsLoading(true);
    
    lastRerouteTime.current = now;
    
    try {
      console.log(`[Routes] Calculating ${reason}...`);
      const allRoutes = await getAllRoutes(graph, fromNodeId, endNodeId);
      
      // Debug: verify all routes were calculated
      console.log("[Routes] Calculation result:", {
        reason,
        standard: allRoutes.standard ? `✓ ${allRoutes.standard.totalDistanceKm.toFixed(2)}km` : "✗ null",
        fastest: allRoutes.fastest ? `✓ ${allRoutes.fastest.totalDistanceKm.toFixed(2)}km` : "✗ null",
        accessible: allRoutes.accessible ? `✓ ${allRoutes.accessible.totalDistanceKm.toFixed(2)}km` : "✗ null",
        night: allRoutes.night ? `✓ ${allRoutes.night.totalDistanceKm.toFixed(2)}km` : "✗ null",
      });
      
      setRoutes(allRoutes);
      setLastRouteUpdate(now);
      console.log(`[Routes] ${reason} — all 4 routes updated`);
    } catch (err) {
      console.error("[Routes] Calculation failed:", err);
    } finally {
      setIsLoading(false);
      setIsRerouting(false);
      setDeviationDetected(false);
    }
  }, [graph, endNodeId]);

  /**
   * Initial route calculation when start or destination changes
   */
  useEffect(() => {
    if (startNodeId && endNodeId && graph) {
      calculateRoutes(startNodeId, "initial");
    }
  }, [startNodeId, endNodeId, graph, calculateRoutes]);

  /**
   * Real-time deviation detection and auto-reroute
   * Only runs when isActive is true (markers visible and user moving)
   */
  useEffect(() => {
    // Don't check if not active or missing data
    if (!isActive || !currentLocation || !routes[activeProfile] || !graph || !endNodeId) return;
    
    const activeRoute = routes[activeProfile];
    if (!activeRoute?.coordinates?.length) return;
    
    const { lat, lng } = currentLocation;
    
    // Skip if user hasn't moved enough (prevents jitter)
    if (lastPositionRef.current) {
      const moved = distanceBetween(lat, lng, lastPositionRef.current.lat, lastPositionRef.current.lng);
      if (moved < MIN_POSITION_CHANGE_METERS) return;
    }
    lastPositionRef.current = { lat, lng };
    
    // Calculate distance from current position to the active route
    const distanceToRoute = getDistanceToRoute(lat, lng, activeRoute.coordinates);
    
    if (distanceToRoute > DEVIATION_THRESHOLD_METERS) {
      // User is off-route
      if (!deviationDetected) setDeviationDetected(true);
      
      // Clear any existing timer
      if (deviationTimerRef.current) clearTimeout(deviationTimerRef.current);
      
      // Set timer to recalculate after confirming deviation
      deviationTimerRef.current = setTimeout(async () => {
        const nearestNode = findNearestNode(graph, lat, lng);
        if (nearestNode && nearestNode !== startNodeId) {
          await calculateRoutes(nearestNode, "deviation");
        }
        deviationTimerRef.current = null;
      }, REROUTE_DEBOUNCE_MS);
    } else {
      // Back on route — clear deviation state
      if (deviationDetected) setDeviationDetected(false);
      if (deviationTimerRef.current) {
        clearTimeout(deviationTimerRef.current);
        deviationTimerRef.current = null;
      }
    }
    
    // Cleanup timer on unmount
    return () => {
      if (deviationTimerRef.current) clearTimeout(deviationTimerRef.current);
    };
  }, [currentLocation, routes, activeProfile, graph, endNodeId, calculateRoutes, deviationDetected, startNodeId, isActive]);

  /**
   * Get the primary route (based on active profile)
   */
  const getPrimaryRoute = useCallback(() => {
    return routes[activeProfile];
  }, [routes, activeProfile]);

  /**
   * Get all alternative routes (all except active profile)
   * Filters out routes that are identical to the primary route
   */
  const getAlternativeRoutes = useCallback(() => {
    const alternatives = [];
    const allProfiles = ["standard", "fastest", "accessible", "night"];
    const primaryRoute = routes[activeProfile];
    
    // Debug: Log all routes status
    console.log("[Routes] Alternative routes debug:", {
      activeProfile,
      routesKeys: Object.keys(routes),
      routesData: Object.entries(routes).reduce((acc, [key, val]) => {
        acc[key] = val ? `✓ (${val.coordinates?.length || 0} coords)` : "✗ null";
        return acc;
      }, {})
    });
    
    for (const profile of allProfiles) {
      if (profile !== activeProfile && routes[profile] && routes[profile].coordinates?.length > 0) {
        const routeB = routes[profile];
        
        // Quick identity check: compare distance and key coordinates
        const isIdentical = primaryRoute &&
          primaryRoute.totalDistance === routeB.totalDistance &&
          primaryRoute.coordinates.length === routeB.coordinates.length &&
          Math.abs(primaryRoute.coordinates[0].lat - routeB.coordinates[0].lat) < 0.00001 &&
          Math.abs(primaryRoute.coordinates[0].lng - routeB.coordinates[0].lng) < 0.00001;
        
        if (!isIdentical) {
          alternatives.push({
            profile: profile,
            route: routeB,
            config: ROUTE_PROFILES[profile]
          });
        } else {
          console.log(`[Routes] ${profile} is identical to ${activeProfile} - filtering out`);
        }
      }
    }
    
    console.log("[Routes] Alternative routes found:", alternatives.length, alternatives.map(a => a.profile));
    return alternatives;
  }, [routes, activeProfile]);

  /**
   * Check if a specific route is identical to another
   */
  const areRoutesIdentical = useCallback((profileA, profileB) => {
    const routeA = routes[profileA];
    const routeB = routes[profileB];
    
    if (!routeA || !routeB) return false;
    if (routeA.totalDistance !== routeB.totalDistance) return false;
    if (routeA.coordinates.length !== routeB.coordinates.length) return false;
    
    // Quick check: compare first and last coordinates
    const firstA = routeA.coordinates[0];
    const firstB = routeB.coordinates[0];
    const lastA = routeA.coordinates[routeA.coordinates.length - 1];
    const lastB = routeB.coordinates[routeB.coordinates.length - 1];
    
    return (
      Math.abs(firstA.lat - firstB.lat) < 0.00001 &&
      Math.abs(firstA.lng - firstB.lng) < 0.00001 &&
      Math.abs(lastA.lat - lastB.lat) < 0.00001 &&
      Math.abs(lastA.lng - lastB.lng) < 0.00001
    );
  }, [routes]);

  return {
    routes,                 // All 4 routes: { standard, fastest, accessible, night }
    primaryRoute: getPrimaryRoute(),
    alternativeRoutes: getAlternativeRoutes(),
    isLoading,
    isRerouting,
    deviationDetected,
    lastRouteUpdate,
    areRoutesIdentical,
    refreshRoutes: () => {
      if (startNodeId && endNodeId) calculateRoutes(startNodeId, "manual");
    }
  };
}