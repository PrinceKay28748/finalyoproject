// components/ui/WeatherIcons.jsx
// Professional SVG weather icons

export const WeatherIcon = ({ type, className = "w-8 h-8" }) => {
  const iconProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.5",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className
  };

  const icons = {
    sun: (
      <svg {...iconProps}>
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
    clouds: (
      <svg {...iconProps}>
        <path d="M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z" />
      </svg>
    ),
    rain: (
      <svg {...iconProps}>
        <path d="M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z" />
        <line x1="8" y1="15" x2="8" y2="19" />
        <line x1="12" y1="15" x2="12" y2="20" />
        <line x1="16" y1="15" x2="16" y2="19" />
      </svg>
    ),
    snow: (
      <svg {...iconProps}>
        <path d="M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z" />
        <line x1="10" y1="15" x2="10" y2="18" />
        <line x1="14" y1="15" x2="14" y2="18" />
        <line x1="8.5" y1="17" x2="11.5" y2="17" />
        <line x1="12.5" y1="17" x2="15.5" y2="17" />
      </svg>
    ),
    storm: (
      <svg {...iconProps}>
        <path d="M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z" />
        <polygon points="12 8 10 13 14 13 12 18" />
      </svg>
    ),
    fog: (
      <svg {...iconProps}>
        <path d="M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z" />
        <line x1="4" y1="16" x2="20" y2="16" />
        <line x1="6" y1="18" x2="18" y2="18" />
      </svg>
    )
  };

  return icons[type] || icons.clouds;
};

export const CalendarIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

export const RefreshIcon = ({ className = "w-4 h-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
  </svg>
);

export const CloseIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);