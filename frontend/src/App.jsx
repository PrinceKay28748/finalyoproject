import { useState, useCallback } from "react";
import { useGeolocation }  from "./hooks/useGeolocation";
import { geocode, reverseGeocode } from "./services/geocoding";
import NavPanel from "./components/Panel/NavPanel";
import MapView  from "./components/Map/MapView";
import "./index.css";

// App is the root component — it owns all state and passes down only what
// each child needs. No child manages state that belongs to the app level.
export default function App() {
  const [startPoint, setStartPoint]         = useState(null);   // resolved start location
  const [destPoint, setDestPoint]           = useState(null);   // resolved destination
  const [startText, setStartText]           = useState("");     // start input text
  const [destText, setDestText]             = useState("");     // destination input text
  const [flyTarget, setFlyTarget]           = useState(null);   // triggers map fly-to
  const [darkMode, setDarkMode]             = useState(false);  // dark/light toggle
  const [markersVisible, setMarkersVisible] = useState(false);  // show markers on map
  const [waitingForStart, setWaitingForStart] = useState(false);// pin-start tap mode
  const [isResolving, setIsResolving]       = useState(false);  // geocoding in progress

  // GPS location and accuracy from the custom hook
  const { location: currentLocation, accuracy, error: locationError } = useGeolocation();

  // Auto-fill FROM with current location when GPS first resolves
  // This runs only when currentLocation changes from null to a value
  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  if (currentLocation && !hasAutoFilled) {
    setStartPoint(currentLocation);
    setStartText("My current location");
    setHasAutoFilled(true);
  }

  // Called when user picks "Use my current location" from the FROM dropdown
  const handleUseCurrentLocation = () => {
    if (!currentLocation) return;
    setStartPoint(currentLocation);
    setStartText("My current location");
    setWaitingForStart(false);
  };

  // Called when a start suggestion is selected from the search dropdown
  const handleStartSelect = (loc) => {
    setStartPoint(loc);
    setStartText(loc.name);
    setWaitingForStart(false);
    setFlyTarget(loc);
  };

  // Called when a destination suggestion is selected from the search dropdown
  const handleDestSelect = (loc) => {
    setDestPoint(loc);
    setDestText(loc.name);
    setFlyTarget(loc);
  };

  // Called when user taps the map — sets start or destination based on active mode
  const handleMapClick = useCallback(async (latlng) => {
    const name = await reverseGeocode(latlng.lat, latlng.lng);
    const loc  = { lat: latlng.lat, lng: latlng.lng, name };
    if (waitingForStart) {
      setStartPoint(loc);
      setStartText(name);
      setWaitingForStart(false);
    } else {
      // Default tap always sets destination
      setDestPoint(loc);
      setDestText(name);
    }
  }, [waitingForStart]);

  // Called when user drags the pulsing GPS dot to correct their location
  const handleLocationDragEnd = useCallback(async (e) => {
    const { lat, lng } = e.target.getLatLng();
    const name = await reverseGeocode(lat, lng);
    // If FROM is still set to "My current location", update it to match the drag
    if (startText === "My current location") {
      setStartPoint({ lat, lng, name });
      setStartText(name);
    }
  }, [startText]);

  // Geocodes typed text if user didn't pick from a suggestion, then shows markers
  const handleShowOnMap = async () => {
    setIsResolving(true);
    let resolvedStart = startPoint;
    let resolvedDest  = destPoint;

    if (!resolvedStart && startText.trim().length > 0) {
      const results = await geocode(startText);
      if (results.length > 0) {
        resolvedStart = results[0];
        setStartPoint(results[0]);
        setStartText(results[0].name);
      }
    }

    if (!resolvedDest && destText.trim().length > 0) {
      const results = await geocode(destText);
      if (results.length > 0) {
        resolvedDest = results[0];
        setDestPoint(results[0]);
        setDestText(results[0].name);
      }
    }

    setIsResolving(false);

    if (resolvedStart && resolvedDest) {
      setMarkersVisible(true);
      setFlyTarget(resolvedStart);
    }
  };

  // Swaps start and destination — both text and resolved points
  const handleSwap = () => {
    setStartPoint(destPoint);
    setDestPoint(startPoint);
    setStartText(destText);
    setDestText(startText);
  };

  // Resets destination and markers — restores current location to FROM if available
  const handleReset = () => {
    setDestPoint(null);
    setDestText("");
    setFlyTarget(null);
    setMarkersVisible(false);
    setWaitingForStart(false);
    if (currentLocation) {
      setStartPoint(currentLocation);
      setStartText("My current location");
    } else {
      setStartPoint(null);
      setStartText("");
    }
  };

  // Flies the map back to the user's current GPS location
  const handleRecenter = () => {
    if (currentLocation) setFlyTarget({ ...currentLocation, _t: Date.now() });
  };

  // Show on Map button is enabled if both fields have text or resolved points
  const canShow =
    (startPoint || startText.trim().length > 0) &&
    (destPoint  || destText.trim().length  > 0);

  return (
    <div className={`ug-root${darkMode ? " dark" : ""}`}>

      {/* Top panel — search, actions, status */}
      <NavPanel
        startText={startText}
        destText={destText}
        onStartTextChange={setStartText}
        onDestTextChange={setDestText}
        onStartSelect={handleStartSelect}
        onDestSelect={handleDestSelect}
        onUseCurrentLocation={handleUseCurrentLocation}
        onSwap={handleSwap}
        onShowOnMap={handleShowOnMap}
        onReset={handleReset}
        hasCurrentLocation={!!currentLocation}
        canShow={canShow}
        isResolving={isResolving}
        markersVisible={markersVisible}
        accuracy={accuracy}
        locationError={locationError}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
      />

      {/* Map — tiles, markers, click handling, legend */}
      <MapView
        currentLocation={currentLocation}
        accuracy={accuracy}
        startPoint={startPoint}
        destPoint={destPoint}
        startText={startText}
        destText={destText}
        markersVisible={markersVisible}
        flyTarget={flyTarget}
        darkMode={darkMode}
        waitingForStart={waitingForStart}
        onMapClick={handleMapClick}
        onLocationDragEnd={handleLocationDragEnd}
        onRecenter={handleRecenter}
      />
    </div>
  );
}