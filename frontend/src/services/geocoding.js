// services/geocoding.js
// Uses backend proxy to avoid CORS issues

import { UG_CENTER } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { API_URL } from '../config';

// Use backend proxy in production, Vite proxy in development
const NOMINATIM_BASE = import.meta.env.DEV
  ? '/api/nominatim'
  : `${API_URL}/api/nominatim`;

// Simple cache
const cache = new Map();

export async function geocode(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  
  // Check cache
  if (cache.has(normalizedQuery)) {
    console.log(`[geocode] Cache hit: "${normalizedQuery}"`);
    return cache.get(normalizedQuery);
  }

  try {
    const { lat, lng } = UG_CENTER;
    const cleanQuery = encodeURIComponent(query.trim());
    
    // Build URL with parameters
    let url = `${NOMINATIM_BASE}/search?q=${cleanQuery}&limit=8&countrycodes=gh&addressdetails=1`;
    
    // Add viewbox for better local results (UG campus area)
    const viewbox = `${lng-0.05},${lat-0.05},${lng+0.05},${lat+0.05}`;
    url += `&viewbox=${viewbox}&bounded=0`;
    
    console.log(`[geocode] Fetching: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error(`[geocode] HTTP ${response.status}`);
      return [];
    }

    const results = await response.json();
    
    if (!results || results.length === 0) {
      return [];
    }

    const formatted = results
      .map((item) => ({
        name: item.display_name?.split(",")[0] || item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        dist: distanceKm(lat, lng, parseFloat(item.lat), parseFloat(item.lon)),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
    
    // Cache results
    cache.set(normalizedQuery, formatted);
    
    // Limit cache size
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return formatted;
  } catch (error) {
    console.error("[geocode] Error:", error);
    return [];
  }
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    
    const data = await response.json();

    if (!data || !data.display_name) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    if (data.address?.building) return data.address.building;
    if (data.address?.road) return data.address.road;
    if (data.address?.footway) return data.address.footway;

    return data.display_name.split(",")[0] || "Selected point";

  } catch (error) {
    console.error("[reverseGeocode] Error:", error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}