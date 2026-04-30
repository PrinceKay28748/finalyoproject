// App.jsx
import { useState, useCallback, lazy, Suspense, useEffect, useRef } from "react";
import AuthPage from "./components/Auth/AuthPage";
import { useGeolocation }          from "./hooks/useGeolocation";
import { useRealtimeRoutes, ROUTE_PROFILES } from "./hooks/useRealtimeRoutes";
import { geocode, reverseGeocode } from "./services/geocoding";
import { findNearestNode } from "./services/routing";
import { buildGraph } from "./services/graphBuilder";
import { loadPreferences, savePreferences, loadRouteState, saveRouteState, clearRouteState } from "./services/preferencesStore";
import { logRouteCalculated, logSearch, logLogin } from "./services/analyticsLogger";
import NavPanel                    from "./components/Panel/NavPanel";
import ErrorBoundary              from "./components/ErrorBoundary";
import OfflineIndicator           from "./components/OfflineIndicator";
import ProtectedRoute             from "./components/ProtectedRoute";
import { useAuthContext }         from "./context/AuthContext";
import AdminDashboard             from './components/Admin/AdminDashboard';
import "./index.css";

const MapView = lazy(() => import("./components/Map/MapView"));

function MapLoader() {
  return (
    <div className="map-loader">
      <div className="map-loader-spinner" />
      <p>Loading map...</p>
    </div>
  );
}

export default function App() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuthContext();

  const [startPoint, setStartPoint]           = useState(null);
  const [destPoint, setDestPoint]             = useState(null);
  const [startText, setStartText]             = useState("");
  const [destText, setDestText]               = useState("");
  const [flyTarget, setFlyTarget]             = useState(null);
  const [darkMode, setDarkMode]               = useState(false);
  const [markersVisible, setMarkersVisible]   = useState(false);
  const [waitingForStart, setWaitingForStart] = useState(false);
  const [isResolving, setIsResolving]         = useState(false);
  const [activeProfile, setActiveProfile]     = useState("standard");
  const [vehicleMode, setVehicleMode]         = useState("walk");
  const [lastLoggedRoute, setLastLoggedRoute] = useState(null);

  const [isRouteLocked, setIsRouteLocked] = useState(false);
  const [isNavExpanded, setIsNavExpanded] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const [customStartPoint, setCustomStartPoint]   = useState(null);
  const [useCustomLocation, setUseCustomLocation] = useState(false);
  const [isSharedLocation, setIsSharedLocation]   = useState(false);
  const [isLegendExpanded, setIsLegendExpanded]   = useState(true);

  // Heatmap toggle — persisted in preferences
  const [showHeatmap, setShowHeatmap] = useState(false);

  const [graph, setGraph]               = useState(null);
  const [graphLoading, setGraphLoading] = useState(true);

  const legendCollapseRef = useRef(null);

  const { location: currentLocation, accuracy, error: locationError } = useGeolocation();

  const isAdmin      = user?.is_admin === 1 || user?.is_admin === true;
  const isAdminRoute = window.location.pathname === '/admin';

  // ── Restore route state ──────────────────────────────────────────────────
  useEffect(() => {
    const savedState = loadRouteState();
    if (savedState) {
      if (savedState.startPoint)    setStartPoint(savedState.startPoint);
      if (savedState.destPoint)     setDestPoint(savedState.destPoint);
      if (savedState.startText)     setStartText(savedState.startText);
      if (savedState.destText)      setDestText(savedState.destText);
      if (savedState.markersVisible) setMarkersVisible(savedState.markersVisible);
      if (savedState.activeProfile) setActiveProfile(savedState.activeProfile);
      if (savedState.vehicleMode)   setVehicleMode(savedState.vehicleMode);
      console.log('[App] Restored route state from storage');
    }
    setIsInitialLoad(false);
  }, []);

  // ── Persist route state ──────────────────────────────────────────────────
  useEffect(() => {
    if (isInitialLoad) return;
    saveRouteState({ startPoint, destPoint, startText, destText, markersVisible, activeProfile, vehicleMode });
  }, [startPoint, destPoint, startText, destText, markersVisible, activeProfile, vehicleMode, isInitialLoad]);

  // ── Shared location from URL ─────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const lat    = params.get('lat');
    const lng    = params.get('lng');
    const name   = params.get('name') || "Shared location";

    if (lat && lng) {
      const shared = { lat: parseFloat(lat), lng: parseFloat(lng), name: decodeURIComponent(name) };
      setDestPoint(shared);
      setDestText(shared.name);
      setMarkersVisible(true);
      setIsSharedLocation(true);
      console.log("[App] Shared location loaded:", shared);
    }
  }, []);

  // ── Load graph ───────────────────────────────────────────────────────────
  useEffect(() => {
    console.log("[App] Loading road network graph...");
    setGraphLoading(true);
    buildGraph()
      .then((graphData) => {
        if (graphData && Object.keys(graphData.nodes).length > 0) {
          setGraph(graphData);
          console.log("[App] Graph loaded —", Object.keys(graphData.nodes).length, "nodes");
        } else {
          console.error("[App] Failed to load graph data");
        }
        setGraphLoading(false);
      })
      .catch((err) => {
        console.error("[App] Graph loading error:", err);
        setGraphLoading(false);
      });
  }, []);

  // ── Load preferences ─────────────────────────────────────────────────────
  useEffect(() => {
    loadPreferences()
      .then((prefs) => {
        if (!prefs) return;
        if (prefs.activeProfile)        setActiveProfile(prefs.activeProfile);
        if (prefs.darkMode !== undefined) setDarkMode(prefs.darkMode);
        if (prefs.vehicleMode)          setVehicleMode(prefs.vehicleMode);
        if (prefs.showHeatmap !== undefined) setShowHeatmap(prefs.showHeatmap);
        console.log("[App] Preferences loaded:", prefs);
      })
      .catch((err) => console.warn("[App] Failed to load preferences:", err));
  }, []);

  // ── Log login ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isAuthenticated && user) logLogin();
  }, [isAuthenticated, user]);

  // ── Save preferences (includes heatmap toggle) ───────────────────────────
  useEffect(() => {
    savePreferences({ activeProfile, darkMode, vehicleMode, showHeatmap })
      .catch((err) => console.warn("[App] Failed to save preferences:", err));
  }, [activeProfile, darkMode, vehicleMode, showHeatmap]);

  const effectiveStartPoint = useCustomLocation && customStartPoint ? customStartPoint : startPoint;
  const effectiveStartText  = useCustomLocation && customStartPoint
    ? customStartPoint.name || "Custom location"
    : startText;

  const getNodeId = useCallback((point) => {
    if (!point || !graph) return null;
    if (point.nodeId) return point.nodeId;
    return findNearestNode(graph, point.lat, point.lng);
  }, [graph]);

  const startNodeId = effectiveStartPoint ? getNodeId(effectiveStartPoint) : null;
  const destNodeId  = destPoint           ? getNodeId(destPoint)           : null;

  const {
    primaryRoute,
    alternativeRoutes,
    isLoading: isRouting,
    isRerouting,
    deviationDetected,
    routes,
  } = useRealtimeRoutes({
    graph,
    startNodeId,
    endNodeId:   destNodeId,
    currentLocation,
    activeProfile,
    vehicleMode,
    isActive: markersVisible && !!effectiveStartPoint && !!destPoint,
  });

  // ── Log route ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (markersVisible && primaryRoute && effectiveStartPoint && destPoint) {
      const routeKey = `${effectiveStartPoint.name}-${destPoint.name}-${activeProfile}-${vehicleMode}-${primaryRoute.totalDistanceKm}`;
      if (lastLoggedRoute !== routeKey) {
        setLastLoggedRoute(routeKey);
        logRouteCalculated(
          effectiveStartPoint.name || 'Unknown start',
          destPoint.name || 'Unknown destination',
          activeProfile,
          primaryRoute.totalDistanceKm
        );
      }
    }
  }, [markersVisible, primaryRoute, effectiveStartPoint, destPoint, activeProfile, vehicleMode]);

  const warnings = primaryRoute?.context?.warnings || [];

  // ── Auto-fill FROM with GPS ───────────────────────────────────────────────
  const [hasAutoFilled, setHasAutoFilled] = useState(false);
  if (currentLocation && !hasAutoFilled && !useCustomLocation) {
    setStartPoint(currentLocation);
    setStartText("My current location");
    setHasAutoFilled(true);
  }

  // ── Lock route when active ────────────────────────────────────────────────
  useEffect(() => {
    if (markersVisible && primaryRoute?.coordinates?.length > 0) {
      setIsRouteLocked(true);
    } else {
      setIsRouteLocked(false);
    }
  }, [markersVisible, primaryRoute]);

  const registerLegendCollapse = useCallback((fn) => {
    legendCollapseRef.current = fn;
  }, []);

  const handleNavExpandRequest = useCallback((expanded) => {
    setIsNavExpanded(expanded);
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleUseCurrentLocation = () => {
    if (!currentLocation) return;
    setStartPoint(currentLocation);
    setStartText("My current location");
    setWaitingForStart(false);
    setUseCustomLocation(false);
    setCustomStartPoint(null);
  };

  const handleUseCustomLocation = () => {
    if (!customStartPoint) return;
    setUseCustomLocation(true);
    setWaitingForStart(false);
  };

  const handleStartSelect = (loc) => {
    setStartPoint(loc);
    setStartText(loc.name);
    setWaitingForStart(false);
    setFlyTarget(loc);
    setUseCustomLocation(false);
    setCustomStartPoint(null);
  };

  const handleDestSelect = (loc) => {
    setDestPoint(loc);
    setDestText(loc.name);
    setFlyTarget(loc);
    logSearch(destText, loc.name);
  };

  const handleMapClick = useCallback(async (latlng) => {
    if (isRouteLocked) {
      if (isLegendExpanded && legendCollapseRef.current) {
        legendCollapseRef.current();
        setIsLegendExpanded(false);
      }
      return;
    }

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
      setIsSharedLocation(false);
      setIsNavExpanded(true);
      logSearch(`Map click at ${latlng.lat}, ${latlng.lng}`, name);
    }
  }, [waitingForStart, isRouteLocked, isLegendExpanded]);

  const handleCustomLocationDragEnd = useCallback(async (e) => {
    const { lat, lng } = e.target.getLatLng();
    const name         = await reverseGeocode(lat, lng);
    const dragged      = { lat, lng, name };
    setCustomStartPoint(dragged);
    setUseCustomLocation(true);
    if (!startPoint && startText === "") {
      setStartPoint(dragged);
      setStartText(name);
    }
  }, [startPoint, startText]);

  const handleShowOnMap = async () => {
    setIsResolving(true);
    let resolvedStart = effectiveStartPoint;
    let resolvedDest  = destPoint;

    if (!resolvedStart && effectiveStartText.trim().length > 0) {
      const results = await geocode(effectiveStartText);
      if (results.length > 0) {
        resolvedStart = results[0];
        if (!useCustomLocation) { setStartPoint(results[0]); setStartText(results[0].name); }
        else                    { setCustomStartPoint(results[0]); }
      }
    }

    if (!resolvedDest && destText.trim().length > 0) {
      const results = await geocode(destText);
      if (results.length > 0) {
        resolvedDest = results[0];
        setDestPoint(results[0]);
        setDestText(results[0].name);
        setIsSharedLocation(false);
      }
    }

    setIsResolving(false);

    if (resolvedStart && resolvedDest) {
      setMarkersVisible(true);
      setFlyTarget(resolvedStart);
    }
  };

  const handleSwap = () => {
    if (useCustomLocation && customStartPoint) {
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
    setIsSharedLocation(false);
  };

  const handleReset = () => {
    setDestPoint(null);
    setDestText("");
    setMarkersVisible(false);
    setWaitingForStart(false);
    setUseCustomLocation(false);
    setCustomStartPoint(null);
    setIsSharedLocation(false);
    setIsRouteLocked(false);
    setIsNavExpanded(false);
    clearRouteState();
    console.log("[App] Route cleared");
    if (currentLocation) {
      setStartPoint(currentLocation);
      setStartText("My current location");
      setFlyTarget({ ...currentLocation, _t: Date.now() });
    } else {
      setStartPoint(null);
      setStartText("");
    }
  };

  const handleRecenter = () => {
    if (currentLocation) setFlyTarget({ ...currentLocation, _t: Date.now() });
  };

  const canShow =
    (effectiveStartPoint || effectiveStartText.trim().length > 0) &&
    (destPoint           || destText.trim().length > 0);

  // ── Auth / admin guards ───────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="map-loader">
        <div className="map-loader-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (isAdminRoute) {
    if (!isAuthenticated) return <AuthPage />;
    if (!isAdmin)         { window.location.href = '/'; return null; }
    return <AdminDashboard />;
  }

  return (
    <ProtectedRoute>
      <ErrorBoundary>
        <OfflineIndicator />
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
            locationError={locationError}
            darkMode={darkMode}
            onToggleDarkMode={() => setDarkMode((d) => !d)}
            activeProfile={activeProfile}
            onProfileChange={setActiveProfile}
            vehicleMode={vehicleMode}
            onVehicleModeChange={setVehicleMode}
            isExpanded={isNavExpanded}
            onExpandRequest={handleNavExpandRequest}
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
              primaryRoute={primaryRoute}
              alternativeRoutes={alternativeRoutes}
              allRoutes={routes}
              isRouting={isRouting}
              isRerouting={isRerouting}
              deviationDetected={deviationDetected}
              warnings={warnings}
              activeProfile={activeProfile}
              vehicleMode={vehicleMode}
              useCustomLocation={useCustomLocation}
              isSharedLocation={isSharedLocation}
              isLegendExpanded={isLegendExpanded}
              onLegendExpandedChange={setIsLegendExpanded}
              onProfileChange={setActiveProfile}
              onVehicleModeChange={setVehicleMode}
              onMapClick={handleMapClick}
              onCustomLocationDragEnd={handleCustomLocationDragEnd}
              onRecenter={handleRecenter}
              isRouteLocked={isRouteLocked}
              registerLegendCollapse={registerLegendCollapse}
              showHeatmap={showHeatmap}
              onToggleHeatmap={() => setShowHeatmap(h => !h)}
            />
          </Suspense>
        </div>
      </ErrorBoundary>
    </ProtectedRoute>
  );
}