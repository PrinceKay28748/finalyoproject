// components/Map/MapView.jsx
import { MapContainer, useMap, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

import TileLayerSwitcher from "./TileLayerSwitcher";
import SmoothFly         from "./SmoothFly";
import InitialFly        from "./InitialFly";
import MapClickHandler   from "./MapClickHandler";
import { GpsLocationMarker, CustomLocationMarker } from "./LocationMarker";
import RouteMarkers      from "./RouteMarkers";
import RouteLayer        from "./RouteLayer";
import Legend            from "../Legend/Legend";
import "../Legend/Legend.css";

import { UG_MAX_BOUNDS, UG_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from "../../function/utils/bounds";
import "./MapView.css";

// Import from a centralized source
import { ROUTE_COLORS } from "../../function/utils/colors";

// SmartFitBounds component (unchanged from your original)
function SmartFitBounds({ startPoint, destPoint, visible }) {
  const map = useMap();
  
  useEffect(() => {
    if (!visible || !startPoint) return;
    
    if (startPoint && destPoint) {
      const bounds = [
        [startPoint.lat, startPoint.lng],
        [destPoint.lat, destPoint.lng]
      ];
      
      const R = 6371000;
      const dLat = (destPoint.lat - startPoint.lat) * Math.PI / 180;
      const dLng = (destPoint.lng - startPoint.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(startPoint.lat * Math.PI / 180) * Math.cos(destPoint.lat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      
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
        padding: [topPadding, sidePadding, bottomPadding, sidePadding]
      });
    } 
    else if (startPoint && !destPoint) {
      map.flyTo([startPoint.lat, startPoint.lng], 16, { duration: 0.8 });
    }
    
  }, [map, startPoint, destPoint, visible]);
  
  return null;
}

export default function MapView({
  currentLocation,
  accuracy,
  customStartPoint,
  startPoint,
  destPoint,
  startText,
  destText,
  markersVisible,
  // New props for 4-route system
  primaryRoute,
  alternativeRoutes = [],
  allRoutes = null,
  isRouting = false,
  isRerouting = false,
  deviationDetected = false,
  warnings = [],
  activeProfile = "standard",
  flyTarget,
  darkMode,
  waitingForStart,
  useCustomLocation = false,
  isSharedLocation = false,
  isLegendExpanded = true,
  onLegendExpandedChange,
  onProfileChange,
  onMapClick,
  onCustomLocationDragEnd,
  onRecenter,
  // NEW: Props from App.jsx
  isRouteLocked = false,
  registerLegendCollapse,
}) {
  const showDestinationMarker = !!destPoint;
  const displayStartPoint = useCustomLocation && customStartPoint ? customStartPoint : startPoint;
  
  // Create ref for Legend component
  const legendRef = useRef(null);

  // Register the legend collapse function with parent (safe version)
  useEffect(() => {
    if (registerLegendCollapse && legendRef.current) {
      registerLegendCollapse(() => legendRef.current?.collapse());
    }
    return () => {
      if (registerLegendCollapse) {
        registerLegendCollapse(null);
      }
    };
  }, [registerLegendCollapse]);

  // Helper to get the map instance
  const getMap = () => {
    const container = document.querySelector('.leaflet-container');
    return container?._leaflet_map;
  };

  // Check if primary route is available
  const hasValidRoute = primaryRoute && primaryRoute.coordinates && primaryRoute.coordinates.length > 0;

  // Debug: log routes rendering
  useEffect(() => {
    if (markersVisible) {
      console.log("[MapView] Routes rendering:", {
        hasValidRoute,
        primaryRoute: primaryRoute ? `✓ ${primaryRoute.totalDistanceKm?.toFixed(2)}km (${primaryRoute.profile})` : "✗",
        alternativeRoutes: alternativeRoutes?.length || 0,
        alternatives: alternativeRoutes?.map(a => `${a.profile}(${a.route?.totalDistanceKm?.toFixed(2)}km)`) || [],
        activeProfile
      });
    }
  }, [markersVisible, hasValidRoute, primaryRoute, alternativeRoutes, activeProfile]);

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
        
        {/* GPS location dot with direction and speed */}
        <GpsLocationMarker
          location={currentLocation}
          accuracy={accuracy}
        />
        
        {/* Draggable custom location marker */}
        <CustomLocationMarker
          location={customStartPoint}
          onDragEnd={onCustomLocationDragEnd}
          visible={useCustomLocation && !!customStartPoint}
        />

        {/* ===== 4-ROUTE RENDERING WITH PROGRESS TRACKING ===== */}
        {markersVisible && hasValidRoute && (
          <RouteLayer
            route={primaryRoute}
            visible={markersVisible}
            profile={activeProfile}
            currentLocation={currentLocation}
            showProgress={true}
          />
        )}

        {/* Alternative routes — only show when navigation not active (no progress tracking on alternatives) */}
        {markersVisible && alternativeRoutes.length > 0 && !hasValidRoute && (
          <>
            {alternativeRoutes.map((alt, index) => {
              const routeCoords = alt.route?.coordinates;
              if (!routeCoords || routeCoords.length === 0) return null;
              
              return (
                <Polyline
                  key={`alt-${alt.profile}-${alt.route?.totalDistance}`}
                  positions={routeCoords.map(c => [c.lat, c.lng])}
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

        {/* Fallback: show simple route if RouteLayer not used */}
        {markersVisible && hasValidRoute && (
          <>
            {/* Alternative routes (faded) */}
            {alternativeRoutes.map((alt, index) => {
              const routeCoords = alt.route?.coordinates;
              if (!routeCoords || routeCoords.length === 0) return null;
              
              return (
                <Polyline
                  key={`alt-${alt.profile}-${alt.route?.totalDistance}`}
                  positions={routeCoords.map(c => [c.lat, c.lng])}
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

        {/* Markers */}
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

      {/* Custom zoom controls - right side */}
      <div className="map-zoom-controls">
        <button 
          className="map-zoom-btn map-zoom-in" 
          onClick={() => {
            const map = getMap();
            if (map) map.zoomIn({ animate: true });
          }}
          title="Zoom in (+)"
          aria-label="Zoom in"
        >
          +
        </button>
        <button 
          className="map-zoom-btn map-zoom-out" 
          onClick={() => {
            const map = getMap();
            if (map) map.zoomOut({ animate: true });
          }}
          title="Zoom out (-)"
          aria-label="Zoom out"
        >
          −
        </button>
      </div>

      {/* Recenter button - left side */}
      <button
        className="map-recenter-btn"
        onClick={onRecenter}
        title="Go to my location"
        aria-label="Go to my location"
      >
        🎯
      </button>

      {/* Rerouting indicator - subtle, non-blocking */}
      {isRerouting && (
        <div className="rerouting-indicator">
          <div className="rerouting-spinner-small" />
          <span>Updating route...</span>
        </div>
      )}

      {/* Loading indicator */}
      {markersVisible && isRouting && !hasValidRoute && (
        <div className="route-loading">
          <div className="route-loading-spinner" />
          <span>Calculating routes...</span>
        </div>
      )}

      {/* Legend component with ref */}
      <Legend
        ref={legendRef}
        startText={useCustomLocation && customStartPoint ? customStartPoint.name || "Custom location" : startText}
        destText={destText}
        visible={markersVisible}
        route={primaryRoute}
        allRoutes={allRoutes}
        activeProfile={activeProfile}
        currentLocation={currentLocation}
        warnings={warnings}
        onProfileChange={onProfileChange}
        isExpanded={isLegendExpanded}
        onExpandedChange={onLegendExpandedChange}
      />

      {/* Tap hint */}
      {waitingForStart && (
        <div className="map-tap-hint map-tap-hint--start">
          📍 Tap to set start point
        </div>
      )}
    </div>
  );
}