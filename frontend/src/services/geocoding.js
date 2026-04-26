// services/geocoding.js
import { UG_CENTER } from "../function/utils/bounds";
import { distanceKm } from "../function/utils/distance";
import { API_URL } from "../config";
import ugLocations from "../data/ugLocations.json";

const NOMINATIM_BASE = import.meta.env.DEV
  ? "/api/nominatim"
  : `${API_URL}/api/nominatim`;

// Module-level Nominatim cache — single source of truth, survives re-renders
const nominatimCache = new Map();

// ── Local fuzzy search ────────────────────────────────────────────────────────
// Scores how well a location entry matches the query string.
// Returns 0 if no match at all.
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

  // Multi-word token matching — each word of the query must appear somewhere
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

// Returns matching UG campus locations without any API call.
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

// ── Nominatim fallback ────────────────────────────────────────────────────────
// Only called when local search returns nothing useful.
// Accepts an AbortSignal so the caller can cancel stale requests cleanly.
export async function geocode(query, signal) {
  if (!query || query.trim().length < 3) return [];

  const key = query.trim().toLowerCase();

  if (nominatimCache.has(key)) {
    return nominatimCache.get(key);
  }

  try {
    const { lat, lng } = UG_CENTER;
    const url =
      `${NOMINATIM_BASE}/search` +
      `?q=${encodeURIComponent(query.trim())}` +
      `&format=json&limit=8&countrycodes=gh&addressdetails=1` +
      `&lat=${lat}&lon=${lng}`;

    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal,
    });

    if (!response.ok) return [];

    const raw = await response.json();
    if (!raw || raw.length === 0) return [];

    const formatted = raw
      .map((item) => ({
        name: item.display_name?.split(",")[0] || item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type || "place",
        dist: distanceKm(lat, lng, parseFloat(item.lat), parseFloat(item.lon)),
        source: "nominatim",
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 5);

    nominatimCache.set(key, formatted);

    if (nominatimCache.size > 100) {
      nominatimCache.delete(nominatimCache.keys().next().value);
    }

    return formatted;
  } catch (err) {
    // AbortError is intentional — a newer query cancelled this one
    if (err.name === "AbortError") return null;
    console.error("[geocode] Error:", err);
    return [];
  }
}

// ── Reverse geocoding ─────────────────────────────────────────────────────────
export async function reverseGeocode(lat, lng) {
  try {
    const url = `${NOMINATIM_BASE}/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });

    if (!response.ok) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    const data = await response.json();
    if (!data?.display_name) return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

    if (data.address?.building) return data.address.building;
    if (data.address?.road) return data.address.road;
    if (data.address?.footway) return data.address.footway;
    return data.display_name.split(",")[0] || "Selected point";
  } catch {
    return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  }
}