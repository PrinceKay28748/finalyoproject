// components/Map/MapLibre3DView.jsx
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

if (!MAPTILER_KEY) {
  console.warn('[MapLibre3D] VITE_MAPTILER_KEY not set. 3D map will not load tiles.');
}

const STYLE_EXPLORE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
const STYLE_SATELLITE = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;
const TERRAIN_SOURCE = `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`;

// OpenMapTiles schema uses "openmaptiles" source — MapTiler serves it via their API
const BUILDINGS_SOURCE = `https://api.maptiler.com/tiles/v3/tiles.json?key=${MAPTILER_KEY}`;

const UG_CENTER = { lng: -0.1865, lat: 5.6510 };

// ── Pulse animation styles ──────────────────────────────────────────────────
const PULSE_STYLE = `
@keyframes maplibre-marker-pulse {
  0%, 100% { box-shadow: 0 2px 6px rgba(0,0,0,0.3); }
  50% { box-shadow: 0 2px 12px rgba(37,99,235,0.5), 0 0 0 8px rgba(37,99,235,0.1); }
}
`;

// ── Create DOM marker element ───────────────────────────────────────────────
function createMarkerElement(color = '#2563eb', isDestination = false, label = '') {
  const el = document.createElement('div');
  el.className = 'maplibre-marker';
  el.innerHTML = isDestination
    ? `<div style="
        width: 24px; height: 24px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3), 0 0 0 4px ${color}33;
      "></div>`
    : `<div style="
        width: 16px; height: 16px;
        background: ${color};
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        animation: maplibre-marker-pulse 2s ease-in-out infinite;
      "></div>`;

  if (label) {
    const labelEl = document.createElement('div');
    labelEl.style.cssText = `
      position: absolute;
      top: -28px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.75);
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-family: 'Outfit', sans-serif;
      white-space: nowrap;
      pointer-events: none;
    `;
    labelEl.textContent = label;
    el.appendChild(labelEl);
  }

  return el;
}

// ── Add 3D buildings layer (waits for source to exist) ──────────────────────
function addBuildingsLayer(map, sourceId) {
  // Remove existing layer if any
  if (map.getLayer('3d-buildings')) {
    map.removeLayer('3d-buildings');
  }

  // Wait for the source to be available
  const tryAdd = () => {
    const source = map.getSource(sourceId);
    if (!source) {
      // Source not ready yet, try again on next idle
      map.once('idle', tryAdd);
      return;
    }

    map.addLayer({
      id: '3d-buildings',
      source: sourceId,
      'source-layer': 'building',
      type: 'fill-extrusion',
      minzoom: 14,
      paint: {
        'fill-extrusion-color': [
          'interpolate',
          ['linear'],
          ['get', 'render_height'],
          0, '#e4e4e7',
          5, '#a1a1aa',
          15, '#71717a',
          40, '#52525b',
        ],
        'fill-extrusion-height': [
          'interpolate',
          ['linear'],
          ['zoom'],
          13, 0,
          14, ['get', 'render_height'],
        ],
        'fill-extrusion-base': ['get', 'render_min_height'],
        'fill-extrusion-opacity': [
          'interpolate',
          ['linear'],
          ['zoom'],
          14, 0.4,
          15, 0.7,
          17, 0.9,
        ],
      },
      filter: ['!', ['has', 'hide_3d']],
    });

    // Set lighting for shadows
    map.setLight({
      anchor: 'viewport',
      color: '#ffffff',
      intensity: 0.6,
      position: [1.5, 80, 80],
    });
  };

  map.once('idle', tryAdd);
}

export default function MapLibre3DView({
  visible = false,
  viewMode = 'explore',
  currentLocation,
  flyTarget,
  primaryRoute,
  alternativeRoutes = [],
  markersVisible,
  startPoint,
  destPoint,
  darkMode = false,
  onMapClick,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Cleanup all markers
  const clearMarkers = () => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
  };

  // Add markers to map
  const updateMarkers = () => {
    if (!mapRef.current) return;
    clearMarkers();

    if (currentLocation) {
      const markerEl = createMarkerElement('#2563eb', false);
      const marker = new maplibregl.Marker({ element: markerEl, anchor: 'center' })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    }

    if (startPoint) {
      const markerEl = createMarkerElement('#2563eb', false, 'Start');
      const marker = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
        .setLngLat([startPoint.lng, startPoint.lat])
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    }

    if (destPoint) {
      const markerEl = createMarkerElement('#22c55e', true, 'Destination');
      const marker = new maplibregl.Marker({ element: markerEl, anchor: 'bottom' })
        .setLngLat([destPoint.lng, destPoint.lat])
        .addTo(mapRef.current);
      markersRef.current.push(marker);
    }
  };

  // ── Initialize map ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    if (!document.getElementById('maplibre-marker-styles')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'maplibre-marker-styles';
      styleEl.textContent = PULSE_STYLE;
      document.head.appendChild(styleEl);
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: STYLE_EXPLORE,
      center: [UG_CENTER.lng, UG_CENTER.lat],
      zoom: 15,
      minZoom: 13,
      maxZoom: 19,
      pitch: 60,
      bearing: 0,
      antialias: true,
      attributionControl: false,
      sky: {
        'sky-color': '#a8d8ff',
        'sky-horizon-blend': 0.5,
        'horizon-color': '#f0f4ff',
        'horizon-fog-blend': 0.3,
        'fog-color': '#e8edf5',
        'fog-ground-blend': 0.1,
      },
    });

    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true,
      }),
      'top-right'
    );

    map.on('load', () => {
      // Add terrain
      map.addSource('terrain-source', {
        type: 'raster-dem',
        url: TERRAIN_SOURCE,
        tileSize: 256,
      });
      map.setTerrain({
        source: 'terrain-source',
        exaggeration: 1.8,
      });

      // MapTiler Streets v2 uses 'maptiler' as the source name
      // Try common source names for buildings
      const sourceId = map.getSource('openmaptiles') ? 'openmaptiles'
        : map.getSource('maptiler') ? 'maptiler'
        : map.getSource('maptiler-planet') ? 'maptiler-planet'
        : null;

      if (sourceId) {
        addBuildingsLayer(map, sourceId);
      } else {
        // If no vector source with buildings, fetch building tiles separately
        map.addSource('buildings-source', {
          type: 'vector',
          url: BUILDINGS_SOURCE,
        });
        map.once('idle', () => addBuildingsLayer(map, 'buildings-source'));
      }

      setMapLoaded(true);
    });

    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    mapRef.current = map;

    return () => {
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Handle flyTarget ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !flyTarget) return;
    mapRef.current.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: 17,
      pitch: 60,
      duration: 1200,
    });
  }, [flyTarget]);

  // ── Initial fly to user location ─────────────────────────────────────────
  const hasFlown = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !currentLocation || hasFlown.current) return;
    mapRef.current.flyTo({
      center: [currentLocation.lng, currentLocation.lat],
      zoom: 17,
      pitch: 60,
      duration: 1500,
    });
    hasFlown.current = true;
  }, [currentLocation]);

  // ── Update markers ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapLoaded) return;
    updateMarkers();
  }, [currentLocation, startPoint, destPoint, mapLoaded]);

  // ── Switch explore/satellite ─────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    const style = viewMode === 'satellite' ? STYLE_SATELLITE : STYLE_EXPLORE;
    const targetPitch = viewMode === 'satellite' ? 60 : 45;
    const targetZoom = viewMode === 'satellite' ? 17 : 16;

    mapRef.current.setStyle(style);

    mapRef.current.once('style.load', () => {
      if (!mapRef.current) return;

      // Re-add terrain
      mapRef.current.addSource('terrain-source', {
        type: 'raster-dem',
        url: TERRAIN_SOURCE,
        tileSize: 256,
      });
      mapRef.current.setTerrain({
        source: 'terrain-source',
        exaggeration: viewMode === 'satellite' ? 2.0 : 1.5,
      });

      // Buildings in satellite mode
      if (viewMode === 'satellite') {
        const sourceId = mapRef.current.getSource('openmaptiles') ? 'openmaptiles'
          : mapRef.current.getSource('maptiler') ? 'maptiler'
          : mapRef.current.getSource('maptiler-planet') ? 'maptiler-planet'
          : null;

        if (sourceId) {
          addBuildingsLayer(mapRef.current, sourceId);
        } else {
          mapRef.current.addSource('buildings-source', {
            type: 'vector',
            url: BUILDINGS_SOURCE,
          });
          mapRef.current.once('idle', () => addBuildingsLayer(mapRef.current, 'buildings-source'));
        }

        mapRef.current.setLight({
          anchor: 'viewport',
          color: '#ffeedd',
          intensity: 0.8,
          position: [1.5, 70, 70],
        });
      }

      mapRef.current.easeTo({
        pitch: targetPitch,
        zoom: targetZoom,
        duration: 1000,
      });
    });
  }, [viewMode, mapLoaded]);

  // ── Draw/clear routes ────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    ['primary-route-glow', 'primary-route-line', 'alt-route-line'].forEach(id => {
      if (mapRef.current.getLayer(id)) mapRef.current.removeLayer(id);
    });
    ['primary-route', 'alt-routes'].forEach(id => {
      if (mapRef.current.getSource(id)) mapRef.current.removeSource(id);
    });

    if (!markersVisible || !primaryRoute?.coordinates?.length) {
      return;
    }

    const coords = primaryRoute.coordinates.map(c => [c.lng, c.lat]);
    mapRef.current.addSource('primary-route', {
      type: 'geojson',
      data: {
        type: 'Feature',
        properties: {},
        geometry: { type: 'LineString', coordinates: coords },
      },
    });

    mapRef.current.addLayer({
      id: 'primary-route-glow',
      type: 'line',
      source: 'primary-route',
      paint: {
        'line-color': '#2563eb',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 6, 19, 20],
        'line-opacity': 0.2,
        'line-blur': ['interpolate', ['linear'], ['zoom'], 13, 4, 19, 12],
      },
    });

    mapRef.current.addLayer({
      id: 'primary-route-line',
      type: 'line',
      source: 'primary-route',
      paint: {
        'line-color': '#2563eb',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 19, 8],
        'line-opacity': 0.95,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });

    const altFeatures = alternativeRoutes
      .filter(alt => alt.route?.coordinates?.length)
      .map(alt => ({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: alt.route.coordinates.map(c => [c.lng, c.lat]),
        },
      }));

    if (altFeatures.length > 0) {
      mapRef.current.addSource('alt-routes', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: altFeatures },
      });

      mapRef.current.addLayer({
        id: 'alt-route-line',
        type: 'line',
        source: 'alt-routes',
        paint: {
          'line-color': '#94a3b8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 19, 5],
          'line-opacity': 0.5,
          'line-dasharray': [3, 5],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
    }
  }, [primaryRoute, alternativeRoutes, markersVisible, mapLoaded]);

  return (
    <div
      ref={mapContainer}
      className={`maplibre-map ${visible ? 'maplibre-map--visible' : 'maplibre-map--hidden'}`}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: visible ? 1 : 0,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    />
  );
}