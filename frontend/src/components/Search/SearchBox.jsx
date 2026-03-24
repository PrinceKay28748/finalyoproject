import { useState, useEffect, useRef } from "react";
import { geocode } from "../../services/geocoding";
import "./SearchBox.css";

// Search input with live suggestions powered by the geocoding service
// Triggers search after 1 character with a 350ms debounce for performance
export default function SearchBox({
  placeholder,
  value,
  onChange,
  onSelect,
  onUseCurrentLocation,
  showCurrentLocationOption,
  accentColor,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [open, setOpen]               = useState(false);
  const debounceRef                   = useRef(null);
  const wrapRef                       = useRef(null);

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceRef.current);

    if (val.length < 1) {
      setOpen(showCurrentLocationOption);
      setSuggestions([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const results = await geocode(val);
      setSuggestions(results);
      setLoading(false);
      setOpen(true);
    }, 350);
  };

  // Close dropdown when user clicks outside the search box
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const showDropdown = open && (showCurrentLocationOption || suggestions.length > 0 || loading);

  return (
    <div ref={wrapRef} className="search-wrap">
      <div className="search-inner">
        {/* Coloured dot matching the marker colour (blue for start, green for dest) */}
        <div
          className="search-dot"
          style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }}
        />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          className="search-input"
          onMouseEnter={(e) => (e.target.style.borderColor = accentColor)}
          onMouseLeave={(e) => (e.target.style.borderColor = "")}
        />
        {loading && (
          <div
            className="search-spinner"
            style={{ border: `2px solid ${accentColor}`, borderTopColor: "transparent" }}
          />
        )}
      </div>

      {showDropdown && (
        <div className="search-dropdown">

          {/* Use current location option — only shown in the FROM field */}
          {showCurrentLocationOption && (
            <div
              className="search-dropdown-cl"
              onClick={() => { onUseCurrentLocation(); setOpen(false); }}
            >
              <div className="search-dropdown-cl-dot" />
              Use my current location
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="search-dropdown-empty">Searching...</div>
          )}

          {/* Geocoded suggestions */}
          {!loading && suggestions.map((loc, i) => (
            <div
              key={i}
              className="search-dropdown-item"
              onClick={() => { onChange(loc.name); onSelect(loc); setOpen(false); }}
            >
              <svg width="10" height="14" viewBox="0 0 12 16" fill="none" style={{ flexShrink: 0 }}>
                <path d="M6 0C2.686 0 0 2.686 0 6c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6z" fill={accentColor} />
                <circle cx="6" cy="6" r="2" fill="white" />
              </svg>
              <span>{loc.name}</span>
              {/* Distance badge — shown if result is more than 0.5km from UG center */}
              {loc.dist > 0.5 && (
                <span className="search-dropdown-dist">{loc.dist.toFixed(1)}km</span>
              )}
            </div>
          ))}

          {/* No results message */}
          {!loading && suggestions.length === 0 && !showCurrentLocationOption && (
            <div className="search-dropdown-empty">No results — try a different name</div>
          )}
        </div>
      )}
    </div>
  );
}