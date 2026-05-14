// components/Map/FloatingButtonGroup.jsx
// Apple-style vertical glassmorphism button group (icon-only + tooltip)

import { useState } from 'react';
import './FloatingButtonGroup.css';

const FloatingButtonGroup = ({ buttons }) => {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  return (
    <div className="floating-glass-container">
      {buttons.map((button, index) => (
        <div
          key={index}
          className="floating-glass-item"
          onMouseEnter={() => setHoveredIndex(index)}
          onMouseLeave={() => setHoveredIndex(null)}
          onClick={(e) => {
            e.stopPropagation();
            button.onClick();
            // Haptic feedback on mobile
            if (window.navigator && window.navigator.vibrate) {
              window.navigator.vibrate(10);
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          role="button"
          tabIndex={0}
          aria-label={button.label}
          aria-pressed={button.active}
        >
          <span className={`floating-glass-icon ${button.active ? 'floating-glass-icon--active' : ''}`}>
            {button.icon}
          </span>
          
          {/* Apple-style tooltip */}
          {hoveredIndex === index && (
            <div className="floating-glass-tooltip">
              <span className="tooltip-arrow" />
              {button.label}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default FloatingButtonGroup;