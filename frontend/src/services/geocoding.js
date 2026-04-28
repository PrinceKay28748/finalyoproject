// services/geocoding.js
import { UG_CENTER } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { API_URL } from "../config";
import ugLocations from "../data/ugLocations.json";

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

  const cleanQuery = query.trim().toLowerCase();
  const queryWords = cleanQuery.split(/\s+/);
  
  let allWordsValid = true;
  for (const word of queryWords) {
    if (word.length < 3) continue;
    const wordExists = ugLocations.some(loc => 
      loc.name.toLowerCase().includes(word) || 
      (loc.aliases && loc.aliases.some(alias => alias.toLowerCase().includes(word)))
    );
    if (!wordExists) {
      allWordsValid = false;
      break;
    }
  }
  
  if (!allWordsValid) {
    return [];
  }

  return ugLocations
    .map((loc) => ({ ...loc, score: scoreLocalMatch(loc, cleanQuery) }))
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

export async function geocode(query, signal) {
  if (!query || query.trim().length < 3) return [];

  const localResults = searchLocal(query);
  if (localResults.length >= 2) {
    return localResults;
  }

  const cacheKey = query.trim().toLowerCase();
  
  if (apiCache.has(cacheKey)) {
    return apiCache.get(cacheKey);
  }

  try {
    const url = `${API_URL}/api/locationiq/search?q=${encodeURIComponent(query.trim())}`;
    const response = await fetch(url, { signal });
    
    if (!response.ok) {
      return localResults;
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      return localResults;
    }
    
    const formatted = data.map((item) => ({
      name: item.display_name.split(",")[0] || item.display_name,
      fullAddress: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      source: "locationiq",
    }));
    
    apiCache.set(cacheKey, formatted);
    
    if (apiCache.size > 200) {
      const firstKey = apiCache.keys().next().value;
      apiCache.delete(firstKey);
    }
    
    return formatted;
  } catch (err) {
    if (err.name === "AbortError") return null;
    return localResults;
  }
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `${API_URL}/api/locationiq/reverse?lat=${lat}&lon=${lng}&format=json`;
    const response = await fetch(url);
    
    if (!response.ok) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    
    const data = await response.json();
    
    if (data.address?.building) return data.address.building;
    if (data.address?.road) return data.address.road;
    if (data.address?.footway) return data.address.footway;
    
    return data.display_name?.split(",")[0] || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  } catch (err) {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}