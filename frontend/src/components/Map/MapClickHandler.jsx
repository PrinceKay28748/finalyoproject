import { useMapEvents } from "react-leaflet";
import { UG_BOUNDS } from "../../function/utils/bounds";

// Listens for clicks on the map and calls onMapClick only if the
// click falls within the UG community boundary
export default function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (!UG_BOUNDS.contains(e.latlng)) return;
      onMapClick(e.latlng);
    },
  });

  // This component handles events only — it renders nothing
  return null;
}