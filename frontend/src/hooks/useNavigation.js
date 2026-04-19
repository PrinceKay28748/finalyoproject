// hooks/useNavigation.js
// Manages navigation tracking and rerouting via Web Worker

import { useState, useEffect, useRef, useCallback } from "react";

export function useNavigation(currentLocation, route, destination, onReroute) {
  const [remainingRoute, setRemainingRoute] = useState(null);
  const [progress, setProgress] = useState(0);
  const [offRoute, setOffRoute] = useState(false);
  const [isActive, setIsActive] = useState(false);
  
  const workerRef = useRef(null);
  const lastLocationRef = useRef(null);

  // Initialize worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL("../workers/navigationWorker.js", import.meta.url),
      { type: "module" }
    );
    
    workerRef.current.onmessage = (e) => {
      const { type, data } = e.data;
      
      switch (type) {
        case 'LOCATION_UPDATE':
          setRemainingRoute(data.remainingRoute);
          setProgress(data.progress);
          setOffRoute(data.offRoute);
          break;
          
        case 'REQUEST_REROUTE':
          if (onReroute && data.currentLocation && data.destination) {
            onReroute(data.currentLocation, data.destination);
          }
          break;
          
        case 'NO_ROUTE_ACTIVE':
        case 'ROUTE_SET':
        case 'ROUTE_CLEARED':
          // Handle as needed
          break;
          
        default:
          break;
      }
    };
    
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [onReroute]);

  // Set route in worker when it changes
  useEffect(() => {
    if (!route || !destination) {
      workerRef.current?.postMessage({ type: 'CLEAR_ROUTE' });
      setIsActive(false);
      return;
    }
    
    workerRef.current?.postMessage({
      type: 'SET_ROUTE',
      data: { route, destination }
    });
    setIsActive(true);
  }, [route, destination]);

  // Send location updates to worker (throttled)
  useEffect(() => {
    if (!isActive || !currentLocation) return;
    
    // Throttle to avoid flooding worker
    if (lastLocationRef.current && 
        Date.now() - lastLocationRef.current < 500) {
      return;
    }
    lastLocationRef.current = Date.now();
    
    workerRef.current?.postMessage({
      type: 'UPDATE_LOCATION',
      data: { location: currentLocation }
    });
  }, [currentLocation, isActive]);

  return {
    remainingRoute,
    progress,
    offRoute,
    isActive
  };
}