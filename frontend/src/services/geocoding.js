// services/geocoding.js
// Uses backend proxy + local campus locations first for zero API calls on common searches

import { UG_CENTER } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { API_URL } from '../config';
import ugLocations from "../data/ug-locations.json";

// Use backend proxy in production, Vite proxy in development
const NOMINATIM_BASE = import.meta.env.DEV
  ? '/api/nominatim'
  : `${API_URL}/api/nominatim`;

// Cache for search results
const cache = new Map();

// Fuzzy match helper - checks if query matches name or keywords
function matchesQuery(query, text) {
  if (!text) return false;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  return t.includes(q) || q.includes(t);
}

// Search local UG locations first (0 API calls)
function searchLocalLocations(query) {
  if (!query || query.trim().length < 2) return [];
  
  const cleanQuery = query.trim().toLowerCase();
  const { lat, lng } = UG_CENTER;
  
  const matches = ugLocations.locations
    .filter(loc => {
      // Check name match
      if (matchesQuery(cleanQuery, loc.name)) return true;
      // Check keywords match
      if (loc.keywords && loc.keywords.some(kw => matchesQuery(cleanQuery, kw))) return true;
      return false;
    })
    .map(loc => ({
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      dist: distanceKm(lat, lng, loc.lat, loc.lng),
      type: loc.type,
      source: "local"
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);
  
  if (matches.length > 0) {
    console.log(`[geocode] Local match: ${matches.length} results for "${query}"`);
  }
  
  return matches;
}

export async function geocode(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  
  // Check cache first
  if (cache.has(normalizedQuery)) {
    console.log(`[geocode] Cache hit: "${normalizedQuery}"`);
    return cache.get(normalizedQuery);
  }
  
  // FIRST: Search local UG locations (0 API calls)
  const localResults = searchLocalLocations(query);
  
  // If we have good local matches (2+), return them immediately
  if (localResults.length >= 2) {
    cache.set(normalizedQuery, localResults);
    return localResults;
  }

  // SECOND: If no/few local matches, hit Nominatim API
  try {
    const { lat, lng } = UG_CENTER;
    const cleanQuery = encodeURIComponent(query.trim());
    
    const url = `${NOMINATIM_BASE}/search?q=${cleanQuery}&format=json&limit=8&countrycodes=gh&addressdetails=1&lat=${lat}&lon=${lng}`;
    
    console.log(`[geocode] Fetching from Nominatim: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      console.error(`[geocode] HTTP ${response.status}`);
      // Fallback to local results even if few
      return localResults;
    }

    const results = await response.json();
    
    if (!results || results.length === 0) {
      return localResults;
    }

    const formatted = results
      .map((item) => ({
        name: item.display_name?.split(",")[0] || item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        dist: distanceKm(lat, lng, parseFloat(item.lat), parseFloat(item.lon)),
        source: "nominatim"
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
    
    // Combine local results first, then Nominatim results
    const combined = [...localResults, ...formatted].slice(0, 5);
    
    cache.set(normalizedQuery, combined);
    
    // Limit cache size
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    return combined;
  } catch (error) {
    console.error("[geocode] Error:", error);
    return localResults;
  }
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
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