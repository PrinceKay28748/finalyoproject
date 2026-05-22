// components/Map/MapLibre3DView.jsx
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

if (!MAPTILER_KEY) {
  console.warn('[MapLibre3D] VITE_MAPTILER_KEY not set.');
}

const STYLE_EXPLORE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
const STYLE_SATELLITE = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;
const TERRAIN_SOURCE = `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`;

const UG_CENTER = { lng: -0.1865, lat: 5.6510 };

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
  onMapClick,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  const clearMarkers = () => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
  };

  const createMarkerElement = (color, isDestination) => {
    const el = document.createElement('div');
    el.innerHTML = isDestination
      ? `<div style="width:24px;height:24px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`
      : `<div style="width:16px;height:16px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);"></div>`;
    return el;
  };

  const updateMarkers = () => {
    if (!mapRef.current) return;
    clearMarkers();

    if (currentLocation) {
      new maplibregl.Marker({ element: createMarkerElement('#2563eb', false), anchor: 'center' })
        .setLngLat([currentLocation.lng, currentLocation.lat])
        .addTo(mapRef.current);
    }
    if (startPoint) {
      new maplibregl.Marker({ element: createMarkerElement('#2563eb', false), anchor: 'bottom' })
        .setLngLat([startPoint.lng, startPoint.lat])
        .addTo(mapRef.current);
    }
    if (destPoint) {
      new maplibregl.Marker({ element: createMarkerElement('#22c55e', true), anchor: 'bottom' })
        .setLngLat([destPoint.lng, destPoint.lat])
        .addTo(mapRef.current);
    }
  };

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

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
      map.addSource('terrain-source', {
        type: 'raster-dem',
        url: TERRAIN_SOURCE,
        tileSize: 256,
      });
      map.setTerrain({ source: 'terrain-source', exaggeration: 1.5 });
      setMapLoaded(true);
    });

    map.on('click', (e) => {
      if (onMapClick) onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    mapRef.current = map;

    return () => {
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !flyTarget) return;
    mapRef.current.flyTo({ center: [flyTarget.lng, flyTarget.lat], zoom: 17, pitch: 60, duration: 1200 });
  }, [flyTarget]);

  const hasFlown = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !currentLocation || hasFlown.current) return;
    mapRef.current.flyTo({ center: [currentLocation.lng, currentLocation.lat], zoom: 17, pitch: 60, duration: 1500 });
    hasFlown.current = true;
  }, [currentLocation]);

  useEffect(() => {
    if (!mapLoaded) return;
    updateMarkers();
  }, [currentLocation, startPoint, destPoint, mapLoaded]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    const style = viewMode === 'satellite' ? STYLE_SATELLITE : STYLE_EXPLORE;
    mapRef.current.setStyle(style);
    mapRef.current.once('style.load', () => {
      if (!mapRef.current) return;
      mapRef.current.addSource('terrain-source', {
        type: 'raster-dem',
        url: TERRAIN_SOURCE,
        tileSize: 256,
      });
      mapRef.current.setTerrain({ source: 'terrain-source', exaggeration: viewMode === 'satellite' ? 1.5 : 1.2 });
    });
  }, [viewMode, mapLoaded]);

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    ['primary-route-line', 'alt-route-line'].forEach(id => {
      if (mapRef.current.getLayer(id)) mapRef.current.removeLayer(id);
    });
    ['primary-route', 'alt-routes'].forEach(id => {
      if (mapRef.current.getSource(id)) mapRef.current.removeSource(id);
    });

    if (!markersVisible || !primaryRoute?.coordinates?.length) return;

    const coords = primaryRoute.coordinates.map(c => [c.lng, c.lat]);
    mapRef.current.addSource('primary-route', {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } },
    });
    mapRef.current.addLayer({
      id: 'primary-route-line',
      type: 'line',
      source: 'primary-route',
      paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.95 },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });

    const altFeatures = alternativeRoutes
      .filter(alt => alt.route?.coordinates?.length)
      .map(alt => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: alt.route.coordinates.map(c => [c.lng, c.lat]) },
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
        paint: { 'line-color': '#94a3b8', 'line-width': 4, 'line-opacity': 0.5, 'line-dasharray': [3, 5] },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
    }
  }, [primaryRoute, alternativeRoutes, markersVisible, mapLoaded]);

  return (
    <div
      ref={mapContainer}
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