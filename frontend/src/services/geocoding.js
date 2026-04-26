// services/geocoding.js
// Uses backend proxy + local campus locations first (name-only, no coordinates)

import { UG_CENTER } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { API_URL } from '../config';
import ugLocations from "../data/ug-locations.json";

const NOMINATIM_BASE = import.meta.env.DEV
  ? '/api/nominatim'
  : `${API_URL}/api/nominatim`;

const cache = new Map();

// Fuzzy match helper
function matchesQuery(query, text) {
  if (!text) return false;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  return t.includes(q) || q.includes(t);
}

// Search local UG locations - NAME ONLY (no coordinates)
// Return just the name, let Nominatim provide the actual coordinates
function searchLocalLocations(query) {
  if (!query || query.trim().length < 2) return [];
  
  const cleanQuery = query.trim().toLowerCase();
  
  const matches = ugLocations.locations
    .filter(loc => {
      if (matchesQuery(cleanQuery, loc.name)) return true;
      if (loc.keywords && loc.keywords.some(kw => matchesQuery(cleanQuery, kw))) return true;
      return false;
    })
    .map(loc => ({
      name: loc.name,
      type: loc.type,
      source: "local",
      // No lat/lng - will be filled by Nominatim when selected
    }))
    .slice(0, 5);
  
  if (matches.length > 0) {
    console.log(`[geocode] Local name match: ${matches.length} results for "${query}"`);
  }
  
  return matches;
}

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
  
  // FIRST: Search local UG locations by name only
  const localResults = searchLocalLocations(query);
  
  // If we have ANY local matches, return them immediately (NO API CALL)
  if (localResults.length > 0) {
    console.log(`[geocode] Returning ${localResults.length} local results, skipping Nominatim`);
    cache.set(normalizedQuery, localResults);
    return localResults;
  }

  // SECOND: Only hit Nominatim if no local matches found
  try {
    const { lat, lng } = UG_CENTER;
    const cleanQuery = encodeURIComponent(query.trim());
    
    const url = `${NOMINATIM_BASE}/search?q=${cleanQuery}&format=json&limit=5&countrycodes=gh&addressdetails=1&lat=${lat}&lon=${lng}`;
    
    console.log(`[geocode] No local match, fetching from Nominatim`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
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
        source: "nominatim"
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);
    
    cache.set(normalizedQuery, formatted);
    
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