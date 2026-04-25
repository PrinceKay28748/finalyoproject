// services/routing.js
// A* algorithm with min-heap priority queue for optimal performance
// Uses heuristic (straight-line distance to destination) to guide search toward target

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
 * A* heuristic: straight-line distance to destination (in weighted cost units)
 * This guides the search toward the target instead of exploring all directions
 */
function heuristicCost(lat1, lng1, lat2, lng2, profile, vehicleMode) {
  // Convert to meters using Haversine formula
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const distanceMeters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  // Apply a small speed factor based on vehicle mode
  let speedFactor = 1.0;
  if (vehicleMode === 'car') speedFactor = 1.2;
  else if (vehicleMode === 'motorcycle') speedFactor = 1.1;
  // Walking is base 1.0
  
  // Heuristic must be optimistic (<= actual cost) for A* to be optimal
  return distanceMeters * speedFactor;
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
 * Finds the optimal path between two nodes using A* algorithm
 * A* = Dijkstra + heuristic (straight-line distance to destination)
 * This naturally avoids exploring roads that go away from the target
 * 
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
  const endNode = nodes[endNodeId];
  
  if (!nodes[startNodeId] || !endNode) {
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

  // ── A* with min-heap ─────────────────────────────────────────────────────
  // gScore = actual cost from start to current node
  // fScore = gScore + heuristic (estimated cost to destination)
  const gScore = {};
  const fScore = {};
  const previous = {};
  const visited = new Set();
  const heap = new MinHeap();

  // Initialize all scores to infinity
  for (const nodeId in nodes) {
    gScore[nodeId] = Infinity;
    fScore[nodeId] = Infinity;
    previous[nodeId] = null;
  }
  
  gScore[startNodeId] = 0;
  fScore[startNodeId] = heuristicCost(
    nodes[startNodeId].lat, nodes[startNodeId].lng,
    endNode.lat, endNode.lng,
    profile, vehicleMode
  );
  heap.push(startNodeId, fScore[startNodeId]);

  let nodesExplored = 0;

  while (heap.size > 0) {
    const { nodeId: current } = heap.pop();
    nodesExplored++;

    // Early exit when we reach the destination
    if (current === endNodeId) {
      console.log(`[Routing] A* explored ${nodesExplored} nodes (vs Dijkstra would explore more)`);
      break;
    }

    if (visited.has(current)) continue;
    visited.add(current);

    const neighbors = nodes[current].neighbors || [];
    const currentG = gScore[current];

    for (const neighbor of neighbors) {
      if (visited.has(neighbor.nodeId)) continue;

      const edgeKey = `${current}-${neighbor.nodeId}`;
      const edge = edgeMap[edgeKey] || { distance: neighbor.distance, tags: {}, type: "residential" };
      
      // Calculate edge cost with all contextual factors
      const edgeCost = calculateEdgeCost(edge, profile, context.timePeriod, context.vehicleRestricted, context.currentHour, vehicleMode);
      const tentativeG = currentG + edgeCost;

      if (tentativeG < gScore[neighbor.nodeId]) {
        // This path is better than any previous one
        previous[neighbor.nodeId] = current;
        gScore[neighbor.nodeId] = tentativeG;
        
        // Calculate heuristic (straight-line distance to destination)
        const h = heuristicCost(
          nodes[neighbor.nodeId].lat, nodes[neighbor.nodeId].lng,
          endNode.lat, endNode.lng,
          profile, vehicleMode
        );
        fScore[neighbor.nodeId] = tentativeG + h;
        
        heap.push(neighbor.nodeId, fScore[neighbor.nodeId]);
      }
    }
  }

  // ── No path found ──
  if (gScore[endNodeId] === Infinity) {
    const s = nodes[startNodeId];
    const e = nodes[endNodeId];
    const directDist = distanceKm(s.lat, s.lng, e.lat, e.lng) * 1000;

    if (directDist <= 500) {
      console.log(`[Routing] A* fallback direct connection — ${directDist.toFixed(1)}m`);
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

    console.warn(`[Routing] A* no path found - direct distance ${directDist.toFixed(1)}m exceeds fallback`);
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

  console.log(
    `[Routing] A* path — ${pathNodeIds.length} nodes → ${simplifiedCoords.length} after simplification, ` +
    `${(actualDistMetres / 1000).toFixed(2)}km`
  );

  return {
    nodes:           pathNodeIds,
    coordinates:     simplifiedCoords.map(([lat, lng]) => ({ lat, lng })),
    totalDistance:   actualDistMetres,
    totalDistanceKm: actualDistMetres / 1000,
    weightedCost:    gScore[endNodeId],
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
  console.log(`[Routing] All 4 routes calculated in ${elapsed.toFixed(0)}ms (vehicle: ${vehicleMode}, algorithm: A*)`);
  
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