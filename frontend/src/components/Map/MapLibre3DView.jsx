// components/Map/MapLibre3DView.jsx

import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY; // Read from .env

// Fallback check during development
if (!MAPTILER_KEY) {
  console.warn('[MapLibre3D] VITE_MAPTILER_KEY not set. 3D map will not load tiles.');
}

// 2D tile style (Explore)
const STYLE_EXPLORE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;

// 3D satellite with terrain + buildings
const STYLE_SATELLITE = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;

const TERRAIN_SOURCE = `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`;

const UG_CENTER = { lng: -0.1865, lat: 5.6510 }; // Adjust to your actual UG center

export default function MapLibre3DView({
  visible = false,
  viewMode = 'explore', // 'explore' | 'satellite'
  currentLocation,
  flyTarget,
  primaryRoute,
  alternativeRoutes = [],
  markersVisible,
  startPoint,
  destPoint,
  darkMode = false,
  onMapClick,
  onMapLoad,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const style = viewMode === 'satellite' ? STYLE_SATELLITE : STYLE_EXPLORE;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: style,
      center: [UG_CENTER.lng, UG_CENTER.lat],
      zoom: 15,
      minZoom: 13,
      maxZoom: 19,
      pitch: viewMode === 'satellite' ? 60 : 0, // Start tilted in satellite mode
      bearing: 0,
      antialias: true,
      attributionControl: false, // We'll add our own if needed
    });

    // Add navigation controls (pitch, rotate, zoom)
    map.addControl(
      new maplibregl.NavigationControl({
        visualizePitch: true,
        showZoom: true,
        showCompass: true,
      }),
      'top-right'
    );

    map.on('load', () => {
      setMapLoaded(true);

      // Add terrain source for 3D elevation
      map.addSource('terrain-source', {
        type: 'raster-dem',
        url: TERRAIN_SOURCE,
        tileSize: 256,
      });

      map.setTerrain({
        source: 'terrain-source',
        exaggeration: 1.5,
      });

      // Add 3D buildings layer
      map.addLayer({
        id: '3d-buildings',
        source: 'openmaptiles',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 14,
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['get', 'render_height'],
            0, '#e2e8f0',
            10, '#cbd5e1',
            30, '#94a3b8',
            60, '#64748b',
          ],
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            14, 0,
            14.05, ['get', 'render_height'],
          ],
          'fill-extrusion-base': ['get', 'render_min_height'],
          'fill-extrusion-opacity': 0.8,
        },
        filter: ['!', ['has', 'hide_3d']],
      });

      if (onMapLoad) onMapLoad(map);
    });

    // Click handler
    map.on('click', (e) => {
      if (onMapClick) {
        onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Handle flyTarget changes
  useEffect(() => {
    if (!mapRef.current || !flyTarget) return;
    mapRef.current.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: 17,
      duration: 1200,
    });
  }, [flyTarget]);

  // Initial fly to user location
  const hasFlown = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !currentLocation || hasFlown.current) return;
    mapRef.current.flyTo({
      center: [currentLocation.lng, currentLocation.lat],
      zoom: 17,
      duration: 1500,
    });
    hasFlown.current = true;
  }, [currentLocation]);

  // Switch between explore/satellite styles
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const style = viewMode === 'satellite' ? STYLE_SATELLITE : STYLE_EXPLORE;
    mapRef.current.setStyle(style);

    // Re-add terrain and buildings after style change
    mapRef.current.once('style.load', () => {
      if (!mapRef.current) return;

      mapRef.current.addSource('terrain-source', {
        type: 'raster-dem',
        url: TERRAIN_SOURCE,
        tileSize: 256,
      });

      mapRef.current.setTerrain({
        source: 'terrain-source',
        exaggeration: 1.5,
      });

      if (viewMode === 'satellite') {
        mapRef.current.addLayer({
          id: '3d-buildings',
          source: 'openmaptiles',
          'source-layer': 'building',
          type: 'fill-extrusion',
          minzoom: 14,
          paint: {
            'fill-extrusion-color': [
              'interpolate',
              ['linear'],
              ['get', 'render_height'],
              0, '#f8fafc',
              10, '#e2e8f0',
              30, '#94a3b8',
              60, '#475569',
            ],
            'fill-extrusion-height': [
              'interpolate',
              ['linear'],
              ['zoom'],
              14, 0,
              14.05, ['get', 'render_height'],
            ],
            'fill-extrusion-base': ['get', 'render_min_height'],
            'fill-extrusion-opacity': 0.9,
          },
        });
      }

      // Tilt in satellite mode, flat in explore
      mapRef.current.easeTo({
        pitch: viewMode === 'satellite' ? 60 : 0,
        duration: 800,
      });
    });
  }, [viewMode, mapLoaded]);

  // Draw routes when available
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !markersVisible) return;

    // Remove existing route layers
    ['primary-route-line', 'primary-route-glow', 'alt-route-line'].forEach(id => {
      if (mapRef.current.getLayer(id)) {
        mapRef.current.removeLayer(id);
      }
    });
    ['primary-route', 'alt-routes'].forEach(id => {
      if (mapRef.current.getSource(id)) {
        mapRef.current.removeSource(id);
      }
    });

    // Add primary route
    if (primaryRoute?.coordinates?.length) {
      const coords = primaryRoute.coordinates.map(c => [c.lng, c.lat]);

      mapRef.current.addSource('primary-route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: coords,
          },
        },
      });

      // Glow layer
      mapRef.current.addLayer({
        id: 'primary-route-glow',
        type: 'line',
        source: 'primary-route',
        paint: {
          'line-color': '#2563eb',
          'line-width': 14,
          'line-opacity': 0.15,
          'line-blur': 8,
        },
      });

      // Main line
      mapRef.current.addLayer({
        id: 'primary-route-line',
        type: 'line',
        source: 'primary-route',
        paint: {
          'line-color': '#2563eb',
          'line-width': 5,
          'line-opacity': 0.95,
        },
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
      });
    }

    // Add alternative routes
    if (alternativeRoutes.length > 0) {
      const altCoords = alternativeRoutes
        .filter(alt => alt.route?.coordinates?.length)
        .map(alt => ({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: alt.route.coordinates.map(c => [c.lng, c.lat]),
          },
        }));

      if (altCoords.length > 0) {
        mapRef.current.addSource('alt-routes', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: altCoords,
          },
        });

        mapRef.current.addLayer({
          id: 'alt-route-line',
          type: 'line',
          source: 'alt-routes',
          paint: {
            'line-color': '#94a3b8',
            'line-width': 4,
            'line-opacity': 0.5,
            'line-dasharray': [2, 4],
          },
          layout: {
            'line-cap': 'round',
            'line-join': 'round',
          },
        });
      }
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
        transition: 'opacity 0.3s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    />
  );
}