// components/Map/RouteLayer.jsx
// Draws the computed Dijkstra route as a polyline on the map

import { Polyline } from "react-leaflet";

/**
 * Renders the calculated route as a blue line on the map
 * Only renders when visible is true and a valid route exists
 */
export default function RouteLayer({ route, visible = true }) {
  if (!visible || !route?.coordinates?.length) return null;

  // Convert route coordinates to Leaflet [lat, lng] format
  const positions = route.coordinates.map((coord) => [coord.lat, coord.lng]);

  return (
    <Polyline
      positions={positions}
      color="#3b82f6"    // blue — matches the start marker colour
      weight={5}         // thick enough to be clearly visible on the map
      opacity={0.85}
      smoothFactor={1}   // slight simplification for rendering performance
    />
  );
}