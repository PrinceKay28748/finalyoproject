// services/graphBuilderWorker.js
// Worker-safe version — no Leaflet or DOM dependencies
// Copy of graphBuilder.js with Leaflet dependencies removed

// Hardcoded UG Legon bounds (copied from your bounds.js without Leaflet)
const UG_BOUNDS_RAW = {
  south: 5.62,
  west: -0.21,
  north: 5.672,
  east: -0.175
};

// Distance calculation in km (for worker)
function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// OSM Overpass API endpoint
const OVERPASS_API = "https://overpass-api.de/api/interpreter";
const OVERPASS_API_BACKUP = "https://overpass.kumi.systems/api/interpreter";

// Optimized Overpass query — only fetch walkable paths
function getOSMQuery(bounds) {
  const { south, west, north, east } = bounds;
  
  return `
    [out:json][timeout:30];
    (
      way["highway"~"footway|path|pedestrian|steps|residential|service|track|living_street|unclassified"](${south},${west},${north},${east});
      node(w);
    );
    out body;
    >;
    out skel qt;
  `;
}

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
      
      console.warn(`[GraphWorker] Attempt ${i + 1} failed: HTTP ${response.status}`);
      
    } catch (error) {
      console.warn(`[GraphWorker] Attempt ${i + 1} failed:`, error.message);
    }
    
    if (i < retries) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new Error('All fetch attempts failed');
}

// Process OSM data into graph
function processOSMData(elements) {
  const nodes = {};
  const ways = [];

  elements.forEach(el => {
    if (el.type === 'node') {
      const id = String(el.id);
      nodes[id] = { id, lat: el.lat, lng: el.lon, neighbors: [] };
    } else if (el.type === 'way' && el.tags?.highway && el.nodes?.length > 0) {
      const highwayType = el.tags.highway;
      if (highwayType === 'motorway' || highwayType === 'motorway_link') return;
      
      ways.push({
        id: String(el.id),
        nodes: el.nodes.map(String),
        tags: el.tags,
        type: highwayType,
      });
    }
  });

  const edges = [];
  const edgeSet = new Set();
  let edgeCount = 0;
  let skippedCount = 0;

  ways.forEach(way => {
    const nodeIds = way.nodes;
    
    for (let i = 0; i < nodeIds.length - 1; i++) {
      const fromId = nodeIds[i];
      const toId = nodeIds[i + 1];
      
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

  // Remove isolated nodes
  const connectedNodes = {};
  let isolatedCount = 0;
  
  for (const [id, node] of Object.entries(nodes)) {
    if (node.neighbors.length > 0) {
      connectedNodes[id] = node;
    } else {
      isolatedCount++;
    }
  }

  return { nodes: connectedNodes, edges };
}

// Connect nearby nodes to fill gaps
function connectNearbyNodes(graph, thresholdMeters = 25) {
  const nodes = graph.nodes;
  const edges = [...graph.edges];
  const edgeSet = new Set(graph.edges.map(e => e.id));
  let connectionsAdded = 0;
  
  const nodeList = Object.values(nodes);
  
  for (let i = 0; i < nodeList.length; i++) {
    const nodeA = nodeList[i];
    if (nodeA.neighbors.length > 5) continue;
    
    for (let j = i + 1; j < nodeList.length; j++) {
      const nodeB = nodeList[j];
      if (nodeB.neighbors.length > 5) continue;
      
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
  
  return { nodes, edges };
}

// Main build function
export async function buildGraphWorker() {
  try {
    console.log("[GraphWorker] Fetching OSM data...");
    
    const query = getOSMQuery(UG_BOUNDS_RAW);
    
    let response;
    let usedBackup = false;
    
    try {
      response = await fetchWithRetry(OVERPASS_API, query);
    } catch (error) {
      console.log("[GraphWorker] Primary endpoint failed, trying backup...");
      usedBackup = true;
      response = await fetchWithRetry(OVERPASS_API_BACKUP, query);
    }
    
    if (!response) {
      throw new Error('No response from Overpass API');
    }
    
    const data = await response.json();
    console.log(`[GraphWorker] Received ${data.elements?.length || 0} elements`);
    
    if (!data.elements || data.elements.length === 0) {
      throw new Error("No OSM data returned");
    }
    
    let graph = processOSMData(data.elements);
    
    if (!graph || Object.keys(graph.nodes).length === 0) {
      throw new Error("No nodes created");
    }
    
    // Connect nearby nodes to fill gaps
    graph = connectNearbyNodes(graph, 25);
    
    console.log(`[GraphWorker] Graph built — ${Object.keys(graph.nodes).length} nodes, ${graph.edges.length} edges`);
    
    return graph;
    
  } catch (error) {
    console.error("[GraphWorker] Error:", error);
    throw error;
  }
}