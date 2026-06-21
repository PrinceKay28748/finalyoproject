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

// ── Type-specific destination icons (Apple Maps style) ────────────────
const TYPE_SVG = {
  hall:          '<path d="M3 21h18M6 21V7a2 2 0 012-2h8a2 2 0 012 2v14M10 21v-4h4v4"/>',
  academic:      '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  library:       '<path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h12v2H4v-2z"/>',
  gate:          '<path d="M3 21V3h18v18H3z"/><path d="M9 21V9h6v12"/><path d="M3 9h18"/>',
  health:        '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15v-4H6v-2h4V7h2v4h4v2h-4v4h-2z"/>',
  admin:         '<path d="M5 21h14M7 21V5a2 2 0 012 2h6a2 2 0 012 2v12"/>',
  service:       '<path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 4v4h4v2h-4v4h-2v-4H7v-2h4V6h2z"/>',
  food:          '<path d="M12 2C8 2 4 5 4 9c0 2.5 1.5 4.5 3 6l1 5h8l1-5c1.5-1.5 3-3.5 3-6 0-4-4-7-8-7z"/><path d="M9 16h6"/>',
  sport:         '<path d="M18 8a3 3 0 100-6 3 3 0 000 6z"/><path d="M12 12c-2 0-4 1-5 3l-2 5h4l2-4 2 4h4l-2-5c-1-2-3-3-5-3z"/>',
  worship:       '<path d="M12 2L8 10h8L12 2z"/><path d="M5 22l7-8 7 8H5z"/>',
  research:      '<path fill-rule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z"/>',
  landmark:      '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  road:          '<path d="M12 2v20"/><path d="M2 12h20"/><path d="M4 4l16 16"/><path d="M20 4L4 16"/>',
  commercial:    '<path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4H6z"/><path d="M16 10a4 4 0 01-8 0"/>',
  accommodation: '<path d="M3 7v11a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9 5 9-5M3 7l9-5 9 5"/>',
};

const TYPE_COLORS = {
  hall:          "#f59e0b",
  academic:      "#6366f1",
  library:       "#8b5cf6",
  gate:          "#64748b",
  health:        "#ef4444",
  admin:         "#1d4ed8",
  service:       "#f97316",
  food:          "#e11d48",
  sport:         "#10b981",
  worship:       "#d946ef",
  research:      "#0ea5e9",
  landmark:      "#78716c",
  road:          "#a1a1aa",
  commercial:    "#d97706",
  accommodation: "#0891b2",
};

const TYPE_LABELS = {
  hall:          "HALL",
  academic:      "ACADEMIC",
  library:       "LIBRARY",
  gate:          "GATE",
  health:        "HEALTH",
  admin:         "ADMIN",
  service:       "SERVICE",
  food:          "FOOD",
  sport:         "SPORT",
  worship:       "WORSHIP",
  research:      "RESEARCH",
  landmark:      "LANDMARK",
  road:          "ROAD",
  commercial:    "SHOP",
  accommodation: "LODGE",
};

// Animated version that plays a pop-in entrance on every setIcon() call
export const makeAnimatedHeroPin = (color, icon, label) =>
  L.divIcon({
    className: "",
    html: `
      <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.2));">
        <div class="pin-label" style="background:${color};color:#fff;font-size:11px;font-weight:700;
          font-family:'Outfit',sans-serif;padding:4px 8px;border-radius:6px;
          margin-bottom:2px;white-space:nowrap;letter-spacing:0.5px;">
          ${label}
        </div>
        <div class="pin-body" style="background:${color};border:3px solid #fff;border-radius:50% 50% 50% 0;
          width:32px;height:32px;display:flex;align-items:center;justify-content:center;
          transform:rotate(-45deg);box-shadow:0 2px 8px rgba(0,0,0,0.15);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" style="transform:rotate(45deg);filter:drop-shadow(0 1px 1px rgba(0,0,0,0.1));">
            ${icon}
          </svg>
        </div>
      </div>
      <style>
        @keyframes pinPop { 0% { transform:rotate(-45deg) scale(0.3); opacity:0; } 60% { transform:rotate(-45deg) scale(1.15); opacity:1; } 100% { transform:rotate(-45deg) scale(1); opacity:1; } }
        @keyframes labelSlide { 0% { opacity:0; transform:translateY(-6px); } 100% { opacity:1; transform:translateY(0); } }
        .pin-label { animation:labelSlide 0.25s ease-out 0.08s both; }
        .pin-body { animation:pinPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both; }
      </style>`,
    iconSize: [48, 56],
    iconAnchor: [24, 56],
    popupAnchor: [0, -56],
  });

// Pre-built icons for every destination type (animated)
export const typeIconMap = Object.fromEntries(
  Object.keys(TYPE_SVG).map((key) => [
    key,
    makeAnimatedHeroPin(TYPE_COLORS[key], TYPE_SVG[key], TYPE_LABELS[key]),
  ])
);

// Fallback: use the default green DEST pin when type is unknown
export function getDestIcon(type) {
  return typeIconMap[type] || destIcon;
}

// Override Leaflet's broken default icon globally
L.Marker.prototype.options.icon = startIcon;