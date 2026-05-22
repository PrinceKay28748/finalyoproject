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

// ── Weather codes to conditions ─────────────────────────────────────────────
const WEATHER_CONDITIONS = {
  rain: [200, 201, 202, 230, 231, 232, 300, 301, 302, 310, 311, 312, 313, 314, 321, 500, 501, 502, 503, 504, 511, 520, 521, 522, 531],
  thunderstorm: [210, 211, 212, 221],
  drizzle: [300, 301, 302, 310, 311, 312, 313, 314, 321],
  snow: [600, 601, 602, 611, 612, 613, 615, 616, 620, 621, 622],
};

// ── Rain particle system ────────────────────────────────────────────────────
class RainEffect {
  constructor(container) {
    this.container = container;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'maplibre-rain-canvas';
    this.canvas.style.cssText = `
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 999;
      opacity: 0;
      transition: opacity 0.5s ease;
    `;
    this.ctx = this.canvas.getContext('2d');
    this.drops = [];
    this.isRunning = false;
    this.intensity = 0;
    container.appendChild(this.canvas);
    console.log('[RainEffect] Created, canvas appended to container');
  }

  resize() {
    this.canvas.width = this.container.clientWidth;
    this.canvas.height = this.container.clientHeight;
    console.log('[RainEffect] Resized to', this.canvas.width, 'x', this.canvas.height);
  }

  start(intensity = 0.5) {
    this.intensity = intensity;
    if (!this.isRunning) {
      this.resize();
      this.isRunning = true;
      this.canvas.style.opacity = '1';
      console.log('[RainEffect] Started with intensity', intensity);
      this.loop();
    }
  }

  stop() {
    this.isRunning = false;
    this.canvas.style.opacity = '0';
    this.drops = [];
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    console.log('[RainEffect] Stopped');
  }

  updateIntensity(intensity) {
    this.intensity = Math.max(0, Math.min(1, intensity));
    if (this.intensity > 0 && !this.isRunning) {
      this.start(this.intensity);
    } else if (this.intensity === 0 && this.isRunning) {
      this.stop();
    }
  }

  loop() {
    if (!this.isRunning) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    const dropsToSpawn = Math.floor(this.intensity * 3);
    for (let i = 0; i < dropsToSpawn; i++) {
      this.drops.push({
        x: Math.random() * w,
        y: -10 - Math.random() * 100,
        speed: 8 + Math.random() * 14,
        length: 8 + Math.random() * 12,
        opacity: 0.15 + Math.random() * 0.3,
      });
    }

    if (this.drops.length > 200) {
      this.drops = this.drops.slice(-200);
    }

    ctx.strokeStyle = '#a8d8ff';
    ctx.lineWidth = 1;

    this.drops = this.drops.filter(drop => {
      drop.y += drop.speed;
      if (drop.y > h + 20) return false;

      ctx.globalAlpha = drop.opacity * this.intensity;
      ctx.beginPath();
      ctx.moveTo(drop.x, drop.y);
      ctx.lineTo(drop.x - 0.5, drop.y + drop.length);
      ctx.stroke();

      return true;
    });

    ctx.globalAlpha = 1;
    requestAnimationFrame(() => this.loop());
  }

  destroy() {
    this.stop();
    if (this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}

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
  weather = null,
  showHeatmap = false,
  heatmapPoints = null,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const rainRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // ── Determine weather condition ───────────────────────────────────────────
  const getWeatherCondition = () => {
    console.log('[Weather] Raw weather data:', weather);
    if (!weather) return null;
    
    // Try multiple possible data structures
    const weatherId = weather.list?.[0]?.weather?.[0]?.id
      || weather.current?.weather?.[0]?.id
      || weather.weather?.[0]?.id;
    
    console.log('[Weather] Detected weather ID:', weatherId);
    
    if (!weatherId) return null;

    if (WEATHER_CONDITIONS.thunderstorm.includes(weatherId)) return 'thunderstorm';
    if (WEATHER_CONDITIONS.snow.includes(weatherId)) return 'snow';
    if (WEATHER_CONDITIONS.rain.includes(weatherId)) return 'rain';
    if (WEATHER_CONDITIONS.drizzle.includes(weatherId)) return 'drizzle';
    return null;
  };

  const weatherCondition = getWeatherCondition();
  const isRaining = weatherCondition === 'rain' || weatherCondition === 'drizzle' || weatherCondition === 'thunderstorm';

  console.log('[Weather] Condition:', weatherCondition, 'IsRaining:', isRaining);

  // ── Rain effect control ───────────────────────────────────────────────────
  useEffect(() => {
    console.log('[Rain] Effect check - visible:', visible, 'container:', !!mapContainer.current, 'isRaining:', isRaining);
    
    if (!mapContainer.current || !visible) return;

    if (!rainRef.current) {
      rainRef.current = new RainEffect(mapContainer.current);
    }
    rainRef.current.resize();

    if (isRaining && visible) {
      const intensity = weatherCondition === 'thunderstorm' ? 1.0
        : weatherCondition === 'rain' ? 0.7
        : 0.4;
      console.log('[Rain] Updating intensity to:', intensity);
      rainRef.current.updateIntensity(intensity);
    } else {
      console.log('[Rain] Stopping rain');
      rainRef.current.updateIntensity(0);
    }

    return () => {
      if (rainRef.current) {
        rainRef.current.destroy();
        rainRef.current = null;
      }
    };
  }, [isRaining, weatherCondition, visible]);

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

  // ── Fetch heatmap data ────────────────────────────────────────────────────
  const fetchAndUpdateHeatmap = async () => {
    if (!mapRef.current || !showHeatmap) return;

    try {
      const { fetchHeatmapData } = await import('../../services/heatmapAnalytics');
      const bounds = mapRef.current.getBounds();
      const boundsObj = {
        south: bounds.getSouth(),
        west: bounds.getWest(),
        north: bounds.getNorth(),
        east: bounds.getEast(),
      };
      const points = await fetchHeatmapData(boundsObj, { hour: undefined });

      if (!mapRef.current) return;

      const features = points.map(p => ({
        type: 'Feature',
        properties: { intensity: p.weight || 1 },
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      }));

      const source = mapRef.current.getSource('heatmap-source');
      if (source) {
        source.setData({ type: 'FeatureCollection', features });
      }
    } catch (err) {
      console.error('[MapLibre3D] Heatmap fetch failed:', err);
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
      maxZoom: 18,
      pitch: 60,
      bearing: 0,
      antialias: false,
      attributionControl: false,
      fadeDuration: 0,
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

    // ── Suppress missing sprite image warnings ────────────────────────────
    map.on('styleimagemissing', (e) => {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      map.addImage(e.id, canvas, { sdf: false });
    });

    map.on('load', () => {
      // ── Fix sprite URL with API key ─────────────────────────────────────
      const style = map.getStyle();
      if (style && style.sprite && !style.sprite.includes('key=')) {
        const separator = style.sprite.includes('?') ? '&' : '?';
        style.sprite = `${style.sprite}${separator}key=${MAPTILER_KEY}`;
        // Note: setStyle triggers a reload, so we do terrain after
      }

      // ── Terrain ──────────────────────────────────────────────────────────
      map.addSource('terrain-source', {
        type: 'raster-dem',
        url: TERRAIN_SOURCE,
        tileSize: 256,
        encoding: 'mapbox',
      });
      map.setTerrain({
        source: 'terrain-source',
        exaggeration: 1.2,
      });

      // ── Satellite imagery ────────────────────────────────────────────────
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
          'raster-resampling': 'nearest',
          'raster-fade-duration': 0,
          'raster-opacity-transition': { duration: 0 },
        },
      });

      map.getCanvas().style.background = '#1a1a2e';

      // ── Dark overlay for rain mood ───────────────────────────────────────
      map.addLayer({
        id: 'weather-overlay',
        type: 'background',
        layout: { visibility: 'none' },
        paint: {
          'background-color': '#0a1628',
          'background-opacity': 0.15,
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
      if (rainRef.current) {
        rainRef.current.destroy();
        rainRef.current = null;
      }
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
      duration: 800,
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

  // ── Weather overlay toggle ───────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    if (mapRef.current.getLayer('weather-overlay')) {
      mapRef.current.setLayoutProperty(
        'weather-overlay',
        'visibility',
        isRaining ? 'visible' : 'none'
      );
    }
  }, [isRaining, mapLoaded]);

  // ── Heatmap layer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;

    if (mapRef.current.getLayer('heatmap-layer')) {
      mapRef.current.removeLayer('heatmap-layer');
    }
    if (mapRef.current.getSource('heatmap-source')) {
      mapRef.current.removeSource('heatmap-source');
    }

    if (!showHeatmap) return;

    mapRef.current.addSource('heatmap-source', {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });

    mapRef.current.addLayer({
      id: 'heatmap-layer',
      type: 'heatmap',
      source: 'heatmap-source',
      paint: {
        'heatmap-weight': ['get', 'intensity'],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 18, 3],
        'heatmap-color': [
          'interpolate',
          ['linear'],
          ['heatmap-density'],
          0, 'rgba(33,102,172,0)',
          0.2, 'rgb(103,169,207)',
          0.4, 'rgb(209,229,240)',
          0.6, 'rgb(253,219,199)',
          0.8, 'rgb(239,138,98)',
          1, 'rgb(178,24,43)',
        ],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 13, 8, 16, 25, 18, 40],
        'heatmap-opacity': 0.75,
      },
    });

    fetchAndUpdateHeatmap();
  }, [showHeatmap, mapLoaded]);

  // ── Refetch heatmap on map movement ──────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapLoaded || !showHeatmap) return;

    const onMoveEnd = () => {
      fetchAndUpdateHeatmap();
    };

    mapRef.current.on('moveend', onMoveEnd);
    mapRef.current.on('zoomend', onMoveEnd);

    return () => {
      if (mapRef.current) {
        mapRef.current.off('moveend', onMoveEnd);
        mapRef.current.off('zoomend', onMoveEnd);
      }
    };
  }, [showHeatmap, mapLoaded]);

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

    const style = mapRef.current.getStyle();
    if (style && style.layers) {
      style.layers.forEach(layer => {
        if (
          layer.id.includes('building') ||
          layer.id.includes('landuse') ||
          layer.id.includes('landcover') ||
          layer.type === 'fill-extrusion'
        ) {
          if (mapRef.current.getLayer(layer.id)) {
            mapRef.current.setLayoutProperty(
              layer.id,
              'visibility',
              viewMode === 'satellite' ? 'none' : 'visible'
            );
          }
        }
      });
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

    ['primary-route-line', 'alt-route-line'].forEach(id => {
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