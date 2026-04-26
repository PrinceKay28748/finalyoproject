// services/geocoding.js
// Handles geocoding with Nominatim proxy and in-memory cache

import { UG_CENTER } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { API_URL } from '../config';

const NOMINATIM_BASE = import.meta.env.DEV
  ? '/api/nominatim'
  : `${API_URL}/api/nominatim`;

// Cache for search results
const searchCache = new Map();

// Cache for resolved coordinates
const coordinateCache = new Map();

// Campus locations for local search (names only, no coordinates)
const CAMPUS_LOCATIONS = [
  "Balme Library",
  "Jones Quartey Building (JQB)",
  "JQB",
  "Mensah Sarbah Hall",
  "Akuafo Hall",
  "Commonwealth Hall",
  "Volta Hall",
  "Legon Hall",
  "UG Stadium",
  "School of Engineering",
  "School of Law",
  "University of Ghana Business School",
  "UGBS",
  "Department of Mathematics",
  "Department of Computer Science",
  "Department of Economics",
  "Department of Psychology",
  "UG Post Office",
  "UG Medical Centre",
  "Night Market",
  "Onyaa Road",
  "Nsia Road",
  "Akuafo Road",
  "E.A. Boateng Road",
  "Ivan Addae Mensah Intersection",
  "University of Ghana Basic School",
  "Legon Presec",
  "Legon Mosque",
  "Legon Chapel",
  "Jim Hall",
  "Central Cafeteria",
  "UG Guest Centre",
  "University Bookshop"
];

// Fuzzy match helper
function matchesQuery(query, text) {
  if (!text) return false;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  return t.includes(q) || q.includes(t);
}

// Search local campus names
function searchLocalCampus(query) {
  if (!query || query.trim().length < 2) return [];
  
  const cleanQuery = query.trim().toLowerCase();
  
  const matches = CAMPUS_LOCATIONS
    .filter(name => matchesQuery(cleanQuery, name))
    .map(name => ({
      name: name,
      source: "local"
    }))
    .slice(0, 5);
  
  if (matches.length > 0) {
    console.log(`[geocode] Local match: ${matches.length} results for "${query}"`);
  }
  
  return matches;
}

// Resolve a local location name to coordinates
export async function resolveLocalLocation(locationName) {
  // Check cache first
  if (coordinateCache.has(locationName)) {
    console.log(`[resolve] Cache hit: ${locationName}`);
    return coordinateCache.get(locationName);
  }
  
  try {
    const cleanName = encodeURIComponent(locationName);
    const { lat, lng } = UG_CENTER;
    const url = `${NOMINATIM_BASE}/search?q=${cleanName}&format=json&limit=1&countrycodes=gh&addressdetails=1&lat=${lat}&lon=${lng}`;
    
    console.log(`[resolve] Fetching coordinates for: ${locationName}`);
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });
    
    if (!response.ok) {
      console.error(`[resolve] HTTP ${response.status}`);
      return null;
    }
    
    const results = await response.json();
    
    if (!results || results.length === 0) {
      return null;
    }
    
    const resolved = {
      name: locationName,
      lat: parseFloat(results[0].lat),
      lng: parseFloat(results[0].lon),
      source: "resolved"
    };
    
    coordinateCache.set(locationName, resolved);
    
    // Limit cache size
    if (coordinateCache.size > 200) {
      const firstKey = coordinateCache.keys().next().value;
      coordinateCache.delete(firstKey);
    }
    
    return resolved;
  } catch (error) {
    console.error("[resolve] Error:", error);
    return null;
  }
}

export async function geocode(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  
  // Check search cache
  if (searchCache.has(normalizedQuery)) {
    console.log(`[geocode] Cache hit: "${normalizedQuery}"`);
    return searchCache.get(normalizedQuery);
  }
  
  // FIRST: Search local campus names (no API call)
  const localResults = searchLocalCampus(query);
  
  // If we have local matches, return them immediately
  if (localResults.length > 0) {
    console.log(`[geocode] Returning ${localResults.length} local results`);
    searchCache.set(normalizedQuery, localResults);
    return localResults;
  }

  // SECOND: Hit Nominatim API
  try {
    const { lat, lng } = UG_CENTER;
    const cleanQuery = encodeURIComponent(query.trim());
    
    const url = `${NOMINATIM_BASE}/search?q=${cleanQuery}&format=json&limit=5&countrycodes=gh&addressdetails=1&lat=${lat}&lon=${lng}`;
    
    console.log(`[geocode] Fetching from Nominatim`);
    
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
    
    searchCache.set(normalizedQuery, formatted);
    
    // Limit cache size
    if (searchCache.size > 100) {
      const firstKey = searchCache.keys().next().value;
      searchCache.delete(firstKey);
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