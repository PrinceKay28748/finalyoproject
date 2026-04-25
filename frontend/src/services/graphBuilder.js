// services/graphBuilder.js
// Fetches road network from OpenStreetMap and builds a graph for Dijkstra

import { UG_BOUNDS } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { getCachedGraph, cacheGraph } from "./cacheStore";

// OSM Overpass API endpoints
const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const OVERPASS_API_BACKUP = "https://overpass.kumi.systems/api/interpreter";

function getBoundsValues(bounds) {
  if (bounds && bounds._southWest && bounds._northEast) {
    return {
      south: bounds._southWest.lat,
      west: bounds._southWest.lng,
      north: bounds._northEast.lat,
      east: bounds._northEast.lng,
    };
  }
  return { south: 5.62, west: -0.21, north: 5.672, east: -0.175 };
}

const getOSMQuery = (bounds) => {
  const { south, west, north, east } = getBoundsValues(bounds);
  
  return `
    [out:json][timeout:45];
    (
      way["highway"~"footway|path|pedestrian|steps|residential|service|track|living_street|unclassified|tertiary|secondary|primary|tertiary_link|secondary_link"](${south},${west},${north},${east});
      node(w);
    );
    out body;
    >;
    out skel qt;
  `;
};

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
      await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
    }
  }
  
  throw new Error('All fetch attempts failed');
}

export async function buildGraph() {
  try {
    const cached = await getCachedGraph();
    if (cached) {
      console.log("[GraphBuilder] Using cached graph from IndexedDB");
      return cached;
    }
    
    console.log("[GraphBuilder] Fetching OSM data for Legon...");

    const query = getOSMQuery(UG_BOUNDS);
    
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
    console.log(`[GraphBuilder] Received ${data.elements?.length || 0} elements`);

    if (!data.elements || data.elements.length === 0) {
      console.warn("[GraphBuilder] No OSM data returned");
      return null;
    }

    const graph = processOSMData(data.elements);

    if (!graph || Object.keys(graph.nodes).length === 0) {
      console.warn("[GraphBuilder] Graph is empty after processing");
      return null;
    }

    const enhancedGraph = connectNearbyNodes(graph, 15);
    
    const components = findConnectedComponents(enhancedGraph);
    console.log(
      `[GraphBuilder] Graph ready — ${Object.keys(enhancedGraph.nodes).length} nodes, ` +
      `${enhancedGraph.edges.length} edges, ${components.length} connected component(s)`
    );

    await cacheGraph(enhancedGraph);

    return enhancedGraph;

  } catch (error) {
    console.error("[GraphBuilder] Error building graph:", error);
    return null;
  }
}

function processOSMData(elements) {
  const nodes = {};
  const ways = [];

  elements.forEach((el) => {
    if (el.type === "node") {
      const id = String(el.id);
      nodes[id] = { id, lat: el.lat, lng: el.lon, neighbors: [] };
    } else if (el.type === "way" && el.tags?.highway && el.nodes?.length > 0) {
      const highwayType = el.tags.highway;
      if (highwayType === 'motorway' || highwayType === 'motorway_link') {
        return;
      }
      
      ways.push({
        id: String(el.id),
        nodes: el.nodes.map(String),
        tags: el.tags,
        type: highwayType,
      });
    }
  });

  console.log(`[GraphBuilder] ${Object.keys(nodes).length} nodes, ${ways.length} ways`);

  const edges = [];
  const edgeSet = new Set();
  let edgeCount = 0;
  let skippedCount = 0;

  ways.forEach((way) => {
    for (let i = 0; i < way.nodes.length - 1; i++) {
      const fromId = way.nodes[i];
      const toId = way.nodes[i + 1];

      if (!nodes[fromId] || !nodes[toId]) {
        skippedCount++;
        continue;
      }

      const from = nodes[fromId];
      const to = nodes[toId];

      const distMetres = distanceKm(from.lat, from.lng, to.lat, to.lng) * 1000;

      if (distMetres < 0.5) continue;

      const edgeKey = `${fromId}-${toId}`;
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

      from.neighbors.push({ nodeId: toId, edgeId: edgeKey, distance: distMetres });
      to.neighbors.push({ nodeId: fromId, edgeId: edgeKey, distance: distMetres });
    }
  });

  console.log(`[GraphBuilder] Built ${edgeCount} edges, skipped ${skippedCount} missing nodes`);

  const connectedNodes = {};
  let isolatedCount = 0;
  
  Object.entries(nodes).forEach(([id, node]) => {
    if (node.neighbors.length > 0) {
      connectedNodes[id] = node;
    } else {
      isolatedCount++;
    }
  });

  console.log(`[GraphBuilder] ${Object.keys(connectedNodes).length} connected nodes, ${isolatedCount} isolated removed`);

  return { nodes: connectedNodes, edges };
}

function connectNearbyNodes(graph, thresholdMeters = 15) {
  const nodes = graph.nodes;
  const edges = [...graph.edges];
  const edgeSet = new Set(graph.edges.map(e => e.id));
  
  let connectionsAdded = 0;
  const nodeList = Object.values(nodes);
  
  console.log(`[GraphBuilder] Connecting nodes within ${thresholdMeters}m...`);
  
  const GRID_SIZE_DEG = 0.005;
  const grid = new Map();
  
  for (const node of nodeList) {
    const cellX = Math.floor(node.lat / GRID_SIZE_DEG);
    const cellY = Math.floor(node.lng / GRID_SIZE_DEG);
    const cellKey = `${cellX},${cellY}`;
    
    if (!grid.has(cellKey)) {
      grid.set(cellKey, []);
    }
    grid.get(cellKey).push(node);
  }
  
  const nodesWithGoodConnections = new Set();
  for (const node of nodeList) {
    if (node.neighbors.length >= 2) {
      nodesWithGoodConnections.add(node.id);
    }
  }
  
  for (const [cellKey, cellNodes] of grid.entries()) {
    const [cellX, cellY] = cellKey.split(',').map(Number);
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const adjacentNodes = grid.get(`${cellX + dx},${cellY + dy}`);
        if (!adjacentNodes) continue;
        
        for (const nodeA of cellNodes) {
          if (nodeA.neighbors.length > 6) continue;
          
          for (const nodeB of adjacentNodes) {
            if (nodeA.id === nodeB.id) continue;
            
            if (nodesWithGoodConnections.has(nodeA.id) && nodesWithGoodConnections.has(nodeB.id)) {
              continue;
            }
            
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
    }
  }
  
  console.log(`[GraphBuilder] Added ${connectionsAdded} connections`);
  
  return { nodes, edges };
}

export function findConnectedComponents(graph) {
  const visited = new Set();
  const components = [];

  for (const nodeId of Object.keys(graph.nodes)) {
    if (visited.has(nodeId)) continue;

    const component = new Set();
    const queue = [nodeId];
    visited.add(nodeId);

    while (queue.length > 0) {
      const current = queue.shift();
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

export function findClosestNode(graph, lat, lng) {
  if (!graph || Object.keys(graph.nodes).length === 0) {
    console.warn("[GraphBuilder] Cannot find closest node — graph is empty");
    return null;
  }

  let closestId = null;
  let minDistance = Infinity;

  for (const [nodeId, node] of Object.entries(graph.nodes)) {
    const dist = distanceKm(lat, lng, node.lat, node.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestId = nodeId;
    }
  }

  return closestId;
}