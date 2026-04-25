import { useState, useEffect, useRef, useCallback } from "react";

// Optimized geolocation for walking navigation
// Features:
// - Smooth position updates (5 meters minimum movement)
// - Filters out noisy GPS jumps
// - Calculates direction/distance from last position
// - Battery-efficient for walking speeds

export function useGeolocation() {
  const [location, setLocation] = useState(null);  // { lat, lng, heading, speed, timestamp }
  const [accuracy, setAccuracy] = useState(null);  // accuracy in metres
  const [error, setError] = useState(null);
  const [lastPosition, setLastPosition] = useState(null);
  const [isLowAccuracy, setIsLowAccuracy] = useState(false); // NEW: track low accuracy
  
  // Refs to track movement for filtering
  const watchIdRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = useCallback((lat1, lng1, lat2, lng2) => {
    const R = 6371000; // Earth's radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }, []);

  // Calculate bearing between two points (for heading/direction)
  const calculateHeading = useCallback((lat1, lng1, lat2, lng2) => {
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const y = Math.sin(dLng) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
  }, []);

  // Filter out noisy GPS jumps (rejects positions that are unrealistic for walking)
  const isValidMovement = useCallback((newLat, newLng, oldLat, oldLng, timeDelta) => {
    if (!oldLat || !oldLng) return true;
    
    const distance = calculateDistance(oldLat, oldLng, newLat, newLng);
    const timeSeconds = timeDelta / 1000;
    
    // Maximum realistic walking speed: 2.5 m/s (~9 km/h)
    // Maximum running speed: 5 m/s (~18 km/h)
    const maxSpeed = 5.0; // meters per second
    
    if (timeSeconds > 0 && distance / timeSeconds > maxSpeed) {
      console.log(`[Geolocation] Filtered jump: ${(distance / timeSeconds).toFixed(1)} m/s`);
      return false;
    }
    
    // Also filter out positions that haven't moved enough (GPS jitter)
    if (distance < 3 && timeSeconds > 2) {
      return false;
    }
    
    return true;
  }, [calculateDistance]);

  // Smooth position with exponential moving average
  const smoothPosition = useCallback((newLat, newLng, oldLat, oldLng, alpha = 0.3) => {
    if (!oldLat || !oldLng) return { lat: newLat, lng: newLng };
    
    // Exponential moving average for smoother tracking
    return {
      lat: oldLat + alpha * (newLat - oldLat),
      lng: oldLng + alpha * (newLng - oldLng)
    };
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    // Optimized options for walking navigation
    const options = {
      enableHighAccuracy: true,     // Use GPS for better accuracy
      maximumAge: 5000,             // Accept positions up to 5 seconds old
      timeout: 10000,               // Wait 10 seconds for GPS fix
    };

    const handlePosition = (pos) => {
      const { latitude, longitude, accuracy: acc, speed, heading: gpsHeading } = pos.coords;
      const timestamp = pos.timestamp;
      const timeDelta = timestamp - lastUpdateTimeRef.current;
      
      // Reset error counter on success
      consecutiveErrorsRef.current = 0;
      
      // UPDATED: Increased threshold for laptops (Wi-Fi positioning often 100-200m)
      // Also track low accuracy status
      if (acc > 200) {
        console.log(`[Geolocation] Accuracy too poor (${acc}m), ignoring...`);
        return;
      }
      
      // Set low accuracy flag for positions between 50-200m (laptop typical range)
      const isLow = acc > 50;
      setIsLowAccuracy(isLow);
      
      if (isLow) {
        console.log(`[Geolocation] Using low accuracy position (${acc}m) - typical for laptop Wi-Fi positioning`);
      } else {
        console.log(`[Geolocation] Good accuracy (${acc}m) - likely GPS fix`);
      }
      
      // Check if movement is realistic
      let isValid = true;
      if (lastPosition) {
        isValid = isValidMovement(
          latitude, longitude,
          lastPosition.lat, lastPosition.lng,
          timeDelta
        );
      }
      
      if (!isValid) {
        console.log('[Geolocation] Invalid movement detected, ignoring...');
        return;
      }
      
      // Smooth the position to reduce jitter
      let finalLat = latitude;
      let finalLng = longitude;
      
      if (lastPosition && timeDelta < 3000) {
        const smoothed = smoothPosition(latitude, longitude, lastPosition.lat, lastPosition.lng);
        finalLat = smoothed.lat;
        finalLng = smoothed.lng;
      }
      
      // Calculate heading from movement (if GPS heading not available)
      let finalHeading = gpsHeading || 0;
      if (lastPosition && timeDelta > 500) {
        const calculatedHeading = calculateHeading(
          lastPosition.lat, lastPosition.lng,
          finalLat, finalLng
        );
        if (!gpsHeading && calculatedHeading !== undefined) {
          finalHeading = calculatedHeading;
        }
      }
      
      // Calculate movement speed if available
      let finalSpeed = speed || 0;
      if (lastPosition && timeDelta > 1000 && !speed) {
        const distance = calculateDistance(
          lastPosition.lat, lastPosition.lng,
          finalLat, finalLng
        );
        const timeSeconds = timeDelta / 1000;
        finalSpeed = distance / timeSeconds;
      }
      
      // Update state with low accuracy flag
      setLocation({
        lat: finalLat,
        lng: finalLng,
        heading: finalHeading,
        speed: finalSpeed,
        timestamp: timestamp,
        rawAccuracy: acc,
        isLowAccuracy: isLow  // Add flag to location object
      });
      setAccuracy(Math.round(acc));
      setError(null);
      setLastPosition({ lat: finalLat, lng: finalLng });
      lastUpdateTimeRef.current = timestamp;
    };

    const handleError = (err) => {
      consecutiveErrorsRef.current++;
      console.warn('[Geolocation] Error:', err.message);
      
      // Only set error after multiple consecutive failures
      if (consecutiveErrorsRef.current >= 3) {
        setError(err.message);
      }
    };

    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      handlePosition,
      handleError,
      options
    );

    // Clean up
    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [calculateDistance, calculateHeading, isValidMovement, smoothPosition, lastPosition]);

  return { location, accuracy, error, isLowAccuracy }; // NEW: export low accuracy flag
}