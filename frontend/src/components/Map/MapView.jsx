



// // components/Map/MapView.jsx
// import { MapContainer, useMap } from "react-leaflet";
// import "leaflet/dist/leaflet.css";
// import { useEffect } from "react";

// import TileLayerSwitcher from "./TileLayerSwitcher";
// import SmoothFly         from "./SmoothFly";
// import InitialFly        from "./InitialFly";
// import MapClickHandler   from "./MapClickHandler";
// import LocationMarker    from "./LocationMarker";
// import RouteMarkers      from "./RouteMarkers";
// import Legend            from "../Legend/Legend";
// import RouteLayer        from "./RouteLayer";
// import "../Legend/Legend.css";

// import { UG_MAX_BOUNDS, UG_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from "../../function/utils/bounds";
// import "./MapView.css";

// // Helper component to fit bounds when route changes
// function FitBounds({ bounds, enabled }) {
//   const map = useMap();
  
//   useEffect(() => {
//     if (enabled && bounds && bounds.length === 2) {
//       map.fitBounds(bounds, { padding: [50, 50] });
//     }
//   }, [map, bounds, enabled]);
  
//   return null;
// }

// // Assembles the full map — tiles, markers, click handler, legend, and recenter button
// export default function MapView({
//   currentLocation,
//   accuracy,
//   startPoint,
//   destPoint,
//   startText,
//   destText,
//   markersVisible,
//   flyTarget,
//   darkMode,
//   waitingForStart,
//   route,
//   isRouteLoading,
//   onMapClick,
//   onLocationDragEnd,
//   onRecenter,
// }) {
//   // Calculate bounds to fit both markers when route is shown
//   const getBoundsToFit = () => {
//     if (!markersVisible || !startPoint || !destPoint) return null;
//     return [
//       [startPoint.lat, startPoint.lng],
//       [destPoint.lat, destPoint.lng]
//     ];
//   };
  
//   const boundsToFit = getBoundsToFit();
  
//   return (
//     <div className="map-wrap">
//       <MapContainer
//         center={[UG_CENTER.lat, UG_CENTER.lng]}
//         zoom={DEFAULT_ZOOM}
//         maxBounds={UG_MAX_BOUNDS}
//         maxBoundsViscosity={0.7}
//         minZoom={MIN_ZOOM}
//         maxZoom={MAX_ZOOM}
//         style={{ height: "100%", width: "100%" }}
//       >
//         {/* Map tile layer — switches between light and dark */}
//         <TileLayerSwitcher darkMode={darkMode} />

//         {/* Fly helpers — animate map to new locations */}
//         <SmoothFly target={flyTarget} />
//         <InitialFly location={currentLocation} />

//         {/* Click handler — taps within UG bounds set start or destination */}
//         <MapClickHandler onMapClick={onMapClick} />

//         {/* Pulsing blue dot — user's live GPS location, draggable */}
//         <LocationMarker
//           location={currentLocation}
//           accuracy={accuracy}
//           onDragEnd={onLocationDragEnd}
//         />

//         {/* START and DEST markers — only shown after Show on Map */}
//         <RouteMarkers
//           startPoint={startPoint}
//           destPoint={destPoint}
//           visible={markersVisible}
//         />

//         {/* Draw the calculated route on the map */}
//         {markersVisible && route && (
//           <RouteLayer route={route} visible={true} />
//         )}
        
//         {/* Auto-fit map to show both markers when route is shown */}
//         <FitBounds bounds={boundsToFit} enabled={markersVisible && route !== null} />

//         {/* Show loading indicator while route is being calculated */}
//         {markersVisible && isRouteLoading && (
//           <div className="route-loading">
//             <div className="route-loading-spinner"></div>
//             <span>Finding best route...</span>
//           </div>
//         )}

//         {/* Show error message if routing fails */}
//         {markersVisible && route === null && !isRouteLoading && (
//           <div className="route-error">
//             No path found between these points
//           </div>
//         )}
//       </MapContainer>

//       {/* Recenter button — bottom right, always visible */}
//       <button
//         className="map-recenter-btn"
//         onClick={onRecenter}
//         title="Go to my location"
//       >
//         🎯
//       </button>

//       {/* Legend card — bottom left, shows route info when available */}
//       <Legend
//         startText={startText}
//         destText={destText}
//         visible={markersVisible}
//         route={route}
//       />

//       {/* Tap hint banner — appears when pin-start mode is active */}
//       {waitingForStart && (
//         <div className="map-tap-hint map-tap-hint--start">
//           Tap to set start point
//         </div>
//       )}
//     </div>
//   );
// }


import { MapContainer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect } from "react";

import TileLayerSwitcher from "./TileLayerSwitcher";
import SmoothFly         from "./SmoothFly";
import InitialFly        from "./InitialFly";
import MapClickHandler   from "./MapClickHandler";
import LocationMarker    from "./LocationMarker";
import RouteMarkers      from "./RouteMarkers";
import RouteLayer        from "./RouteLayer";
import Legend            from "../Legend/Legend";
import "../Legend/Legend.css";

import { UG_MAX_BOUNDS, UG_CENTER, DEFAULT_ZOOM, MIN_ZOOM, MAX_ZOOM } from "../../function/utils/bounds";
import "./MapView.css";

// Helper component to smartly fit bounds based on distance between points
function SmartFitBounds({ startPoint, destPoint, visible }) {
  const map = useMap();
  
  useEffect(() => {
    if (!visible || !startPoint) return;
    
    // If both points exist, fit to show both
    if (startPoint && destPoint) {
      const bounds = [
        [startPoint.lat, startPoint.lng],
        [destPoint.lat, destPoint.lng]
      ];
      
      // Calculate approximate distance in meters
      const latDiff = Math.abs(startPoint.lat - destPoint.lat);
      const lngDiff = Math.abs(startPoint.lng - destPoint.lng);
      const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
      
      // Adjust padding based on distance
      let padding;
      if (distance < 100) {
        padding = [30, 30];      // Very close — tight zoom
      } else if (distance < 500) {
        padding = [50, 50];      // Close — moderate padding
      } else if (distance < 2000) {
        padding = [80, 80];      // Medium — standard padding
      } else {
        padding = [120, 120];    // Far apart — more padding for context
      }
      
      map.fitBounds(bounds, { padding });
    } 
    // If only start point exists (after reset)
    else if (startPoint && !destPoint) {
      map.flyTo([startPoint.lat, startPoint.lng], 16, { duration: 0.8 });
    }
    
  }, [map, startPoint, destPoint, visible]);
  
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
  route,
  warnings = [],
  activeProfile = "standard",
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

        {/* Smart fit bounds — adjusts zoom based on distance between points */}
        <SmartFitBounds
          startPoint={startPoint}
          destPoint={destPoint}
          visible={markersVisible}
        />

        {/* Click handler — taps within UG bounds set start or destination */}
        <MapClickHandler onMapClick={onMapClick} />

        {/* Pulsing blue dot — user's live GPS location, draggable */}
        <LocationMarker
          location={currentLocation}
          accuracy={accuracy}
          onDragEnd={onLocationDragEnd}
        />

        {/* Computed route line — drawn below the markers */}
        <RouteLayer route={route} visible={markersVisible} />

        {/* START and DEST markers — rendered above the route line */}
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
        route={route}
        warnings={warnings}
        activeProfile={activeProfile}
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