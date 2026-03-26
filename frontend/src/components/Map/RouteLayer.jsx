// // components/Map/RouteLayer.jsx
// // Draws the computed route as an animated polyline
// // The line progressively reveals itself from start to destination
// // mimicking the drawing animation in Bolt and Google Maps

// import { useEffect, useRef, useState } from "react";
// import { Polyline, useMap }            from "react-leaflet";

// // How many milliseconds the full draw animation takes
// const ANIMATION_DURATION_MS = 800;

// // Number of steps in the animation — more steps = smoother but heavier
// const ANIMATION_STEPS = 60;

// export default function RouteLayer({ route, visible = true }) {
//   const map                           = useMap();
//   const [displayedCoords, setDisplayedCoords] = useState([]);
//   const animationRef                  = useRef(null);
//   const prevRouteRef                  = useRef(null);

//   useEffect(() => {
//     // Clear any running animation
//     if (animationRef.current) {
//       clearInterval(animationRef.current);
//       animationRef.current = null;
//     }

//     // Nothing to draw
//     if (!visible || !route?.coordinates?.length) {
//       setDisplayedCoords([]);
//       prevRouteRef.current = null;
//       return;
//     }

//     const coords = route.coordinates.map(c => [c.lat, c.lng]);
//     const total  = coords.length;

//     // If it's the same route (e.g. profile changed but same path) skip re-animation
//     const routeKey = `${coords[0]}-${coords[total - 1]}-${total}`;
//     if (prevRouteRef.current === routeKey) return;
//     prevRouteRef.current = routeKey;

//     // Reset to empty so the animation starts from scratch
//     setDisplayedCoords([]);

//     // Step interval in ms
//     const stepInterval = ANIMATION_DURATION_MS / ANIMATION_STEPS;
//     // How many coordinates to reveal per step
//     const coordsPerStep = Math.max(1, Math.ceil(total / ANIMATION_STEPS));

//     let currentIndex = 0;

//     animationRef.current = setInterval(() => {
//       currentIndex += coordsPerStep;

//       if (currentIndex >= total) {
//         // Reveal all remaining coordinates and stop
//         setDisplayedCoords(coords);
//         clearInterval(animationRef.current);
//         animationRef.current = null;
//         return;
//       }

//       setDisplayedCoords(coords.slice(0, currentIndex));
//     }, stepInterval);

//     // Clean up interval on unmount or route change
//     return () => {
//       if (animationRef.current) {
//         clearInterval(animationRef.current);
//         animationRef.current = null;
//       }
//     };
//   }, [route, visible]);

//   if (!visible || displayedCoords.length < 2) return null;

//   return (
//     <>
//       {/* Shadow line — slightly wider, semi-transparent, gives depth */}
//       <Polyline
//         positions={displayedCoords}
//         color="#1d4ed8"
//         weight={9}
//         opacity={0.15}
//         smoothFactor={1}
//       />

//       {/* Main route line */}
//       <Polyline
//         positions={displayedCoords}
//         color="#3b82f6"
//         weight={5}
//         opacity={0.92}
//         smoothFactor={1}
//         lineCap="round"
//         lineJoin="round"
//       />
//     </>
//   );
// }

// components/Map/RouteLayer.jsx
// Animated route polyline — draws itself progressively like Bolt and Google Maps
// Reduced to 20 animation steps (from 60) to cut re-renders by 3x

import { useEffect, useRef, useState } from "react";
import { Polyline, useMap }            from "react-leaflet";

const ANIMATION_DURATION_MS = 700;
const ANIMATION_STEPS       = 20;  // reduced from 60 — same visual effect, 3x fewer renders

export default function RouteLayer({ route, visible = true }) {
  const [displayedCoords, setDisplayedCoords] = useState([]);
  const animationRef                          = useRef(null);
  const prevRouteRef                          = useRef(null);

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
    const total  = coords.length;

    // Skip re-animation if it's the same route
    const routeKey = `${coords[0]}-${coords[total - 1]}-${total}`;
    if (prevRouteRef.current === routeKey) return;
    prevRouteRef.current = routeKey;

    setDisplayedCoords([]);

    const stepInterval  = ANIMATION_DURATION_MS / ANIMATION_STEPS;
    const coordsPerStep = Math.max(1, Math.ceil(total / ANIMATION_STEPS));
    let currentIndex    = 0;

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
      {/* Shadow line — gives depth like Bolt/Google Maps */}
      <Polyline
        positions={displayedCoords}
        color="#1d4ed8"
        weight={9}
        opacity={0.15}
        smoothFactor={2}
      />
      {/* Main route line */}
      <Polyline
        positions={displayedCoords}
        color="#3b82f6"
        weight={5}
        opacity={0.92}
        smoothFactor={2}
        lineCap="round"
        lineJoin="round"
      />
    </>
  );
}