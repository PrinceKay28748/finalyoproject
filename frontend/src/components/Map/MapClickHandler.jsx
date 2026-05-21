import { useMapEvents } from "react-leaflet";
import { useFocus } from "../../context/FocusContext";
import { UG_BOUNDS } from "../../function/utils/bounds";

// Listens for clicks on the map and calls onMapClick only if the
// click falls within the UG community boundary
export default function MapClickHandler({ onMapClick }) {
  const focus = useFocus();

  useMapEvents({
    click(e) {
      if (!UG_BOUNDS.contains(e.latlng)) return;
      // Clear focus when clicking empty map area
      focus.clearFocus();
      onMapClick(e.latlng);
    },
  });

  // This component handles events only — it renders nothing
  return null;
}