import { Marker } from "react-leaflet";
import { startIcon, destIcon, sharedLocationIcon } from "../../function/utils/icons";

// Renders the START and DEST markers on the map
// Only shown after the user presses "Show on Map"
// Shared locations use a purple pin instead of green
export default function RouteMarkers({ startPoint, destPoint, visible, isShared = false }) {
  if (!visible) return null;

  return (
    <>
      {startPoint && (
        <Marker position={[startPoint.lat, startPoint.lng]} icon={startIcon} />
      )}
      {destPoint && (
        <Marker 
          position={[destPoint.lat, destPoint.lng]} 
          icon={isShared ? sharedLocationIcon : destIcon} 
        />
      )}
    </>
  );
}