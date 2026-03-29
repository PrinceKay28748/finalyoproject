import { MapContainer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

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

// Improved SmartFitBounds with distance-based padding
function SmartFitBounds({ startPoint, destPoint, visible }) {
  const map = useMap();
  
  useEffect(() => {
    if (!visible || !startPoint) return;
    
    if (startPoint && destPoint) {
      const bounds = [
        [startPoint.lat, startPoint.lng],
        [destPoint.lat, destPoint.lng]
      ];
      
      // Calculate accurate distance in meters using Haversine formula
      const R = 6371000; // Earth's radius in meters
      const dLat = (destPoint.lat - startPoint.lat) * Math.PI / 180;
      const dLng = (destPoint.lng - startPoint.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(startPoint.lat * Math.PI / 180) * Math.cos(destPoint.lat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
      const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      
      // Dynamic padding based on actual distance (meters)
      let padding;
      if (distance < 50) {
        padding = [30, 30];      // Very close (under 50m) - tight zoom
      } else if (distance < 200) {
        padding = [50, 50];      // Close (50-200m) - comfortable zoom
      } else if (distance < 500) {
        padding = [70, 70];      // Medium (200-500m) - standard zoom
      } else if (distance < 1000) {
        padding = [90, 90];      // Far (500-1000m) - zoomed out
      } else if (distance < 2000) {
        padding = [120, 120];    // Very far (1-2km) - more context
      } else {
        padding = [180, 180];    // Extremely far (2km+) - wide view
      }
      
      // Add extra top padding to account for nav panel (approx 80px)
      const topPadding = padding[0] + 80;
      
      map.fitBounds(bounds, { padding: [topPadding, padding[1], padding[1], padding[1]] });
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
  route,
  remainingRoute = null,
  navigationProgress = 0,
  isOffRoute = false,
  warnings = [],
  activeProfile = "standard",
  flyTarget,
  darkMode,
  waitingForStart,
  useCustomLocation = false,
  isSharedLocation = false,
  onProfileChange,
  onMapClick,
  onCustomLocationDragEnd,
  onRecenter,
}) {
  const showDestinationMarker = !!destPoint;
  const displayStartPoint = useCustomLocation && customStartPoint ? customStartPoint : startPoint;
  const displayRoute = (remainingRoute && remainingRoute.length > 0) ? { coordinates: remainingRoute } : route;
  const showFullRoute = !remainingRoute || remainingRoute.length === 0;

  // Helper to get the map instance
  const getMap = () => {
    return document.querySelector('.leaflet-container')._leaflet_map;
  };

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
        
        <GpsLocationMarker
          location={currentLocation}
          accuracy={accuracy}
        />
        
        <CustomLocationMarker
          location={customStartPoint}
          onDragEnd={onCustomLocationDragEnd}
          visible={useCustomLocation && !!customStartPoint}
        />

        <RouteLayer 
          route={displayRoute} 
          visible={markersVisible}
          showFullRoute={showFullRoute}
        />

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
        >
          −
        </button>
      </div>

      {/* Recenter button - left side */}
      <button
        className="map-recenter-btn"
        onClick={onRecenter}
        title="Go to my location"
      >
        🎯
      </button>

      {markersVisible && navigationProgress > 0 && navigationProgress < 100 && (
        <div className="progress-indicator">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${navigationProgress}%` }}
            />
          </div>
          <span className="progress-text">{Math.round(navigationProgress)}% completed</span>
          {isOffRoute && (
            <span className="offroute-warning"> ⚠️ Off route — recalculating...</span>
          )}
        </div>
      )}

      <Legend
        startText={useCustomLocation && customStartPoint ? customStartPoint.name || "Custom location" : startText}
        destText={destText}
        visible={markersVisible}
        route={route}
        warnings={warnings}
        activeProfile={activeProfile}
        currentLocation={currentLocation}
        onProfileChange={onProfileChange}
      />

      {waitingForStart && (
        <div className="map-tap-hint map-tap-hint--start">
          📍 Tap to set start point
        </div>
      )}
    </div>
  );
}