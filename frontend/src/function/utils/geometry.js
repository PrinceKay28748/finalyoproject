// utils/geometry.js
// Distance calculations for route deviation detection

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