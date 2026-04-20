// services/preferencesStore.js
// IndexedDB storage for user preferences (profile, theme, recent searches, favorites)

const DB_NAME = 'ug-routing-preferences';
const STORE_NAME = 'prefs';
const PREFS_KEY = 'user-preferences';

let dbInstance = null;

/**
 * Initialize preferences database
 */
async function initPreferencesDB() {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Default preferences object
 */
const DEFAULT_PREFERENCES = {
  activeProfile: 'standard',
  darkMode: false,
  recentSearches: [],
  savedLocations: [],
  notificationsEnabled: true,
  timestamp: Date.now(),
};

/**
 * Save preferences to IndexedDB
 */
export async function savePreferences(prefs) {
  try {
    const db = await initPreferencesDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);

      const data = {
        ...DEFAULT_PREFERENCES,
        ...prefs,
        timestamp: Date.now(),
      };

      const request = store.put(data, PREFS_KEY);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('[PreferencesStore] Preferences saved');
        resolve(data);
      };
    });
  } catch (error) {
    console.warn('[PreferencesStore] Could not save preferences:', error.message);
    return null;
  }
}

/**
 * Load preferences from IndexedDB
 */
export async function loadPreferences() {
  try {
    const db = await initPreferencesDB();

    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(PREFS_KEY);

      request.onerror = () => {
        console.log('[PreferencesStore] Loading defaults (no saved prefs)');
        resolve(DEFAULT_PREFERENCES);
      };

      request.onsuccess = () => {
        const data = request.result;
        if (!data) {
          console.log('[PreferencesStore] Loading defaults (first time)');
          resolve(DEFAULT_PREFERENCES);
        } else {
          console.log('[PreferencesStore] Loaded preferences from IndexedDB');
          resolve(data);
        }
      };
    });
  } catch (error) {
    console.warn('[PreferencesStore] Could not read preferences:', error.message);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Add a location to recent searches
 */
export async function addRecentSearch(location) {
  try {
    const prefs = await loadPreferences();
    const recentSearches = prefs.recentSearches || [];

    // Remove duplicates (keep only if different name/coords)
    const filtered = recentSearches.filter(
      (s) => s.name !== location.name || s.lat !== location.lat || s.lng !== location.lng
    );

    // Add new search to front, keep last 10
    const updated = [
      { ...location, timestamp: Date.now() },
      ...filtered,
    ].slice(0, 10);

    await savePreferences({
      ...prefs,
      recentSearches: updated,
    });

    return updated;
  } catch (error) {
    console.warn('[PreferencesStore] Could not add recent search:', error.message);
    return [];
  }
}

/**
 * Save a favorite location
 */
export async function saveFavoriteLocation(location) {
  try {
    const prefs = await loadPreferences();
    const savedLocations = prefs.savedLocations || [];

    // Check if already saved
    const exists = savedLocations.find((l) => l.name === location.name);
    if (exists) return savedLocations;

    const updated = [...savedLocations, { ...location, savedAt: Date.now() }];
    await savePreferences({
      ...prefs,
      savedLocations: updated,
    });

    return updated;
  } catch (error) {
    console.warn('[PreferencesStore] Could not save favorite:', error.message);
    return [];
  }
}

/**
 * Remove a favorite location
 */
export async function removeFavoriteLocation(locationName) {
  try {
    const prefs = await loadPreferences();
    const updated = (prefs.savedLocations || []).filter((l) => l.name !== locationName);

    await savePreferences({
      ...prefs,
      savedLocations: updated,
    });

    return updated;
  } catch (error) {
    console.warn('[PreferencesStore] Could not remove favorite:', error.message);
    return [];
  }
}

/**
 * Clear all preferences (for logout or reset)
 */
export async function clearPreferences() {
  try {
    const db = await initPreferencesDB();

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(PREFS_KEY);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('[PreferencesStore] Preferences cleared');
        resolve();
      };
    });
  } catch (error) {
    console.warn('[PreferencesStore] Could not clear preferences:', error.message);
  }
}
