// components/Map/LocationMarker.jsx
import { Marker, Circle } from "react-leaflet";
import { currentLocationIcon, customLocationIcon } from "../../function/utils/icons";
import L from "leaflet";

// Create pulsing icon with direction arrow (derived from route)
function createPulsingIcon(speed, heading, isLowAccuracy = false, routeDirection = null) {
  // Use route direction if available (snapped to route), otherwise use GPS heading
  const finalHeading = routeDirection !== null ? routeDirection : (heading || 0);
  
  // Speed determines pulse intensity
  const pulseIntensity = Math.min(1, (speed || 0) / 3);
  
  const pulseClass = pulseIntensity > 0.1 ? `pulse-${Math.floor(pulseIntensity * 10)}` : '';
  
  // Orange for low accuracy, blue for good accuracy
  const arrowColor = isLowAccuracy ? "#f59e0b" : "#2563eb";
  const shadowColor = isLowAccuracy ? "rgba(245, 158, 11, 0.3)" : "rgba(37, 99, 235, 0.3)";
  const dotColor = isLowAccuracy ? "#f59e0b" : "#2563eb";
  
  const iconHtml = currentLocationIcon.options.html || '';
  
  // Direction arrow - rotates to match route direction
  const directionArrow = finalHeading && finalHeading !== 0 ? `
    <div style="
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%) rotate(${finalHeading}deg);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 14px solid ${arrowColor};
      filter: drop-shadow(0 2px 4px ${shadowColor});
      animation: ${pulseIntensity > 0 ? 'arrowWiggle 0.5s ease-in-out infinite' : 'none'};
    "></div>
  ` : '';
  
  // Pulsing ring effect
  const pulseRing = `
    <div style="
      position: absolute;
      top: 50%;
      left: 50%;
      width: 40px;
      height: 40px;
      margin-left: -20px;
      margin-top: -20px;
      border-radius: 50%;
      background: radial-gradient(circle, ${dotColor}20 0%, ${dotColor}08 70%, transparent 100%);
      animation: pulseRing 1.5s ease-out infinite;
      pointer-events: none;
    "></div>
  `;
  
  const speedText = speed && speed > 0.1 ? `
    <div style="
      position: absolute;
      bottom: -22px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.75);
      color: white;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 20px;
      white-space: nowrap;
      font-family: monospace;
      backdrop-filter: blur(4px);
      letter-spacing: 0.5px;
    ">
      ${(speed * 3.6).toFixed(1)} km/h
    </div>
  ` : '';
  
  return L.divIcon({
    html: `
      <div class="gps-marker ${pulseClass}" style="position: relative;">
        ${pulseRing}
        ${iconHtml}
        ${directionArrow}
        ${speedText}
      </div>
    `,
    className: "custom-direction-icon",
    iconSize: [24, 36],
    iconAnchor: [12, 36],
    popupAnchor: [0, -36]
  });
}

// GPS marker — color changes based on accuracy, snaps to route direction
export function GpsLocationMarker({ location, accuracy, isLowAccuracy = false, routeDirection = null }) {
  if (!location) return null;

  const hasHeading = location.heading && location.heading !== 0;
  const hasSpeed = location.speed && location.speed > 0;
  
  // Orange for low accuracy, blue for good accuracy
  const markerColor = isLowAccuracy ? "#f59e0b" : "#2563eb";
  
  // Pass routeDirection to the icon creator (for arrow alignment)
  const markerIcon = (hasHeading || hasSpeed)
    ? createPulsingIcon(location.speed, location.heading, isLowAccuracy, routeDirection)
    : currentLocationIcon;

  // Calculate opacity based on accuracy
  const opacity = accuracy ? Math.max(0.5, Math.min(1, 30 / accuracy)) : 0.8;

  return (
    <>
      <Marker
        position={[location.lat, location.lng]}
        icon={markerIcon}
        draggable={false}
        zIndexOffset={1000}
      />
      {accuracy && (
        <Circle
          center={[location.lat, location.lng]}
          radius={accuracy}
          pathOptions={{
            color: markerColor,
            fillColor: markerColor,
            fillOpacity: 0.06 * opacity,
            weight: 1.5,
            opacity: 0.4,
            dashArray: isLowAccuracy ? "5, 5" : undefined, // Dashed circle for low accuracy
          }}
        />
      )}
    </>
  );
}

// Custom green pin — draggable, used as custom start point
export function CustomLocationMarker({ location, onDragEnd, visible = true }) {
  if (!location || !visible) return null;

  return (
    <Marker
      position={[location.lat, location.lng]}
      icon={customLocationIcon}
      draggable={true}
      zIndexOffset={1000}
      eventHandlers={{ dragend: onDragEnd }}
    />
  );
}