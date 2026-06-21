import { TileLayer } from "react-leaflet";

const TILE_URLS = {
  standard: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
  dark: "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png",
  cycle: "https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png",
  transport: "https://tile.memomaps.de/tilegen/{z}/{x}/{y}.png",
  humanitarian: "https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png",
};

const TILE_ATTRS = {
  standard: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  dark: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://stadiamaps.com/">Stadia Maps</a>',
  cycle: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://cyclosm.org">CycleOSM</a>',
  transport: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://memomaps.de/">MenoMaps</a>',
  humanitarian: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://www.openstreetmap.fr/">OpenStreetMap France</a>',
};

export default function TileLayerSwitcher({ layer, darkMode }) {
  // Backward compatibility: if darkMode is passed (legacy Map.jsx), map to layer
  const resolved = darkMode !== undefined ? (darkMode ? "dark" : "standard") : (layer || "standard");
  const url = TILE_URLS[resolved] || TILE_URLS.standard;
  const attr = TILE_ATTRS[resolved] || TILE_ATTRS.standard;

  return (
    <TileLayer
      url={url}
      attribution={attr}
      maxZoom={19}
      minZoom={13}
      keepBuffer={4}
      updateWhenIdle={true}
      updateWhenZooming={false}
      preferCanvas={true}
      detectRetina={false}
      crossOrigin={false}
    />
  );
}