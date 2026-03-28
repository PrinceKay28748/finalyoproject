import L from "leaflet";

// Creates a labelled pin marker in any colour
export const makePin = (color, label) =>
  L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;">
        <div style="background:${color};color:#fff;font-size:10px;font-weight:700;
          font-family:'Outfit',sans-serif;padding:2px 6px;border-radius:4px;
          margin-bottom:3px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);">
          ${label}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="26" height="38">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
            fill="${color}" stroke="#fff" stroke-width="2"/>
          <circle cx="12" cy="12" r="4" fill="#fff"/>
        </svg>
      </div>`,
    iconSize: [60, 58],
    iconAnchor: [30, 58],
    popupAnchor: [0, -58],
  });

// Pulsing blue dot used to represent the user's current GPS location
export const currentLocationIcon = L.divIcon({
  className: "",
  html: `<div class="ug-location-dot"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Custom draggable location marker (green pin) — no label, just a green marker
export const customLocationIcon = L.divIcon({
  className: "",
  html: `
    <div style="display:flex;flex-direction:column;align-items:center;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="26" height="38">
        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24S24 21 24 12C24 5.373 18.627 0 12 0z"
          fill="#22c55e" stroke="#fff" stroke-width="2"/>
        <circle cx="12" cy="12" r="4" fill="#fff"/>
      </svg>
    </div>`,
  iconSize: [26, 38],
  iconAnchor: [13, 38],
  popupAnchor: [0, -38],
});

// Named instances used throughout the app
export const startIcon = makePin("#2563eb", "START");
export const destIcon  = makePin("#22c55e", "DEST");

// Override Leaflet's broken default icon globally
L.Marker.prototype.options.icon = startIcon;