import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { geocode } from "../../services/geocoding";
import { saveRecentSearch, getRecentSearches, clearRecentSearches } from "../../services/recentSearches";
import "./SearchBox.css";

export default function PortalSearchBox({
  placeholder,
  value,
  onChange,
  onSelect,
  onUseCurrentLocation,
  showCurrentLocationOption,
  accentColor,
  onFocus,
}) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Load recent searches
  useEffect(() => {
    setRecentSearches(getRecentSearches());
    
    const handleUpdate = () => {
      setRecentSearches(getRecentSearches());
    };
    window.addEventListener("recentSearchesUpdated", handleUpdate);
    return () => window.removeEventListener("recentSearchesUpdated", handleUpdate);
  }, []);

  // Update dropdown position
  const updatePosition = () => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX,
        width: rect.width
      });
    }
  };

  useEffect(() => {
    if (showDropdown) {
      updatePosition();
      window.addEventListener("scroll", updatePosition);
      window.addEventListener("resize", updatePosition);
    }
    return () => {
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [showDropdown]);

  const handleInputClick = () => {
    setShowDropdown(true);
    if (onFocus) onFocus();
  };

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    clearTimeout(debounceRef.current);

    if (val.length < 1) {
      setShowDropdown(true);
      setSuggestions([]);
      return;
    }

    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await geocode(val);
        setSuggestions(results);
        setShowDropdown(true);
      } catch (error) {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  };

  const handleSelect = (loc) => {
    onChange(loc.name);
    onSelect(loc);
    saveRecentSearch(loc);
    setRecentSearches(getRecentSearches());
    setShowDropdown(false);
  };

  const handleClearAll = () => {
    clearRecentSearches();
    setRecentSearches([]);
    setShowAllRecent(false);
  };

  // Close when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (inputRef.current && !inputRef.current.contains(e.target) &&
          dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const visibleRecent = showAllRecent ? recentSearches : recentSearches.slice(0, 5);
  const hasMoreRecent = recentSearches.length > 5;

  // CSS classes for theming instead of inline styles
  const dropdownClasses = `search-dropdown ${showDropdown ? "search-dropdown--visible" : ""}`;

  return (
    <div className="portal-search-wrapper" style={{ position: "relative", width: "100%" }}>
      {/* Input wrapper */}
      <div className="portal-search-input-wrapper" style={{ position: "relative", width: "100%" }}>
        <div
          className="portal-search-dot"
          style={{
            position: "absolute",
            left: "14px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: accentColor,
            boxShadow: `0 0 6px ${accentColor}`,
            zIndex: 1
          }}
        />
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          onClick={handleInputClick}
          className="portal-search-input"
          style={{
            width: "100%",
            padding: "13px 44px 13px 32px",
            borderRadius: "14px",
            border: "1.5px solid var(--border)",
            background: "var(--input-bg)",
            color: "var(--text)",
            fontSize: "14px",
            fontFamily: "Outfit, sans-serif",
            outline: "none",
            boxSizing: "border-box",
            backdropFilter: "blur(8px)",
            transition: "border 0.2s, box-shadow 0.2s"
          }}
          onMouseEnter={(e) => (e.target.style.borderColor = accentColor)}
          onMouseLeave={(e) => (e.target.style.borderColor = "")}
        />
        {loading && (
          <div
            className="portal-search-spinner"
            style={{
              position: "absolute",
              right: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "14px",
              height: "14px",
              border: `2px solid ${accentColor}`,
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "ugspin 0.7s linear infinite"
            }}
          />
        )}
      </div>

      {/* Dropdown rendered at body level via Portal */}
      {showDropdown && createPortal(
        <div
          ref={dropdownRef}
          className="portal-search-dropdown"
          style={{
            position: "fixed",
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            width: dropdownPosition.width,
            background: "var(--drop-bg)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
            zIndex: 999999,
            maxHeight: "320px",
            overflowY: "auto",
            overflowX: "hidden"
          }}
        >
          {/* Recent searches */}
          {value.length < 1 && recentSearches.length > 0 && (
            <>
              <div className="search-section-header">
                <span>Recent</span>
                <button className="search-clear-btn" onClick={handleClearAll}>
                  Clear all
                </button>
              </div>
              {visibleRecent.map((item, i) => (
                <div
                  key={i}
                  className="search-dropdown-item"
                  onClick={() => handleSelect({ name: item.name, lat: item.lat, lng: item.lng })}
                >
                  <svg width="10" height="14" viewBox="0 0 12 16" fill="none">
                    <path d="M6 0C2.686 0 0 2.686 0 6c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6z" fill="#6b7280"/>
                    <circle cx="6" cy="6" r="2" fill="white"/>
                  </svg>
                  <span>{item.name}</span>
                </div>
              ))}
              {hasMoreRecent && (
                <div className="search-dropdown-showmore" onClick={() => setShowAllRecent(!showAllRecent)}>
                  {showAllRecent ? "Show less" : `Show ${recentSearches.length - 5} more`}
                </div>
              )}
              <div className="search-dropdown-divider" />
            </>
          )}

          {/* Current location option */}
          {showCurrentLocationOption && (
            <div
              className="search-dropdown-cl"
              onClick={() => { onUseCurrentLocation(); setShowDropdown(false); }}
            >
              <div className="search-dropdown-cl-dot" />
              Use my current location
            </div>
          )}

          {/* Loading */}
          {loading && <div className="search-dropdown-empty">Searching...</div>}

          {/* Suggestions */}
          {!loading && suggestions.length > 0 && (
            <>
              {value.length >= 1 && <div className="search-section-header">Suggestions</div>}
              {suggestions.map((loc, i) => (
                <div
                  key={i}
                  className="search-dropdown-item"
                  onClick={() => handleSelect(loc)}
                >
                  <svg width="10" height="14" viewBox="0 0 12 16" fill="none">
                    <path d="M6 0C2.686 0 0 2.686 0 6c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6z" fill={accentColor}/>
                    <circle cx="6" cy="6" r="2" fill="white"/>
                  </svg>
                  <span>{loc.name}</span>
                  {loc.dist > 0.5 && <span className="search-dropdown-dist">{loc.dist.toFixed(1)}km</span>}
                </div>
              ))}
            </>
          )}

          {/* No results */}
          {!loading && suggestions.length === 0 && value.length >= 1 && !showCurrentLocationOption && (
            <div className="search-dropdown-empty">No results — try a different name</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}