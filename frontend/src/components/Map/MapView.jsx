// components/Map/MapView.jsx
import { MapContainer, useMap, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState } from "react";

import TileLayerSwitcher from "./TileLayerSwitcher";
import SmoothFly from "./SmoothFly";
import InitialFly from "./InitialFly";
import MapClickHandler from "./MapClickHandler";
import { GpsLocationMarker, CustomLocationMarker } from "./LocationMarker";
import RouteMarkers from "./RouteMarkers";
import RouteLayer from "./RouteLayer";
import HeatmapLayer from "./HeatmapLayer";
import HeatmapControls from "./HeatmapControls";
import Legend from "../Legend/Legend";
import { IconReport } from "../ui/icon";
import "../Legend/Legend.css";

import {
  UG_MAX_BOUNDS,
  UG_CENTER,
  DEFAULT_ZOOM,
  MIN_ZOOM,
  MAX_ZOOM,
} from "../../function/utils/bounds";
import "./MapView.css";

import { ROUTE_COLORS } from "../../function/utils/colors";

// ── SmartFitBounds ────────────────────────────────────────────────────────────
function SmartFitBounds({ startPoint, destPoint, visible }) {
  const map = useMap();

  useEffect(() => {
    if (!visible || !startPoint) return;

    if (startPoint && destPoint) {
      const bounds = [
        [startPoint.lat, startPoint.lng],
        [destPoint.lat, destPoint.lng],
      ];

      const R = 6371000;
      const dLat = ((destPoint.lat - startPoint.lat) * Math.PI) / 180;
      const dLng = ((destPoint.lng - startPoint.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((startPoint.lat * Math.PI) / 180) *
          Math.cos((destPoint.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      const isMobile = window.innerWidth < 600;

      let padding;
      if (isMobile) {
        if (distance < 50) padding = [20, 20];
        else if (distance < 200) padding = [30, 30];
        else if (distance < 500) padding = [40, 40];
        else if (distance < 1000) padding = [50, 50];
        else if (distance < 2000) padding = [60, 60];
        else padding = [80, 80];
      } else {
        if (distance < 50) padding = [30, 30];
        else if (distance < 200) padding = [50, 50];
        else if (distance < 500) padding = [70, 70];
        else if (distance < 1000) padding = [90, 90];
        else if (distance < 2000) padding = [120, 120];
        else padding = [180, 180];
      }

      const topPadding = isMobile ? padding[0] + 50 : padding[0] + 80;
      const bottomPadding = isMobile ? padding[1] + 50 : padding[1] + 80;
      const sidePadding = padding[1];

      map.fitBounds(bounds, {
        padding: [topPadding, sidePadding, bottomPadding, sidePadding],
      });
    } else if (startPoint && !destPoint) {
      map.flyTo([startPoint.lat, startPoint.lng], 16, { duration: 0.8 });
    }
  }, [map, startPoint, destPoint, visible]);

  return null;
}

// ── MapView ───────────────────────────────────────────────────────────────────
export default function MapView({
  currentLocation,
  accuracy,
  customStartPoint,
  startPoint,
  destPoint,
  startText,
  destText,
  markersVisible,
  primaryRoute,
  alternativeRoutes = [],
  allRoutes = null,
  isRouting = false,
  isRerouting = false,
  deviationDetected = false,
  warnings = [],
  activeProfile = "standard",
  vehicleMode = "walk",
  flyTarget,
  darkMode,
  waitingForStart,
  useCustomLocation = false,
  isSharedLocation = false,
  isLegendExpanded = true,
  onLegendExpandedChange,
  onProfileChange,
  onVehicleModeChange,
  onMapClick,
  onCustomLocationDragEnd,
  onRecenter,
  isRouteLocked = false,
  registerLegendCollapse,
  // Heatmap
  showHeatmap = false,
  onToggleHeatmap,
  selectedHour,
  onSelectedHourChange,
  // Report modal
  onOpenReportModal,
}) {
  const showDestinationMarker = !!destPoint;
  const displayStartPoint =
    useCustomLocation && customStartPoint ? customStartPoint : startPoint;

  const legendRef = useRef(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [map, setMap] = useState(null);

  useEffect(() => {
    if (registerLegendCollapse && legendRef.current) {
      registerLegendCollapse(() => legendRef.current?.collapse());
    }
    return () => {
      if (registerLegendCollapse) registerLegendCollapse(null);
    };
  }, [registerLegendCollapse]);

  const getMap = () =>
    document.querySelector(".leaflet-container")?._leaflet_map;

  const hasValidRoute = primaryRoute?.coordinates?.length > 0;

  // Track map bounds for heatmap controls
  useEffect(() => {
    const container = document.querySelector(".leaflet-container");
    if (container && container._leaflet_map) {
      const leafletMap = container._leaflet_map;
      setMap(leafletMap);
      
      const updateBounds = () => {
        if (leafletMap) {
          const bounds = leafletMap.getBounds();
          setMapBounds({
            south: bounds.getSouth(),
            west: bounds.getWest(),
            north: bounds.getNorth(),
            east: bounds.getEast(),
          });
        }
      };
      
      leafletMap.on('moveend', updateBounds);
      leafletMap.on('zoomend', updateBounds);
      updateBounds();
      
      return () => {
        leafletMap.off('moveend', updateBounds);
        leafletMap.off('zoomend', updateBounds);
      };
    }
  }, []);

  return (
    <div className="map-wrap">
      <MapContainer
        center={[UG_CENTER.lat, UG_CENTER.lng]}
        zoom={DEFAULT_ZOOM}
        maxBounds={UG_MAX_BOUNDS}
        maxBoundsViscosity={0.7}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        zoomControl={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayerSwitcher darkMode={darkMode} />
        <SmoothFly target={flyTarget} />
        <InitialFly location={currentLocation} />
        <SmartFitBounds
          startPoint={displayStartPoint}
          destPoint={destPoint}
          visible={markersVisible}
        />
        <MapClickHandler onMapClick={onMapClick} />

        <GpsLocationMarker location={currentLocation} accuracy={accuracy} />

        <CustomLocationMarker
          location={customStartPoint}
          onDragEnd={onCustomLocationDragEnd}
          visible={useCustomLocation && !!customStartPoint}
        />

        {/* Heatmap overlay — inside map container (needs map context) */}
        <HeatmapLayer visible={showHeatmap} selectedHour={selectedHour} />

        {markersVisible && hasValidRoute && (
          <RouteLayer
            route={primaryRoute}
            visible={markersVisible}
            profile={activeProfile}
            vehicleMode={vehicleMode}
            currentLocation={currentLocation}
            showProgress={true}
          />
        )}

        {/* Alternative routes when no primary yet */}
        {markersVisible && alternativeRoutes.length > 0 && !hasValidRoute && (
          <>
            {alternativeRoutes.map((alt) => {
              const coords = alt.route?.coordinates;
              if (!coords?.length) return null;
              return (
                <Polyline
                  key={`alt-${alt.profile}-${alt.route?.totalDistance}`}
                  positions={coords.map((c) => [c.lat, c.lng])}
                  color={ROUTE_COLORS[alt.profile]}
                  weight={4}
                  opacity={0.5}
                  smoothFactor={2}
                  lineCap="round"
                  lineJoin="round"
                  className="alternative-route"
                  interactive={false}
                />
              );
            })}
          </>
        )}

        {/* Alternative routes alongside primary */}
        {markersVisible && hasValidRoute && (
          <>
            {alternativeRoutes.map((alt) => {
              const coords = alt.route?.coordinates;
              if (!coords?.length) return null;
              return (
                <Polyline
                  key={`alt-${alt.profile}-${alt.route?.totalDistance}`}
                  positions={coords.map((c) => [c.lat, c.lng])}
                  color={ROUTE_COLORS[alt.profile]}
                  weight={4}
                  opacity={0.35}
                  smoothFactor={2}
                  lineCap="round"
                  lineJoin="round"
                  className="alternative-route"
                  interactive={false}
                />
              );
            })}
          </>
        )}

        <RouteMarkers
          startPoint={null}
          destPoint={destPoint}
          visible={showDestinationMarker}
          isShared={isSharedLocation}
        />

        <RouteMarkers
          startPoint={displayStartPoint}
          destPoint={destPoint}
          visible={markersVisible}
          isShared={isSharedLocation}
        />
      </MapContainer>

      {/* ── Map controls (OUTSIDE map container) ───────────────────────────── */}
      <div className="map-zoom-controls">
        <button
          className="map-zoom-btn map-zoom-in"
          onClick={() => getMap()?.zoomIn({ animate: true })}
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          className="map-zoom-btn map-zoom-out"
          onClick={() => getMap()?.zoomOut({ animate: true })}
          title="Zoom out (-)"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      <button
        className="map-recenter-btn"
        onClick={onRecenter}
        title="Go to my location"
        aria-label="Go to my location"
      >
        🎯
      </button>

      {/* Heatmap toggle button */}
      <button
        className={`map-heatmap-btn${showHeatmap ? " map-heatmap-btn--active" : ""}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleHeatmap();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        title={showHeatmap ? "Hide congestion heatmap" : "Show congestion heatmap"}
        aria-label="Toggle congestion heatmap"
        aria-pressed={showHeatmap}
      >
        🔥
      </button>

      {/* Report button — accessibility issue reporting */}
      <button
        className="map-report-btn"
        onClick={(e) => {
          e.stopPropagation();
          if (onOpenReportModal) onOpenReportModal();
        }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        title="Report accessibility issue"
        aria-label="Report accessibility issue"
      >
        <IconReport className="w-5 h-5" />
      </button>

      {/* Heatmap Controls Panel — OUTSIDE map container, no interference */}
      <HeatmapControls
        visible={showHeatmap}
        onToggle={onToggleHeatmap}
        mapBounds={mapBounds}
        selectedHour={selectedHour}
        onSelectedHourChange={onSelectedHourChange}
      />

      {/* ── Status indicators ─────────────────────────────────────────────── */}
      {isRerouting && (
        <div className="rerouting-indicator">
          <div className="rerouting-spinner-small" />
          <span>Updating route...</span>
        </div>
      )}

      {markersVisible && isRouting && !hasValidRoute && (
        <div className="route-loading">
          <div className="route-loading-spinner" />
          <span>Calculating routes...</span>
        </div>
      )}

      <Legend
        ref={legendRef}
        startText={
          useCustomLocation && customStartPoint
            ? customStartPoint.name || "Custom location"
            : startText
        }
        destText={destText}
        visible={markersVisible}
        route={primaryRoute}
        allRoutes={allRoutes}
        activeProfile={activeProfile}
        vehicleMode={vehicleMode}
        currentLocation={currentLocation}
        warnings={warnings}
        onProfileChange={onProfileChange}
        isExpanded={isLegendExpanded}
        onExpandedChange={onLegendExpandedChange}
      />

      {waitingForStart && (
        <div className="map-tap-hint map-tap-hint--start">
          📍 Tap to set start point
        </div>
      )}
    </div>
  );
}