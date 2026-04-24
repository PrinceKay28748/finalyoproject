// components/Map/LocationMarker.jsx
import { Marker, Circle } from "react-leaflet";
import { currentLocationIcon, customLocationIcon } from "../../function/utils/icons";
import L from "leaflet";
import { useState, useEffect } from "react";

// Create pulsing icon based on speed
function createPulsingIcon(speed, heading) {
  // Speed determines pulse intensity (standing still = no pulse, walking = subtle, running = strong)
  const pulseIntensity = Math.min(1, (speed || 0) / 3); // Max pulse at 3 m/s
  
  const pulseClass = pulseIntensity > 0.1 ? `pulse-${Math.floor(pulseIntensity * 10)}` : '';
  
  const iconHtml = currentLocationIcon.options.html || '';
  
  const directionArrow = heading && heading !== 0 ? `
    <div style="
      position: absolute;
      top: -8px;
      left: 50%;
      transform: translateX(-50%) rotate(${heading}deg);
      width: 0;
      height: 0;
      border-left: 6px solid transparent;
      border-right: 6px solid transparent;
      border-bottom: 14px solid #2563eb;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
      animation: ${pulseIntensity > 0 ? 'wiggle 0.5s ease-in-out infinite' : 'none'};
    "></div>
  ` : '';
  
  const speedText = speed && speed > 0.1 ? `
    <div style="
      position: absolute;
      bottom: -20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.7);
      color: white;
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 12px;
      white-space: nowrap;
      font-family: monospace;
    ">
      ${(speed * 3.6).toFixed(1)} km/h
    </div>
  ` : '';
  
  return L.divIcon({
    html: `
      <div class="gps-marker ${pulseClass}" style="position: relative;">
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

// GPS blue dot — with direction and speed indicators
export function GpsLocationMarker({ location, accuracy }) {
  if (!location) return null;

  const hasHeading = location.heading && location.heading !== 0;
  const hasSpeed = location.speed && location.speed > 0;
  
  // Use special icon if we have heading or speed data
  const markerIcon = (hasHeading || hasSpeed)
    ? createPulsingIcon(location.speed, location.heading)
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
            color: "#3b82f6",
            fillColor: "#3b82f6",
            fillOpacity: 0.06 * opacity,
            weight: 1.5,
            opacity: 0.4,
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