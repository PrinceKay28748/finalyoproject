// services/graphBuilder.js
// Fetches road network from OpenStreetMap and builds a graph for Dijkstra

import { UG_BOUNDS } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";

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

// Optimized Overpass query — only fetch essential walkable paths
const getOSMQuery = (bounds) => {
  const { south, west, north, east } = getBoundsValues(bounds);
  
  return `
    [out:json][timeout:30];
    (
      // Walkable paths and roads suitable for campus navigation
      way["highway"~"footway|path|pedestrian|steps|residential|service|track|living_street|unclassified"](${south},${west},${north},${east});
      node(w);
    );
    out body;
    >;
    out skel qt;
  `;
};

// Fetch with retry logic
async function fetchWithRetry(url, query, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
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
      await new Promise(resolve => setTimeout(resolve, 2000));
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
    // Check localStorage cache first (huge speed boost in dev mode)
    const cached = localStorage.getItem('ug-graph-cache');
    const cacheTimestamp = localStorage.getItem('ug-graph-cache-time');
    const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
    
    if (cached && cacheTimestamp) {
      const age = Date.now() - parseInt(cacheTimestamp);
      if (age < CACHE_DURATION_MS) {
        console.log(`[GraphBuilder] Loading from cache (${(age / 1000).toFixed(1)}s old)`);
        return JSON.parse(cached);
      }
    }
    
    console.log("[GraphBuilder] Fetching OSM data for Legon...");

    const query = getOSMQuery(UG_BOUNDS);
    console.log("[GraphBuilder] Query optimized for walkable paths");
    
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

    // Connect nearby nodes to fill gaps in OSM data
    const enhancedGraph = connectNearbyNodes(graph, 25);
    
    const components = findConnectedComponents(enhancedGraph);
    console.log(
      `[GraphBuilder] Graph ready — ${Object.keys(enhancedGraph.nodes).length} nodes, ` +
      `${enhancedGraph.edges.length} edges, ${components.length} connected component(s)`
    );

    // Save to localStorage for next load
    try {
      localStorage.setItem('ug-graph-cache', JSON.stringify(enhancedGraph));
      localStorage.setItem('ug-graph-cache-time', Date.now().toString());
      console.log("[GraphBuilder] Graph cached to localStorage");
    } catch (e) {
      console.warn("[GraphBuilder] Could not cache to localStorage:", e.message);
    }

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
      // Skip non-walkable roads
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
 * @param {number} thresholdMeters - Max distance to connect (default 25m)
 * @returns {Object} Enhanced graph with additional connections
 */
function connectNearbyNodes(graph, thresholdMeters = 25) {
  const nodes = graph.nodes;
  const edges = [...graph.edges];
  const edgeSet = new Set(graph.edges.map(e => e.id));
  
  let connectionsAdded = 0;
  let nodesChecked = 0;
  
  // Get all nodes as array
  const nodeList = Object.values(nodes);
  
  console.log(`[GraphBuilder] Connecting nodes within ${thresholdMeters}m...`);
  
  // Only check nodes that have few connections (potential gaps)
  for (let i = 0; i < nodeList.length; i++) {
    const nodeA = nodeList[i];
    
    // Skip nodes that already have many connections
    if (nodeA.neighbors.length > 5) continue;
    
    for (let j = i + 1; j < nodeList.length; j++) {
      const nodeB = nodeList[j];
      
      // Skip if nodeB already has many connections
      if (nodeB.neighbors.length > 5) continue;
      
      // Calculate distance between nodes
      const distMeters = distanceKm(nodeA.lat, nodeA.lng, nodeB.lat, nodeB.lng) * 1000;
      
      if (distMeters <= thresholdMeters && distMeters > 0.5) {
        // Check if these nodes are already connected
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
    
    nodesChecked++;
    if (nodesChecked % 1000 === 0) {
      console.log(`[GraphBuilder] Processed ${nodesChecked}/${nodeList.length} nodes...`);
    }
  }
  
  console.log(`[GraphBuilder] Added ${connectionsAdded} connections between nearby nodes`);
  
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