// services/costFunction.js
// Calculates the contextual cost of travelling an edge
// Used by Dijkstra instead of raw distance so routes reflect real-world conditions

import { getTimePeriod, isVehicleRestrictedNow } from "./gateSchedule";

// ─── Gate node IDs ────────────────────────────────────────────────────────────
let gateNodeIds = {
  main:    null,
  stadium: null,
  north:   null,
  south:   null,
  link:    null,
};

export function setGateNodeIds(ids) {
  gateNodeIds = { ...gateNodeIds, ...ids };
  console.log("[CostFunction] Gate node IDs registered:", gateNodeIds);
}

// ─── VEHICLE MODES ────────────────────────────────────────────────────────────
export const VEHICLE_MODES = {
  walk: {
    key: 'walk',
    label: 'Walking',
    icon: '🚶',
    speedKmh: 5,
    description: 'Pedestrian routes - uses footpaths and walkways',
    allowedRoads: ['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'residential', 'service', 'track', 'living_street', 'unclassified', 'tertiary', 'secondary_link', 'tertiary_link'],
    blockedRoads: ['motorway', 'motorway_link', 'primary', 'secondary', 'trunk'],
    baseSpeedMs: 1.39,
  },
  car: {
    key: 'car',
    label: 'Car',
    icon: '🚗',
    speedKmh: 30,
    description: 'Driving routes - follows roads, avoids footpaths',
    allowedRoads: ['residential', 'service', 'unclassified', 'tertiary', 'secondary', 'primary', 'living_street'],
    blockedRoads: ['footway', 'path', 'pedestrian', 'steps', 'cycleway', 'track', 'motorway', 'motorway_link'],
    baseSpeedMs: 8.33,
  },
  motorcycle: {
    key: 'motorcycle',
    label: 'Motorcycle',
    icon: '🏍️',
    speedKmh: 25,
    description: 'Motorcycle routes - more flexible than cars',
    allowedRoads: ['residential', 'service', 'unclassified', 'tertiary', 'secondary', 'primary', 'living_street', 'track', 'cycleway'],
    blockedRoads: ['footway', 'path', 'pedestrian', 'steps', 'motorway', 'motorway_link'],
    baseSpeedMs: 6.94,
  }
};

// ─── User profiles ────────────────────────────────────────────────────────────
export const PROFILES = {
  standard: {
    label: "Standard",
    icon: "🗺️",
    color: "#2563eb",
    description: "Balanced route — shortest with basic safety",
    weights: {
      surface: 1.0,
      incline: 1.0,
      sidewalk: 1.0,
      lighting: 1.2,
      traffic: 1.3,
      gate: 1.0,
    },
  },
  accessible: {
    label: "Accessible",
    icon: "♿",
    color: "#8b5cf6",
    description: "Avoids steep inclines, unpaved surfaces and roads without sidewalks",
    weights: {
      surface: 2.5,
      incline: 3.0,
      sidewalk: 2.0,
      lighting: 1.2,
      traffic: 1.5,
      gate: 1.0,
    },
  },
  night: {
    label: "Night Safety",
    icon: "🌙",
    color: "#f59e0b",
    description: "Prioritises well-lit, busy roads for safer night navigation",
    weights: {
      surface: 1.2,
      incline: 1.5,
      sidewalk: 1.5,
      lighting: 3.0,
      traffic: 0.8,
      gate: 1.0,
    },
  },
  fastest: {
    label: "Fastest",
    icon: "⚡",
    color: "#22c55e",
    description: "Pure shortest path — ignores comfort and safety factors",
    weights: {
      surface: 1.0,
      incline: 1.0,
      sidewalk: 1.0,
      lighting: 1.0,
      traffic: 1.0,
      gate: 1.0,
    },
  },
};

// ─── Surface penalties ────────────────────────────────────────────────────────
const SURFACE_PENALTIES = {
  paved: 1.0,
  asphalt: 1.0,
  concrete: 1.0,
  paving_stones: 1.1,
  sett: 1.1,
  compacted: 1.2,
  gravel: 1.4,
  fine_gravel: 1.3,
  dirt: 1.6,
  grass: 1.7,
  unpaved: 1.5,
  ground: 1.5,
  sand: 1.8,
  mud: 2.0,
};

// ─── Incline penalties ────────────────────────────────────────────────────────
const INCLINE_PENALTIES = {
  flat: 1.0,
  gentle: 1.2,
  moderate: 1.5,
  steep: 2.5,
  very_steep: 3.5,
};

// ─── Highway type base costs ──────────────────────────────────────────────────
const HIGHWAY_BASE_COST = {
  footway: 1.0,
  path: 1.0,
  pedestrian: 1.0,
  steps: 1.8,
  cycleway: 1.1,
  residential: 1.2,
  service: 1.3,
  tertiary: 1.4,
  secondary: 1.6,
  primary: 1.8,
  trunk: 2.5,
  motorway: 9999,
};

// ─── Campus road preference (for direct central routes) ──────────────────────
// These roads are the preferred central campus routes
const CAMPUS_CORE_ROADS = [
  'Nsia Road', 'Akuafo Road', 'Onyaa Road', 'E.A. Boateng Road',
  'Legon Road', 'Ivan Addae Mensah Intersection', 'JQB Road'
];

// Bonus multiplier for campus core roads (0.85 = 15% cheaper, making them more attractive)
const CAMPUS_CORE_BONUS = 0.85;

// Penalty for perimeter roads to discourage long detours (1.15 = 15% more expensive)
const PERIMETER_ROAD_PENALTY = 1.15;

// Perimeter road names (major roads that cause long detours)
const PERIMETER_ROADS = [
  'Ring Road West', 'Ring Road East', 'J.J. Rawlings Avenue',
  'N4', 'Legon Boundary Road', 'McCarthy Link'
];

const BUSY_AREA_TYPES = ["footway", "pedestrian", "residential"];
const PEAK_HOURS = [8, 9, 12, 13, 16, 17];

function isWeekend() {
  const day = new Date().getDay();
  return day === 0 || day === 6;
}

function isSunday() {
  return new Date().getDay() === 0;
}

function isSaturday() {
  return new Date().getDay() === 6;
}

function getInclineCategory(inclineTag) {
  if (!inclineTag) return "flat";
  const tag = String(inclineTag).toLowerCase().trim();
  if (tag === "flat" || tag === "0%") return "flat";
  if (tag === "steep" || tag === "very_steep") return tag.replace("_", "_");
  const pct = parseFloat(tag.replace("%", ""));
  if (isNaN(pct)) return "flat";
  const abs = Math.abs(pct);
  if (abs <= 2) return "flat";
  if (abs <= 5) return "gentle";
  if (abs <= 10) return "moderate";
  if (abs <= 15) return "steep";
  return "very_steep";
}

function getTrafficMultiplier(highwayType, timePeriod, currentHour, trafficWeight) {
  const isPeakHour = PEAK_HOURS.includes(currentHour);
  const isBusyArea = BUSY_AREA_TYPES.includes(highwayType);
  const isHighTrafficRoad = ["primary", "secondary", "trunk"].includes(highwayType);
  const weekend = isWeekend();
  const saturday = isSaturday();
  const sunday = isSunday();
  
  let baseMultiplier = 1.0;
  
  if (weekend) {
    if (sunday) {
      baseMultiplier = 1.0;
    } else if (saturday) {
      baseMultiplier = 1.1;
    }
  } else {
    if (isPeakHour && (isBusyArea || isHighTrafficRoad)) {
      baseMultiplier = 1.6;
    } else if (timePeriod === "day" && (isBusyArea || isHighTrafficRoad)) {
      baseMultiplier = 1.3;
    } else if (timePeriod === "dusk" && (isBusyArea || isHighTrafficRoad)) {
      baseMultiplier = 1.1;
    } else if (timePeriod === "night") {
      baseMultiplier = 1.0;
    }
  }
  
  return 1 + (baseMultiplier - 1) * trafficWeight;
}

/**
 * Check if an edge is allowed for a given vehicle mode
 */
export function isEdgeAllowed(edge, vehicleMode) {
  const highwayType = edge.tags?.highway || edge.type || 'residential';
  const vehicleConfig = VEHICLE_MODES[vehicleMode];
  
  if (!vehicleConfig) return true;
  
  if (vehicleConfig.blockedRoads.includes(highwayType)) {
    return false;
  }
  
  return true;
}

/**
 * Check if a road is in the campus core (preferred for direct routes)
 */
function isCampusCoreRoad(roadName, tags) {
  if (!roadName && !tags?.name) return false;
  const name = (roadName || tags?.name || '').toLowerCase();
  for (const coreRoad of CAMPUS_CORE_ROADS) {
    if (name.includes(coreRoad.toLowerCase()) || name === coreRoad.toLowerCase()) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a road is a perimeter road (penalized to avoid detours)
 */
function isPerimeterRoad(roadName, tags) {
  if (!roadName && !tags?.name) return false;
  const name = (roadName || tags?.name || '').toLowerCase();
  for (const perimeterRoad of PERIMETER_ROADS) {
    if (name.includes(perimeterRoad.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Get estimated travel time in minutes based on vehicle mode and distance
 */
export function getEstimatedTime(distanceMeters, vehicleMode) {
  const vehicleConfig = VEHICLE_MODES[vehicleMode] || VEHICLE_MODES.walk;
  const timeSeconds = distanceMeters / vehicleConfig.baseSpeedMs;
  return Math.ceil(timeSeconds / 60);
}

/**
 * Calculates the contextual cost of traversing an edge
 */
export function calculateEdgeCost(edge, profile, timePeriod, vehicleRestricted, currentHour, vehicleMode = 'walk') {
  // Check if edge is allowed for this vehicle mode
  if (!isEdgeAllowed(edge, vehicleMode)) {
    return 9999 * edge.distance;
  }
  
  const tags = edge.tags || {};
  const distance = edge.distance;
  const w = profile.weights;

  const highwayType = tags.highway || "residential";
  let highwayCost = HIGHWAY_BASE_COST[highwayType] ?? 1.3;

  if (highwayCost === 9999) return 9999 * distance;

  // ─── Campus core preference (for walking mode only) ──────────────────────────
  // Contextual factors (surface, incline, lighting, traffic) are still applied on top
  let campusBonus = 1.0;
  if (vehicleMode === 'walk') {
    const roadName = tags.name || '';
    if (isCampusCoreRoad(roadName, tags)) {
      campusBonus = CAMPUS_CORE_BONUS;
    } else if (isPerimeterRoad(roadName, tags)) {
      campusBonus = PERIMETER_ROAD_PENALTY;
    }
  }

  const surfaceTag = tags.surface?.toLowerCase() || "unknown";
  const surfacePenalty = SURFACE_PENALTIES[surfaceTag] ?? 1.3;
  const surfaceCost = 1 + (surfacePenalty - 1) * w.surface;

  const inclineCat = getInclineCategory(tags.incline);
  const inclinePenalty = INCLINE_PENALTIES[inclineCat] ?? 1.0;
  const inclineCost = 1 + (inclinePenalty - 1) * w.incline;

  const sidewalkTag = tags.sidewalk?.toLowerCase();
  const noSidewalk = sidewalkTag === "none" || sidewalkTag === "no";
  const sidewalkCost = noSidewalk ? 1 + (0.4 * w.sidewalk) : 1.0;

  let lightingCost = 1.0;
  if (timePeriod === "dusk" || timePeriod === "night") {
    const litTag = tags.lit?.toLowerCase();
    const isUnlit = litTag === "no" || litTag === undefined;
    if (isUnlit) {
      const nightMultiplier = timePeriod === "night" ? 1.0 : 0.5;
      lightingCost = 1 + (1.0 * w.lighting * nightMultiplier);
    }
  }

  const trafficCost = getTrafficMultiplier(highwayType, timePeriod, currentHour, w.traffic);

  let gateCost = 1.0;
  if (vehicleRestricted && vehicleMode !== 'walk') {
    const isGateEdge = isEdgeNearGate(edge);
    if (isGateEdge && isGateEdge.requiresEcard) {
      gateCost = 9999;
    }
  }

  // Final cost = distance × campusBonus × highwayCost × surfaceCost × inclineCost × sidewalkCost × lightingCost × trafficCost × gateCost
  return distance * campusBonus * highwayCost * surfaceCost * inclineCost * sidewalkCost * lightingCost * trafficCost * gateCost;
}

function isEdgeNearGate(edge) {
  for (const [key, nodeId] of Object.entries(gateNodeIds)) {
    if (!nodeId) continue;
    if (edge.from === nodeId || edge.to === nodeId) {
      const { UG_GATES } = require("./gateSchedule");
      return UG_GATES[key];
    }
  }
  return null;
}

export function buildRouteContext() {
  const now = new Date();
  return {
    timePeriod: getTimePeriod(),
    vehicleRestricted: isVehicleRestrictedNow(),
    currentHour: now.getHours(),
    timestamp: now.toISOString(),
  };
}

export function getActiveWarnings(context, profileKey) {
  const warnings = [];
  const day = new Date().getDay();
  const isWeekday = day >= 1 && day <= 5;

  if (context.timePeriod === "night") {
    warnings.push({
      type: "danger",
      icon: "🌑",
      message: "Night mode active — poorly lit routes are avoided",
    });
  } else if (context.timePeriod === "dusk") {
    warnings.push({
      type: "warn",
      icon: "🌆",
      message: "Dusk mode active — lighting penalties applied",
    });
  }

  if (context.vehicleRestricted) {
    warnings.push({
      type: "warn",
      icon: "🚪",
      message: "Gates closed 00:00–05:00 — Open to pedestrians",
    });
  }

  if (profileKey === "accessible") {
    warnings.push({
      type: "info",
      icon: "♿",
      message: "Accessibility mode — steep and unpaved paths avoided",
    });
  }

  const isPeakHour = [8, 9, 12, 13, 16, 17].includes(context.currentHour);
  if (isWeekday && isPeakHour && context.timePeriod === "day") {
    warnings.push({
      type: "info",
      icon: "🚶‍♂️",
      message: "Peak hours — busy paths may be slower",
    });
  }

  return warnings;
}