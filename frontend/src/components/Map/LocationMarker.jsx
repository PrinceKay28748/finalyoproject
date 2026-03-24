import { Marker, Circle } from "react-leaflet";
import { currentLocationIcon } from "../../function/utils/icons";

// Renders the user's current GPS location as a pulsing blue dot
// The dot is draggable so users can manually correct an inaccurate GPS fix
// The accuracy circle shows the GPS uncertainty radius
export default function LocationMarker({ location, accuracy, onDragEnd }) {
  if (!location) return null;

  return (
    <>
      <Marker
        position={[location.lat, location.lng]}
        icon={currentLocationIcon}
        draggable={true}
        zIndexOffset={1000}
        eventHandlers={{ dragend: onDragEnd }}
      />
      <Circle
        center={[location.lat, location.lng]}
        radius={accuracy || 30}
        pathOptions={{
          color: "#2563eb",
          fillColor: "#2563eb",
          fillOpacity: 0.1,
          weight: 1.5,
        }}
      />
    </>
  );
}