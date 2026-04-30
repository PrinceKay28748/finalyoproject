// frontend/src/components/Map/HeatmapLayer.jsx
// Renders a Leaflet.heat congestion overlay on the map.

import { useEffect, useRef, useState, useCallback } from "react";
import { useMap } from "react-leaflet";
import { fetchHeatmapData } from "../../services/heatmapAnalytics";
import "./HeatmapLayer.css";

const FETCH_DEBOUNCE_MS = 800;
const AUTO_REFRESH_MS = 5 * 60 * 1000;

const TIME_SLOTS = [
  { label: "All day",   hour: undefined },
  { label: "Morning",   hour: 8  },
  { label: "Midday",    hour: 12 },
  { label: "Afternoon", hour: 16 },
  { label: "Evening",   hour: 19 },
  { label: "Night",     hour: 22 },
];

export default function HeatmapLayer({ visible, onToggle }) {
  const map              = useMap();
  const heatLayerRef     = useRef(null);
  const debounceRef      = useRef(null);
  const refreshTimerRef  = useRef(null);

  const [selectedHour,    setSelectedHour]    = useState(undefined);
  const [isLoading,       setIsLoading]       = useState(false);
  const [pointCount,      setPointCount]      = useState(0);
  const [lastRefresh,     setLastRefresh]     = useState(null);

  // Prevent map interaction when clicking on controls
  const stopPropagation = (e) => {
    e.stopPropagation();
    e.preventDefault();
  };

  useEffect(() => {
    if (!visible) {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      return;
    }

    if (!window.L?.heatLayer) {
      console.warn("[HeatmapLayer] leaflet.heat not loaded");
      return;
    }

    heatLayerRef.current = window.L.heatLayer([], {
      radius:   20,
      blur:     15,
      max:      1.0,
      minOpacity: 0.3,
      gradient: {
        0.0: '#313695',
        0.2: '#4575b4',
        0.4: '#74add1',
        0.5: '#fee090',
        0.7: '#f46d43',
        0.9: '#d73027',
        1.0: '#a50026',
      },
    }).addTo(map);

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [visible, map]);

  const refreshData = useCallback(async () => {
    if (!visible || !heatLayerRef.current) return;

    setIsLoading(true);
    try {
      const bounds = map.getBounds();
      const points = await fetchHeatmapData(bounds, { hour: selectedHour });

      if (heatLayerRef.current) {
        heatLayerRef.current.setLatLngs(points.map(p => [p.lat, p.lng, p.weight]));
      }

      setPointCount(points.length);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("[HeatmapLayer] Fetch failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, [visible, map, selectedHour]);

  useEffect(() => {
    if (!visible) return;

    const onMoveEnd = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(refreshData, FETCH_DEBOUNCE_MS);
    };

    map.on('moveend', onMoveEnd);
    map.on('zoomend', onMoveEnd);
    refreshData();

    return () => {
      map.off('moveend', onMoveEnd);
      map.off('zoomend', onMoveEnd);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [visible, map, refreshData]);

  useEffect(() => {
    if (!visible) return;
    refreshTimerRef.current = setInterval(refreshData, AUTO_REFRESH_MS);
    return () => clearInterval(refreshTimerRef.current);
  }, [visible, refreshData]);

  useEffect(() => {
    if (visible) refreshData();
  }, [selectedHour, visible, refreshData]);

  if (!visible) return null;

  return (
    <div 
      className="heatmap-controls" 
      onMouseDown={stopPropagation}
      onTouchStart={stopPropagation}
      onPointerDown={stopPropagation}
      onClick={stopPropagation}
      style={{ position: 'relative', zIndex: 1000, pointerEvents: 'auto' }}
    >
      <div className="heatmap-header">
        <span className="heatmap-title">
          🔥 Congestion
          {isLoading && <span className="heatmap-spinner" />}
        </span>
        <button 
          className="heatmap-close" 
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          aria-label="Hide heatmap"
        >
          ✕
        </button>
      </div>

      <div className="heatmap-time-pills">
        {TIME_SLOTS.map((slot) => (
          <button
            key={slot.label}
            className={`heatmap-pill ${selectedHour === slot.hour ? "heatmap-pill--active" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedHour(slot.hour);
            }}
          >
            {slot.label}
          </button>
        ))}
      </div>

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

      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Low</span>
        <div className="heatmap-legend-bar" />
        <span className="heatmap-legend-label">High</span>
      </div>
    </div>
  );
}