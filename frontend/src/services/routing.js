// services/routing.js
// Dijkstra's algorithm using a min-heap priority queue for O(n log n) performance
// Previously used a linear Set scan which was O(n²) — too slow for 9000+ nodes

import { calculateEdgeCost, buildRouteContext, PROFILES } from "./costFunction";
import { distanceKm } from "../function/utils/distance";
import { MinHeap }    from "../function/utils/MinHeap";

/**
 * Simplifies a coordinate array using the Ramer-Douglas-Peucker algorithm
 * Reduces the number of points on the route polyline without losing its shape
 * This makes the animation and rendering significantly faster
 *
 * @param {Array}  coords    - Array of [lat, lng] pairs
 * @param {number} tolerance - Higher = fewer points (0.00005 works well for campus scale)
 * @returns {Array} Simplified coordinate array
 */
function simplifyPath(coords, tolerance = 0.00005) {
  if (coords.length <= 2) return coords;

  // Find the point furthest from the line between start and end
  let maxDist  = 0;
  let maxIndex = 0;
  const start  = coords[0];
  const end    = coords[coords.length - 1];

  for (let i = 1; i < coords.length - 1; i++) {
    const dist = perpendicularDistance(coords[i], start, end);
    if (dist > maxDist) { maxDist = dist; maxIndex = i; }
  }

  // If the furthest point is within tolerance, collapse everything between start and end
  if (maxDist <= tolerance) return [start, end];

  // Otherwise split and recurse on both halves
  const left  = simplifyPath(coords.slice(0, maxIndex + 1), tolerance);
  const right = simplifyPath(coords.slice(maxIndex),        tolerance);

  // Merge — remove duplicate middle point
  return [...left.slice(0, -1), ...right];
}

// Calculates perpendicular distance from point p to line (a, b)
function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t  = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Finds the optimal path between two nodes using Dijkstra + min-heap
 *
 * @param {Object} graph       - Graph with nodes and edges
 * @param {string} startNodeId - Starting node ID
 * @param {string} endNodeId   - Destination node ID
 * @param {string} profileKey  - Active routing profile
 * @returns {Object|null} Path with coordinates, distance and metadata
 */
export function findShortestPath(graph, startNodeId, endNodeId, profileKey = "standard") {
  console.log(`[Routing] Finding path — profile: ${profileKey}`);

  if (!graph?.nodes || !graph?.edges) {
    console.error("[Routing] Invalid graph");
    return null;
  }

  const nodes = graph.nodes;

  if (!nodes[startNodeId] || !nodes[endNodeId]) {
    console.error("[Routing] Start or end node not found");
    return null;
  }

  if (startNodeId === endNodeId) {
    return {
      nodes:           [startNodeId],
      coordinates:     [{ lat: nodes[startNodeId].lat, lng: nodes[startNodeId].lng }],
      totalDistance:   0,
      totalDistanceKm: 0,
      isFallback:      false,
      profile:         profileKey,
    };
  }

  const context = buildRouteContext();
  const profile = PROFILES[profileKey] || PROFILES.standard;

  // Build edge lookup map once — O(1) access during traversal
  const edgeMap = {};
  for (const edge of graph.edges) {
    edgeMap[`${edge.from}-${edge.to}`] = edge;
    edgeMap[`${edge.to}-${edge.from}`] = edge;
  }

  // ── Dijkstra with min-heap ─────────────────────────────────────────────────
  const distances = {};
  const previous  = {};
  const visited   = new Set();
  const heap      = new MinHeap();

  // Initialise all distances to infinity
  for (const nodeId in nodes) {
    distances[nodeId] = Infinity;
    previous[nodeId]  = null;
  }
  distances[startNodeId] = 0;
  heap.push(startNodeId, 0);

  while (heap.size > 0) {
    const { nodeId: current, priority: currentDist } = heap.pop();

    // Skip if we already processed this node with a shorter distance
    if (visited.has(current)) continue;
    visited.add(current);

    // Early exit — destination reached
    if (current === endNodeId) break;

    // Skip stale heap entries
    if (currentDist > distances[current]) continue;

    const neighbors = nodes[current].neighbors || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) continue;

      const edgeKey  = `${current}-${neighbor.nodeId}`;
      const edge     = edgeMap[edgeKey] || { distance: neighbor.distance, tags: {}, type: "residential" };
      // Pass currentHour to calculateEdgeCost for dynamic traffic
      const edgeCost = calculateEdgeCost(edge, profile, context.timePeriod, context.vehicleRestricted, context.currentHour);
      const altCost  = distances[current] + edgeCost;

      if (altCost < distances[neighbor.nodeId]) {
        distances[neighbor.nodeId] = altCost;
        previous[neighbor.nodeId]  = current;
        heap.push(neighbor.nodeId, altCost);
      }
    }
  }

  // ── No path — try fallback for small OSM data gaps ────────────────────────
  if (distances[endNodeId] === Infinity) {
    const s = nodes[startNodeId];
    const e = nodes[endNodeId];
    const directDist = distanceKm(s.lat, s.lng, e.lat, e.lng) * 1000;

    if (directDist <= 100) {
      console.log(`[Routing] Fallback direct connection — ${directDist.toFixed(1)}m`);
      return {
        nodes:           [startNodeId, endNodeId],
        coordinates:     [{ lat: s.lat, lng: s.lng }, { lat: e.lat, lng: e.lng }],
        totalDistance:   directDist,
        totalDistanceKm: directDist / 1000,
        isFallback:      true,
        profile:         profileKey,
        context,
      };
    }

    console.warn("[Routing] No path found");
    return null;
  }

  // ── Reconstruct path ──────────────────────────────────────────────────────
  const pathNodeIds = [];
  let current       = endNodeId;
  while (current !== null) {
    pathNodeIds.unshift(current);
    current = previous[current];
  }

  // Calculate actual physical distance (not weighted cost) for display
  let actualDistMetres = 0;
  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const a = nodes[pathNodeIds[i]];
    const b = nodes[pathNodeIds[i + 1]];
    actualDistMetres += distanceKm(a.lat, a.lng, b.lat, b.lng) * 1000;
  }

  // Convert to [lat, lng] pairs for Leaflet
  const rawCoords = pathNodeIds.map(id => [nodes[id].lat, nodes[id].lng]);

  // Simplify the path — reduces point count for faster rendering and animation
  const simplifiedCoords = simplifyPath(rawCoords);

  console.log(
    `[Routing] Path — ${pathNodeIds.length} nodes → ${simplifiedCoords.length} after simplification, ` +
    `${(actualDistMetres / 1000).toFixed(2)}km`
  );

  return {
    nodes:           pathNodeIds,
    coordinates:     simplifiedCoords.map(([lat, lng]) => ({ lat, lng })),
    totalDistance:   actualDistMetres,
    totalDistanceKm: actualDistMetres / 1000,
    weightedCost:    distances[endNodeId],
    isFallback:      false,
    profile:         profileKey,
    context,
  };
}


// ============================================
// MULTI-ROUTE FUNCTIONS (Four profiles)
// ============================================

/**
 * Calculates all four route variants in parallel
 * Profiles: standard, fastest, accessible, night
 * 
 * @param {Object} graph - Graph with nodes and edges
 * @param {string} startNodeId - Starting node ID
 * @param {string} endNodeId - Destination node ID
 * @returns {Promise<Object>} Object with standard, fastest, accessible, night routes
 */
export async function getAllRoutes(graph, startNodeId, endNodeId) {
  const startTime = performance.now();
  
  // Run all FOUR Dijkstra calculations in parallel
  const [standard, fastest, accessible, night] = await Promise.all([
    Promise.resolve(findShortestPath(graph, startNodeId, endNodeId, "standard")),
    Promise.resolve(findShortestPath(graph, startNodeId, endNodeId, "fastest")),
    Promise.resolve(findShortestPath(graph, startNodeId, endNodeId, "accessible")),
    Promise.resolve(findShortestPath(graph, startNodeId, endNodeId, "night"))
  ]);
  
  const elapsed = performance.now() - startTime;
  console.log(`[Routing] All 4 routes calculated in ${elapsed.toFixed(0)}ms`);
  
  return {
    standard,
    fastest,
    accessible,
    night,
    timestamp: Date.now()
  };
}

/**
 * Finds the nearest node ID to a given GPS coordinate
 * Used for rerouting when user deviates from the path
 * 
 * @param {Object} graph - Graph with nodes
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @returns {string|null} Nearest node ID or null if graph empty
 */
export function findNearestNode(graph, lat, lng) {
  if (!graph?.nodes) return null;
  
  let minDist = Infinity;
  let nearestId = null;
  
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const dx = node.lat - lat;
    const dy = node.lng - lng;
    const dist = Math.hypot(dx, dy);
    
    if (dist < minDist) {
      minDist = dist;
      nearestId = nodeId;
    }
  }
  
  return nearestId;
}