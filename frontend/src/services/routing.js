// services/routing.js
// Dijkstra's algorithm using a min-heap priority queue for O(n log n) performance

import { calculateEdgeCost, buildRouteContext, getActiveWarnings, PROFILES } from "./costFunction";
import { distanceKm } from "../function/utils/distance";
import { MinHeap }    from "../function/utils/MinHeap";

// Convert degrees to meters approximation
function degreesToMeters(latDiff, lngDiff, lat) {
  const latMeters = latDiff * 111319;
  const lngMeters = lngDiff * 85200 * Math.cos(lat * Math.PI / 180);
  return Math.hypot(latMeters, lngMeters);
}

/**
 * Simplifies a coordinate array using the Ramer-Douglas-Peucker algorithm
 */
function simplifyPath(coords, tolerance = 0.00005) {
  if (coords.length <= 2) return coords;

  let maxDist = 0;
  let maxIndex = 0;
  const start = coords[0];
  const end = coords[coords.length - 1];

  for (let i = 1; i < coords.length - 1; i++) {
    const dist = perpendicularDistance(coords[i], start, end);
    if (dist > maxDist) { maxDist = dist; maxIndex = i; }
  }

  if (maxDist <= tolerance) return [start, end];

  const left = simplifyPath(coords.slice(0, maxIndex + 1), tolerance);
  const right = simplifyPath(coords.slice(maxIndex), tolerance);

  return [...left.slice(0, -1), ...right];
}

function perpendicularDistance(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

/**
 * Finds the nearest node ID to a given GPS coordinate
 */
export function findNearestNode(graph, lat, lng, maxDistanceDegrees = 0.01) {
  if (!graph?.nodes) return null;
  
  let minDist = Infinity;
  let nearestId = null;
  
  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const dx = node.lat - lat;
    const dy = node.lng - lng;
    const dist = Math.hypot(dx, dy);
    
    if (dist < minDist && dist < maxDistanceDegrees) {
      minDist = dist;
      nearestId = nodeId;
    }
  }
  
  return nearestId;
}

/**
 * Finds the optimal path between two nodes using Dijkstra + min-heap
 * @param {Object} graph - Graph with nodes and edges
 * @param {string} startNodeId - Starting node ID
 * @param {string} endNodeId - Destination node ID
 * @param {string} profileKey - Routing profile (standard, fastest, accessible, night)
 * @param {string} vehicleMode - Vehicle mode (walk, car, motorcycle)
 */
export function findShortestPath(graph, startNodeId, endNodeId, profileKey = "standard", vehicleMode = "walk") {
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
      vehicleMode:     vehicleMode,
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

    if (visited.has(current)) continue;
    visited.add(current);

    if (current === endNodeId) break;

    if (currentDist > distances[current]) continue;

    const neighbors = nodes[current].neighbors || [];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) continue;

      const edgeKey  = `${current}-${neighbor.nodeId}`;
      const edge     = edgeMap[edgeKey] || { distance: neighbor.distance, tags: {}, type: "residential" };
      // Pass vehicleMode to calculateEdgeCost
      const edgeCost = calculateEdgeCost(edge, profile, context.timePeriod, context.vehicleRestricted, context.currentHour, vehicleMode);
      const altCost  = distances[current] + edgeCost;

      if (altCost < distances[neighbor.nodeId]) {
        distances[neighbor.nodeId] = altCost;
        previous[neighbor.nodeId]  = current;
        heap.push(neighbor.nodeId, altCost);
      }
    }
  }

  // ── No path — try fallback for OSM data gaps ──
  if (distances[endNodeId] === Infinity) {
    const s = nodes[startNodeId];
    const e = nodes[endNodeId];
    const directDist = distanceKm(s.lat, s.lng, e.lat, e.lng) * 1000;

    if (directDist <= 300) {
      console.log(`[Routing] Fallback direct connection — ${directDist.toFixed(1)}m`);
      return {
        nodes:           [startNodeId, endNodeId],
        coordinates:     [{ lat: s.lat, lng: s.lng }, { lat: e.lat, lng: e.lng }],
        totalDistance:   directDist,
        totalDistanceKm: directDist / 1000,
        isFallback:      true,
        profile:         profileKey,
        vehicleMode:     vehicleMode,
        context,
      };
    }

    console.warn(`[Routing] No path found - direct distance ${directDist.toFixed(1)}m exceeds fallback`);
    return null;
  }

  // ── Reconstruct path ──────────────────────────────────────────────────────
  const pathNodeIds = [];
  let current = endNodeId;
  while (current !== null) {
    pathNodeIds.unshift(current);
    current = previous[current];
  }

  // Calculate actual physical distance
  let actualDistMetres = 0;
  for (let i = 0; i < pathNodeIds.length - 1; i++) {
    const a = nodes[pathNodeIds[i]];
    const b = nodes[pathNodeIds[i + 1]];
    actualDistMetres += distanceKm(a.lat, a.lng, b.lat, b.lng) * 1000;
  }

  // Convert to [lat, lng] pairs for Leaflet
  const rawCoords = pathNodeIds.map(id => [nodes[id].lat, nodes[id].lng]);

  // Simplify the path
  const simplifiedCoords = simplifyPath(rawCoords);

  return {
    nodes:           pathNodeIds,
    coordinates:     simplifiedCoords.map(([lat, lng]) => ({ lat, lng })),
    totalDistance:   actualDistMetres,
    totalDistanceKm: actualDistMetres / 1000,
    weightedCost:    distances[endNodeId],
    isFallback:      false,
    profile:         profileKey,
    vehicleMode:     vehicleMode,
    context,
  };
}

/**
 * Calculates all four route variants in parallel
 * @param {Object} graph - Graph with nodes and edges
 * @param {string} startNodeId - Starting node ID
 * @param {string} endNodeId - Destination node ID
 * @param {string} profileKey - Routing profile
 * @param {string} vehicleMode - Vehicle mode (walk, car, motorcycle)
 */
export async function getAllRoutes(graph, startNodeId, endNodeId, profileKey = "standard", vehicleMode = "walk") {
  const startTime = performance.now();
  
  const [standard, fastest, accessible, night] = await Promise.all([
    Promise.resolve(findShortestPath(graph, startNodeId, endNodeId, "standard", vehicleMode)),
    Promise.resolve(findShortestPath(graph, startNodeId, endNodeId, "fastest", vehicleMode)),
    Promise.resolve(findShortestPath(graph, startNodeId, endNodeId, "accessible", vehicleMode)),
    Promise.resolve(findShortestPath(graph, startNodeId, endNodeId, "night", vehicleMode))
  ]);
  
  const elapsed = performance.now() - startTime;
  console.log(`[Routing] All 4 routes calculated in ${elapsed.toFixed(0)}ms (vehicle: ${vehicleMode})`);
  
  // Generate warnings for each route based on context and profile
  if (standard?.context) standard.context.warnings = getActiveWarnings(standard.context, "standard");
  if (fastest?.context) fastest.context.warnings = getActiveWarnings(fastest.context, "fastest");
  if (accessible?.context) accessible.context.warnings = getActiveWarnings(accessible.context, "accessible");
  if (night?.context) night.context.warnings = getActiveWarnings(night.context, "night");
  
  return {
    standard,
    fastest,
    accessible,
    night,
    timestamp: Date.now()
  };
}