// frontend/src/services/analyticsLogger.js
import { API_URL } from '../config';

async function fetchWithAuth(url, options = {}) {
  const token = sessionStorage.getItem('accessToken');
  
  // Skip if no token
  if (!token) return null;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });
    
    // Silently ignore 401
    if (response.status === 401) return null;
    
    return response;
  } catch (err) {
    return null;
  }
}

export async function logRouteCalculated(startLocation, endLocation, profileUsed, distance) {
  fetchWithAuth(`${API_URL}/analytics/route`, {
    method: 'POST',
    body: JSON.stringify({
      start_location: startLocation,
      end_location: endLocation,
      profile_used: profileUsed,
      distance: distance
    })
  });
}

export async function logSearch(query, selectedResult) {
  // selectedResult can be:
  // - A location object: {lat, lng, name, ...}
  // - A string (for map clicks): location name or coordinates text
  
  const isLocationObject = selectedResult && typeof selectedResult === 'object' && 'lat' in selectedResult && 'lng' in selectedResult;
  
  if (isLocationObject) {
    // Log search destination with coordinates (fire-and-forget like route logging)
    // No auth required — same as heatmap route segment logging
    const { lat, lng, name } = selectedResult;
    fetch(`${API_URL}/analytics/heatmap/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        destination_name: name,
        lat,
        lng,
      })
    }).catch(() => {
      // Silently fail — never surface search logging errors to user
    });
  } else {
    // Fallback: log as regular activity if no coordinates
    fetchWithAuth(`${API_URL}/analytics/log`, {
      method: 'POST',
      body: JSON.stringify({
        activity_type: 'search',
        metadata: JSON.stringify({ query, selected_result: selectedResult })
      })
    });
  }
}

export async function logLogin() {
  const token = sessionStorage.getItem('accessToken');
  if (!token) return;
  
  fetchWithAuth(`${API_URL}/analytics/log`, {
    method: 'POST',
    body: JSON.stringify({
      activity_type: 'login',
      metadata: JSON.stringify({ timestamp: new Date().toISOString() })
    })
  });
}