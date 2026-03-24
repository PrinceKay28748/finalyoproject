import { MapContainer } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import TileLayerSwitcher from "./TileLayerSwitcher";
import SmoothFly         from "./SmoothFly";
import InitialFly        from "./InitialFly";
import MapClickHandler   from "./MapClickHandler";
import LocationMarker    from "./LocationMarker";
import RouteMarkers      from "./RouteMarkers";
import Legend            from "../Legend/Legend";
import "../Legend/Legend.css";

import { UG_MAX_BOUNDS, UG_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from "../../function/utils/bounds";
import "./MapView.css";

// Assembles the full map — tiles, markers, click handler, legend, and recenter button
// Each map concern lives in its own sub-component; this file just composes them
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
  onMapClick,
  onLocationDragEnd,
  onRecenter,
}) {
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
      </MapContainer>

      {/* Recenter button — bottom right, always visible */}
      <button
        className="map-recenter-btn"
        onClick={onRecenter}
        title="Go to my location"
      >
        🎯
      </button>

      {/* Legend card — bottom left, only after Show on Map */}
      <Legend
        startText={startText}
        destText={destText}
        visible={markersVisible}
      />

      {/* Tap hint banner — appears when pin-start mode is active */}
      {waitingForStart && (
        <div className="map-tap-hint map-tap-hint--start">
          📍 Tap to set start point
        </div>
      )}
    </div>
  );
}