// components/Map/LocationMarker.jsx
import { Marker, Circle } from "react-leaflet";
import { currentLocationIcon, customLocationIcon } from "../../function/utils/icons";

// GPS blue dot — not draggable, shows accuracy circle
export function GpsLocationMarker({ location, accuracy }) {
  if (!location) return null;

  return (
    <>
      <Marker
        position={[location.lat, location.lng]}
        icon={currentLocationIcon}
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
            fillOpacity: 0.08,
            weight: 1.5,
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