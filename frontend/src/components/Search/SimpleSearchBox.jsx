import { useState, useRef, useEffect } from "react";
import { getRecentSearches, saveRecentSearch } from "../../services/recentSearches";

export default function SimpleSearchBox({
  placeholder,
  value,
  onChange,
  onSelect,
  accentColor,
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);

  // Load recent searches
  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  // When user clicks the input, show dropdown
  const handleInputClick = () => {
    setShowDropdown(true);
  };

  // When user selects a location
  const handleSelect = (loc) => {
    onChange(loc.name);
    onSelect(loc);
    saveRecentSearch(loc);
    setShowDropdown(false);
  };

  // Close dropdown when clicking outside
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

  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={handleInputClick}
        style={{
          width: "100%",
          padding: "12px 16px",
          borderRadius: "40px",
          border: "1px solid #ddd",
          fontSize: "14px",
          background: "white"
        }}
      />
      
      {showDropdown && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "8px",
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: 999999,
            maxHeight: "300px",
            overflowY: "auto"
          }}
        >
          {/* Recent searches */}
          {recentSearches.slice(0, 5).map((item, i) => (
            <div
              key={i}
              onClick={() => handleSelect({ name: item.name, lat: item.lat, lng: item.lng })}
              style={{
                padding: "10px 16px",
                cursor: "pointer",
                borderBottom: "1px solid #eee"
              }}
              onMouseEnter={(e) => e.target.style.background = "#f5f5f5"}
              onMouseLeave={(e) => e.target.style.background = "white"}
            >
              🕘 {item.name}
            </div>
          ))}
          <div style={{ padding: "8px 16px", fontSize: "12px", color: "#666" }}>
            Type to search...
          </div>
        </div>
      )}
    </div>
  );
}