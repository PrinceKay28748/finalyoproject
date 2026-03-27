// components/Map/FitBounds.jsx
// Fits map bounds to show start and destination points with smart padding
// Uses useMemo and useEffect to prevent unnecessary re-renders

import { useMap } from "react-leaflet";
import { useEffect, useMemo, useRef } from "react";

export default function FitBounds({ startPoint, destPoint, visible }) {
  const map = useMap();
  const lastFittedRef = useRef(null);

  // Calculate padding based on distance between points
  const getPadding = useMemo(() => {
    if (!startPoint || !destPoint) return [50, 50];
    
    // Calculate approximate distance in meters
    const latDiff = Math.abs(startPoint.lat - destPoint.lat);
    const lngDiff = Math.abs(startPoint.lng - destPoint.lng);
    const distance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000;
    
    // Return padding based on distance
    if (distance < 100) return [30, 30];      // Very close — tight zoom
    if (distance < 500) return [50, 50];      // Close — moderate padding
    if (distance < 2000) return [80, 80];     // Medium — standard padding
    return [120, 120];                        // Far apart — more padding
  }, [startPoint, destPoint]);

  useEffect(() => {
    // Only run if visible and we have points
    if (!visible) return;
    
    // If we have both points, fit to show both
    if (startPoint && destPoint) {
      // Create unique key for this bounds
      const boundsKey = `${startPoint.lat},${startPoint.lng}|${destPoint.lat},${destPoint.lng}`;
      
      // Skip if we already fitted to these exact bounds
      if (lastFittedRef.current === boundsKey) return;
      lastFittedRef.current = boundsKey;
      
      const bounds = [
        [startPoint.lat, startPoint.lng],
        [destPoint.lat, destPoint.lng]
      ];
      
      // Use requestAnimationFrame to avoid blocking
      requestAnimationFrame(() => {
        map.fitBounds(bounds, { padding: getPadding });
      });
    } 
    // If only start point exists (like after reset)
    else if (startPoint && !destPoint) {
      const pointKey = `${startPoint.lat},${startPoint.lng}`;
      if (lastFittedRef.current === pointKey) return;
      lastFittedRef.current = pointKey;
      
      requestAnimationFrame(() => {
        map.flyTo([startPoint.lat, startPoint.lng], 16, { duration: 0.8 });
      });
    }
    
  }, [map, startPoint, destPoint, visible, getPadding]);

  return null;
}