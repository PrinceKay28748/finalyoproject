// services/directions.js
// Generates turn-by-turn instructions from route coordinates

// Calculate bearing between two points (in degrees)
function calculateBearing(lat1, lng1, lat2, lng2) {
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
  
  let bearing = Math.atan2(y, x) * 180 / Math.PI;
  bearing = (bearing + 360) % 360;
  return bearing;
}

// Calculate distance between two points in meters
function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Determine maneuver type based on angle change
function getManeuver(angleChange) {
  const absAngle = Math.abs(angleChange);
  
  if (absAngle < 15) return "straight";
  if (absAngle < 40) return "slight-right";
  if (absAngle < 120) return "turn-right";
  if (absAngle < 160) return "sharp-right";
  if (absAngle > 200) {
    const oppositeAngle = 360 - absAngle;
    if (oppositeAngle < 15) return "straight";
    if (oppositeAngle < 40) return "slight-left";
    if (oppositeAngle < 120) return "turn-left";
    return "sharp-left";
  }
  return "turn-left";
}

// Generate human-readable instruction
function getInstruction(maneuver, roadName, distance) {
  const roadText = roadName ? ` onto ${roadName}` : '';
  
  switch (maneuver) {
    case "straight":
      return `Continue straight${roadText}`;
    case "slight-right":
      return `Bear right${roadText}`;
    case "turn-right":
      return `Turn right${roadText}`;
    case "sharp-right":
      return `Make a sharp right${roadText}`;
    case "slight-left":
      return `Bear left${roadText}`;
    case "turn-left":
      return `Turn left${roadText}`;
    case "sharp-left":
      return `Make a sharp left${roadText}`;
    default:
      return `Continue${roadText}`;
  }
}

// Format distance for voice (natural language)
function formatDistanceForVoice(meters) {
  if (meters < 50) return "now";
  if (meters < 200) return `in ${Math.round(meters)} meters`;
  if (meters < 500) return `in about ${Math.round(meters / 10) * 10} meters`;
  return `in ${(meters / 1000).toFixed(1)} kilometers`;
}

/**
 * Generate turn-by-turn instructions from route coordinates
 * @param {Array} coordinates - Array of {lat, lng} objects
 * @returns {Array} Instructions with distance, maneuver, and text
 */
export function generateDirections(coordinates) {
  if (!coordinates || coordinates.length < 2) return [];
  
  const instructions = [];
  let cumulativeDistance = 0;
  
  // Calculate total distance and segment distances
  const segments = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const dist = distanceMeters(
      coordinates[i].lat, coordinates[i].lng,
      coordinates[i + 1].lat, coordinates[i + 1].lng
    );
    segments.push({
      start: coordinates[i],
      end: coordinates[i + 1],
      distance: dist,
      cumulativeStart: cumulativeDistance,
      cumulativeEnd: cumulativeDistance + dist
    });
    cumulativeDistance += dist;
  }
  
  const totalDistance = cumulativeDistance;
  
  // Detect turns by comparing bearing changes
  let lastBearing = null;
  let currentSegmentStart = 0;
  let currentRoadName = null;
  
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const bearing = calculateBearing(
      seg.start.lat, seg.start.lng,
      seg.end.lat, seg.end.lng
    );
    
    if (lastBearing !== null) {
      let angleChange = bearing - lastBearing;
      if (angleChange > 180) angleChange -= 360;
      if (angleChange < -180) angleChange += 360;
      
      const maneuver = getManeuver(angleChange);
      
      // Only add instruction if it's not straight
      if (maneuver !== "straight") {
        const distanceToTurn = seg.cumulativeStart;
        const instructionText = getInstruction(maneuver, currentRoadName, distanceToTurn);
        
        instructions.push({
          distance: distanceToTurn,
          maneuver,
          instruction: instructionText,
          point: seg.start,
          index: i
        });
      }
    }
    
    lastBearing = bearing;
    currentSegmentStart = seg.cumulativeStart;
    // Road name would come from OSM tags - placeholder
    currentRoadName = null;
  }
  
  // Add destination instruction
  instructions.push({
    distance: totalDistance,
    maneuver: "destination",
    instruction: "You have arrived at your destination",
    point: coordinates[coordinates.length - 1],
    index: segments.length,
    isDestination: true
  });
  
  return instructions;
}

/**
 * Find the next upcoming turn based on current position
 * @param {Array} instructions - Turn instructions array
 * @param {number} distanceFromStart - Distance traveled along route
 * @param {number} lookaheadMeters - How far ahead to look for next turn
 * @returns {Object|null} Next turn instruction
 */
export function findNextTurn(instructions, distanceFromStart, lookaheadMeters = 300) {
  for (let i = 0; i < instructions.length; i++) {
    const inst = instructions[i];
    if (inst.distance > distanceFromStart && 
        inst.distance - distanceFromStart <= lookaheadMeters) {
      return {
        ...inst,
        distanceRemaining: inst.distance - distanceFromStart
      };
    }
  }
  return null;
}

/**
 * Check if user has reached destination
 * @param {number} distanceFromStart - Distance traveled
 * @param {number} totalDistance - Total route distance
 * @param {number} threshold - Distance threshold for arrival (default 30m)
 * @returns {boolean}
 */
export function hasReachedDestination(distanceFromStart, totalDistance, threshold = 30) {
  return (totalDistance - distanceFromStart) <= threshold;
}