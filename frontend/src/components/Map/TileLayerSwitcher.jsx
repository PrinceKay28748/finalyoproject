import { TileLayer } from "react-leaflet";

const TILE_LIGHT = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_DARK  = "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png";

// Switches between OSM light tiles (full building detail) and
// Stadia dark tiles depending on the current colour mode
// Optimized for performance with proper tile loading settings
export default function TileLayerSwitcher({ darkMode }) {
  return (
    <TileLayer
      url={darkMode ? TILE_DARK : TILE_LIGHT}
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      maxZoom={19}
      minZoom={13}
      // Performance optimizations:
      keepBuffer={4}              // Keep more tiles in memory to reduce loading
      updateWhenIdle={true}      // Only update tiles when map is idle
      updateWhenZooming={false}  // Don't update while zooming (reduces load)
      preferCanvas={true}        // Use canvas rendering for better performance
      detectRetina={false}       // Disable retina detection for lower bandwidth
      crossOrigin={false}        // Disable CORS for tiles (faster loading)
    />
  );
}