// services/geocoding.js
// Handles all Nominatim API calls with proper rate limiting

import { UG_CENTER } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { API_URL } from '../config';

// ========================
// NOMINATIM CONFIGURATION
// ========================
const NOMINATIM_BASE = import.meta.env.DEV
  ? '/api/nominatim'
  : `${API_URL}/api/nominatim`;

// ========================
// RATE LIMITING QUEUE
// ========================
let requestQueue = [];
let isProcessing = false;
let lastRequestTime = 0;
const RATE_LIMIT_MS = 3000; // 3 seconds between requests (more aggressive)

// Pending requests deduplication
const pendingRequests = new Map();

// Cache for results (24 hour TTL)
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function processQueue() {
  if (isProcessing || requestQueue.length === 0) return;

  isProcessing = true;

  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  const timeToWait = Math.max(0, RATE_LIMIT_MS - timeSinceLastRequest);

  if (timeToWait > 0) {
    await new Promise(resolve => setTimeout(resolve, timeToWait));
  }

  const { url, resolve, reject, retryCount = 0 } = requestQueue.shift();

  try {
    lastRequestTime = Date.now();
    console.log(`[RateLimit] Making request, queue size: ${requestQueue.length}`);

    const response = await fetch(url, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'UGNavigator/1.0 (https://ugnavigator.onrender.com)'
      }
    });

    if (response.status === 429) {
      throw new Error('RATE_LIMITED');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    resolve(data);
  } catch (error) {
    if (error.message === 'RATE_LIMITED' && retryCount < 5) {
      // Exponential backoff: 2s, 4s, 8s, 16s, 32s
      const backoff = Math.pow(2, retryCount) * 1000;
      console.warn(`Rate limited, retrying in ${backoff/1000}s... (attempt ${retryCount + 1}/5)`);
      await new Promise(resolve => setTimeout(resolve, backoff));
      requestQueue.unshift({ url, resolve, reject, retryCount: retryCount + 1 });
    } else {
      reject(error);
    }
  }

  isProcessing = false;
  processQueue();
}

function queuedFetch(url) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ url, resolve, reject, retryCount: 0 });
    processQueue();
  });
}

// ========================
// SEARCH FUNCTION - SINGLE PASS OPTIMIZED
// ========================

export async function geocode(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  
  // Check cache first
  const cached = cache.get(normalizedQuery);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log(`[geocode] Cache hit for "${normalizedQuery}"`);
    return cached.results;
  }
  
  // Check pending request
  if (pendingRequests.has(normalizedQuery)) {
    console.log(`[geocode] Reusing pending request for: "${normalizedQuery}"`);
    return pendingRequests.get(normalizedQuery);
  }

  const promise = (async () => {
    try {
      const { lat, lng } = UG_CENTER;
      const cleanQuery = encodeURIComponent(query.trim());
      
      // SINGLE REQUEST - Combined search with viewbox and bounded=0
      // This replaces the 3-pass strategy
      const url = `${NOMINATIM_BASE}/search?q=${cleanQuery}&format=json&limit=8&countrycodes=gh&viewbox=${lng-0.05},${lat-0.05},${lng+0.05},${lat+0.05}&bounded=0&addressdetails=1`;
      
      console.log(`[geocode] Single request for "${query.trim()}"`);
      const results = await queuedFetch(url);

      if (!results || results.length === 0) {
        return [];
      }

      const formatted = results
        .map((item) => ({
          name: item.display_name?.split(",").slice(0, 2).join(", ") || item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          dist: distanceKm(lat, lng, parseFloat(item.lat), parseFloat(item.lon)),
        }))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 5);
      
      // Cache results
      cache.set(normalizedQuery, {
        results: formatted,
        timestamp: Date.now()
      });
      
      return formatted;
    } catch (error) {
      console.error("[geocode] Error:", error);
      return [];
    } finally {
      pendingRequests.delete(normalizedQuery);
    }
  })();

  pendingRequests.set(normalizedQuery, promise);
  return promise;
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const data = await queuedFetch(url);

    if (!data || !data.display_name) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }

    if (data.address?.building) return data.address.building;
    if (data.address?.road) return data.address.road;
    if (data.address?.footway) return data.address.footway;

    return data.display_name.split(",").slice(0, 2).join(", ") || "Selected point";

  } catch (error) {
    console.error("[reverseGeocode] Error:", error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}