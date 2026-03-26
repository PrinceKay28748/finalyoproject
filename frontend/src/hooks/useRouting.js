// hooks/useRouting.js
// Manages routing state — loads the graph once, then runs Dijkstra
// only when the user explicitly triggers it via markersVisible

import { useState, useEffect, useRef } from "react";
import { buildGraph, findClosestNode } from "../services/graphBuilder";
import { findShortestPath }            from "../services/routing";

// Module-level cache — survives StrictMode double-invoke
// so Overpass API is only called once per session
let graphCache    = null;
let graphPromise  = null;

function getGraph() {
  if (graphCache) return Promise.resolve(graphCache);
  if (graphPromise) return graphPromise;
  graphPromise = buildGraph().then((g) => {
    graphCache   = g;
    graphPromise = null;
    return g;
  });
  return graphPromise;
}

export function useRouting(startPoint, destPoint, triggered) {
  const [graph, setGraph]         = useState(null);   // road network graph
  const [route, setRoute]         = useState(null);   // computed route result
  const [isLoading, setIsLoading] = useState(false);  // loading state
  const [error, setError]         = useState(null);   // error message

  // Load the road network graph once — module-level cache prevents duplicate requests
  useEffect(() => {
    async function loadGraph() {
      console.log("[useRouting] Loading road network...");
      setIsLoading(true);
      setError(null);

      const graphData = await getGraph();

      if (graphData && Object.keys(graphData.nodes).length > 0) {
        setGraph(graphData);
        console.log("[useRouting] Graph ready —", Object.keys(graphData.nodes).length, "nodes");
      } else {
        setError("Failed to load road network data");
        console.error("[useRouting] Graph load failed");
      }

      setIsLoading(false);
    }

    loadGraph();
  }, []);

  // Calculate route only when the user presses Show on Map (triggered = true)
  // This prevents Dijkstra firing on every GPS update or keystroke
  useEffect(() => {
    if (!triggered) {
      setRoute(null); // clear old route when user resets
      return;
    }

    if (!graph) {
      console.log("[useRouting] Graph not ready yet");
      return;
    }

    if (!startPoint || !destPoint) {
      console.log("[useRouting] Both points needed to calculate route");
      return;
    }

    async function calculateRoute() {
      setIsLoading(true);
      setError(null);

      try {
        // Snap both points to the nearest node on the road network
        const startNodeId = findClosestNode(graph, startPoint.lat, startPoint.lng);
        const destNodeId  = findClosestNode(graph, destPoint.lat,  destPoint.lng);

        console.log("[useRouting] Snapped nodes —", { startNodeId, destNodeId });

        if (!startNodeId) throw new Error("Could not snap start point to road network");
        if (!destNodeId)  throw new Error("Could not snap destination to road network");

        const path = findShortestPath(graph, startNodeId, destNodeId);

        if (!path) throw new Error("No path found between the selected points");

        console.log("[useRouting] Route found —", path.totalDistanceKm.toFixed(2), "km");
        setRoute(path);

      } catch (err) {
        console.error("[useRouting] Route error:", err.message);
        setError(err.message);
        setRoute(null);
      } finally {
        setIsLoading(false);
      }
    }

    calculateRoute();
  }, [graph, startPoint, destPoint, triggered]);

  return { route, isLoading, error };
}