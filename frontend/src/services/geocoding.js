// services/geocoding.js
import { UG_CENTER } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { API_URL } from "../config";
import ugLocations from "../data/ugLocations.json";

// Cache for API results
const apiCache = new Map();

// Local fuzzy search
function scoreLocalMatch(location, query) {
  const q = query.toLowerCase().trim();
  const name = location.name.toLowerCase();
  const aliases = location.aliases || [];

  if (name === q) return 100;
  if (name.startsWith(q)) return 90;
  if (aliases.some((a) => a === q)) return 85;
  if (aliases.some((a) => a.startsWith(q))) return 80;
  if (name.includes(` ${q}`) || name.includes(`${q} `)) return 70;
  if (name.includes(q)) return 60;
  if (aliases.some((a) => a.includes(q))) return 50;

  const tokens = q.split(" ").filter((t) => t.length >= 2);
  if (tokens.length > 1) {
    const hits = tokens.filter(
      (t) => name.includes(t) || aliases.some((a) => a.includes(t))
    ).length;
    if (hits === tokens.length) return 45;
    if (hits > 0) return 30;
  }

  return 0;
}

export function searchLocal(query) {
  if (!query || query.trim().length < 2) return [];

  return ugLocations
    .map((loc) => ({ ...loc, score: scoreLocalMatch(loc, query) }))
    .filter((loc) => loc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((loc) => ({
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      type: loc.type,
      dist: distanceKm(UG_CENTER.lat, UG_CENTER.lng, loc.lat, loc.lng),
      source: "local",
    }));
}

// Main geocode function - uses LocationIQ first, falls back to Nominatim
export async function geocode(query, signal) {
  if (!query || query.trim().length < 3) return [];

  // Check local first
  const localResults = searchLocal(query);
  if (localResults.length >= 2) {
    return localResults;
  }

  const cacheKey = query.trim().toLowerCase();
  
  // Check API cache
  if (apiCache.has(cacheKey)) {
    console.log(`[geocode] Cache hit: ${cacheKey}`);
    return apiCache.get(cacheKey);
  }

  // Try LocationIQ first (3 req/sec limit)
  try {
    const url = `${API_URL}/api/locationiq/search?q=${encodeURIComponent(query.trim())}`;
    console.log(`[geocode] Trying LocationIQ: ${query}`);
    
    const response = await fetch(url, { signal });
    
    if (response.ok) {
      const data = await response.json();
      
      if (data && data.length > 0) {
        const formatted = data.map((item) => ({
          name: item.display_name.split(",")[0] || item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          source: "locationiq",
        }));
        
        apiCache.set(cacheKey, formatted);
        return formatted;
      }
    }
  } catch (err) {
    if (err.name === "AbortError") return null;
    console.log("[geocode] LocationIQ failed, trying Nominatim");
  }

  // Fallback to Nominatim if LocationIQ fails
  try {
    const { lat, lng } = UG_CENTER;
    const url = `${API_URL}/api/nominatim/search?q=${encodeURIComponent(query.trim())}&format=json&limit=8&countrycodes=gh&addressdetails=1&lat=${lat}&lon=${lng}`;
    
    console.log(`[geocode] Falling back to Nominatim: ${query}`);
    const response = await fetch(url, { signal });
    
    if (!response.ok) return localResults;
    
    const data = await response.json();
    if (!data || data.length === 0) return localResults;
    
    const formatted = data.map((item) => ({
      name: item.display_name.split(",")[0] || item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      source: "nominatim",
    }));
    
    apiCache.set(cacheKey, formatted);
    return formatted;
  } catch (err) {
    if (err.name === "AbortError") return null;
    console.error("[geocode] Error:", err);
    return localResults;
  }
}

// Reverse geocoding
export async function reverseGeocode(lat, lng) {
  try {
    // Try LocationIQ first
    const locationIQUrl = `${API_URL}/api/locationiq/reverse?lat=${lat}&lon=${lng}&format=json`;
    const locationIQResponse = await fetch(locationIQUrl);
    
    if (locationIQResponse.ok) {
      const data = await locationIQResponse.json();
      if (data.address?.building) return data.address.building;
      if (data.address?.road) return data.address.road;
      if (data.address?.footway) return data.address.footway;
      if (data.display_name) return data.display_name.split(",")[0];
    }
  } catch (err) {
    console.log("[reverseGeocode] LocationIQ failed, trying Nominatim");
  }
  
  // Fallback to Nominatim
  try {
    const url = `${API_URL}/api/nominatim/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const response = await fetch(url);
    
    if (!response.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
    const data = await response.json();
    if (!data?.display_name) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    
    if (data.address?.building) return data.address.building;
    if (data.address?.road) return data.address.road;
    if (data.address?.footway) return data.address.footway;
    return data.display_name.split(",")[0] || "Selected point";
  } catch (err) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}