// App.jsx
import { useState, useCallback, lazy, Suspense } from "react";
import { useGeolocation }          from "./hooks/useGeolocation";
import { useRouting }              from "./hooks/useRouting";
import { geocode, reverseGeocode } from "./services/geocoding";
import NavPanel                    from "./components/Panel/NavPanel";
import "./index.css";

// Lazy load the map — reduces initial bundle, map only loads when needed
const MapView = lazy(() => import("./components/Map/MapView"));

// Loading fallback shown while MapView chunk is downloading
function MapLoader() {
  return (
    <div className="map-loader">
      <div className="map-loader-spinner" />
      <p>Loading map...</p>
    </div>
  );
}

// App owns all state and passes only what each child needs
// No child manages state that belongs at the app level
export default function App() {
  const [startPoint, setStartPoint]           = useState(null);   // resolved start location
  const [destPoint, setDestPoint]             = useState(null);   // resolved destination
  const [startText, setStartText]             = useState("");     // start input text
  const [destText, setDestText]               = useState("");     // destination input text
  const [flyTarget, setFlyTarget]             = useState(null);   // triggers map fly-to
  const [darkMode, setDarkMode]               = useState(false);  // dark/light toggle
  const [markersVisible, setMarkersVisible]   = useState(false);  // show markers + route
  const [waitingForStart, setWaitingForStart] = useState(false);  // pin-start tap mode
  const [isResolving, setIsResolving]         = useState(false);  // geocoding in progress
  const [activeProfile, setActiveProfile]     = useState("standard"); // routing profile

  // GPS location from the custom hook
  const { location: currentLocation, accuracy, error: locationError } = useGeolocation();

  // Route calculation — graph preloads silently, worker runs Dijkstra off main thread
  const { route, warnings, isRouting, error: routeError } = useRouting(
    startPoint,
    destPoint,
    markersVisible,
    activeProfile
  );

  // Auto-fill FROM with GPS location on first fix — runs inline to avoid extra effect
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

  // Called when a start suggestion is selected from search
  const handleStartSelect = (loc) => {
    setStartPoint(loc);
    setStartText(loc.name);
    setWaitingForStart(false);
    setFlyTarget(loc);
  };

  // Called when a destination suggestion is selected from search
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

  // Called when user drags the GPS dot to correct their location
  const handleLocationDragEnd = useCallback(async (e) => {
    const { lat, lng } = e.target.getLatLng();
    const name = await reverseGeocode(lat, lng);
    // Only update FROM if it was still showing "My current location"
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

  // Resets destination and route — restores current location to FROM if available
  const handleReset = () => {
    setDestPoint(null);
    setDestText("");
    setMarkersVisible(false);
    setWaitingForStart(false);

    if (currentLocation) {
      setStartPoint(currentLocation);
      setStartText("My current location");
      setFlyTarget({ ...currentLocation, _t: Date.now() }); // fly back to user
    } else {
      setStartPoint(null);
      setStartText("");
    }
  };

  // Flies the map back to the user's current GPS location
  const handleRecenter = () => {
    if (currentLocation) setFlyTarget({ ...currentLocation, _t: Date.now() });
  };

  // Show on Map button enabled when both fields have text or resolved points
  const canShow =
    (startPoint || startText.trim().length > 0) &&
    (destPoint  || destText.trim().length  > 0);

  return (
    <div className={`ug-root${darkMode ? " dark" : ""}`}>

      {/* Top panel — search, profile selector, actions, status */}
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
        isResolving={isResolving || isRouting}
        markersVisible={markersVisible}
        accuracy={accuracy}
        locationError={locationError || routeError}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode((d) => !d)}
        activeProfile={activeProfile}
        onProfileChange={setActiveProfile}
      />

      {/* Map — lazy loaded, shows spinner while chunk downloads */}
      <Suspense fallback={<MapLoader />}>
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
          route={route}
          isRouteLoading={isRouting}
          warnings={warnings}
          activeProfile={activeProfile}
          onMapClick={handleMapClick}
          onLocationDragEnd={handleLocationDragEnd}
          onRecenter={handleRecenter}
        />
      </Suspense>
    </div>
  );
}