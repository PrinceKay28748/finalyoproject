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
  
  // Custom location state (green pin)
  const [customStartPoint, setCustomStartPoint] = useState(null);
  const [useCustomLocation, setUseCustomLocation] = useState(false);

  // GPS location from the custom hook
  const { location: currentLocation, accuracy, error: locationError } = useGeolocation();

  // Determine which start point to use for routing
  const effectiveStartPoint = useCustomLocation && customStartPoint ? customStartPoint : startPoint;
  const effectiveStartText = useCustomLocation && customStartPoint 
    ? customStartPoint.name || "Custom location" 
    : startText;

  // Route calculation
  const { route, warnings, isRouting, error: routeError } = useRouting(
    effectiveStartPoint,
    destPoint,
    markersVisible,
    activeProfile
  );

  // Auto-fill FROM with GPS location on first fix
  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  if (currentLocation && !hasAutoFilled && !useCustomLocation) {
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
    setUseCustomLocation(false);  // Switch back to GPS
    setCustomStartPoint(null);
  };

  // Called when user picks "Use custom location" from the FROM dropdown
  const handleUseCustomLocation = () => {
    if (!customStartPoint) return;
    setUseCustomLocation(true);
    setWaitingForStart(false);
  };

  // Called when a start suggestion is selected from search
  const handleStartSelect = (loc) => {
    setStartPoint(loc);
    setStartText(loc.name);
    setWaitingForStart(false);
    setFlyTarget(loc);
    setUseCustomLocation(false);  // Switching to searched location
    setCustomStartPoint(null);
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
      setUseCustomLocation(false);
      setCustomStartPoint(null);
    } else {
      setDestPoint(loc);
      setDestText(name);
    }
  }, [waitingForStart]);

  // Called when user drags the custom green pin
  const handleCustomLocationDragEnd = useCallback(async (e) => {
    const { lat, lng } = e.target.getLatLng();
    const name = await reverseGeocode(lat, lng);
    const draggedLocation = { lat, lng, name };
    
    setCustomStartPoint(draggedLocation);
    setUseCustomLocation(true);
    
    // If no start point set yet, use this as start
    if (!startPoint && startText === "") {
      setStartPoint(draggedLocation);
      setStartText(name);
    }
  }, [startPoint, startText]);

  // Geocodes typed text if user didn't pick from a suggestion, then shows markers
  const handleShowOnMap = async () => {
    setIsResolving(true);
    let resolvedStart = effectiveStartPoint;
    let resolvedDest  = destPoint;

    if (!resolvedStart && effectiveStartText.trim().length > 0) {
      const results = await geocode(effectiveStartText);
      if (results.length > 0) {
        resolvedStart = results[0];
        if (!useCustomLocation) {
          setStartPoint(results[0]);
          setStartText(results[0].name);
        } else {
          setCustomStartPoint(results[0]);
        }
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

  // Swaps start and destination
  const handleSwap = () => {
    if (useCustomLocation && customStartPoint) {
      // Swap custom location with destination
      setDestPoint(customStartPoint);
      setDestText(customStartPoint.name || "Custom location");
      setCustomStartPoint(destPoint);
      setStartPoint(destPoint);
      setStartText(destPoint?.name || "");
      setUseCustomLocation(!!destPoint);
    } else {
      setStartPoint(destPoint);
      setDestPoint(startPoint);
      setStartText(destText);
      setDestText(startText);
      setUseCustomLocation(false);
      setCustomStartPoint(null);
    }
  };

  // Resets destination and route
  const handleReset = () => {
    setDestPoint(null);
    setDestText("");
    setMarkersVisible(false);
    setWaitingForStart(false);
    setUseCustomLocation(false);
    setCustomStartPoint(null);

    if (currentLocation) {
      setStartPoint(currentLocation);
      setStartText("My current location");
      setFlyTarget({ ...currentLocation, _t: Date.now() });
    } else {
      setStartPoint(null);
      setStartText("");
    }
  };

  // Flies the map back to the user's current GPS location
  const handleRecenter = () => {
    if (currentLocation) {
      setFlyTarget({ ...currentLocation, _t: Date.now() });
    }
  };

  const canShow =
    (effectiveStartPoint || effectiveStartText.trim().length > 0) &&
    (destPoint  || destText.trim().length  > 0);

  return (
    <div className={`ug-root${darkMode ? " dark" : ""}`}>
      <NavPanel
        startText={effectiveStartText}
        destText={destText}
        onStartTextChange={setStartText}
        onDestTextChange={setDestText}
        onStartSelect={handleStartSelect}
        onDestSelect={handleDestSelect}
        onUseCurrentLocation={handleUseCurrentLocation}
        onUseCustomLocation={handleUseCustomLocation}
        hasCustomLocation={!!customStartPoint}
        isUsingCustomLocation={useCustomLocation}
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

      <Suspense fallback={<MapLoader />}>
        <MapView
          currentLocation={currentLocation}
          accuracy={accuracy}
          customStartPoint={customStartPoint}
          startPoint={effectiveStartPoint}
          destPoint={destPoint}
          startText={effectiveStartText}
          destText={destText}
          markersVisible={markersVisible}
          flyTarget={flyTarget}
          darkMode={darkMode}
          waitingForStart={waitingForStart}
          route={route}
          isRouteLoading={isRouting}
          warnings={warnings}
          activeProfile={activeProfile}
          useCustomLocation={useCustomLocation}
          onMapClick={handleMapClick}
          onCustomLocationDragEnd={handleCustomLocationDragEnd}
          onRecenter={handleRecenter}
        />
      </Suspense>
    </div>
  );
}