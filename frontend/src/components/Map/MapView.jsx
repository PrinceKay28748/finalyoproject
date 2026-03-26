// components/Map/MapView.jsx
import { MapContainer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

import TileLayerSwitcher from "./TileLayerSwitcher";
import SmoothFly         from "./SmoothFly";
import InitialFly        from "./InitialFly";
import MapClickHandler   from "./MapClickHandler";
import LocationMarker    from "./LocationMarker";
import RouteMarkers      from "./RouteMarkers";
import Legend            from "../Legend/Legend";
import RouteLayer        from "./RouteLayer";
import "../Legend/Legend.css";

import { UG_MAX_BOUNDS, UG_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from "../../function/utils/bounds";
import "./MapView.css";

// Helper component to fit bounds when route changes
function FitBounds({ bounds, enabled }) {
  const map = useMap();
  
  useEffect(() => {
    if (enabled && bounds && bounds.length === 2) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, bounds, enabled]);
  
  return null;
}

// Assembles the full map — tiles, markers, click handler, legend, and recenter button
export default function MapView({
  currentLocation,
  accuracy,
  startPoint,
  destPoint,
  startText,
  destText,
  markersVisible,
  flyTarget,
  darkMode,
  waitingForStart,
  route,
  isRouteLoading,
  onMapClick,
  onLocationDragEnd,
  onRecenter,
}) {
  // Calculate bounds to fit both markers when route is shown
  const getBoundsToFit = () => {
    if (!markersVisible || !startPoint || !destPoint) return null;
    return [
      [startPoint.lat, startPoint.lng],
      [destPoint.lat, destPoint.lng]
    ];
  };
  
  const boundsToFit = getBoundsToFit();
  
  return (
    <div className="map-wrap">
      <MapContainer
        center={[UG_CENTER.lat, UG_CENTER.lng]}
        zoom={DEFAULT_ZOOM}
        maxBounds={UG_MAX_BOUNDS}
        maxBoundsViscosity={0.7}
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        style={{ height: "100%", width: "100%" }}
      >
        {/* Map tile layer — switches between light and dark */}
        <TileLayerSwitcher darkMode={darkMode} />

        {/* Fly helpers — animate map to new locations */}
        <SmoothFly target={flyTarget} />
        <InitialFly location={currentLocation} />

        {/* Click handler — taps within UG bounds set start or destination */}
        <MapClickHandler onMapClick={onMapClick} />

        {/* Pulsing blue dot — user's live GPS location, draggable */}
        <LocationMarker
          location={currentLocation}
          accuracy={accuracy}
          onDragEnd={onLocationDragEnd}
        />

        {/* START and DEST markers — only shown after Show on Map */}
        <RouteMarkers
          startPoint={startPoint}
          destPoint={destPoint}
          visible={markersVisible}
        />

        {/* Draw the calculated route on the map */}
        {markersVisible && route && (
          <RouteLayer route={route} visible={true} />
        )}
        
        {/* Auto-fit map to show both markers when route is shown */}
        <FitBounds bounds={boundsToFit} enabled={markersVisible && route !== null} />

        {/* Show loading indicator while route is being calculated */}
        {markersVisible && isRouteLoading && (
          <div className="route-loading">
            <div className="route-loading-spinner"></div>
            <span>Finding best route...</span>
          </div>
        )}

        {/* Show error message if routing fails */}
        {markersVisible && route === null && !isRouteLoading && (
          <div className="route-error">
            No path found between these points
          </div>
        )}
      </MapContainer>

      {/* Recenter button — bottom right, always visible */}
      <button
        className="map-recenter-btn"
        onClick={onRecenter}
        title="Go to my location"
      >
        🎯
      </button>

      {/* Legend card — bottom left, shows route info when available */}
      <Legend
        startText={startText}
        destText={destText}
        visible={markersVisible}
        route={route}
      />

      {/* Tap hint banner — appears when pin-start mode is active */}
      {waitingForStart && (
        <div className="map-tap-hint map-tap-hint--start">
          Tap to set start point
        </div>
      )}
    </div>
  );
}