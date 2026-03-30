// components/Map/RouteLayer.jsx
// Animated route polyline — draws itself progressively like Bolt and Google Maps
// Route color changes based on active profile

import { useEffect, useRef, useState } from "react";
import { Polyline } from "react-leaflet";

const ANIMATION_DURATION_MS = 700;
const ANIMATION_STEPS = 20;

// Profile color mapping
const PROFILE_COLORS = {
  standard:   { main: "#3b82f6", shadow: "#1d4ed8" },
  accessible: { main: "#8b5cf6", shadow: "#6d28d9" },
  night:      { main: "#f59e0b", shadow: "#d97706" },
  fastest:    { main: "#22c55e", shadow: "#15803d" },  // Green
};

export default function RouteLayer({ route, visible = true, profile = "standard" }) {
  const [displayedCoords, setDisplayedCoords] = useState([]);
  const animationRef = useRef(null);
  const prevRouteRef = useRef(null);

  // Get colors for the active profile
  const colors = PROFILE_COLORS[profile] || PROFILE_COLORS.standard;
  const mainColor = colors.main;
  const shadowColor = colors.shadow;

  useEffect(() => {
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }

    if (!visible || !route?.coordinates?.length) {
      setDisplayedCoords([]);
      prevRouteRef.current = null;
      return;
    }

    const coords = route.coordinates.map(c => [c.lat, c.lng]);
    const total = coords.length;

    // Skip re-animation if it's the same route
    const routeKey = `${coords[0]}-${coords[total - 1]}-${total}`;
    if (prevRouteRef.current === routeKey) return;
    prevRouteRef.current = routeKey;

    setDisplayedCoords([]);

    const stepInterval = ANIMATION_DURATION_MS / ANIMATION_STEPS;
    const coordsPerStep = Math.max(1, Math.ceil(total / ANIMATION_STEPS));
    let currentIndex = 0;

    animationRef.current = setInterval(() => {
      currentIndex += coordsPerStep;

      if (currentIndex >= total) {
        setDisplayedCoords(coords);
        clearInterval(animationRef.current);
        animationRef.current = null;
        return;
      }

      setDisplayedCoords(coords.slice(0, currentIndex));
    }, stepInterval);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [route, visible]);

  if (!visible || displayedCoords.length < 2) return null;

  return (
    <>
      {/* Shadow line — gives depth */}
      <Polyline
        positions={displayedCoords}
        color={shadowColor}
        weight={9}
        opacity={0.2}
        smoothFactor={2}
      />
      {/* Main route line */}
      <Polyline
        positions={displayedCoords}
        color={mainColor}
        weight={5}
        opacity={0.95}
        smoothFactor={2}
        lineCap="round"
        lineJoin="round"
      />
    </>
  );
}