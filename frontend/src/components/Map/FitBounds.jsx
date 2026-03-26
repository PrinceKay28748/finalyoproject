// components/Map/FitBounds.jsx
// Automatically fits the map view to contain both route points with padding
// Triggers whenever the route or visible state changes

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

export default function FitBounds({ startPoint, destPoint, visible }) {
  const map = useMap();

  useEffect(() => {
    // Only fit bounds when both points are set and markers are visible
    if (!visible || !startPoint || !destPoint) return;

    const bounds = L.latLngBounds(
      [startPoint.lat, startPoint.lng],
      [destPoint.lat,  destPoint.lng]
    );

    // Pad generously so markers don't sit on the edge
    // Also accounts for the NavPanel at the top and Legend sheet at the bottom
    map.fitBounds(bounds, {
      paddingTopLeft:     [40, 140],
      paddingBottomRight: [40, 180],
      maxZoom:            15,        // comfortable zoom — shows route with surrounding context
      animate:            true,
      duration:           0.8,
    });
  }, [startPoint, destPoint, visible, map]);

  return null;
}