// components/Map/MapLibre3DView.jsx
// MapLibre 3D view with sprite fix, rain effect, and heatmap support
import { useEffect, useRef, useState, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { fetchHeatmapData } from '../../services/heatmapAnalytics';

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

if (!MAPTILER_KEY) {
  console.warn('[MapLibre3D] VITE_MAPTILER_KEY not set.');
}

const STYLE_EXPLORE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
const STYLE_SATELLITE = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;
const TERRAIN_SOURCE = `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`;

const UG_CENTER = { lng: -0.1865, lat: 5.6510 };

// Rain condition codes: drizzle (51-55), rain (61-65, 80-82), thunderstorm (95-99)
const RAIN_CODES = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];

// Helper to check if weather has rain
const hasRain = (weatherCode) => RAIN_CODES.includes(weatherCode);

// Helper to get rain intensity (0-1)
const getRainIntensity = (weatherCode) => {
  if ([95, 96, 99].includes(weatherCode)) return 1.0; // thunderstorm - heavy
  if ([80, 81, 82, 63, 65].includes(weatherCode)) return 0.7; // moderate rain
  if ([61, 51, 53, 55].includes(weatherCode)) return 0.3; // drizzle/light rain
  return 0;
};

// Rain particle system
class RainParticles {
  constructor(canvas, intensity = 0.5) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.intensity = intensity;
    this.particles = [];
    this.animationId = null;
    this.isRunning = false;
    
    this.resize();
    this.initParticles();
  }

  resize() {
    this.canvas.width = this.canvas.offsetWidth;
    this.canvas.height = this.canvas.offsetHeight;
  }

  initParticles() {
    this.particles = [];
    const count = Math.floor(100 * this.intensity);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: 2 + Math.random() * 3,
        opacity: Math.random() * 0.5 + 0.3,
        length: Math.random() * 10 + 5,
        width: Math.random() * 1.5 + 0.5,
      });
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  animate = () => {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.strokeStyle = 'rgba(200, 220, 255, 0.6)';
    this.ctx.lineCap = 'round';

    for (let particle of this.particles) {
      particle.x += particle.vx;
      particle.y += particle.vy;

      // Wrap around or reset
      if (particle.y > this.canvas.height) {
        particle.y = -particle.length;
        particle.x = Math.random() * this.canvas.width;
      }
      if (particle.x > this.canvas.width) particle.x = 0;
      if (particle.x < 0) particle.x = this.canvas.width;

      // Draw droplet
      this.ctx.globalAlpha = particle.opacity;
      this.ctx.lineWidth = particle.width;
      this.ctx.beginPath();
      this.ctx.moveTo(particle.x, particle.y);
      this.ctx.lineTo(particle.x + particle.vx * 2, particle.y + particle.vy * 2);
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;
    this.animationId = requestAnimationFrame(this.animate);
  };

  stop() {
    this.isRunning = false;
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setIntensity(intensity) {
    if (this.intensity !== intensity) {
      this.intensity = intensity;
      this.initParticles();
    }
  }

  destroy() {
    this.stop();
    this.particles = [];
  }
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
  onMapClick,
  weather,
  showHeatmap,
  selectedHour,
}) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const rainCanvasRef = useRef(null);
  const rainSystemRef = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const heatmapLayerIdRef = useRef(null);
  const heatmapRefreshTimeoutRef = useRef(null);
  const heatmapBoundsRef = useRef(null);

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

  // Fix sprite URL with API key
  const fixSpriteUrl = useCallback((map) => {
    if (!map) return;
    const style = map.getStyle();
    if (style && style.sprite) {
      const spriteUrl = style.sprite;
      // Only add key if not already present
      if (!spriteUrl.includes('key=')) {
        const separator = spriteUrl.includes('?') ? '&' : '?';
        const fixedUrl = `${spriteUrl}${separator}key=${MAPTILER_KEY}`;
        map.setSprite(fixedUrl);
      }
    }
  }, []);

  // Update heatmap on map
  const updateHeatmap = useCallback(async () => {
    if (!mapRef.current || !showHeatmap || !mapLoaded) return;

    try {
      const bounds = mapRef.current.getBounds();
      const points = await fetchHeatmapData(bounds, { hour: selectedHour });

      if (!points || points.length === 0) return;

      // Convert to GeoJSON features
      const features = points.map(p => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { intensity: p.weight || 0.5 },
      }));

      const geojson = { type: 'FeatureCollection', features };

      // Remove existing heatmap layer and source
      if (heatmapLayerIdRef.current && mapRef.current.getLayer(heatmapLayerIdRef.current)) {
        mapRef.current.removeLayer(heatmapLayerIdRef.current);
      }
      if (mapRef.current.getSource('heatmap-3d')) {
        mapRef.current.removeSource('heatmap-3d');
      }

      // Add heatmap source
      mapRef.current.addSource('heatmap-3d', {
        type: 'geojson',
        data: geojson,
      });

      // Add heatmap layer
      const layerId = `heatmap-3d-layer-${Date.now()}`;
      heatmapLayerIdRef.current = layerId;

      mapRef.current.addLayer(
        {
          id: layerId,
          type: 'heatmap',
          source: 'heatmap-3d',
          paint: {
            'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0, 1, 1],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 1, 9, 3],
            'heatmap-color': [
              'interpolate',
              ['linear'],
              ['heatmap-density'],
              0,
              'rgba(0, 0, 255, 0)',
              0.2,
              '#313695',
              0.4,
              '#4575b4',
              0.5,
              '#74add1',
              0.6,
              '#fee090',
              0.7,
              '#f46d43',
              0.8,
              '#d73027',
              1,
              '#a50026',
            ],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 2, 9, 20],
            'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 9, 0.6],
          },
        },
        'water'
      );

      heatmapBoundsRef.current = bounds;
    } catch (err) {
      console.error('[MapLibre3D] Heatmap fetch error:', err);
    }
  }, [showHeatmap, selectedHour, mapLoaded]);

  // Main map initialization
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
      // Fix sprite URL on load
      fixSpriteUrl(map);

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

    // Refetch heatmap on map move/zoom
    const onMoveEnd = () => {
      if (showHeatmap) {
        if (heatmapRefreshTimeoutRef.current) clearTimeout(heatmapRefreshTimeoutRef.current);
        heatmapRefreshTimeoutRef.current = setTimeout(() => {
          updateHeatmap();
        }, 500);
      }
    };
    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);

    mapRef.current = map;

    return () => {
      clearMarkers();
      if (heatmapRefreshTimeoutRef.current) clearTimeout(heatmapRefreshTimeoutRef.current);
      if (rainSystemRef.current) rainSystemRef.current.destroy();
      map.remove();
      mapRef.current = null;
    };
  }, [fixSpriteUrl, onMapClick, showHeatmap, updateHeatmap]);

  // Rain particle system
  useEffect(() => {
    if (!visible || !rainCanvasRef.current) return;

    const weatherCode = weather?.weatherCode;
    const rainIntensity = weatherCode ? getRainIntensity(weatherCode) : 0;

    if (!rainSystemRef.current) {
      rainSystemRef.current = new RainParticles(rainCanvasRef.current, rainIntensity);
    }

    if (rainIntensity > 0) {
      rainSystemRef.current.setIntensity(rainIntensity);
      rainCanvasRef.current.style.opacity = '1';
      rainSystemRef.current.start();
    } else {
      rainCanvasRef.current.style.opacity = '0';
      rainSystemRef.current.stop();
    }

    return () => {
      // Don't destroy on unmount yet - let cleanup happen in main useEffect
    };
  }, [weather, visible]);

  // Handle fly to target
  useEffect(() => {
    if (!mapRef.current || !flyTarget) return;
    mapRef.current.flyTo({
      center: [flyTarget.lng, flyTarget.lat],
      zoom: 17,
      pitch: 60,
      duration: 1200,
    });
  }, [flyTarget]);

  // Handle current location auto-fly
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

  // Update markers
  useEffect(() => {
    if (!mapLoaded) return;
    updateMarkers();
  }, [currentLocation, startPoint, destPoint, mapLoaded]);

  // Switch map style (explore/satellite)
  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    
    // Remove heatmap before style change
    if (heatmapLayerIdRef.current && mapRef.current.getLayer(heatmapLayerIdRef.current)) {
      mapRef.current.removeLayer(heatmapLayerIdRef.current);
    }
    if (mapRef.current.getSource('heatmap-3d')) {
      mapRef.current.removeSource('heatmap-3d');
    }

    const style = viewMode === 'satellite' ? STYLE_SATELLITE : STYLE_EXPLORE;
    mapRef.current.setStyle(style);

    mapRef.current.once('style.load', () => {
      if (!mapRef.current) return;

      fixSpriteUrl(mapRef.current);

      mapRef.current.addSource('terrain-source', {
        type: 'raster-dem',
        url: TERRAIN_SOURCE,
        tileSize: 256,
      });
      mapRef.current.setTerrain({
        source: 'terrain-source',
        exaggeration: viewMode === 'satellite' ? 1.5 : 1.2,
      });

      // Re-add heatmap if it was visible
      if (showHeatmap) {
        setTimeout(() => updateHeatmap(), 200);
      }
    });
  }, [viewMode, mapLoaded, fixSpriteUrl, showHeatmap, updateHeatmap]);

  // Update routes
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
      data: {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: coords },
      },
    });
    mapRef.current.addLayer({
      id: 'primary-route-line',
      type: 'line',
      source: 'primary-route',
      paint: {
        'line-color': '#2563eb',
        'line-width': 5,
        'line-opacity': 0.95,
      },
      layout: { 'line-cap': 'round', 'line-join': 'round' },
    });

    const altFeatures = alternativeRoutes
      .filter(alt => alt.route?.coordinates?.length)
      .map(alt => ({
        type: 'Feature',
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
          'line-width': 4,
          'line-opacity': 0.5,
          'line-dasharray': [3, 5],
        },
        layout: { 'line-cap': 'round', 'line-join': 'round' },
      });
    }
  }, [primaryRoute, alternativeRoutes, markersVisible, mapLoaded]);

  // Handle heatmap visibility changes
  useEffect(() => {
    if (showHeatmap && mapLoaded) {
      updateHeatmap();
    } else if (!showHeatmap && mapLoaded) {
      // Remove heatmap
      if (heatmapLayerIdRef.current && mapRef.current?.getLayer(heatmapLayerIdRef.current)) {
        mapRef.current.removeLayer(heatmapLayerIdRef.current);
      }
      if (mapRef.current?.getSource('heatmap-3d')) {
        mapRef.current.removeSource('heatmap-3d');
      }
      heatmapLayerIdRef.current = null;
    }
  }, [showHeatmap, mapLoaded, updateHeatmap]);

  return (
    <>
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
      {/* Rain canvas overlay */}
      {visible && (
        <canvas
          ref={rainCanvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: visible ? 2 : 0,
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.4s ease-in-out',
          }}
        />
      )}
    </>
  );
}