import L from "leaflet";

// Heroicons SVG paths - modern, clean icon set
const heroiconPaths = {
  flag: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M3 3a1 1 0 011-1h12a1 1 0 011 1v13h2V3a3 3 0 00-3-3H4a3 3 0 00-3 3v13h2V3z"/><path d="M3 16h14v5a1 1 0 11-2 0v-3H5v3a1 1 0 11-2 0v-5z"/></svg>',
  mapPin: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M11.54 22.351l.07.04.028.016a.75.75 0 00.723 0l.028-.015.071-.041a60.856 60.856 0 002.6-1.951c2.165-1.73 4.583-4.032 6.332-6.51C21.75 11.561 24 8.531 24 5.75 24 2.468 21.53 0 18.75 0c-1.362 0-2.716.254-3.972.744C12.987.644 12.528.624 12 .624c-.528 0-.987.02-1.778.12B8.22.744A5.975 5.975 0 00 5.25 0C2.47 0 0 2.468 0 5.75c0 2.78 2.25 5.81 3.955 7.793 1.75 2.478 4.168 4.78 6.332 6.51.886.705 1.754 1.393 2.6 1.952.181.127.389.196.598.196s.417-.069.598-.196.898-.517 1.754-1.393 4.168-4.032 6.332-6.51Z"/></svg>',
  checkCircle: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.061l2.25 3.25a.75.75 0 001.19-.102l3.75-5.25z"/></svg>',
  share: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M15 13.5H5.5c-1.1 0-2 .9-2 2v5.5c0 1.1.9 2 2 2h13c1.1 0 2-.9 2-2V15.5c0-1.1-.9-2-2-2zm0 7H5.5v-5.5h13v5.5zM19.5 7h-4.5V2.5H8.5V7H4L12 15l8-8z"/></svg>'
};

// Creates a modern Heroicon marker with label and custom color
export const makeHeroPin = (color, icon, label) =>
  L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.2));">
        <div style="background:${color};color:#fff;font-size:11px;font-weight:700;
          font-family:'Outfit',sans-serif;padding:4px 8px;border-radius:6px;
          margin-bottom:2px;white-space:nowrap;letter-spacing:0.5px;">
          ${label}
        </div>
        <div style="background:${color};border:3px solid #fff;border-radius:50% 50% 50% 0;
          width:32px;height:32px;display:flex;align-items:center;justify-content:center;
          transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.15);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" style="transform:rotate(45deg);filter:drop-shadow(0 1px 1px rgba(0,0,0,0.1));">
            ${icon}
          </svg>
        </div>
      </div>`,
    iconSize: [48, 56],
    iconAnchor: [24, 56],
    popupAnchor: [0, -56],
  });

// Pulsing blue dot with Heroicons map-pin
export const currentLocationIcon = L.divIcon({
  className: "",
  html: `
    <div style="display:flex;align-items:center;justify-content:center;animation:pulse 2s infinite;">
      <div style="position:absolute;width:24px;height:24px;border-radius:50%;background:#2563eb;opacity:0.3;animation:expand 2s infinite;"></div>
      <div style="width:16px;height:16px;background:#2563eb;border-radius:50%;border:3px solid #fff;box-shadow:0 2px 6px rgba(37,99,235,0.4);"></div>
    </div>
    <style>
      @keyframes expand { 0% { width:24px;height:24px;opacity:0.3; } 100% { width:48px;height:48px;opacity:0; } }
      @keyframes pulse { 0%,100% { transform:scale(1); } 50% { transform:scale(1.1); } }
    </style>`,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
});

// Modern green marker with check icon for draggable custom location
export const customLocationIcon = makeHeroPin("#22c55e", heroiconPaths.checkCircle, "");

// Modern purple marker with share icon for shared locations
export const sharedLocationIcon = makeHeroPin("#a855f7", heroiconPaths.share, "SHARED");

// Modern blue START marker with flag icon
export const startIcon = makeHeroPin("#2563eb", heroiconPaths.flag, "START");

// Modern green DEST marker with check icon
export const destIcon = makeHeroPin("#22c55e", heroiconPaths.checkCircle, "DEST");

// Override Leaflet's broken default icon globally
L.Marker.prototype.options.icon = startIcon;