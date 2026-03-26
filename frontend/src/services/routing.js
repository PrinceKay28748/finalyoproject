// services/routing.js
// Dijkstra's algorithm implementation for shortest path

/**
 * Find shortest path between two nodes using Dijkstra's algorithm
 * @param {Object} graph - Graph with nodes and edges
 * @param {string} startNodeId - Starting node ID
 * @param {string} endNodeId - Destination node ID
 * @returns {Object} Path with nodes, coordinates, and total distance
 */
export function findShortestPath(graph, startNodeId, endNodeId) {
  console.log(`[Routing] Finding path from ${startNodeId} to ${endNodeId}`);
  
  if (!graph || !graph.nodes || !graph.edges) {
    console.error('[Routing] Invalid graph');
    return null;
  }
  
  const nodes = graph.nodes;
  const edges = graph.edges;
  
  // Dijkstra's algorithm setup
  const distances = {};      // Shortest known distance to each node
  const previous = {};       // Previous node in the optimal path
  const unvisited = new Set(); // Nodes not yet processed
  
  // Initialize
  for (const nodeId in nodes) {
    distances[nodeId] = Infinity;
    previous[nodeId] = null;
    unvisited.add(nodeId);
  }
  distances[startNodeId] = 0;
  
  while (unvisited.size > 0) {
    // Find unvisited node with smallest distance
    let current = null;
    let smallestDistance = Infinity;
    
    for (const nodeId of unvisited) {
      if (distances[nodeId] < smallestDistance) {
        smallestDistance = distances[nodeId];
        current = nodeId;
      }
    }
    
    // If we reached the destination or no reachable nodes left
    if (current === null || current === endNodeId) {
      break;
    }
    
    // Remove current from unvisited
    unvisited.delete(current);
    
    // Check all neighbors of current node
    const neighbors = nodes[current].neighbors || [];
    
    for (const neighbor of neighbors) {
      if (!unvisited.has(neighbor.nodeId)) continue;
      
      // Calculate alternative distance
      const alt = distances[current] + neighbor.distance;
      
      if (alt < distances[neighbor.nodeId]) {
        distances[neighbor.nodeId] = alt;
        previous[neighbor.nodeId] = current;
      }
    }
  }
  
  // Check if destination was reached
  if (distances[endNodeId] === Infinity) {
    console.warn('[Routing] No path found between nodes');
    return null;
  }
  
  // Reconstruct path from end to start
  const pathNodeIds = [];
  let current = endNodeId;
  
  while (current !== null) {
    pathNodeIds.unshift(current);
    current = previous[current];
  }
  
  // Convert node IDs to coordinates for map rendering
  const pathCoordinates = pathNodeIds.map(nodeId => ({
    lat: nodes[nodeId].lat,
    lng: nodes[nodeId].lng
  }));
  
  console.log(`[Routing] Path found with ${pathNodeIds.length} nodes, total distance: ${(distances[endNodeId] / 1000).toFixed(2)}km`);
  
  return {
    nodes: pathNodeIds,
    coordinates: pathCoordinates,
    totalDistance: distances[endNodeId],
    totalDistanceKm: distances[endNodeId] / 1000
  };
}