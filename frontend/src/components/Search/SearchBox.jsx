import { useState, useEffect, useRef, useCallback } from "react";
import { geocode } from "../../services/geocoding";
import { saveRecentSearch, getRecentSearches, clearRecentSearches } from "../../services/recentSearches";
import "./SearchBox.css";

export default function SearchBox({
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
  const [isTyping, setIsTyping] = useState(false);
  const [lastRequestId, setLastRequestId] = useState(0);
  
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastQueryRef = useRef("");
  const cacheRef = useRef(new Map());

  // Load recent searches
  useEffect(() => {
    setRecentSearches(getRecentSearches());
    
    const handleUpdate = () => {
      setRecentSearches(getRecentSearches());
    };
    window.addEventListener("recentSearchesUpdated", handleUpdate);
    return () => window.removeEventListener("recentSearchesUpdated", handleUpdate);
  }, []);

  // Cancel pending requests
  const cancelPendingRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // Clear debounce timeout
  const clearDebounce = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const handleInputClick = () => {
    setShowDropdown(true);
    if (onFocus) onFocus();
  };

  const handleChange = (e) => {
    const val = e.target.value;
    onChange(val);
    
    // Clear previous debounce
    clearDebounce();
    
    // Cancel any pending API request
    cancelPendingRequest();
    
    // If empty, show recent searches only
    if (val.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setIsTyping(false);
      setShowDropdown(true);
      lastQueryRef.current = "";
      return;
    }
    
    // Generate unique request ID for this typing session
    const requestId = Date.now();
    setLastRequestId(requestId);
    
    // Show loading state
    setIsTyping(true);
    setLoading(true);
    setShowDropdown(true);
    
    // Check cache first (results for same query)
    if (cacheRef.current.has(val)) {
      console.log(`[Search] Cache hit for "${val}"`);
      setSuggestions(cacheRef.current.get(val));
      setLoading(false);
      setIsTyping(false);
      lastQueryRef.current = val;
      return;
    }
    
    // Set debounce to 300ms for fast but not overwhelming suggestions
    debounceRef.current = setTimeout(async () => {
      // Check if this is still the latest request (prevents stale responses)
      if (requestId !== lastRequestId) {
        console.log(`[Search] Skipping stale request ${requestId}`);
        setLoading(false);
        setIsTyping(false);
        return;
      }
      
      // Don't search if query is too short
      if (val.length < 3) {
        setSuggestions([]);
        setLoading(false);
        setIsTyping(false);
        return;
      }
      
      // Skip if same as last query (prevents duplicate requests)
      if (lastQueryRef.current === val) {
        setLoading(false);
        setIsTyping(false);
        return;
      }
      
      lastQueryRef.current = val;
      
      try {
        console.log(`[Search] Fetching results for "${val}"`);
        const results = await geocode(val);
        
        // Only update if this is still the latest request
        if (requestId === lastRequestId) {
          // Cache results
          cacheRef.current.set(val, results);
          
          // Limit cache size to 50 items
          if (cacheRef.current.size > 50) {
            const firstKey = cacheRef.current.keys().next().value;
            cacheRef.current.delete(firstKey);
          }
          
          setSuggestions(results);
        }
      } catch (error) {
        console.error("[Search] Error:", error);
        if (requestId === lastRequestId) {
          setSuggestions([]);
        }
      } finally {
        if (requestId === lastRequestId) {
          setLoading(false);
          setIsTyping(false);
        }
      }
    }, 300);
  };

  const handleSelect = (loc) => {
    onChange(loc.name);
    onSelect(loc);
    saveRecentSearch(loc);
    setRecentSearches(getRecentSearches());
    setShowDropdown(false);
    
    // Clear pending requests
    clearDebounce();
    cancelPendingRequest();
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearDebounce();
      cancelPendingRequest();
    };
  }, [clearDebounce, cancelPendingRequest]);

  const visibleRecent = showAllRecent ? recentSearches : recentSearches.slice(0, 5);
  const hasMoreRecent = recentSearches.length > 5;

  return (
    <div style={{ position: "relative", width: "100%" }}>
      {/* Input wrapper */}
      <div style={{ position: "relative", width: "100%" }}>
        <div
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

      {/* Dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "8px",
            background: "var(--drop-bg)",
            border: "1px solid var(--border)",
            borderRadius: "14px",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.12)",
            zIndex: 999999,
            maxHeight: "320px",
            overflowY: "auto"
          }}
        >
          {/* Recent searches */}
          {value.length < 1 && recentSearches.length > 0 && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                <span>Recent</span>
                <button onClick={handleClearAll} style={{ background: "none", border: "none", fontSize: "11px", color: "#ef4444", cursor: "pointer" }}>Clear all</button>
              </div>
              {visibleRecent.map((item, i) => (
                <div
                  key={i}
                  onClick={() => handleSelect({ name: item.name, lat: item.lat, lng: item.lng })}
                  style={{ padding: "11px 16px", cursor: "pointer", fontSize: "13px", color: "var(--text)", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => (e.target.style.background = "var(--hover-row)")}
                  onMouseLeave={(e) => (e.target.style.background = "transparent")}
                >
                  <svg width="10" height="14" viewBox="0 0 12 16" fill="none"><path d="M6 0C2.686 0 0 2.686 0 6c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6z" fill="#6b7280"/><circle cx="6" cy="6" r="2" fill="white"/></svg>
                  <span>{item.name}</span>
                </div>
              ))}
              {hasMoreRecent && (
                <div onClick={() => setShowAllRecent(!showAllRecent)} style={{ padding: "8px 12px", fontSize: "12px", color: "#2563eb", textAlign: "center", cursor: "pointer", borderTop: "1px solid var(--border)" }}>
                  {showAllRecent ? "Show less" : `Show ${recentSearches.length - 5} more`}
                </div>
              )}
              <div style={{ height: "1px", background: "var(--border)", margin: "6px 0" }} />
            </>
          )}

          {/* Current location option */}
          {showCurrentLocationOption && (
            <div
              onClick={() => { onUseCurrentLocation(); setShowDropdown(false); }}
              style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: 600, color: "#2563eb", background: "var(--cl-option)" }}
            >
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#2563eb", boxShadow: "0 0 6px #2563eb" }} />
              Use my current location
            </div>
          )}

          {/* Loading indicator with message */}
          {loading && (
            <div style={{ padding: "12px 16px", fontSize: "13px", color: "var(--sub)", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "14px", height: "14px", border: "2px solid var(--border)", borderTopColor: accentColor, borderRadius: "50%", animation: "ugspin 0.7s linear infinite" }} />
              Searching...
            </div>
          )}

          {/* Suggestions - show even while typing (no flashing) */}
          {!loading && suggestions.length > 0 && (
            <>
              <div style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {isTyping ? "Suggestions (keep typing for more)" : "Suggestions"}
              </div>
              {suggestions.slice(0, 7).map((loc, i) => (
                <div
                  key={`${loc.name}-${i}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(loc);
                  }}
                  style={{ padding: "11px 16px", cursor: "pointer", fontSize: "13px", color: "var(--text)", display: "flex", alignItems: "center", gap: "10px", borderBottom: "1px solid var(--border)" }}
                  onMouseEnter={(e) => (e.target.style.background = "var(--hover-row)")}
                  onMouseLeave={(e) => (e.target.style.background = "transparent")}
                >
                  <svg width="10" height="14" viewBox="0 0 12 16" fill="none"><path d="M6 0C2.686 0 0 2.686 0 6c0 4.5 6 10 6 10s6-5.5 6-10c0-3.314-2.686-6-6-6z" fill={accentColor}/><circle cx="6" cy="6" r="2" fill="white"/></svg>
                  <span>{loc.name}</span>
                  {loc.dist > 0.5 && <span style={{ marginLeft: "auto", fontSize: "11px", opacity: 0.5 }}>{loc.dist.toFixed(1)}km</span>}
                </div>
              ))}
            </>
          )}

          {/* No results */}
          {!loading && suggestions.length === 0 && value.length >= 3 && !showCurrentLocationOption && (
            <div style={{ padding: "12px 16px", fontSize: "13px", color: "var(--sub)" }}>
              No results — try a different name
            </div>
          )}
        </div>ava
      )}
    </div>
  );
}