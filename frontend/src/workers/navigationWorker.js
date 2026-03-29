// workers/navigationWorker.js
// Handles GPS tracking, off-route detection, and rerouting
// Runs in background thread to keep UI smooth

// Distance calculation (in meters)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Find closest point on route to current location
function findClosestPointOnRoute(location, routeCoordinates) {
  if (!routeCoordinates || routeCoordinates.length === 0) return null;
  
  let closestIndex = 0;
  let minDistance = Infinity;
  
  for (let i = 0; i < routeCoordinates.length; i++) {
    const point = routeCoordinates[i];
    const dist = calculateDistance(location.lat, location.lng, point.lat, point.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }
  
  return {
    index: closestIndex,
    distance: minDistance,
    point: routeCoordinates[closestIndex]
  };
}

// Check if user is off route
function isOffRoute(location, routeCoordinates, threshold = 30) {
  if (!routeCoordinates || routeCoordinates.length === 0) return false;
  
  const closest = findClosestPointOnRoute(location, routeCoordinates);
  return closest && closest.distance > threshold;
}

// Get remaining route (from current position to destination)
function getRemainingRoute(location, fullRoute) {
  if (!fullRoute || fullRoute.length === 0) return [];
  
  const closest = findClosestPointOnRoute(location, fullRoute);
  if (!closest) return fullRoute;
  
  // Return route from closest point to end
  return fullRoute.slice(closest.index);
}

let currentRoute = null;
let currentDestination = null;
let lastRecalcTime = 0;
const RECALC_THROTTLE_MS = 5000; // Don't recalc more than once every 5 seconds
const OFF_ROUTE_THRESHOLD = 30; // meters

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'SET_ROUTE':
      currentRoute = data.route;
      currentDestination = data.destination;
      self.postMessage({ type: 'ROUTE_SET', success: true });
      break;
      
    case 'UPDATE_LOCATION':
      if (!currentRoute || !currentDestination) {
        self.postMessage({ type: 'NO_ROUTE_ACTIVE' });
        break;
      }
      
      const location = data.location;
      const offRoute = isOffRoute(location, currentRoute.coordinates, OFF_ROUTE_THRESHOLD);
      const remainingRoute = getRemainingRoute(location, currentRoute.coordinates);
      const progress = calculateProgress(location, currentRoute.coordinates);
      
      // Send progress update
      self.postMessage({
        type: 'LOCATION_UPDATE',
        data: {
          offRoute,
          remainingRoute,
          progress,
          closestPoint: findClosestPointOnRoute(location, currentRoute.coordinates)
        }
      });
      
      // If off route and enough time passed, request reroute
      if (offRoute && (Date.now() - lastRecalcTime) > RECALC_THROTTLE_MS) {
        lastRecalcTime = Date.now();
        self.postMessage({
          type: 'REQUEST_REROUTE',
          data: {
            currentLocation: location,
            destination: currentDestination
          }
        });
      }
      break;
      
    case 'CLEAR_ROUTE':
      currentRoute = null;
      currentDestination = null;
      self.postMessage({ type: 'ROUTE_CLEARED' });
      break;
      
    default:
      console.warn('[NavigationWorker] Unknown message type:', type);
  }
};

// Calculate progress percentage along route
function calculateProgress(location, routeCoordinates) {
  if (!routeCoordinates || routeCoordinates.length < 2) return 0;
  
  const closest = findClosestPointOnRoute(location, routeCoordinates);
  if (!closest) return 0;
  
  // Calculate total route length
  let totalLength = 0;
  for (let i = 0; i < routeCoordinates.length - 1; i++) {
    totalLength += calculateDistance(
      routeCoordinates[i].lat, routeCoordinates[i].lng,
      routeCoordinates[i + 1].lat, routeCoordinates[i + 1].lng
    );
  }
  
  // Calculate distance traveled to closest point
  let traveled = 0;
  for (let i = 0; i < closest.index; i++) {
    traveled += calculateDistance(
      routeCoordinates[i].lat, routeCoordinates[i].lng,
      routeCoordinates[i + 1].lat, routeCoordinates[i + 1].lng
    );
  }
  
  // Add partial distance from closest segment start to current position
  if (closest.index > 0) {
    const prevPoint = routeCoordinates[closest.index - 1];
    const partialDist = calculateDistance(
      prevPoint.lat, prevPoint.lng,
      location.lat, location.lng
    );
    traveled += Math.min(partialDist, calculateDistance(
      prevPoint.lat, prevPoint.lng,
      closest.point.lat, closest.point.lng
    ));
  }
  
  return Math.min(100, Math.max(0, (traveled / totalLength) * 100));
}