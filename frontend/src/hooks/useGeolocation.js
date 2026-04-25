import { useState, useEffect, useRef, useCallback } from "react";

export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [isLowAccuracy, setIsLowAccuracy] = useState(false);
  
  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);

  const calculateDistance = useCallback((lat1, lng1, lat2, lng2) => {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }, []);

  const calculateHeading = useCallback((lat1, lng1, lat2, lng2) => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      return;
    }

    const options = {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    };

    const handlePosition = (pos) => {
      const { latitude, longitude, accuracy: acc, speed, heading: gpsHeading } = pos.coords;
      const timestamp = pos.timestamp;
      const timeDelta = timestamp - lastUpdateTimeRef.current;
      
      // Only reject extremely bad accuracy (> 500m is unusable)
      if (acc > 500) return;
      
      // Track low accuracy (over 50m) - just store it, no spam logs
      const isLow = acc > 50;
      setIsLowAccuracy(isLow);
      
      // Check for unrealistic jumps (teleporting)
      let isValid = true;
      if (lastPositionRef.current) {
        const distance = calculateDistance(
          latitude, longitude,
          lastPositionRef.current.lat, lastPositionRef.current.lng
        );
        const timeSeconds = timeDelta / 1000;
        // Reject only if moving faster than 10 m/s (36 km/h - unrealistic for walking)
        if (timeSeconds > 0 && distance / timeSeconds > 10) {
          isValid = false;
        }
      }
      
      if (!isValid) return;
      
      // Smooth position slightly to reduce jitter
      let finalLat = latitude;
      let finalLng = longitude;
      if (lastPositionRef.current && timeDelta < 3000) {
        const alpha = 0.3;
        finalLat = lastPositionRef.current.lat + alpha * (latitude - lastPositionRef.current.lat);
        finalLng = lastPositionRef.current.lng + alpha * (longitude - lastPositionRef.current.lng);
      }
      
      // Calculate heading if needed
      let finalHeading = gpsHeading || 0;
      if (lastPositionRef.current && timeDelta > 500 && !gpsHeading) {
        finalHeading = calculateHeading(
          lastPositionRef.current.lat, lastPositionRef.current.lng,
          finalLat, finalLng
        );
      }
      
      // Calculate speed if needed
      let finalSpeed = speed || 0;
      if (lastPositionRef.current && timeDelta > 1000 && !speed) {
        const distance = calculateDistance(
          lastPositionRef.current.lat, lastPositionRef.current.lng,
          finalLat, finalLng
        );
        finalSpeed = distance / (timeDelta / 1000);
      }
      
      setLocation({
        lat: finalLat,
        lng: finalLng,
        heading: finalHeading,
        speed: finalSpeed,
        timestamp: timestamp,
      });
      setAccuracy(Math.round(acc));
      setError(null);
      lastPositionRef.current = { lat: finalLat, lng: finalLng };
      lastUpdateTimeRef.current = timestamp;
    };

    const handleError = (err) => {
      if (!error) setError(err.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      options
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [calculateDistance, calculateHeading, error]);

  return { location, accuracy, error, isLowAccuracy };
}