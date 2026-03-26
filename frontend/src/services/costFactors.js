// services/costFactors.js
// Handles all contextual cost factors for edge weighting
// Each factor is a multiplier that increases the effective distance
// Higher multiplier = more expensive = Dijkstra avoids it

// ========================
// USER PROFILE
// ========================
// Active profile can be: 'standard', 'accessible', 'night'
// Set by the UI when user selects their preference
let activeProfile = 'standard';

export function setProfile(profile) {
  const validProfiles = ['standard', 'accessible', 'night'];
  if (validProfiles.includes(profile)) {
    activeProfile = profile;
    console.log(`[CostFactors] Profile set to: ${activeProfile}`);
  } else {
    console.warn(`[CostFactors] Invalid profile: ${profile}, using standard`);
    activeProfile = 'standard';
  }
}

export function getActiveProfile() {
  return activeProfile;
}

// ========================
// SURFACE QUALITY
// ========================
// Penalizes rough or unpaved surfaces
// Data source: OSM "surface" tag on ways

const SURFACE_PENALTIES = {
  // Best surfaces — no penalty
  'paved': 1.0,
  'asphalt': 1.0,
  'concrete': 1.0,
  'concrete:plates': 1.0,
  'paving_stones': 1.0,
  
  // Moderate surfaces — slight penalty
  'sett': 1.1,
  'cobblestone': 1.15,
  'gravel': 1.2,
  'compacted': 1.2,
  
  // Poor surfaces — heavy penalty
  'unpaved': 1.4,
  'ground': 1.4,
  'dirt': 1.5,
  'grass': 1.6,
  'sand': 1.7,
  'mud': 2.0,
  
  // Unknown — mild penalty
  'unknown': 1.15
};

// Default penalty for missing surface tag
const DEFAULT_SURFACE_PENALTY = 1.15;

/**
 * Get surface penalty multiplier for an edge
 * @param {Object} tags - OSM tags from the edge
 * @param {string} profile - Active profile
 * @returns {number} Multiplier (1.0 = no penalty, higher = worse)
 */
export function getSurfacePenalty(tags, profile = activeProfile) {
  // Standard profile — no surface penalty
  if (profile === 'standard') return 1.0;
  
  // Accessible profile — penalizes rough surfaces heavily
  if (profile === 'accessible') {
    if (!tags || !tags.surface) return DEFAULT_SURFACE_PENALTY * 1.2;
    
    const surface = tags.surface.toLowerCase();
    for (const [key, penalty] of Object.entries(SURFACE_PENALTIES)) {
      if (surface.includes(key)) {
        // Amplify penalty for accessible profile
        return Math.min(penalty * 1.3, 2.5);
      }
    }
    return DEFAULT_SURFACE_PENALTY * 1.2;
  }
  
  // Night profile — surface doesn't matter as much
  if (profile === 'night') return 1.0;
  
  return 1.0;
}

// ========================
// SIDEWALK AVAILABILITY
// ========================
// Penalizes roads without sidewalks
// Data source: OSM "sidewalk" tag on ways

const SIDEWALK_PENALTIES = {
  'both': 1.0,      // Best — sidewalks on both sides
  'left': 1.05,     // Slight penalty — one side only
  'right': 1.05,
  'yes': 1.05,      // Has sidewalk but unspecified which side
  'no': 1.35,       // Heavy penalty — no sidewalk at all
  'none': 1.35,
  'separate': 1.0,  // Separate path alongside road
  'unknown': 1.15
};

const DEFAULT_SIDEWALK_PENALTY = 1.15;

/**
 * Get sidewalk penalty multiplier for an edge
 * @param {Object} tags - OSM tags from the edge
 * @param {string} profile - Active profile
 * @returns {number} Multiplier
 */
export function getSidewalkPenalty(tags, profile = activeProfile) {
  // Only accessibility profile cares about sidewalks
  if (profile !== 'accessible') return 1.0;
  
  if (!tags) return DEFAULT_SIDEWALK_PENALTY;
  
  const sidewalk = tags.sidewalk;
  if (!sidewalk) return DEFAULT_SIDEWALK_PENALTY;
  
  const normalized = sidewalk.toLowerCase();
  for (const [key, penalty] of Object.entries(SIDEWALK_PENALTIES)) {
    if (normalized.includes(key)) {
      return penalty;
    }
  }
  
  return DEFAULT_SIDEWALK_PENALTY;
}

// ========================
// LIGHTING
// ========================
// Penalizes unlit roads at night
// Data source: OSM "lit" tag on ways + current time

// Hours for night mode (24-hour format)
const NIGHT_START_HOUR = 19;  // 7:00 PM
const NIGHT_END_HOUR = 5;     // 5:00 AM

const LIGHTING_PENALTIES = {
  'yes': 1.0,        // Well lit — no penalty
  '24/7': 1.0,
  'automatic': 1.0,
  'no': 2.0,         // Unlit at night — heavy penalty
  'limited': 1.5,    // Poor lighting — moderate penalty
  'unknown': 1.3
};

const DEFAULT_LIGHTING_PENALTY = 1.3;

/**
 * Check if current time is night mode
 * @returns {boolean}
 */
export function isNightTime() {
  const now = new Date();
  const hour = now.getHours();
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

/**
 * Get lighting penalty multiplier for an edge
 * @param {Object} tags - OSM tags from the edge
 * @param {string} profile - Active profile
 * @returns {number} Multiplier
 */
export function getLightingPenalty(tags, profile = activeProfile) {
  // Only night profile cares about lighting
  if (profile !== 'night') return 1.0;
  
  // Check if it's actually night time
  if (!isNightTime()) return 1.0;
  
  if (!tags) return DEFAULT_LIGHTING_PENALTY;
  
  const lit = tags.lit;
  if (!lit) return DEFAULT_LIGHTING_PENALTY;
  
  const normalized = lit.toLowerCase();
  for (const [key, penalty] of Object.entries(LIGHTING_PENALTIES)) {
    if (normalized.includes(key)) {
      return penalty;
    }
  }
  
  return DEFAULT_LIGHTING_PENALTY;
}

// ========================
// INCLINE / STEEP ROADS
// ========================
// Penalizes steep inclines for accessibility
// Data source: OSM "incline" tag or elevation difference

// Incline thresholds (in degrees or %)
// OSM incline can be: "10%", "15%", "steep", etc.
const STEEP_THRESHOLD_PERCENT = 8; // 8% grade is considered steep for mobility

/**
 * Parse OSM incline tag and return grade percentage
 * @param {string} incline - OSM incline value
 * @returns {number|null} Grade percentage or null if can't parse
 */
function parseIncline(incline) {
  if (!incline) return null;
  
  const str = String(incline).toLowerCase();
  
  // Handle percentage format: "10%"
  if (str.includes('%')) {
    const percent = parseFloat(str);
    if (!isNaN(percent)) return percent;
  }
  
  // Handle degree format: "5°" or "5 deg"
  if (str.includes('°') || str.includes('deg')) {
    const degrees = parseFloat(str);
    if (!isNaN(degrees)) return Math.tan(degrees * Math.PI / 180) * 100;
  }
  
  // Handle text descriptions
  if (str.includes('steep')) return 15;
  if (str.includes('moderate')) return 8;
  if (str.includes('slight')) return 3;
  
  return null;
}

/**
 * Get incline penalty multiplier for an edge
 * @param {Object} tags - OSM tags from the edge
 * @param {string} profile - Active profile
 * @returns {number} Multiplier
 */
export function getInclinePenalty(tags, profile = activeProfile) {
  // Only accessibility profile cares about steep inclines
  if (profile !== 'accessible') return 1.0;
  
  if (!tags) return 1.0;
  
  const incline = tags.incline;
  if (!incline) return 1.0;
  
  const grade = parseIncline(incline);
  if (grade === null) return 1.0;
  
  // Apply penalty based on steepness
  if (grade >= 12) return 2.5;  // Very steep — strongly avoid
  if (grade >= 8) return 1.8;   // Steep — moderate penalty
  if (grade >= 5) return 1.3;   // Moderate incline — slight penalty
  
  return 1.0;
}

// ========================
// MAIN COST CALCULATION
// ========================

/**
 * Calculate total edge cost with all contextual factors
 * @param {number} distanceMeters - Original distance in meters
 * @param {Object} tags - OSM tags from the edge
 * @param {string} profile - Optional override profile (defaults to active)
 * @returns {number} Weighted cost
 */
export function calculateEdgeCost(distanceMeters, tags, profile = activeProfile) {
  // Get all penalty multipliers
  const surfacePenalty = getSurfacePenalty(tags, profile);
  const sidewalkPenalty = getSidewalkPenalty(tags, profile);
  const lightingPenalty = getLightingPenalty(tags, profile);
  const inclinePenalty = getInclinePenalty(tags, profile);
  
  // Combine all penalties (multiply, since they're independent factors)
  const totalPenalty = surfacePenalty * sidewalkPenalty * lightingPenalty * inclinePenalty;
  
  const finalCost = distanceMeters * totalPenalty;
  
  // Log for debugging (optional — can comment out in production)
  if (totalPenalty > 1.1) {
    console.debug(`[CostFactors] Edge cost: ${distanceMeters.toFixed(0)}m × ${totalPenalty.toFixed(2)} = ${finalCost.toFixed(0)}m`);
  }
  
  return finalCost;
}

/**
 * Get human-readable explanation of why a route was chosen
 * Used for the UI to show users why a certain path was recommended
 * @param {Object} tags - OSM tags
 * @returns {Array} List of factors affecting the route
 */
export function getRouteFactors(tags) {
  const factors = [];
  const profile = activeProfile;
  
  if (profile === 'accessible') {
    if (getInclinePenalty(tags) > 1.3) factors.push('Avoids steep slopes');
    if (getSidewalkPenalty(tags) > 1.2) factors.push('Prioritizes roads with sidewalks');
    if (getSurfacePenalty(tags) > 1.2) factors.push('Prefers paved surfaces');
  }
  
  if (profile === 'night' && isNightTime()) {
    if (getLightingPenalty(tags) > 1.2) factors.push('Uses well-lit paths');
  }
  
  return factors;
}