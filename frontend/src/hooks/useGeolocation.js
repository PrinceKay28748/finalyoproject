// frontend/src/hooks/useGeolocation.js
import { useState, useEffect, useRef, useCallback } from "react";

export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [error, setError] = useState(null);
  const [permissionState, setPermissionState] = useState("prompt");

  const watchIdRef = useRef(null);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (!navigator.geolocation) return;
    stopWatching();

    const options = { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 };

    const handleSuccess = (pos) => {
      const { latitude, longitude, accuracy: acc } = pos.coords;
      setLocation({ lat: latitude, lng: longitude });
      setAccuracy(Math.round(acc));
      setError(null);
    };

    const handleError = (err) => {
      setError(err.message);
      if (err.code === 1) setPermissionState("denied");
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess, handleError, options
    );
  }, [stopWatching]);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setPermissionState("unsupported");
      return;
    }

    setError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;
        setLocation({ lat: latitude, lng: longitude });
        setAccuracy(Math.round(acc));
        setError(null);
        setPermissionState("granted");
        startWatching();
      },
      (err) => {
        if (err.code === 1) {
          setPermissionState("denied");
          setError("Location access is blocked. Enable location in your browser settings.");
        } else {
          setError(err.message);
        }
        startWatching();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [stopWatching, startWatching]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation not supported");
      setPermissionState("unsupported");
      return;
    }

    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: "geolocation" }).then((status) => {
        setPermissionState(status.state);
        if (status.state === "granted") {
          startWatching();
        } else if (status.state === "prompt") {
          requestLocation();
        }
      }).catch(() => {
        requestLocation();
      });
    } else {
      requestLocation();
    }

    return stopWatching;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { location, accuracy, error, permissionState, requestLocation };
}