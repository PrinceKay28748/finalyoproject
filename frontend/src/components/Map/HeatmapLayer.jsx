// frontend/src/components/Map/HeatmapLayer.jsx
// Renders a Leaflet.heat congestion overlay on the map.
//
// Setup: install leaflet.heat first —
//   npm install leaflet.heat
// Then import it once in your app entry point (main.jsx or App.jsx):
//   import 'leaflet.heat';

import { useEffect, useRef, useState, useCallback } from "react";
import { useMap } from "react-leaflet";
import { fetchHeatmapData } from "../../services/heatmapAnalytics";
import "./HeatmapLayer.css";

// How long to wait after map movement before fetching new data (ms)
const FETCH_DEBOUNCE_MS = 800;

// Refresh heatmap data every 5 minutes while the layer is visible
const AUTO_REFRESH_MS = 5 * 60 * 1000;

const TIME_SLOTS = [
  { label: "All day",   hour: undefined },
  { label: "Morning",   hour: 8  },
  { label: "Midday",    hour: 12 },
  { label: "Afternoon", hour: 16 },
  { label: "Evening",   hour: 19 },
  { label: "Night",     hour: 22 },
];

const DAY_SLOTS = [
  { label: "All week", dayOfWeek: undefined },
  { label: "Weekdays", dayOfWeek: undefined, weekdays: true },
  { label: "Weekend",  dayOfWeek: undefined, weekends: true },
];

/**
 * HeatmapLayer — drop this inside your <MapContainer> as a sibling to
 * <TileLayer> and <RouteLayer>.
 *
 * Props:
 *   visible {boolean} — whether to show the heatmap overlay
 *   onToggle {function} — called when the user toggles the layer off
 */
export default function HeatmapLayer({ visible, onToggle }) {
  const map              = useMap();
  const heatLayerRef     = useRef(null);
  const debounceRef      = useRef(null);
  const refreshTimerRef  = useRef(null);

  const [selectedHour,    setSelectedHour]    = useState(undefined);
  const [isLoading,       setIsLoading]       = useState(false);
  const [pointCount,      setPointCount]      = useState(0);
  const [lastRefresh,     setLastRefresh]     = useState(null);

  // ── Create / destroy the heat layer when visibility changes ────────────────
  useEffect(() => {
    if (!visible) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      return;
    }

    // leaflet.heat attaches itself to the L global
    if (!window.L?.heatLayer) {
      console.warn("[HeatmapLayer] leaflet.heat not loaded — run: npm install leaflet.heat");
      return;
    }

    // Create the heat layer with UG-tuned parameters:
    // radius: ~20px — covers a ~15m radius at typical campus zoom
    // blur:   15    — smooth enough to read, sharp enough to see paths
    // max:    1.0   — weights are pre-normalised by the backend
    heatLayerRef.current = window.L.heatLayer([], {
      radius:   20,
      blur:     15,
      max:      1.0,
      minOpacity: 0.3,
      gradient: {
        0.0: '#313695', // deep blue  — very low usage
        0.2: '#4575b4', // blue
        0.4: '#74add1', // light blue
        0.5: '#fee090', // yellow     — moderate usage
        0.7: '#f46d43', // orange
        0.9: '#d73027', // red
        1.0: '#a50026', // deep red   — highest usage
      },
    }).addTo(map);

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [visible, map]);

  // ── Fetch data and update the heat layer ───────────────────────────────────
  const refreshData = useCallback(async () => {
    if (!visible || !heatLayerRef.current) return;

    setIsLoading(true);
    try {
      const bounds = map.getBounds();
      const points = await fetchHeatmapData(bounds, {
        hour: selectedHour,
      });

      if (heatLayerRef.current) {
        // Leaflet.heat expects [[lat, lng, intensity], ...]
        heatLayerRef.current.setLatLngs(
          points.map(p => [p.lat, p.lng, p.weight])
        );
      }

      setPointCount(points.length);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("[HeatmapLayer] Fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [visible, map, selectedHour]);

  // ── Debounced fetch on map move/zoom ──────────────────────────────────────
  useEffect(() => {
    if (!visible) return;

    const onMoveEnd = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(refreshData, FETCH_DEBOUNCE_MS);
    };

    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);

    // Initial fetch
    refreshData();

    return () => {
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onMoveEnd);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [visible, map, refreshData]);

  // ── Auto-refresh every 5 minutes ─────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    refreshTimerRef.current = setInterval(refreshData, AUTO_REFRESH_MS);
    return () => clearInterval(refreshTimerRef.current);
  }, [visible, refreshData]);

  // ── Refetch when time filter changes ─────────────────────────────────────
  useEffect(() => {
    if (visible) refreshData();
  }, [selectedHour, visible, refreshData]);

  if (!visible) return null;

  return (
    <div className="heatmap-controls">
      <div className="heatmap-header">
        <span className="heatmap-title">
          🔥 Congestion
          {isLoading && <span className="heatmap-spinner" />}
        </span>
        <button className="heatmap-close" onClick={onToggle} aria-label="Hide heatmap">✕</button>
      </div>

      {/* Time filter */}
      <div className="heatmap-time-pills">
        {TIME_SLOTS.map((slot) => (
          <button
            key={slot.label}
            className={`heatmap-pill ${selectedHour === slot.hour ? "heatmap-pill--active" : ""}`}
            onClick={() => setSelectedHour(slot.hour)}
          >
            {slot.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="heatmap-stats">
        {pointCount > 0 ? (
          <span>{pointCount.toLocaleString()} data point{pointCount !== 1 ? 's' : ''}</span>
        ) : (
          <span className="heatmap-empty">No data yet — routes you calculate will appear here</span>
        )}
        {lastRefresh && (
          <span className="heatmap-refresh-time">
            Updated {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Colour legend */}
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Low</span>
        <div className="heatmap-legend-bar" />
        <span className="heatmap-legend-label">High</span>
      </div>
    </div>
  );
}