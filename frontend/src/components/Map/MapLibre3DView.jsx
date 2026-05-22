// components/Map/MapLibre3DView.jsx
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

if (!MAPTILER_KEY) {
  console.warn('[MapLibre3D] VITE_MAPTILER_KEY not set. 3D map will not load tiles.');
}

const STYLE_EXPLORE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
const TERRAIN_SOURCE = `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`;
const SATELLITE_IMAGERY_URL = `https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${MAPTILER_KEY}`;

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

  // ── Cleanup all markers ──────────────────────────────────────────────────
  const clearMarkers = () => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
  };

  // ── Add markers to map ───────────────────────────────────────────────────
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
      maxZoom: 18,          // Reduced from 19
      pitch: 60,
      bearing: 0,
      antialias: false,     // Disable for performance
      attributionControl: false,
      fadeDuration: 0,      // Instant tile transitions
      // Performance optimizations
      maxTileCacheSize: 200,
      localIdeographFontFamily: "'Noto Sans', 'Noto Sans CJK SC', sans-serif",
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
      // ── Terrain (256px tiles, mapbox encoding = faster) ──────────────────
      map.addSource('terrain-source', {
        type: 'raster-dem',
        url: TERRAIN_SOURCE,
        tileSize: 256,        // Smaller tiles = faster load
        encoding: 'mapbox',   // Faster than terrarium
      });
      map.setTerrain({
        source: 'terrain-source',
        exaggeration: 1.2,    // Reduced from 1.5
      });

      // ── Satellite imagery (256px = 4x faster than 512px) ─────────────────
      map.addSource('satellite-imagery', {
        type: 'raster',
        tiles: [SATELLITE_IMAGERY_URL],
        tileSize: 256,
        minzoom: 0,
        maxzoom: 18,
      });

      map.addLayer({
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite-imagery',
        layout: { visibility: 'none' },
        paint: {
          'raster-opacity': 1,
          'raster-resampling': 'nearest',  // Faster than linear
          'raster-fade-duration': 0,
        },
      });

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
      zoom: 16,
      pitch: 60,
      duration: 800,  // Faster fly
    });
  }, [flyTarget]);

  // ── Initial fly to user location ─────────────────────────────────────────
  const hasFlown = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !currentLocation || hasFlown.current) return;
    mapRef.current.flyTo({
      center: [currentLocation.lng, currentLocation.lat],
      zoom: 16,
      pitch: 60,
      duration: 1000,
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

    const targetPitch = viewMode === 'satellite' ? 55 : 45;

    if (mapRef.current.getLayer('satellite-layer')) {
      mapRef.current.setLayoutProperty(
        'satellite-layer',
        'visibility',
        viewMode === 'satellite' ? 'visible' : 'none'
      );
    }

    mapRef.current.setTerrain({
      source: 'terrain-source',
      exaggeration: viewMode === 'satellite' ? 1.2 : 1.0,
    });

    mapRef.current.easeTo({
      pitch: targetPitch,
      duration: 600,
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
      id: 'primary-route-line',
      type: 'line',
      source: 'primary-route',
      paint: {
        'line-color': '#2563eb',
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 18, 6],
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
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.5, 18, 4],
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