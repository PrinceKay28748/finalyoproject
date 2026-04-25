// frontend/src/hooks/useGeolocation.js
import { useState, useEffect, useRef } from "react";

export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  
  const watchIdRef = useRef(null);

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

    const handleSuccess = (pos) => {
      const { latitude, longitude, accuracy: acc } = pos.coords;
      
      setLocation({ lat: latitude, lng: longitude });
      setAccuracy(Math.round(acc));
      setError(null);
    };

    const handleError = (err) => {
      setError(err.message);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      options
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  return { location, accuracy, error };
}