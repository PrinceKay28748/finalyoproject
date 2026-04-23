// frontend/src/services/analyticsLogger.js
// Analytics logging service

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function fetchWithAuth(url, options = {}) {
  const token = sessionStorage.getItem('accessToken');
  if (!token) {
    console.warn('[Analytics] No token found, skipping log');
    return null;
  }
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers
      }
    });
    
    if (!response.ok) {
      console.warn('[Analytics] Request failed:', response.status);
    }
    
    return response;
  } catch (err) {
    console.warn('[Analytics] Network error:', err);
    return null;
  }
}

export async function logRouteCalculated(startLocation, endLocation, profileUsed, distance) {
  console.log('[Analytics] Logging route:', { startLocation, endLocation, profileUsed, distance });
  try {
    await fetchWithAuth(`${API_URL}/analytics/route`, {
      method: 'POST',
      body: JSON.stringify({
        start_location: startLocation,
        end_location: endLocation,
        profile_used: profileUsed,
        distance: distance
      })
    });
  } catch (err) {
    console.warn('[Analytics] Failed to log route:', err);
  }
}

export async function logSearch(query, selectedResult) {
  console.log('[Analytics] Logging search:', { query, selectedResult });
  try {
    await fetchWithAuth(`${API_URL}/analytics/log`, {
      method: 'POST',
      body: JSON.stringify({
        activity_type: 'search',
        metadata: JSON.stringify({ query, selected_result: selectedResult })
      })
    });
  } catch (err) {
    console.warn('[Analytics] Failed to log search:', err);
  }
}

export async function logLogin() {
  console.log('[Analytics] Logging login');
  try {
    await fetchWithAuth(`${API_URL}/analytics/log`, {
      method: 'POST',
      body: JSON.stringify({
        activity_type: 'login',
        metadata: JSON.stringify({ timestamp: new Date().toISOString() })
      })
    });
  } catch (err) {
    console.warn('[Analytics] Failed to log login:', err);
  }
}