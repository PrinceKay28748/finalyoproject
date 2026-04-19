// components/Map/RouteLayer.jsx

import { useEffect, useRef, useState } from "react";
import { Polyline } from "react-leaflet";
import { ROUTE_COLORS } from "../../function/utils/colors";
import "./RouteLayer.css";

const ANIMATION_DURATION_MS = 1200; // Slightly longer for smoother effect
const ANIMATION_STEPS = 60; // More steps for smoother drawing

export default function RouteLayer({ route, visible = true, profile = "standard" }) {
  const [displayedCoords, setDisplayedCoords] = useState([]);
  const [isAnimationComplete, setIsAnimationComplete] = useState(false);
  const animationRef = useRef(null);

  const mainColor = ROUTE_COLORS[profile] || ROUTE_COLORS.standard;
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
      setIsAnimationComplete(false);
      return;
    }

    const coords = route.coordinates.map(c => [c.lat, c.lng]);
    const total = coords.length;

    // Start fresh
    setDisplayedCoords([]);
    setIsAnimationComplete(false);

    const stepInterval = ANIMATION_DURATION_MS / ANIMATION_STEPS;
    const coordsPerStep = Math.max(1, Math.ceil(total / ANIMATION_STEPS));
    let currentIndex = 0;

    animationRef.current = setInterval(() => {
      currentIndex += coordsPerStep;
      if (currentIndex >= total) {
        setDisplayedCoords(coords);
        setIsAnimationComplete(true);
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
      {/* Shadow layer - creates depth effect */}
      <Polyline
        positions={displayedCoords}
        color={shadowColor}
        weight={10}
        opacity={0.15}
        smoothFactor={2}
        lineCap="round"
        lineJoin="round"
        className="route-shadow"
      />
      
      {/* Glow/blur layer - modern ambient effect */}
      <Polyline
        positions={displayedCoords}
        color={mainColor}
        weight={14}
        opacity={0.1}
        smoothFactor={2}
        lineCap="round"
        lineJoin="round"
        className="route-glow"
      />
      
      {/* Main route line - bright and smooth */}
      <Polyline
        positions={displayedCoords}
        color={mainColor}
        weight={5}
        opacity={0.95}
        smoothFactor={2}
        lineCap="round"
        lineJoin="round"
        className={isAnimationComplete ? "route-main route-complete" : "route-main route-animating"}
      />
    </>
  );
}