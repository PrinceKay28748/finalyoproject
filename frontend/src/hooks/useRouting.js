// 


// hooks/useRouting.js
// Manages routing state — loads the graph once then runs Dijkstra
// when triggered, passing the active profile to the cost function

import { useState, useEffect } from "react";
import { buildGraph, findClosestNode } from "../services/graphBuilder";
import { findShortestPath }            from "../services/routing";
import { buildRouteContext, getActiveWarnings } from "../services/costFunction";

// Module-level cache — survives React StrictMode double-invoke
// so the Overpass API is only called once per session
let graphCache   = null;
let graphPromise = null;

function getGraph() {
  if (graphCache)   return Promise.resolve(graphCache);
  if (graphPromise) return graphPromise;
  graphPromise = buildGraph().then((g) => {
    graphCache   = g;
    graphPromise = null;
    return g;
  });
  return graphPromise;
}

/**
 * Handles graph loading and route calculation
 * @param {Object}  startPoint  - { lat, lng }
 * @param {Object}  destPoint   - { lat, lng }
 * @param {boolean} triggered   - Only calculates when true (user pressed Show on Map)
 * @param {string}  profileKey  - Active routing profile key
 */
export function useRouting(startPoint, destPoint, triggered, profileKey = "standard") {
  const [graph, setGraph]         = useState(null);   // road network graph
  const [route, setRoute]         = useState(null);   // computed route result
  const [warnings, setWarnings]   = useState([]);     // active contextual warnings
  const [isLoading, setIsLoading] = useState(false);  // loading indicator
  const [error, setError]         = useState(null);   // error message

  // Load graph once on mount using module-level cache
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

  // Calculate route only when triggered — prevents running on every GPS update
  useEffect(() => {
    if (!triggered) {
      setRoute(null);
      setWarnings([]);
      return;
    }

    if (!graph || !startPoint || !destPoint) return;

    async function calculateRoute() {
      setIsLoading(true);
      setError(null);

      try {
        // Snap both points onto the nearest road network node
        const startNodeId = findClosestNode(graph, startPoint.lat, startPoint.lng);
        const destNodeId  = findClosestNode(graph, destPoint.lat,  destPoint.lng);

        console.log("[useRouting] Snapped nodes —", { startNodeId, destNodeId });

        if (!startNodeId) throw new Error("Could not snap start point to road network");
        if (!destNodeId)  throw new Error("Could not snap destination to road network");

        // Run Dijkstra with the active profile
        const path = findShortestPath(graph, startNodeId, destNodeId, profileKey);

        if (!path) throw new Error("No path found between the selected points");

        console.log("[useRouting] Route found —", path.totalDistanceKm.toFixed(2), "km");

        // Build context and derive warnings for the Legend
        const context       = buildRouteContext();
        const activeWarnings = getActiveWarnings(context, profileKey);

        setRoute(path);
        setWarnings(activeWarnings);

      } catch (err) {
        console.error("[useRouting] Route error:", err.message);
        setError(err.message);
        setRoute(null);
        setWarnings([]);
      } finally {
        setIsLoading(false);
      }
    }

    calculateRoute();
  }, [graph, startPoint, destPoint, triggered, profileKey]);

  return { route, warnings, isLoading, error };
}