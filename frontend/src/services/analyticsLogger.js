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
  fetchWithAuth(`${API_URL}/analytics/log`, {
    method: 'POST',
    body: JSON.stringify({
      activity_type: 'search',
      metadata: JSON.stringify({ query, selected_result: selectedResult })
    })
  });
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