// services/costFunction.js
// Calculates the contextual cost of travelling an edge
// Used by A* instead of raw distance so routes reflect real-world conditions

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
      surface:   1.0,
      incline:   1.0,
      sidewalk:  1.0,
      lighting:  1.2,
      traffic:   1.3,
      gate:      1.0,
    },
  },
  accessible: {
    label: "Accessible",
    icon: "♿",
    color: "#8b5cf6",
    description: "Avoids steep inclines, unpaved surfaces and roads without sidewalks",
    weights: {
      surface:   2.5,
      incline:   3.0,
      sidewalk:  2.0,
      lighting:  1.2,
      traffic:   1.5,
      gate:      1.0,
    },
  },
  night: {
    label: "Night Safety",
    icon: "🌙",
    color: "#f59e0b",
    description: "Prioritises well-lit, busy roads for safer night navigation",
    weights: {
      surface:   1.2,
      incline:   1.5,
      sidewalk:  1.5,
      lighting:  3.0,
      traffic:   0.8,
      gate:      1.0,
    },
  },
  fastest: {
    label: "Fastest",
    icon: "⚡",
    color: "#22c55e",
    description: "Pure shortest path — ignores comfort and safety factors",
    weights: {
      surface:   1.0,
      incline:   1.0,
      sidewalk:  1.0,
      lighting:  1.0,
      traffic:   1.0,
      gate:      1.0,
    },
  },
};

// ─── Surface penalties ────────────────────────────────────────────────────────
const SURFACE_PENALTIES = {
  paved:         1.0,
  asphalt:       1.0,
  concrete:      1.0,
  paving_stones: 1.1,
  sett:          1.1,
  compacted:     1.2,
  gravel:        1.4,
  fine_gravel:   1.3,
  dirt:          1.6,
  grass:         1.7,
  unpaved:       1.5,
  ground:        1.5,
  sand:          1.8,
  mud:           2.0,
};

// ─── Incline penalties ────────────────────────────────────────────────────────
const INCLINE_PENALTIES = {
  flat:       1.0,
  gentle:     1.2,
  moderate:   1.5,
  steep:      2.5,
  very_steep: 3.5,
};

// ─── Highway base costs ───────────────────────────────────────────────────────
// Walking-specific costs: pedestrian infrastructure is preferred, high-speed
// roads are heavily penalised even if technically reachable.
// These are base multipliers on distance before any other factor is applied.
const HIGHWAY_BASE_COST_WALK = {
  footway:        0.9,  // preferred — purpose-built for pedestrians
  path:           0.9,  // preferred — informal but pedestrian-friendly
  pedestrian:     0.85, // best — pedestrian-only zones
  steps:          1.8,  // slow and tiring
  cycleway:       1.05, // fine to walk on
  living_street:  1.0,  // shared space, calm
  residential:    1.1,  // neutral — low traffic
  service:        1.2,  // slightly worse — vehicle access roads
  track:          1.3,  // rough, usually unpaved
  unclassified:   1.2,  // mixed use
  tertiary_link:  1.3,
  secondary_link: 1.4,
  tertiary:       1.5,  // getting unpleasant for walking
  secondary:      2.0,  // busy road, avoid
  primary:        3.0,  // strongly avoid — fast traffic, hostile to walkers
  trunk:          9999, // impassable on foot
  motorway:       9999,
  motorway_link:  9999,
  connection:     1.1,  // auto-generated proximity connections from graphBuilder
};

// Car/motorcycle use a simpler hierarchy — speed matters more than comfort
const HIGHWAY_BASE_COST_VEHICLE = {
  footway:        9999,
  path:           9999,
  pedestrian:     9999,
  steps:          9999,
  cycleway:       9999,
  living_street:  1.2,
  residential:    1.1,
  service:        1.2,
  track:          1.4,
  unclassified:   1.1,
  tertiary_link:  1.0,
  secondary_link: 1.0,
  tertiary:       0.95,
  secondary:      0.9,
  primary:        0.85,
  trunk:          9999,
  motorway:       9999,
  motorway_link:  9999,
  connection:     1.3,
};

// ─── Campus core preference ───────────────────────────────────────────────────
// 15% discount on known central campus roads to pull routes through the heart
// of campus rather than around the perimeter.
const CAMPUS_CORE_BONUS     = 0.85;
const PERIMETER_ROAD_PENALTY = 1.2;

const CAMPUS_CORE_ROADS = [
  'Nsia Road', 'Akuafo Road', 'Onyaa Road', 'E.A. Boateng Road',
  'Legon Road', 'Ivan Addae Mensah Intersection', 'JQB Road'
];

const PERIMETER_ROADS = [
  'Ring Road West', 'Ring Road East', 'J.J. Rawlings Avenue',
  'N4', 'Legon Boundary Road', 'McCarthy Link'
];

// ─── Turn penalty ─────────────────────────────────────────────────────────────
// Added to the cost of an edge when the route changes direction sharply.
// Expressed in metres so it's directly comparable to distance-based costs.
// A 20m penalty means a U-turn is as expensive as walking an extra 20 metres.
//
// Why these values:
//   - Slight turn  (<30°): free — natural path curvature
//   - Moderate     (30–60°): 5m — minor deviation
//   - Sharp        (60–120°): 15m — noticeable direction change
//   - Very sharp   (120–150°): 30m — almost doubling back
//   - U-turn       (>150°): 50m — actively penalises zigzag paths
const TURN_PENALTIES_METRES = {
  slight:    0,
  moderate:  5,
  sharp:     15,
  very_sharp: 30,
  uturn:     50,
};

/**
 * Calculates the compass bearing from point A to point B (0–360°).
 * Used to detect direction changes between consecutive edges.
 */
export function getBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1R = lat1 * Math.PI / 180;
  const lat2R = lat2 * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2R);
  const x = Math.cos(lat1R) * Math.sin(lat2R) - Math.sin(lat1R) * Math.cos(lat2R) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

/**
 * Returns the turn penalty in metres given an incoming and outgoing bearing.
 * The penalty is added to the weighted edge cost so it directly scales with
 * all the same multipliers as distance.
 */
export function calculateTurnPenalty(incomingBearing, outgoingBearing) {
  // Absolute angular difference, normalised to 0–180°
  const diff = Math.abs(((outgoingBearing - incomingBearing) + 540) % 360 - 180);

  if (diff < 30)  return TURN_PENALTIES_METRES.slight;
  if (diff < 60)  return TURN_PENALTIES_METRES.moderate;
  if (diff < 120) return TURN_PENALTIES_METRES.sharp;
  if (diff < 150) return TURN_PENALTIES_METRES.very_sharp;
  return TURN_PENALTIES_METRES.uturn;
}

// ─── Direction consistency penalty ───────────────────────────────────────────
// Penalises edges that point away from the overall start→destination bearing.
// This is a soft preference — it does NOT override the heuristic but adds a
// small cost when a step moves in the wrong direction.
//
// Max penalty: 20m for directly opposite direction.
// This is intentionally gentle — we don't want to force straight lines when
// the campus layout requires going around buildings.
const MAX_DIRECTION_PENALTY_METRES = 20;

/**
 * Returns a direction-consistency penalty in metres.
 * goalBearing: bearing from current node directly to destination
 * edgeBearing:  bearing of the edge being evaluated
 */
export function calculateDirectionPenalty(goalBearing, edgeBearing) {
  const diff = Math.abs(((edgeBearing - goalBearing) + 540) % 360 - 180);
  // Cosine falloff: 0° off = 0 penalty, 180° off = MAX penalty
  return MAX_DIRECTION_PENALTY_METRES * (1 - Math.cos(diff * Math.PI / 180)) / 2;
}

const BUSY_AREA_TYPES = ["footway", "pedestrian", "residential"];
const PEAK_HOURS = [8, 9, 12, 13, 16, 17];

function isWeekend()  { const d = new Date().getDay(); return d === 0 || d === 6; }
function isSunday()   { return new Date().getDay() === 0; }
function isSaturday() { return new Date().getDay() === 6; }

function getInclineCategory(inclineTag) {
  if (!inclineTag) return "flat";
  const tag = String(inclineTag).toLowerCase().trim();
  if (tag === "flat" || tag === "0%") return "flat";
  if (tag === "steep" || tag === "very_steep") return tag.replace(" ", "_");
  const pct = parseFloat(tag.replace("%", ""));
  if (isNaN(pct)) return "flat";
  const abs = Math.abs(pct);
  if (abs <= 2)  return "flat";
  if (abs <= 5)  return "gentle";
  if (abs <= 10) return "moderate";
  if (abs <= 15) return "steep";
  return "very_steep";
}

function getTrafficMultiplier(highwayType, timePeriod, currentHour, trafficWeight) {
  const isPeakHour       = PEAK_HOURS.includes(currentHour);
  const isBusyArea       = BUSY_AREA_TYPES.includes(highwayType);
  const isHighTrafficRoad = ["primary", "secondary", "trunk"].includes(highwayType);
  const weekend  = isWeekend();
  const saturday = isSaturday();
  const sunday   = isSunday();

  let baseMultiplier = 1.0;

  if (weekend) {
    baseMultiplier = sunday ? 1.0 : 1.1;
  } else {
    if      (isPeakHour && (isBusyArea || isHighTrafficRoad))             baseMultiplier = 1.6;
    else if (timePeriod === "day"  && (isBusyArea || isHighTrafficRoad))  baseMultiplier = 1.3;
    else if (timePeriod === "dusk" && (isBusyArea || isHighTrafficRoad))  baseMultiplier = 1.1;
    else if (timePeriod === "night")                                        baseMultiplier = 1.0;
  }

  return 1 + (baseMultiplier - 1) * trafficWeight;
}

export function isEdgeAllowed(edge, vehicleMode) {
  const highwayType  = edge.tags?.highway || edge.type || 'residential';
  const vehicleConfig = VEHICLE_MODES[vehicleMode];
  if (!vehicleConfig) return true;
  return !vehicleConfig.blockedRoads.includes(highwayType);
}

function isCampusCoreRoad(roadName, tags) {
  if (!roadName && !tags?.name) return false;
  const name = (roadName || tags?.name || '').toLowerCase();
  return CAMPUS_CORE_ROADS.some(r => name.includes(r.toLowerCase()));
}

function isPerimeterRoad(roadName, tags) {
  if (!roadName && !tags?.name) return false;
  const name = (roadName || tags?.name || '').toLowerCase();
  return PERIMETER_ROADS.some(r => name.includes(r.toLowerCase()));
}

export function getEstimatedTime(distanceMeters, vehicleMode) {
  const vehicleConfig = VEHICLE_MODES[vehicleMode] || VEHICLE_MODES.walk;
  const timeSeconds   = distanceMeters / vehicleConfig.baseSpeedMs;
  return Math.ceil(timeSeconds / 60);
}

/**
 * Calculates the weighted cost of traversing an edge.
 *
 * @param {Object} edge              - Graph edge with distance and tags
 * @param {Object} profile           - Routing profile with factor weights
 * @param {string} timePeriod        - 'day' | 'dusk' | 'night'
 * @param {boolean} vehicleRestricted - Whether vehicle gate restrictions apply
 * @param {number} currentHour       - 0–23
 * @param {string} vehicleMode       - 'walk' | 'car' | 'motorcycle'
 * @param {number|null} incomingBearing  - Bearing of the edge we arrived on (null at start)
 * @param {number|null} goalBearing      - Bearing from current node to destination (for direction penalty)
 */
export function calculateEdgeCost(
  edge,
  profile,
  timePeriod,
  vehicleRestricted,
  currentHour,
  vehicleMode = 'walk',
  incomingBearing = null,
  goalBearing = null
) {
  // Hard block for this vehicle mode
  if (!isEdgeAllowed(edge, vehicleMode)) {
    return 9999 * edge.distance;
  }

  const tags     = edge.tags || {};
  const distance = edge.distance;
  const w        = profile.weights;

  const highwayType = tags.highway || edge.type || "residential";

  // Select the right base cost table
  const baseCostTable = vehicleMode === 'walk'
    ? HIGHWAY_BASE_COST_WALK
    : HIGHWAY_BASE_COST_VEHICLE;

  const highwayCost = baseCostTable[highwayType] ?? 1.3;

  // Hard impassable roads return early
  if (highwayCost >= 9999) return 9999 * distance;

  // ── Campus road preference (walking only) ─────────────────────────────────
  let campusBonus = 1.0;
  if (vehicleMode === 'walk') {
    const roadName = tags.name || '';
    if      (isCampusCoreRoad(roadName, tags))  campusBonus = CAMPUS_CORE_BONUS;
    else if (isPerimeterRoad(roadName, tags))    campusBonus = PERIMETER_ROAD_PENALTY;
  }

  // ── Surface ───────────────────────────────────────────────────────────────
  const surfaceTag     = tags.surface?.toLowerCase() || "unknown";
  const surfacePenalty = SURFACE_PENALTIES[surfaceTag] ?? 1.3;
  const surfaceCost    = 1 + (surfacePenalty - 1) * w.surface;

  // ── Incline ───────────────────────────────────────────────────────────────
  const inclineCat     = getInclineCategory(tags.incline);
  const inclinePenalty = INCLINE_PENALTIES[inclineCat] ?? 1.0;
  const inclineCost    = 1 + (inclinePenalty - 1) * w.incline;

  // ── Sidewalk ──────────────────────────────────────────────────────────────
  const sidewalkTag  = tags.sidewalk?.toLowerCase();
  const noSidewalk   = sidewalkTag === "none" || sidewalkTag === "no";
  const sidewalkCost = noSidewalk ? 1 + (0.4 * w.sidewalk) : 1.0;

  // ── Lighting ──────────────────────────────────────────────────────────────
  let lightingCost = 1.0;
  if (timePeriod === "dusk" || timePeriod === "night") {
    const litTag    = tags.lit?.toLowerCase();
    const isUnlit   = litTag === "no" || litTag === undefined;
    if (isUnlit) {
      const nightMultiplier = timePeriod === "night" ? 1.0 : 0.5;
      lightingCost = 1 + (1.0 * w.lighting * nightMultiplier);
    }
  }

  // ── Traffic ───────────────────────────────────────────────────────────────
  const trafficCost = getTrafficMultiplier(highwayType, timePeriod, currentHour, w.traffic);

  // ── Gate ──────────────────────────────────────────────────────────────────
  let gateCost = 1.0;
  if (vehicleRestricted && vehicleMode !== 'walk') {
    const gate = isEdgeNearGate(edge);
    if (gate?.requiresEcard) gateCost = 9999;
  }

  // ── Base weighted distance ────────────────────────────────────────────────
  const baseCost =
    distance *
    campusBonus *
    highwayCost *
    surfaceCost *
    inclineCost *
    sidewalkCost *
    lightingCost *
    trafficCost *
    gateCost;

  // ── Turn penalty (in metres, added directly to cost) ─────────────────────
  // Only applied when we know the direction we arrived from.
  // The fastest profile skips turn penalties — it just wants raw distance.
  let turnPenalty = 0;
  if (incomingBearing !== null && profile !== PROFILES.fastest) {
    const outgoingBearing = getBearing(
      edge.fromLat ?? 0, edge.fromLng ?? 0,
      edge.toLat   ?? 0, edge.toLng   ?? 0
    );
    if (outgoingBearing !== 0 || edge.fromLat) {
      turnPenalty = calculateTurnPenalty(incomingBearing, outgoingBearing);
    }
  }

  // ── Direction consistency penalty (gentle — only for walking) ────────────
  let directionPenalty = 0;
  if (goalBearing !== null && vehicleMode === 'walk' && profile !== PROFILES.fastest) {
    const outgoingBearing = getBearing(
      edge.fromLat ?? 0, edge.fromLng ?? 0,
      edge.toLat   ?? 0, edge.toLng   ?? 0
    );
    if (edge.fromLat) {
      directionPenalty = calculateDirectionPenalty(goalBearing, outgoingBearing);
    }
  }

  return baseCost + turnPenalty + directionPenalty;
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
    timePeriod:        getTimePeriod(),
    vehicleRestricted: isVehicleRestrictedNow(),
    currentHour:       now.getHours(),
    timestamp:         now.toISOString(),
  };
}

export function getActiveWarnings(context, profileKey) {
  const warnings = [];
  const day       = new Date().getDay();
  const isWeekday = day >= 1 && day <= 5;

  if (context.timePeriod === "night") {
    warnings.push({ type: "danger", icon: "🌑", message: "Night mode active — poorly lit routes are avoided" });
  } else if (context.timePeriod === "dusk") {
    warnings.push({ type: "warn",   icon: "🌆", message: "Dusk mode active — lighting penalties applied" });
  }

  if (context.vehicleRestricted) {
    warnings.push({ type: "warn", icon: "🚪", message: "Gates closed 00:00–05:00 — Open to pedestrians" });
  }

  if (profileKey === "accessible") {
    warnings.push({ type: "info", icon: "♿", message: "Accessibility mode — steep and unpaved paths avoided" });
  }

  const isPeakHour = [8, 9, 12, 13, 16, 17].includes(context.currentHour);
  if (isWeekday && isPeakHour && context.timePeriod === "day") {
    warnings.push({ type: "info", icon: "🚶‍♂️", message: "Peak hours — busy paths may be slower" });
  }

  return warnings;
}