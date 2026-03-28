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

function SmartFitBounds({ startPoint, destPoint, visible }) {
  const map = useMap();
  
  useEffect(() => {
    if (!visible || !startPoint) return;
    
    if (startPoint && destPoint) {
      const bounds = [
        [startPoint.lat, startPoint.lng],
        [destPoint.lat, destPoint.lng]
      ];
      
      const latDiff = Math.abs(startPoint.lat - destPoint.lat);
      const lngDiff = Math.abs(startPoint.lng - destPoint.lng);
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
      
      let padding;
      if (distance < 100) padding = [30, 30];
      else if (distance < 500) padding = [50, 50];
      else if (distance < 2000) padding = [80, 80];
      else padding = [120, 120];
      
      map.fitBounds(bounds, { padding });
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
  warnings = [],
  activeProfile = "standard",
  flyTarget,
  darkMode,
  waitingForStart,
  useCustomLocation = false,
  onMapClick,
  onCustomLocationDragEnd,
  onRecenter,
}) {
  // Show destination marker whenever destPoint exists
  const showDestinationMarker = !!destPoint;
  
  // Determine which start point to show on map
  const displayStartPoint = useCustomLocation && customStartPoint ? customStartPoint : startPoint;

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
        <TileLayerSwitcher darkMode={darkMode} />
        <SmoothFly target={flyTarget} />
        <InitialFly location={currentLocation} />
        <SmartFitBounds
          startPoint={displayStartPoint}
          destPoint={destPoint}
          visible={markersVisible}
        />
        <MapClickHandler onMapClick={onMapClick} />
        
        {/* GPS Blue Dot */}
        <GpsLocationMarker
          location={currentLocation}
          accuracy={accuracy}
        />
        
        {/* Custom Green Pin (draggable) */}
        <CustomLocationMarker
          location={customStartPoint}
          onDragEnd={onCustomLocationDragEnd}
          visible={useCustomLocation && !!customStartPoint}
        />

        {/* Route line — only when route is calculated */}
        <RouteLayer route={route} visible={markersVisible} />

        {/* Destination marker — shows immediately when tapped */}
        <RouteMarkers
          startPoint={null}
          destPoint={destPoint}
          visible={showDestinationMarker}
        />

        {/* Full route markers — both start and dest, only after "Show on Map" */}
        <RouteMarkers
          startPoint={displayStartPoint}
          destPoint={destPoint}
          visible={markersVisible}
        />
      </MapContainer>

      <button
        className="map-recenter-btn"
        onClick={onRecenter}
        title="Go to my location"
      >
        🎯
      </button>

      <Legend
        startText={useCustomLocation && customStartPoint ? customStartPoint.name || "Custom location" : startText}
        destText={destText}
        visible={markersVisible}
        route={route}
        warnings={warnings}
        activeProfile={activeProfile}
      />

      {waitingForStart && (
        <div className="map-tap-hint map-tap-hint--start">
          📍 Tap to set start point
        </div>
      )}
    </div>
  );
}