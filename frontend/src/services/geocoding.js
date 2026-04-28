// services/geocoding.js (updated section)

export function searchLocal(query) {
  if (!query || query.trim().length < 2) return [];

  const cleanQuery = query.trim().toLowerCase();
  
  // If query contains ANY word that's NOT a campus location, skip local search
  // e.g., "pizzaman legon" - "pizzaman" is not a UG location, so skip entirely
  const queryWords = cleanQuery.split(/\s+/);
  
  // Check if ALL words in the query relate to campus locations
  // If any word is unknown, return empty (let LocationIQ handle it)
  let allWordsValid = true;
  
  for (const word of queryWords) {
    // Skip short words (and, of, the, etc.)
    if (word.length < 3) continue;
    
    // Check if this word exists in any location name or alias
    const wordExists = ugLocations.some(loc => 
      loc.name.toLowerCase().includes(word) || 
      (loc.aliases && loc.aliases.some(alias => alias.toLowerCase().includes(word)))
    );
    
    if (!wordExists) {
      allWordsValid = false;
      break;
    }
  }
  
  // If any word is not a campus location, skip local search entirely
  if (!allWordsValid) {
    console.log(`[searchLocal] "${query}" contains non-campus word, skipping local search`);
    return [];
  }

  // Only proceed if all words are valid campus terms
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

// Main geocode function
export async function geocode(query, signal) {
  if (!query || query.trim().length < 3) return [];

  const cleanQuery = query.trim();
  const cacheKey = cleanQuery.toLowerCase();
  
  // Check API cache first
  if (apiCache.has(cacheKey)) {
    console.log(`[geocode] Cache hit: ${cacheKey}`);
    return apiCache.get(cacheKey);
  }
  
  // Check local - but only if the query is purely campus-related
  const localResults = searchLocal(cleanQuery);
  
  // If local results found and the query seems campus-specific, return them
  if (localResults.length > 0) {
    // Also check if the query exactly matches or starts with a campus name
    const exactMatch = localResults.some(r => 
      r.name.toLowerCase() === cleanQuery || 
      r.name.toLowerCase().startsWith(cleanQuery)
    );
    
    if (exactMatch || localResults.length >= 2) {
      console.log(`[geocode] Using ${localResults.length} local results for "${cleanQuery}"`);
      return localResults;
    }
  }

  // Otherwise, go to LocationIQ
  try {
    const url = `${API_URL}/api/locationiq/search?q=${encodeURIComponent(cleanQuery)}`;
    console.log(`[geocode] Fetching from LocationIQ: ${cleanQuery}`);
    
    const response = await fetch(url, { signal });
    
    if (!response.ok) {
      console.log(`[geocode] LocationIQ returned ${response.status}`);
      return localResults;
    }
    
    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.log(`[geocode] No results from LocationIQ`);
      return localResults;
    }
    
    // Format results - show full address to differentiate locations
    const formatted = data.map((item) => ({
      name: item.display_name.split(",")[0] || item.display_name,
      fullAddress: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      source: "locationiq",
    }));
    
    // Cache results
    apiCache.set(cacheKey, formatted);
    
    // Limit cache size
    if (apiCache.size > 200) {
      const firstKey = apiCache.keys().next().value;
      apiCache.delete(firstKey);
    }
    
    return formatted;
  } catch (err) {
    if (err.name === "AbortError") return null;
    console.error("[geocode] Error:", err);
    return localResults;
  }
}