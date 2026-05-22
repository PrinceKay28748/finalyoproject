// components/Map/MapLibre3DView.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchHeatmapData } from "../../services/heatmapAnalytics";

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY;

if (!MAPTILER_KEY) {
  console.warn("[MapLibre3D] VITE_MAPTILER_KEY not set.");
}

const STYLE_EXPLORE = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
const STYLE_SATELLITE = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`;
const TERRAIN_SOURCE = `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`;

const UG_CENTER = { lng: -0.1865, lat: 5.651 };

const POI_COLORS = {
  clothes: "#FF6B9D",
  computer: "#4A90E2",
  chemist: "#7ED321",
  kiosk: "#F5A623",
  tailor: "#BD10E0",
  bed: "#50E3C2",
  cosmetics: "#F8E71C",
  default: "#8B572A",
};

const createFallbackImage = (imageName) => {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const color = POI_COLORS[imageName] || POI_COLORS["default"];

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "white";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = "white";
  ctx.font = "bold 28px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((imageName || "?").charAt(0).toUpperCase(), size / 2, size / 2);

  const imageData = ctx.getImageData(0, 0, size, size);
  return { data: imageData.data, width: size, height: size };
};

const RAIN_CODES = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99];
const getRainIntensity = (code) => {
  if (!code) return 0;
  if ([95, 96, 99].includes(code)) return 1.0;
  if ([80, 81, 82, 63, 65].includes(code)) return 0.7;
  if ([61, 51, 53, 55].includes(code)) return 0.3;
  return 0;
};

const extractWeatherCode = (weather) => {
  if (!weather) return null;
  return (
    weather?.list?.[0]?.weather?.[0]?.id ??
    weather?.current?.weather?.[0]?.id ??
    weather?.weather?.[0]?.id ??
    weather?.weatherCode ??
    null
  );
};

class RainParticles {
  constructor(canvas, intensity = 0.5) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.intensity = intensity;
    this.particles = [];
    this.animationId = null;
    this.isRunning = false;
    this._resize();
    this._init();
  }

  _resize() {
    this.canvas.width = this.canvas.offsetWidth || window.innerWidth;
    this.canvas.height = this.canvas.offsetHeight || window.innerHeight;
  }

  _init() {
    this.particles = [];
    const count = Math.floor(200 * this.intensity);
    for (let i = 0; i < count; i++) {
      this.particles.push(this._newParticle(true));
    }
  }

  _newParticle(randomY = false) {
    const w = this.canvas.width;
    const h = this.canvas.height;
    return {
      x: Math.random() * w,
      y: randomY ? Math.random() * h : -10,
      vx: (Math.random() - 0.5) * 0.5,
      vy: 3 + Math.random() * 4 * this.intensity,
      opacity: Math.random() * 0.4 + 0.2,
      length: Math.random() * 12 + 6,
      width: Math.random() * 1.5 + 0.5,
    };
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this._loop();
  }

  _loop = () => {
    if (!this.isRunning) return;
    const { ctx, canvas, particles } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.y > canvas.height + p.length) {
        particles[i] = this._newParticle(false);
        continue;
      }
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;

      ctx.globalAlpha = p.opacity;
      ctx.strokeStyle = "rgba(200, 225, 255, 0.9)";
      ctx.lineWidth = p.width + 1;
      ctx.shadowColor = "rgba(200, 225, 255, 0.5)";
      ctx.shadowBlur = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 3, p.y + p.length);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
    this.animationId = requestAnimationFrame(this._loop);
  };

  stop() {
    this.isRunning = false;
    if (this.animationId) cancelAnimationFrame(this.animationId);
    this.animationId = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  setIntensity(intensity) {
    if (this.intensity !== intensity) {
      this.intensity = intensity;
      this._init();
    }
  }

  destroy() {
    this.stop();
    this.particles = [];
  }
}

export default function MapLibre3DView({
  visible = false,
  viewMode = "explore",
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
  const heatmapDebounceRef = useRef(null);

  // ── helpers ───────────────────────────────────────────────────────────────

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  const makeMarkerEl = (color, large) => {
    const el = document.createElement("div");
    const s = large ? 24 : 16;
    el.style.cssText = `width:${s}px;height:${s}px;background:${color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.3);`;
    return el;
  };

  const addTerrainSource = useCallback((map) => {
    if (!map || !map.getContainer()) return;
    try {
      if (!map.getSource("terrain-source")) {
        map.addSource("terrain-source", {
          type: "raster-dem",
          url: TERRAIN_SOURCE,
          tileSize: 256,
          maxzoom: 14,
        });
      }
      map.setTerrain({ source: "terrain-source", exaggeration: 1.0 });
    } catch (err) {
      console.warn("[MapLibre3D] Terrain skipped:", err.message);
    }
  }, []);

  const fixSprite = useCallback((map) => {
    if (!map) return;
    try {
      const style = map.getStyle();
      if (style?.sprite && !style.sprite.includes("key=")) {
        const sep = style.sprite.includes("?") ? "&" : "?";
        map.setSprite(`${style.sprite}${sep}key=${MAPTILER_KEY}`);
      }
    } catch (_) {}
  }, []);

  const dimWater = useCallback((map) => {
    ["water", "waterway", "water-shadow", "sea", "ocean"].forEach(
      (layerName) => {
        if (map.getLayer(layerName)) {
          try {
            map.setPaintProperty(
              layerName,
              "fill-color",
              "rgba(170, 195, 215, 0.5)",
            );
          } catch (_) {}
        }
      },
    );
  }, []);

  const stripHeavyLayers = useCallback((map) => {
    const removeLayers = ["hillshade", "contour", "landcover"];
    removeLayers.forEach((id) => {
      if (map.getLayer(id)) {
        try {
          map.removeLayer(id);
        } catch (_) {}
      }
    });
  }, []);

  // ── heatmap ───────────────────────────────────────────────────────────────

  const removeHeatmap = useCallback((map) => {
    if (!map) return;
    const lid = heatmapLayerIdRef.current;
    try {
      if (lid && map.getLayer(lid)) map.removeLayer(lid);
    } catch (_) {}
    try {
      if (map.getSource("heatmap-3d")) map.removeSource("heatmap-3d");
    } catch (_) {}
    heatmapLayerIdRef.current = null;
  }, []);

  const updateHeatmap = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !showHeatmap || !mapLoaded || !navigator.onLine) return;

    try {
      const bounds = map.getBounds();
      // Guard: bounds might not be ready yet
      if (!bounds) return;

      const south = bounds.getSouth();
      const west = bounds.getWest();
      const north = bounds.getNorth();
      const east = bounds.getEast();

      // Guard: skip if any bound is invalid
      if (isNaN(south) || isNaN(west) || isNaN(north) || isNaN(east)) return;

      const points = await fetchHeatmapData(bounds, { hour: selectedHour });
      if (!points?.length) return;

      if (!mapRef.current) return;

      const features = points.map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { intensity: p.weight ?? 0.5 },
      }));

      removeHeatmap(map);

      map.addSource("heatmap-3d", {
        type: "geojson",
        data: { type: "FeatureCollection", features },
      });

      const lid = `hm-${Date.now()}`;
      heatmapLayerIdRef.current = lid;

      map.addLayer(
        {
          id: lid,
          type: "heatmap",
          source: "heatmap-3d",
          paint: {
            "heatmap-weight": [
              "interpolate",
              ["linear"],
              ["get", "intensity"],
              0,
              0,
              1,
              1,
            ],
            "heatmap-intensity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              1,
              9,
              3,
            ],
            "heatmap-color": [
              "interpolate",
              ["linear"],
              ["heatmap-density"],
              0,
              "rgba(0,0,255,0)",
              0.2,
              "#313695",
              0.4,
              "#4575b4",
              0.5,
              "#74add1",
              0.6,
              "#fee090",
              0.7,
              "#f46d43",
              0.8,
              "#d73027",
              1,
              "#a50026",
            ],
            "heatmap-radius": [
              "interpolate",
              ["linear"],
              ["zoom"],
              0,
              2,
              9,
              20,
            ],
            "heatmap-opacity": [
              "interpolate",
              ["linear"],
              ["zoom"],
              7,
              1,
              9,
              0.6,
            ],
          },
        },
        "water",
      );
    } catch (err) {
      console.error("[MapLibre3D] Heatmap error:", err);
    }
  }, [showHeatmap, selectedHour, mapLoaded, removeHeatmap]);

  // ── map init ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: STYLE_EXPLORE,
      center: [UG_CENTER.lng, UG_CENTER.lat],
      zoom: 15,
      minZoom: 13,
      maxZoom: 17,
      pitch: 60,
      pixelRatio: 1,
      antialias: false,
      attributionControl: false,
      fadeDuration: 0,
      maxTileCacheSize: 500,
      failIfMissingGlyphs: false,
      preserveDrawingBuffer: false,
      maxWorkerCount: 2,
      localFontFamily: "system-ui, sans-serif",
      collectResourceTiming: false,
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      "top-right",
    );

    map.on("load", () => {
      if (!mapRef.current) return;
      fixSprite(map);
      addTerrainSource(map);
      dimWater(map);
      stripHeavyLayers(map);
      setMapLoaded(true);
    });

    map.on("styleimagemissing", () => {
      // POI icons aren't critical — silently ignore
    });

    map.on("click", (e) => {
      if (onMapClick) onMapClick({ lat: e.lngLat.lat, lng: e.lngLat.lng });
    });

    const onMoveEnd = () => {
      if (!showHeatmap) return;
      clearTimeout(heatmapDebounceRef.current);
      heatmapDebounceRef.current = setTimeout(updateHeatmap, 500);
    };
    map.on("moveend", onMoveEnd);
    map.on("zoomend", onMoveEnd);

    mapRef.current = map;

    return () => {
      clearTimeout(heatmapDebounceRef.current);
      clearMarkers();
      if (rainSystemRef.current) {
        rainSystemRef.current.destroy();
        rainSystemRef.current = null;
      }
      const m = mapRef.current;
      mapRef.current = null;
      setMapLoaded(false);
      try {
        m.remove();
      } catch (_) {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── rain ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!visible || !rainCanvasRef.current) return;

    const code = extractWeatherCode(weather);
    const intensity = getRainIntensity(code);

    if (!rainSystemRef.current) {
      rainSystemRef.current = new RainParticles(
        rainCanvasRef.current,
        intensity,
      );
    } else {
      rainSystemRef.current.setIntensity(intensity);
    }

    if (intensity > 0) {
      rainCanvasRef.current.style.opacity = "1";
      rainSystemRef.current.start();
    } else {
      rainCanvasRef.current.style.opacity = "0";
      rainSystemRef.current.stop();
    }
  }, [weather, visible]);

  // ── fly to target ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !flyTarget) return;
    try {
      mapRef.current.flyTo({
        center: [flyTarget.lng, flyTarget.lat],
        zoom: 17,
        pitch: 60,
        duration: 1200,
      });
    } catch (_) {}
  }, [flyTarget]);

  const hasFlownRef = useRef(false);
  useEffect(() => {
    if (!mapRef.current || !currentLocation || hasFlownRef.current) return;
    try {
      mapRef.current.flyTo({
        center: [currentLocation.lng, currentLocation.lat],
        zoom: 17,
        pitch: 60,
        duration: 1500,
      });
      hasFlownRef.current = true;
    } catch (_) {}
  }, [currentLocation]);

  // ── markers ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    clearMarkers();
    const add = (loc, color, large) => {
      const m = new maplibregl.Marker({
        element: makeMarkerEl(color, large),
        anchor: large ? "bottom" : "center",
      })
        .setLngLat([loc.lng, loc.lat])
        .addTo(mapRef.current);
      markersRef.current.push(m);
    };
    if (currentLocation) add(currentLocation, "#2563eb", false);
    if (startPoint) add(startPoint, "#2563eb", true);
    if (destPoint) add(destPoint, "#22c55e", true);
  }, [currentLocation, startPoint, destPoint, mapLoaded, clearMarkers]);

  // ── style switch (explore ↔ satellite) ───────────────────────────────────

  useEffect(() => {
    if (!mapRef.current || !mapLoaded) return;
    removeHeatmap(mapRef.current);
    const style = viewMode === "satellite" ? STYLE_SATELLITE : STYLE_EXPLORE;
    mapRef.current.setStyle(style);
    mapRef.current.once("style.load", () => {
      if (!mapRef.current) return;
      fixSprite(mapRef.current);
      addTerrainSource(mapRef.current);
      dimWater(mapRef.current);
      stripHeavyLayers(mapRef.current);
      if (showHeatmap) setTimeout(updateHeatmap, 200);
    });
  }, [viewMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── routes ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    ["primary-route-glow", "primary-route-line", "alt-route-line"].forEach(
      (id) => {
        try {
          if (map.getLayer(id)) map.removeLayer(id);
        } catch (_) {}
      },
    );
    ["primary-route", "alt-routes"].forEach((id) => {
      try {
        if (map.getSource(id)) map.removeSource(id);
      } catch (_) {}
    });

    if (!markersVisible || !primaryRoute?.coordinates?.length) return;

    const coords = primaryRoute.coordinates.map((c) => [c.lng, c.lat]);
    map.addSource("primary-route", {
      type: "geojson",
      data: {
        type: "Feature",
        geometry: { type: "LineString", coordinates: coords },
      },
    });

    // Outer glow — makes route visible against any terrain
    map.addLayer({
      id: "primary-route-glow",
      type: "line",
      source: "primary-route",
      paint: {
        "line-color": "#2563eb",
        "line-width": 10,
        "line-opacity": 0.25,
        "line-blur": 4,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });

    // Inner sharp line
    map.addLayer({
      id: "primary-route-line",
      type: "line",
      source: "primary-route",
      paint: {
        "line-color": "#3b82f6",
        "line-width": 6,
        "line-opacity": 1,
      },
      layout: { "line-cap": "round", "line-join": "round" },
    });

    const altFeatures = (alternativeRoutes ?? [])
      .filter((a) => a.route?.coordinates?.length)
      .map((a) => ({
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: a.route.coordinates.map((c) => [c.lng, c.lat]),
        },
      }));

    if (altFeatures.length) {
      map.addSource("alt-routes", {
        type: "geojson",
        data: { type: "FeatureCollection", features: altFeatures },
      });
      map.addLayer({
        id: "alt-route-line",
        type: "line",
        source: "alt-routes",
        paint: {
          "line-color": "#ffffff",
          "line-width": 4,
          "line-opacity": 0.5,
          "line-dasharray": [4, 6],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
    }
  }, [primaryRoute, alternativeRoutes, markersVisible, mapLoaded]);

  // ── heatmap toggle ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapLoaded) return;
    if (showHeatmap) {
      updateHeatmap();
    } else {
      removeHeatmap(mapRef.current);
    }
  }, [showHeatmap, mapLoaded, updateHeatmap, removeHeatmap]);

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div
        ref={mapContainer}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: visible ? 1 : 0,
          opacity: visible ? 1 : 0,
          transition: "opacity 0.3s ease",
          pointerEvents: visible ? "auto" : "none",
        }}
      />
      {visible && (
        <canvas
          ref={rainCanvasRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            zIndex: 1000,
            pointerEvents: "none",
            opacity: 0,
            transition: "opacity 0.4s ease-in-out",
          }}
        />
      )}
    </>
  );
}
