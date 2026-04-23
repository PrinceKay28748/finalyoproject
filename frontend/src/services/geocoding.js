// services/geocoding.js
// Handles all Nominatim API calls with proper rate limiting
// Uses BACKEND proxy in production, Vite proxy in development

import { UG_CENTER } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { API_URL } from '../config';

// ========================
// NOMINATIM CONFIGURATION
// ========================
// Use backend proxy in production, Vite proxy in development
const isProduction = import.meta.env.PROD;
const NOMINATIM_BASE = isProduction 
  ? `${API_URL}/api/proxy/nominatim`  // Production: use backend proxy
  : '/api/nominatim';                  // Development: use Vite proxy

// Headers required by Nominatim (only used in development, backend proxy handles it in production)
const NOMINATIM_HEADERS = {
  'Accept-Language': 'en',
  'User-Agent': 'UG-Navigator/1.0 (pkay28748@gmail.com)'
};

// ========================
// RATE LIMITING QUEUE
// ========================
let requestQueue = [];
let isProcessing = false;
let lastRequestTime = 0;
const RATE_LIMIT_MS = 1000; // 1 second between requests

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
    
    const fetchOptions = isProduction 
      ? { 
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
          // Backend will add its own User-Agent
        }
      : { headers: NOMINATIM_HEADERS };
    
    const response = await fetch(url, fetchOptions);
    
    if (response.status === 429) {
      throw new Error('RATE_LIMITED');
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    resolve(data);
  } catch (error) {
    if (error.message === 'RATE_LIMITED' && retryCount < 3) {
      console.warn(`Rate limited, retrying in 2 seconds... (attempt ${retryCount + 1}/3)`);
      await new Promise(resolve => setTimeout(resolve, 2000));
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
// SEARCH FUNCTIONS — THREE-PASS STRATEGY
// ========================

export async function geocode(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }
  
  try {
    const { lat, lng } = UG_CENTER;
    let results = [];

    // Clean the query — remove extra spaces
    const cleanQuery = query.trim();

    // Pass 1 — University of Ghana Legon Accra suffix (best for campus buildings)
    const q1 = encodeURIComponent(cleanQuery + " University of Ghana Legon Accra");
    const url1 = `${NOMINATIM_BASE}/search?q=${q1}&format=json&limit=8&countrycodes=gh&lat=${lat}&lon=${lng}`;
    results = await queuedFetch(url1);

    // Pass 2 — Legon Accra Ghana suffix (broader campus area)
    if (!results || results.length === 0) {
      const q2 = encodeURIComponent(cleanQuery + " Legon Accra Ghana");
      const url2 = `${NOMINATIM_BASE}/search?q=${q2}&format=json&limit=8&countrycodes=gh`;
      results = await queuedFetch(url2);
    }

    // Pass 3 — bare query with UG bias (last resort)
    if (!results || results.length === 0) {
      const q3 = encodeURIComponent(cleanQuery);
      const url3 = `${NOMINATIM_BASE}/search?q=${q3}&format=json&limit=8&countrycodes=gh&lat=${lat}&lon=${lng}`;
      results = await queuedFetch(url3);
    }

    if (!results || results.length === 0) {
      return [];
    }

    // Format results and sort by distance to UG center
    return results
      .map((item) => ({
        name: item.display_name.split(",").slice(0, 2).join(", "),
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        dist: distanceKm(lat, lng, parseFloat(item.lat), parseFloat(item.lon)),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);

  } catch (error) {
    console.error("[geocode] Error:", error);
    return [];
  }
}

export async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const data = await queuedFetch(url);
    
    if (!data || !data.display_name) {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
    
    // Try to get a clean, readable name
    if (data.address?.building) {
      return data.address.building;
    }
    
    if (data.address?.road) {
      return data.address.road;
    }
    
    if (data.address?.footway) {
      return data.address.footway;
    }
    
    // Fallback to first part of display name
    return data.display_name.split(",").slice(0, 2).join(", ") || "Selected point";
    
  } catch (error) {
    console.error("[reverseGeocode] Error:", error);
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}