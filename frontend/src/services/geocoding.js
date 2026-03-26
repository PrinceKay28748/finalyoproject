

// // services/geocoding.js
// // Handles all Nominatim API calls with proper rate limiting
// // Uses Vite proxy to avoid CORS issues — requests go through /api/nominatim

// import { UG_CENTER } from "../function/utils/bounds";
// import { distanceKm } from "../function/utils/distance";

// // ========================
// // NOMINATIM CONFIGURATION
// // ========================
// // Using Vite proxy — no CORS issues!
// // The proxy forwards /api/nominatim/* to https://nominatim.openstreetmap.org/*
// const NOMINATIM_BASE = '/api/nominatim';

// // Headers required by Nominatim
// const NOMINATIM_HEADERS = {
//   'Accept-Language': 'en',
//   'User-Agent': 'UG-Navigator/1.0 (pkay28748@gmail.com)'
// };

// // ========================
// // RATE LIMITING QUEUE
// // ========================
// let requestQueue = [];
// let isProcessing = false;
// let lastRequestTime = 0;
// const RATE_LIMIT_MS = 1000; // 1 second between requests

// async function processQueue() {
//   if (isProcessing || requestQueue.length === 0) return;
  
//   isProcessing = true;
  
//   const now = Date.now();
//   const timeSinceLastRequest = now - lastRequestTime;
//   const timeToWait = Math.max(0, RATE_LIMIT_MS - timeSinceLastRequest);
  
//   if (timeToWait > 0) {
//     await new Promise(resolve => setTimeout(resolve, timeToWait));
//   }
  
//   const { url, resolve, reject, retryCount = 0 } = requestQueue.shift();
  
//   try {
//     lastRequestTime = Date.now();
    
//     // No CORS proxy needed — Vite handles it!
//     const response = await fetch(url, { 
//       headers: NOMINATIM_HEADERS 
//     });
    
//     if (response.status === 429) {
//       throw new Error('RATE_LIMITED');
//     }
    
//     if (!response.ok) {
//       throw new Error(`HTTP ${response.status}`);
//     }
    
//     const data = await response.json();
//     resolve(data);
//   } catch (error) {
//     if (error.message === 'RATE_LIMITED' && retryCount < 3) {
//       console.warn(`Rate limited, retrying in 2 seconds... (attempt ${retryCount + 1}/3)`);
//       await new Promise(resolve => setTimeout(resolve, 2000));
//       requestQueue.unshift({ url, resolve, reject, retryCount: retryCount + 1 });
//     } else {
//       reject(error);
//     }
//   }
  
//   isProcessing = false;
//   processQueue();
// }

// function queuedFetch(url) {
//   return new Promise((resolve, reject) => {
//     requestQueue.push({ url, resolve, reject, retryCount: 0 });
//     processQueue();
//   });
// }

// // ========================
// // SEARCH FUNCTIONS — THREE-PASS STRATEGY
// // ========================

// export async function geocode(query) {
//   if (!query || query.trim().length < 2) {
//     return [];
//   }
  
//   try {
//     const { lat, lng } = UG_CENTER;
//     let results = [];

//     // Clean the query — remove extra spaces
//     const cleanQuery = query.trim();

//     // Pass 1 — University of Ghana Legon Accra suffix (best for campus buildings)
//     const q1 = encodeURIComponent(cleanQuery + " University of Ghana Legon Accra");
//     const url1 = `${NOMINATIM_BASE}/search?q=${q1}&format=json&limit=8&countrycodes=gh&lat=${lat}&lon=${lng}`;
//     results = await queuedFetch(url1);

//     // Pass 2 — Legon Accra Ghana suffix (broader campus area)
//     if (!results || results.length === 0) {
//       const q2 = encodeURIComponent(cleanQuery + " Legon Accra Ghana");
//       const url2 = `${NOMINATIM_BASE}/search?q=${q2}&format=json&limit=8&countrycodes=gh`;
//       results = await queuedFetch(url2);
//     }

//     // Pass 3 — bare query with UG bias (last resort)
//     if (!results || results.length === 0) {
//       const q3 = encodeURIComponent(cleanQuery);
//       const url3 = `${NOMINATIM_BASE}/search?q=${q3}&format=json&limit=8&countrycodes=gh&lat=${lat}&lon=${lng}`;
//       results = await queuedFetch(url3);
//     }

//     if (!results || results.length === 0) {
//       return [];
//     }

//     // Format results and sort by distance to UG center
//     return results
//       .map((item) => ({
//         name: item.display_name.split(",").slice(0, 2).join(", "),
//         lat: parseFloat(item.lat),
//         lng: parseFloat(item.lon),
//         dist: distanceKm(lat, lng, parseFloat(item.lat), parseFloat(item.lon)),
//       }))
//       .sort((a, b) => a.dist - b.dist)
//       .slice(0, 5);

//   } catch (error) {
//     console.error("[geocode] Error:", error);
//     return [];
//   }
// }

// export async function reverseGeocode(lat, lng) {
//   try {
//     const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
//     const data = await queuedFetch(url);
    
//     if (!data || !data.display_name) {
//       return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
//     }
    
//     // Try to get a clean, readable name
//     if (data.address?.building) {
//       return data.address.building;
//     }
    
//     if (data.address?.road) {
//       return data.address.road;
//     }
    
//     if (data.address?.footway) {
//       return data.address.footway;
//     }
    
//     // Fallback to first part of display name
//     return data.display_name.split(",").slice(0, 2).join(", ") || "Selected point";
    
//   } catch (error) {
//     console.error("[reverseGeocode] Error:", error);
//     return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
//   }
// }



import { UG_CENTER } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";

const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "UGNavigator/1.0",
};

// Module-level cache — same query won't hit the API twice in a session
// Key: lowercase trimmed query string, Value: results array
const geocodeCache       = new Map();
const reverseGeocodeCache = new Map();

// Searches for a location using a three-pass strategy so partial and informal
// names still return results — similar to how Bolt and Google Maps handle search
export async function geocode(query) {
  const cacheKey = query.toLowerCase().trim();

  // Return cached result if available
  if (geocodeCache.has(cacheKey)) {
    console.log("[Geocoding] Cache hit:", cacheKey);
    return geocodeCache.get(cacheKey);
  }

  try {
    const { lat, lng } = UG_CENTER;

    // Pass 1 — bias toward UG Legon, no hard boundary so partial names work
    const q1   = encodeURIComponent(query + " University of Ghana Legon Accra");
    const url1 = `https://nominatim.openstreetmap.org/search?q=${q1}&format=json&limit=8&countrycodes=gh&lat=${lat}&lon=${lng}`;
    let data   = await fetchJSON(url1);

    // Pass 2 — retry with a softer suffix if first pass returned nothing
    if (!data.length) {
      const q2   = encodeURIComponent(query + " Legon Accra Ghana");
      const url2 = `https://nominatim.openstreetmap.org/search?q=${q2}&format=json&limit=8&countrycodes=gh`;
      data       = await fetchJSON(url2);
    }

    // Pass 3 — bare query as last resort, still biased toward UG center
    if (!data.length) {
      const q3   = encodeURIComponent(query);
      const url3 = `https://nominatim.openstreetmap.org/search?q=${q3}&format=json&limit=8&countrycodes=gh&lat=${lat}&lon=${lng}`;
      data       = await fetchJSON(url3);
    }

    // Clean up results and sort by proximity to UG center
    const results = data
      .map((d) => ({
        name: d.display_name.split(",").slice(0, 2).join(", "),
        lat:  parseFloat(d.lat),
        lng:  parseFloat(d.lon),
        dist: distanceKm(lat, lng, parseFloat(d.lat), parseFloat(d.lon)),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);

    // Store in cache for this session
    geocodeCache.set(cacheKey, results);
    return results;

  } catch {
    return [];
  }
}

// Converts a lat/lng coordinate into a human-readable location name
export async function reverseGeocode(lat, lng) {
  // Round to 4 decimal places as cache key (~11m precision — enough for campus)
  const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;

  if (reverseGeocodeCache.has(cacheKey)) {
    return reverseGeocodeCache.get(cacheKey);
  }

  try {
    const url    = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
    const data   = await fetchJSON(url);
    const result = data.display_name?.split(",").slice(0, 2).join(", ") || "Selected point";
    reverseGeocodeCache.set(cacheKey, result);
    return result;
  } catch {
    return "Selected point";
  }
}

// Internal helper — fetches JSON with standard headers
async function fetchJSON(url) {
  const res = await fetch(url, { headers: NOMINATIM_HEADERS });
  return res.json();
}