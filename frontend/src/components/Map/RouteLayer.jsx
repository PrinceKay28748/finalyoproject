// components/Map/RouteLayer.jsx

import { useEffect, useRef, useState } from "react";
import { Polyline } from "react-leaflet";

const ANIMATION_DURATION_MS = 700;
const ANIMATION_STEPS = 20;

// Profile colors
const PROFILE_COLORS = {
  standard:   "#3b82f6",
  accessible: "#8b5cf6",
  night:      "#f59e0b",
  fastest:    "#22c55e",
};

export default function RouteLayer({ route, visible = true, profile = "standard" }) {
  const [displayedCoords, setDisplayedCoords] = useState([]);
  const animationRef = useRef(null);

  const mainColor = PROFILE_COLORS[profile] || PROFILE_COLORS.standard;
  const shadowColor = mainColor;

  // Force animation on every render where route changes OR profile changes
  useEffect(() => {
    // Kill any existing animation
    if (animationRef.current) {
      clearInterval(animationRef.current);
      animationRef.current = null;
    }

    if (!visible || !route?.coordinates?.length) {
      setDisplayedCoords([]);
      return;
    }

    const coords = route.coordinates.map(c => [c.lat, c.lng]);
    const total = coords.length;

    // Start fresh
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
      } else {
        setDisplayedCoords(coords.slice(0, currentIndex));
      }
    }, stepInterval);

    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
        animationRef.current = null;
      }
    };
  }, [route, visible, profile]); // ← profile is in deps, so it re-runs on profile change

  if (!visible || displayedCoords.length < 2) return null;

  return (
    <>
      <Polyline
        positions={displayedCoords}
        color={shadowColor}
        weight={9}
        opacity={0.2}
        smoothFactor={2}
      />
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