// services/costFunction.js
// Calculates the contextual cost of travelling an edge
// Used by Dijkstra instead of raw distance so routes reflect real-world conditions
//
// Cost formula:
//   edgeCost = distance × surfaceMultiplier × inclineMultiplier
//                       × sidewalkMultiplier × lightingMultiplier
//                       × trafficMultiplier  × gateMultiplier
//
// Each multiplier is ≥ 1.0 — a value of 1.0 means no penalty

import { getTimePeriod, isVehicleRestrictedNow } from "./gateSchedule";

// ─── Gate node IDs ────────────────────────────────────────────────────────────
// These will be populated once the graph is built by snapping gate coordinates
// to their nearest OSM nodes. Set via setGateNodeIds() after buildGraph() runs.
let gateNodeIds = {
  main:    null,
  stadium: null,
  north:   null,
  south:   null,
  link:    null,
};

/**
 * Called after graph is built to register which OSM node IDs correspond to gates
 * @param {Object} ids - { main, stadium, north, south, link }
 */
export function setGateNodeIds(ids) {
  gateNodeIds = { ...gateNodeIds, ...ids };
  console.log("[CostFunction] Gate node IDs registered:", gateNodeIds);
}

// ─── User profiles ────────────────────────────────────────────────────────────
// Each profile adjusts which penalties matter and by how much
// Multipliers stack — a steep unlit road at night on the accessible profile
// becomes very expensive and Dijkstra naturally routes around it

export const PROFILES = {
  standard: {
    label:       "Standard",
    icon:        "🗺️",
    color:       "#2563eb",
    description: "Balanced route — shortest path with basic safety",
    weights: {
      surface:    1.0,   // minor preference for paved roads
      incline:    1.0,   // incline not prioritised
      sidewalk:   1.0,   // sidewalk not prioritised
      lighting:   1.2,   // slight preference for lit roads at night
      traffic:    1.3,   // moderate traffic avoidance
      gate:       1.0,   // gates handled normally
    },
  },

  accessible: {
    label:       "Accessible",
    icon:        "♿",
    color:       "#8b5cf6",
    description: "Avoids steep inclines, unpaved surfaces and roads without sidewalks",
    weights: {
      surface:    2.5,   // strongly prefer paved roads
      incline:    3.0,   // heavily penalise steep roads
      sidewalk:   2.0,   // strongly prefer roads with sidewalks
      lighting:   1.2,   // mild lighting preference
      traffic:    1.5,   // moderate traffic avoidance
      gate:       1.0,
    },
  },

  night: {
    label:       "Night Safety",
    icon:        "🌙",
    color:       "#f59e0b",
    description: "Prioritises well-lit, busy roads for safer night navigation",
    weights: {
      surface:    1.2,
      incline:    1.5,   // avoid steep roads at night
      sidewalk:   1.5,   // prefer paths with sidewalks at night
      lighting:   3.0,   // heavily prioritise lit roads
      traffic:    0.8,   // slightly prefer busier roads — more people = safer
      gate:       1.0,
    },
  },

  fastest: {
    label:       "Fastest",
    icon:        "⚡",
    color:       "#22c55e",
    description: "Pure shortest path — ignores comfort and safety factors",
    weights: {
      surface:    1.0,
      incline:    1.0,
      sidewalk:   1.0,
      lighting:   1.0,
      traffic:    1.0,
      gate:       1.0,
    },
  },
};

// ─── Surface penalties ────────────────────────────────────────────────────────
// Based on OSM surface tag values
const SURFACE_PENALTIES = {
  paved:        1.0,
  asphalt:      1.0,
  concrete:     1.0,
  paving_stones:1.1,
  sett:         1.1,
  compacted:    1.2,
  gravel:       1.4,
  fine_gravel:  1.3,
  dirt:         1.6,
  grass:        1.7,
  unpaved:      1.5,
  ground:       1.5,
  sand:         1.8,
  mud:          2.0,
};

// ─── Incline penalties ────────────────────────────────────────────────────────
// Based on OSM incline tag (percentage or descriptor)
const INCLINE_PENALTIES = {
  flat:    1.0,
  gentle:  1.2,   // up to ~5%
  moderate:1.5,   // 5–10%
  steep:   2.5,   // 10–15%
  very_steep: 3.5,// > 15%
};

// ─── Highway type base costs ──────────────────────────────────────────────────
// Some road types are inherently less suitable for pedestrians
const HIGHWAY_BASE_COST = {
  footway:       1.0,   // ideal
  path:          1.0,
  pedestrian:    1.0,
  steps:         1.8,   // penalise steps for accessibility
  cycleway:      1.1,
  residential:   1.2,
  service:       1.3,
  tertiary:      1.4,
  secondary:     1.6,
  primary:       1.8,   // busy road — less safe for pedestrians
  trunk:         2.5,   // avoid major roads
  motorway:      9999,  // impassable for pedestrians
};

/**
 * Determines the incline category from an OSM incline tag value
 * OSM incline can be a percentage string like "8%" or a descriptor like "steep"
 */
function getInclineCategory(inclineTag) {
  if (!inclineTag) return "flat";

  const tag = String(inclineTag).toLowerCase().trim();

  if (tag === "flat" || tag === "0%") return "flat";
  if (tag === "steep" || tag === "very_steep") return tag.replace("_", "_");

  // Parse percentage values
  const pct = parseFloat(tag.replace("%", ""));
  if (isNaN(pct)) return "flat";
  const abs = Math.abs(pct);

  if (abs <= 2)  return "flat";
  if (abs <= 5)  return "gentle";
  if (abs <= 10) return "moderate";
  if (abs <= 15) return "steep";
  return "very_steep";
}

/**
 * Calculates the contextual cost of traversing an edge
 *
 * @param {Object} edge    - Graph edge with distance, tags, type
 * @param {Object} profile - Active routing profile from PROFILES
 * @param {string} timePeriod - "day" | "dusk" | "night"
 * @param {boolean} vehicleRestricted - Whether vehicle gate restriction is active
 * @returns {number} Edge cost in metres (higher = less preferred)
 */
export function calculateEdgeCost(edge, profile, timePeriod, vehicleRestricted) {
  const tags     = edge.tags || {};
  const distance = edge.distance; // in metres
  const w        = profile.weights;

  // ── 1. Base distance × highway type penalty ──────────────────────────────
  const highwayType   = tags.highway || "residential";
  const highwayCost   = HIGHWAY_BASE_COST[highwayType] ?? 1.3;

  // Immediately block motorways for all pedestrian profiles
  if (highwayCost === 9999) return 9999 * distance;

  // ── 2. Surface multiplier ─────────────────────────────────────────────────
  const surfaceTag     = tags.surface?.toLowerCase() || "unknown";
  const surfacePenalty = SURFACE_PENALTIES[surfaceTag] ?? 1.3; // unknown = slight penalty
  const surfaceCost    = 1 + (surfacePenalty - 1) * w.surface;

  // ── 3. Incline multiplier ─────────────────────────────────────────────────
  const inclineCat     = getInclineCategory(tags.incline);
  const inclinePenalty = INCLINE_PENALTIES[inclineCat] ?? 1.0;
  const inclineCost    = 1 + (inclinePenalty - 1) * w.incline;

  // ── 4. Sidewalk multiplier ────────────────────────────────────────────────
  // Penalise roads that have no sidewalk — pedestrians share the carriageway
  const sidewalkTag  = tags.sidewalk?.toLowerCase();
  const noSidewalk   = sidewalkTag === "none" || sidewalkTag === "no";
  const sidewalkCost = noSidewalk ? 1 + (0.4 * w.sidewalk) : 1.0;

  // ── 5. Lighting multiplier ────────────────────────────────────────────────
  // Only activates during dusk and night periods
  let lightingCost = 1.0;
  if (timePeriod === "dusk" || timePeriod === "night") {
    const litTag  = tags.lit?.toLowerCase();
    const isUnlit = litTag === "no" || litTag === undefined;
    if (isUnlit) {
      // Night applies full penalty, dusk applies half
      const nightMultiplier = timePeriod === "night" ? 1.0 : 0.5;
      lightingCost = 1 + (1.0 * w.lighting * nightMultiplier);
    }
  }

  // ── 6. Traffic multiplier ─────────────────────────────────────────────────
  // Simulated based on road type and time of day
  // Higher traffic roads get a penalty to route pedestrians onto quieter paths
  let trafficCost = 1.0;
  const isHighTraffic = ["primary", "secondary", "trunk"].includes(highwayType);
  const isPeakHour    = timePeriod === "day"; // busier during day

  if (isHighTraffic && isPeakHour) {
    trafficCost = 1 + (0.5 * w.traffic);
  } else if (isHighTraffic) {
    trafficCost = 1 + (0.2 * w.traffic);
  }

  // ── 7. Gate multiplier ────────────────────────────────────────────────────
  // Restricted gates become impassable during lock hours for vehicles
  // Pedestrians are never blocked by gate restrictions
  let gateCost = 1.0;
  if (vehicleRestricted) {
    const isGateEdge = isEdgeNearGate(edge);
    if (isGateEdge && isGateEdge.requiresEcard) {
      gateCost = 9999; // effectively impassable for vehicles at night
    }
  }

  // ── Final cost ────────────────────────────────────────────────────────────
  return distance * highwayCost * surfaceCost * inclineCost
                  * sidewalkCost * lightingCost * trafficCost * gateCost;
}

/**
 * Checks if an edge passes through or near a restricted gate
 * Returns the gate object if found, null otherwise
 */
function isEdgeNearGate(edge) {
  const GATE_PROXIMITY_METRES = 30; // within 30m of a gate counts

  for (const [key, nodeId] of Object.entries(gateNodeIds)) {
    if (!nodeId) continue;
    if (edge.from === nodeId || edge.to === nodeId) {
      // This edge connects to a gate node
      const { UG_GATES } = require("./gateSchedule");
      return UG_GATES[key];
    }
  }
  return null;
}

/**
 * Builds the context object passed into every edge cost calculation
 * Called once per route computation so time is consistent across all edges
 */
export function buildRouteContext() {
  return {
    timePeriod:         getTimePeriod(),
    vehicleRestricted:  isVehicleRestrictedNow(),
    timestamp:          new Date().toISOString(),
  };
}

/**
 * Returns active warnings based on the current context and selected profile
 * These are passed to the Legend component to display to the user
 *
 * @param {Object} context - From buildRouteContext()
 * @param {string} profileKey - Active profile key
 * @returns {Array} Array of warning objects { type, icon, message }
 */
export function getActiveWarnings(context, profileKey) {
  const warnings = [];

  if (context.timePeriod === "night") {
    warnings.push({
      type:    "danger",
      icon:    "🌑",
      message: "Night mode active — poorly lit routes are avoided",
    });
  } else if (context.timePeriod === "dusk") {
    warnings.push({
      type:    "warn",
      icon:    "🌆",
      message: "Dusk mode active — lighting penalties applied",
    });
  }

  if (context.vehicleRestricted) {
    warnings.push({
      type:    "warn",
      icon:    "🚪",
      message: "Gates closed 00:00–05:00 — Stadium Gate only",
    });
  }

  if (profileKey === "accessible") {
    warnings.push({
      type:    "info",
      icon:    "♿",
      message: "Accessibility mode — steep and unpaved paths avoided",
    });
  }

  return warnings;
}