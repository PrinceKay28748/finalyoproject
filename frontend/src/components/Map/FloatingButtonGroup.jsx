// components/Map/FloatingButtonGroup.jsx
// Apple visionOS/macOS-style grouped glass buttons (icon-only + tooltip)
import { useState, useCallback } from 'react';
import './FloatingButtonGroup.css';

const FloatingButtonGroup = ({ buttons }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const handleClick = useCallback((button) => {
    button.onClick();
    // Haptic feedback on mobile (10ms light tap, Apple-style)
    if (window.navigator?.vibrate) {
      window.navigator.vibrate(10);
    }
  }, []);

  return (
    <div className="floating-glass-container" role="toolbar" aria-label="Map controls">
      {buttons.map((button, index) => (
        <div
          key={index}
          className="floating-glass-item"
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={(e) => {
            e.stopPropagation();
            handleClick(button);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleClick(button);
            }
          }}
          role="button"
          tabIndex={0}
          aria-label={button.label}
          aria-pressed={button.active ?? undefined}
        >
          <span
            className={`floating-glass-icon${button.active ? ' floating-glass-icon--active' : ''}`}
          >
            {button.icon}
          </span>

          {hoveredIndex === index && (
            <div className="floating-glass-tooltip" role="tooltip">
              <span className="tooltip-arrow" aria-hidden="true" />
              {button.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FloatingButtonGroup;