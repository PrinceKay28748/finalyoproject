// components/ui/Icon.jsx
// Heroicon SVG components with proper color support

export const IconMap = ({ className = "w-5 h-5", strokeWidth = 1.5, color = "currentColor" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={strokeWidth} 
    stroke={color}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
  </svg>
);

export const IconAccessibility = ({ className = "w-5 h-5", strokeWidth = 1.5, color = "currentColor" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={strokeWidth} 
    stroke={color}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a1 1 0 1 1 0 2 1 1 0 0 1 0-2zM9 7a1 1 0 0 1 1-1h4a1 1 0 1 1 0 2h-4a1 1 0 0 1-1-1zM8 11a2 2 0 1 0-4 0 2 2 0 0 0 4 0zm12 0a2 2 0 1 0-4 0 2 2 0 0 0 4 0z" />
  </svg>
);

export const IconMoon = ({ className = "w-5 h-5", strokeWidth = 1.5, color = "currentColor" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={strokeWidth} 
    stroke={color}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998z" />
  </svg>
);

export const IconBolt = ({ className = "w-5 h-5", strokeWidth = 1.5, color = "currentColor" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={strokeWidth} 
    stroke={color}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
  </svg>
);

export const IconWalk = ({ className = "w-5 h-5", strokeWidth = 1.5, color = "currentColor" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={strokeWidth} 
    stroke={color}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-2.25 5.25v5.25m0 0v3.75m0-3.75 3.75 3.75m-3.75-3.75-3.75 3.75M9 6.75l1.5 1.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
  </svg>
);

export const IconCar = ({ className = "w-5 h-5", strokeWidth = 1.5, color = "currentColor" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={strokeWidth} 
    stroke={color}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m15 0a1.5 1.5 0 0 1-3 0M3 9.375h18M5.25 14.25h13.5M6 14.25h12m-9.75 0h7.5M4.5 9.375L5.25 18h13.5l.75-8.625M4.5 9.375L6 6.75h12l1.5 2.625" />
  </svg>
);

export const IconRuler = ({ className = "w-5 h-5", strokeWidth = 1.5, color = "currentColor" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={strokeWidth} 
    stroke={color}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v13.5h16.5V3.75H3.75Zm0 0L12 12m-8.25-8.25L12 12m0 0 8.25-8.25M12 12l8.25 8.25M12 12l-8.25 8.25" />
  </svg>
);

export const IconShare = ({ className = "w-5 h-5", strokeWidth = 1.5, color = "currentColor" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={strokeWidth} 
    stroke={color}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
  </svg>
);

export const IconWarning = ({ className = "w-5 h-5", strokeWidth = 1.5, color = "#ef4444" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={strokeWidth} 
    stroke={color}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
  </svg>
);

export const IconInfo = ({ className = "w-5 h-5", strokeWidth = 1.5, color = "#3b82f6" }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    fill="none" 
    viewBox="0 0 24 24" 
    strokeWidth={strokeWidth} 
    stroke={color}
    className={className}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
  </svg>
);