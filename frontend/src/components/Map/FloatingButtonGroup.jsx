// components/Map/FloatingButtonGroup.jsx
// iOS-style vertical glassmorphism button group
import { useState } from 'react';
import './FloatingButtonGroup.css';

const FloatingButtonGroup = ({ buttons }) => {
  const [activeIndex, setActiveIndex] = useState(null);

  return (
    <div className="floating-button-group">
      {buttons.map((button, index) => (
        <button
          key={index}
          className={`floating-btn ${button.active ? 'floating-btn--active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setActiveIndex(index);
            button.onClick();
            setTimeout(() => setActiveIndex(null), 150);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          title={button.label}
          aria-label={button.label}
          aria-pressed={button.active}
        >
          <span className="floating-btn-icon">{button.icon}</span>
          <span className="floating-btn-label">{button.label}</span>
        </button>
      ))}
    </div>
  );
};

export default FloatingButtonGroup;