// utils/geometry.js
// Distance calculations for route deviation detection and progress tracking

/**
 * Calculates the shortest distance from a point (lat,lng) to a route polyline
 * Returns distance in meters
 */
export function getDistanceToRoute(lat, lng, coordinates) {
  if (!coordinates || coordinates.length < 2) return Infinity;
  
  let minDistance = Infinity;
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = coordinates[i];
    const b = coordinates[i + 1];
    
    const dist = pointToSegmentDistance(lat, lng, a.lat, a.lng, b.lat, b.lng);
    if (dist < minDistance) minDistance = dist;
  }
  
  return minDistance;
}

/**
 * Finds the closest point on a route to the current location
 * Returns index, distance to route, and distance from start of route
 * Used for route progress tracking
 */
export function findClosestPointOnRoute(lat, lng, coordinates) {
  if (!coordinates || coordinates.length === 0) {
    return { closestIndex: -1, distanceToRoute: Infinity, distanceFromStart: 0 };
  }
  
  let closestIndex = -1;
  let minDistance = Infinity;
  let cumulativeDistance = 0;
  let distanceAtClosest = 0;
  
  for (let i = 0; i < coordinates.length - 1; i++) {
    const a = coordinates[i];
    const b = coordinates[i + 1];
    
    const dist = pointToSegmentDistance(lat, lng, a.lat, a.lng, b.lat, b.lng);
    const segmentLength = distanceBetween(a.lat, a.lng, b.lat, b.lng);
    
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
      
      // Calculate distance from start to this point
      distanceAtClosest = cumulativeDistance;
      
      // Add distance from segment start to closest point
      const t = getClosestPointParameter(lat, lng, a.lat, a.lng, b.lat, b.lng);
      if (t > 0 && t < 1) {
        distanceAtClosest += t * segmentLength;
      }
    }
    
    cumulativeDistance += segmentLength;
  }
  
  // Also check the last point as a candidate
  const lastPoint = coordinates[coordinates.length - 1];
  const distToLast = distanceBetween(lat, lng, lastPoint.lat, lastPoint.lng);
  if (distToLast < minDistance) {
    minDistance = distToLast;
    closestIndex = coordinates.length - 1;
    distanceAtClosest = cumulativeDistance;
  }
  
  return {
    closestIndex,
    distanceToRoute: minDistance,
    distanceFromStart: distanceAtClosest
  };
}

/**
 * Gets the parameter t (0-1) of the closest point on a line segment
 */
function getClosestPointParameter(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return 0;
  const t = ((px - x1) * dx + (py - y1) * dy) / len2;
  return Math.max(0, Math.min(1, t));
}

/**
 * Distance from point (px,py) to line segment (x1,y1)-(x2,y2)
 * Returns distance in meters
 */
function pointToSegmentDistance(px, py, x1, y1, x2, y2) {
  // Convert degrees to meters (approximate for Legon area)
  const metersPerDegreeLat = 111319;
  const metersPerDegreeLng = 85200;
  
  // Scale to meters
  const px_m = px * metersPerDegreeLat;
  const py_m = py * metersPerDegreeLng;
  const x1_m = x1 * metersPerDegreeLat;
  const y1_m = y1 * metersPerDegreeLng;
  const x2_m = x2 * metersPerDegreeLat;
  const y2_m = y2 * metersPerDegreeLng;
  
  const dx = x2_m - x1_m;
  const dy = y2_m - y1_m;
  
  if (dx === 0 && dy === 0) {
    return Math.hypot(px_m - x1_m, py_m - y1_m);
  }
  
  const t = ((px_m - x1_m) * dx + (py_m - y1_m) * dy) / (dx * dx + dy * dy);
  
  if (t <= 0) return Math.hypot(px_m - x1_m, py_m - y1_m);
  if (t >= 1) return Math.hypot(px_m - x2_m, py_m - y2_m);
  
  const projX = x1_m + t * dx;
  const projY = y1_m + t * dy;
  
  return Math.hypot(px_m - projX, py_m - projY);
}

/**
 * Calculates distance between two coordinates in meters
 */
export function distanceBetween(lat1, lng1, lat2, lng2) {
  const dx = (lat1 - lat2) * 111319;
  const dy = (lng1 - lng2) * 85200;
  return Math.hypot(dx, dy);
}

/**
 * Calculates the total distance of a route in meters
 */
export function getRouteDistance(coordinates) {
  if (!coordinates || coordinates.length < 2) return 0;
  
  let total = 0;
  for (let i = 0; i < coordinates.length - 1; i++) {
    total += distanceBetween(
      coordinates[i].lat, coordinates[i].lng,
      coordinates[i + 1].lat, coordinates[i + 1].lng
    );
  }
  return total;
}

/**
 * Calculates the remaining distance from a point on the route to the end
 */
export function getRemainingDistance(lat, lng, coordinates) {
  const { distanceFromStart } = findClosestPointOnRoute(lat, lng, coordinates);
  const totalDistance = getRouteDistance(coordinates);
  return Math.max(0, totalDistance - distanceFromStart);
}

/**
 * Calculates the progress percentage (0-100) along the route
 */
export function getRouteProgress(lat, lng, coordinates) {
  const { distanceFromStart } = findClosestPointOnRoute(lat, lng, coordinates);
  const totalDistance = getRouteDistance(coordinates);
  if (totalDistance === 0) return 0;
  return Math.min(100, Math.max(0, (distanceFromStart / totalDistance) * 100));
}