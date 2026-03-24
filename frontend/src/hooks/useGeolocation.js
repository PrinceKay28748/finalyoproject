import { useState, useEffect } from "react";

// Watches the user's GPS position continuously and only updates state
// when a more accurate fix comes in — prevents jumping to a worse location
export function useGeolocation() {
  const [location, setLocation] = useState(null);  // { lat, lng }
  const [accuracy, setAccuracy] = useState(null);  // accuracy in metres
  const [error, setError]       = useState(null);  // error message if GPS fails

  useEffect(() => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    let bestAccuracy = Infinity;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy: acc } = pos.coords;

        // Only accept this fix if it's more accurate than the last one
        if (acc < bestAccuracy) {
          bestAccuracy = acc;
          setLocation({ lat: latitude, lng: longitude });
          setAccuracy(Math.round(acc));
          setError(null);
        }
      },
      (err) => setError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );

    // Clean up the watcher when the component unmounts
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return { location, accuracy, error };
}