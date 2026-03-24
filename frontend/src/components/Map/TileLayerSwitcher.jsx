import { TileLayer } from "react-leaflet";

const TILE_LIGHT = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const TILE_DARK  = "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png";

// Switches between OSM light tiles (full building detail) and
// Stadia dark tiles depending on the current colour mode
export default function TileLayerSwitcher({ darkMode }) {
  return <TileLayer url={darkMode ? TILE_DARK : TILE_LIGHT} />;
}