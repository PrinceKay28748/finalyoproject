// services/graphBuilder.js
// Fetches road network from OpenStreetMap and builds a graph for Dijkstra

import { UG_BOUNDS } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { getCachedGraph, cacheGraph } from "./cacheStore";

// OSM Overpass API endpoint (using a more reliable endpoint)
const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const OVERPASS_API_BACKUP = "https://overpass.kumi.systems/api/interpreter";

// Extract raw bounds values from a Leaflet LatLngBounds object
function getBoundsValues(bounds) {
  if (bounds && bounds._southWest && bounds._northEast) {
    return {
      south: bounds._southWest.lat,
      west:  bounds._southWest.lng,
      north: bounds._northEast.lat,
      east:  bounds._northEast.lng,
    };
  }
  // Fallback to UG Legon campus bounds
  return { south: 5.62, west: -0.21, north: 5.672, east: -0.175 };
}

// Optimized Overpass query — includes ALL walkable roads including secondary/primary
const getOSMQuery = (bounds) => {
  const { south, west, north, east } = getBoundsValues(bounds);
  
  return `
    [out:json][timeout:45];
    (
      // ALL roads - expanded to include secondary, primary, tertiary
      way["highway"~"footway|path|pedestrian|steps|residential|service|track|living_street|unclassified|tertiary|secondary|primary|tertiary_link|secondary_link"](${south},${west},${north},${east});
      node(w);
    );
    out body;
    >;
    out skel qt;
  `;
};

// Fetch with retry logic
async function fetchWithRetry(url, query, retries = 3) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      
      const response = await fetch(url, {
        method: "POST",
        body: query,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        return response;
      }
      
      console.warn(`[GraphBuilder] Attempt ${i + 1} failed: HTTP ${response.status}`);
      
    } catch (error) {
      console.warn(`[GraphBuilder] Attempt ${i + 1} failed:`, error.message);
    }
    
    if (i < retries) {
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1))); // Exponential backoff
    }
  }
  
  throw new Error('All fetch attempts failed');
}

/**
 * Fetches road network data from OpenStreetMap and builds a graph
 * @returns {Promise<Object|null>} Graph with nodes and edges, or null on failure
 */
export async function buildGraph() {
  try {
    // Check IndexedDB cache first (huge speed boost in dev mode)
    const cached = await getCachedGraph();
    if (cached) {
      console.log("[GraphBuilder] Using cached graph from IndexedDB");
      return cached;
    }
    
    console.log("[GraphBuilder] Fetching OSM data for Legon (including secondary/primary roads)...");

    const query = getOSMQuery(UG_BOUNDS);
    console.log("[GraphBuilder] Query includes: footway, path, pedestrian, steps, residential, service, track, living_street, unclassified, tertiary, secondary, primary");
    
    let response;
    let usedBackup = false;
    
    try {
      response = await fetchWithRetry(OVERPASS_API, query);
    } catch (error) {
      console.log("[GraphBuilder] Primary endpoint failed, trying backup...");
      usedBackup = true;
      response = await fetchWithRetry(OVERPASS_API_BACKUP, query);
    }
    
    if (!response) {
      throw new Error('No response from Overpass API');
    }
    
    const data = await response.json();
    console.log(`[GraphBuilder] Received ${data.elements?.length || 0} elements from ${usedBackup ? 'backup' : 'primary'} endpoint`);

    if (!data.elements || data.elements.length === 0) {
      console.warn("[GraphBuilder] No OSM data returned");
      return null;
    }

    const graph = processOSMData(data.elements);

    if (!graph || Object.keys(graph.nodes).length === 0) {
      console.warn("[GraphBuilder] Graph is empty after processing");
      return null;
    }

    // Connect nearby nodes to fill gaps in OSM data (increased threshold for better connectivity)
    const enhancedGraph = connectNearbyNodes(graph, 30);
    
    const components = findConnectedComponents(enhancedGraph);
    console.log(
      `[GraphBuilder] Graph ready — ${Object.keys(enhancedGraph.nodes).length} nodes, ` +
      `${enhancedGraph.edges.length} edges, ${components.length} connected component(s)`
    );

    // Save to IndexedDB cache for next load
    await cacheGraph(enhancedGraph);

    return enhancedGraph;

  } catch (error) {
    console.error("[GraphBuilder] Error building graph:", error);
    return null;
  }
}

/**
 * Processes raw OSM elements into a graph of nodes and edges
 * @param {Array} elements - Raw OSM elements
 * @returns {Object} Graph with nodes (with neighbor lists) and edges array
 */
function processOSMData(elements) {
  const nodes = {};
  const ways  = [];

  // First pass — collect all nodes and walkable ways
  elements.forEach((el) => {
    if (el.type === "node") {
      const id = String(el.id);
      nodes[id] = { id, lat: el.lat, lng: el.lon, neighbors: [] };
    } else if (el.type === "way" && el.tags?.highway && el.nodes?.length > 0) {
      const highwayType = el.tags.highway;
      // Only skip motorways (keep secondary, primary, etc.)
      if (highwayType === 'motorway' || highwayType === 'motorway_link') {
        return;
      }
      
      ways.push({
        id:    String(el.id),
        nodes: el.nodes.map(String),
        tags:  el.tags,
        type:  highwayType,
      });
    }
  });

  console.log(`[GraphBuilder] ${Object.keys(nodes).length} nodes, ${ways.length} walkable ways`);

  // Second pass — build edges between consecutive nodes in each way
  const edges   = [];
  const edgeSet = new Set();
  let edgeCount = 0;
  let skippedCount = 0;

  ways.forEach((way) => {
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const fromId = way.nodes[i];
      const toId   = way.nodes[i + 1];

      if (!nodes[fromId] || !nodes[toId]) {
        skippedCount++;
        continue;
      }

      const from = nodes[fromId];
      const to   = nodes[toId];

      const distMetres = distanceKm(from.lat, from.lng, to.lat, to.lng) * 1000;

      if (distMetres < 0.5) continue;

      const edgeKey    = `${fromId}-${toId}`;
      const reverseKey = `${toId}-${fromId}`;
      if (edgeSet.has(edgeKey) || edgeSet.has(reverseKey)) continue;

      edgeSet.add(edgeKey);
      edgeCount++;

      edges.push({ 
        id: edgeKey, 
        from: fromId, 
        to: toId, 
        distance: distMetres, 
        tags: way.tags, 
        type: way.type 
      });

      from.neighbors.push({ nodeId: toId,   edgeId: edgeKey, distance: distMetres });
      to.neighbors.push(  { nodeId: fromId, edgeId: edgeKey, distance: distMetres });
    }
  });

  console.log(`[GraphBuilder] Built ${edgeCount} edges, skipped ${skippedCount} missing nodes`);

  // Remove isolated nodes that ended up with no connections
  const connectedNodes = {};
  let isolatedCount = 0;
  
  Object.entries(nodes).forEach(([id, node]) => {
    if (node.neighbors.length > 0) {
      connectedNodes[id] = node;
    } else {
      isolatedCount++;
    }
  });

  console.log(
    `[GraphBuilder] ${Object.keys(connectedNodes).length} connected nodes, ` +
    `${isolatedCount} isolated nodes removed`
  );

  return { nodes: connectedNodes, edges };
}

/**
 * Connects nearby nodes that are within a threshold distance
 * This helps fill gaps in OSM data where roads are split or missing connections
 * @param {Object} graph - Graph with nodes and edges
 * @param {number} thresholdMeters - Max distance to connect (default 30m)
 * @returns {Object} Enhanced graph with additional connections
 */
function connectNearbyNodes(graph, thresholdMeters = 30) {
  const nodes = graph.nodes;
  const edges = [...graph.edges];
  const edgeSet = new Set(graph.edges.map(e => e.id));
  
  let connectionsAdded = 0;
  const nodeList = Object.values(nodes);
  
  console.log(`[GraphBuilder] Connecting nodes within ${thresholdMeters}m...`);
  
  // Create spatial grid for faster neighbor finding
  const GRID_SIZE_DEG = 0.005; // ~500m cell
  const grid = new Map();
  
  // Place nodes in grid cells
  for (const node of nodeList) {
    const cellX = Math.floor(node.lat / GRID_SIZE_DEG);
    const cellY = Math.floor(node.lng / GRID_SIZE_DEG);
    const cellKey = `${cellX},${cellY}`;
    
    if (!grid.has(cellKey)) {
      grid.set(cellKey, []);
    }
    grid.get(cellKey).push(node);
  }
  
  const startTime = performance.now();
  
  // Check only nodes in same + adjacent cells
  for (const [cellKey, cellNodes] of grid.entries()) {
    const [cellX, cellY] = cellKey.split(',').map(Number);
    
    // Get adjacent cells
    const cellsToCheck = new Set();
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const key = `${cellX + dx},${cellY + dy}`;
        const adjacentNodes = grid.get(key);
        if (adjacentNodes) {
          for (const n of adjacentNodes) cellsToCheck.add(n.id);
        }
      }
    }
    
    for (let i = 0; i < cellNodes.length; i++) {
      const nodeA = cellNodes[i];
      
      if (nodeA.neighbors.length > 8) continue;
      
      for (let j = i + 1; j < cellNodes.length; j++) {
        const nodeB = cellNodes[j];
        
        if (nodeB.neighbors.length > 8) continue;
        
        const distMeters = distanceKm(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng) * 1000;
        
        if (distMeters <= thresholdMeters && distMeters > 0.5) {
          const edgeKey = `${nodeA.id}-${nodeB.id}`;
          const reverseKey = `${nodeB.id}-${nodeA.id}`;
          
          if (!edgeSet.has(edgeKey) && !edgeSet.has(reverseKey)) {
            edgeSet.add(edgeKey);
            connectionsAdded++;
            
            const newEdge = {
              id: edgeKey,
              from: nodeA.id,
              to: nodeB.id,
              distance: distMeters,
              tags: { highway: 'connection' },
              type: 'connection'
            };
            
            edges.push(newEdge);
            nodeA.neighbors.push({ nodeId: nodeB.id, edgeId: edgeKey, distance: distMeters });
            nodeB.neighbors.push({ nodeId: nodeA.id, edgeId: edgeKey, distance: distMeters });
          }
        }
      }
    }
  }
  
  const elapsed = performance.now() - startTime;
  console.log(`[GraphBuilder] Added ${connectionsAdded} connections in ${elapsed.toFixed(0)}ms`);
  
  return { nodes, edges };
}

/**
 * Finds all connected components in the graph
 * Useful for debugging disconnected subgraphs
 * @param {Object} graph
 * @returns {Array<Set>} Array of sets, each containing node IDs in that component
 */
export function findConnectedComponents(graph) {
  const visited    = new Set();
  const components = [];

  for (const nodeId of Object.keys(graph.nodes)) {
    if (visited.has(nodeId)) continue;

    const component = new Set();
    const queue     = [nodeId];
    visited.add(nodeId);

    while (queue.length > 0) {
      const current   = queue.shift();
      component.add(current);
      const neighbors = graph.nodes[current]?.neighbors || [];
      for (const n of neighbors) {
        if (!visited.has(n.nodeId)) {
          visited.add(n.nodeId);
          queue.push(n.nodeId);
        }
      }
    }

    components.push(component);
  }

  return components;
}

/**
 * Finds the closest graph node to a given lat/lng coordinate
 * Used to snap a user-selected point onto the road network
 * @param {Object} graph
 * @param {number} lat
 * @param {number} lng
 * @returns {string|null} Node ID of the closest node
 */
export function findClosestNode(graph, lat, lng) {
  if (!graph || Object.keys(graph.nodes).length === 0) {
    console.warn("[GraphBuilder] Cannot find closest node — graph is empty");
    return null;
  }

  let closestId   = null;
  let minDistance = Infinity;

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const dist = distanceKm(lat, lng, node.lat, node.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestId   = nodeId;
    }
  }

  console.log(`[GraphBuilder] Closest node found at ${(minDistance * 1000).toFixed(1)}m away`);
  return closestId;
}