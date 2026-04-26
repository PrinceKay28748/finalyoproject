import { useState, useEffect, useRef, useCallback } from "react";
import { geocode } from "../../services/geocoding";
import { saveRecentSearch, getRecentSearches, clearRecentSearches } from "../../services/recentSearches";
import "./SearchBox.css";

// Simple SVG icons for suggestion types
const SuggestionIcon = ({ type }) => {
  const iconProps = { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" };
  
  if (type === "hall") {
    return <svg {...iconProps}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
  }
  if (type === "academic") {
    return <svg {...iconProps}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>;
  }
  if (type === "road") {
    return <svg {...iconProps}><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2v20" /></svg>;
  }
  if (type === "food") {
    return <svg {...iconProps}><path d="M18 8c0 5-6 5-6 5s-6 0-6-5c0-2 2-3 4-3 0 0 2 0 2-2 0 2 2 2 2 2 2 0 4 1 4 3z" /><line x1="12" y1="17" x2="12" y2="22" /><line x1="9" y1="20" x2="15" y2="20" /></svg>;
  }
  if (type === "medical") {
    return <svg {...iconProps}><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>;
  }
  return <svg {...iconProps}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>;
};

// Detect suggestion type from name
function getSuggestionType(name) {
  const lower = name.toLowerCase();
  if (lower.includes("hall")) return "hall";
  if (lower.includes("library") || lower.includes("school") || lower.includes("department")) return "academic";
  if (lower.includes("road") || lower.includes("street") || lower.includes("link")) return "road";
  if (lower.includes("market") || lower.includes("canteen") || lower.includes("cafe")) return "food";
  if (lower.includes("medical") || lower.includes("clinic") || lower.includes("hospital")) return "medical";
  return "default";
}

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

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    const handleUpdate = () => setRecentSearches(getRecentSearches());
    window.addEventListener("recentSearchesUpdated", handleUpdate);
    return () => window.removeEventListener("recentSearchesUpdated", handleUpdate);
  }, []);

  const cancelPendingRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

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
    clearDebounce();
    cancelPendingRequest();
    
    if (val.length < 3) {
      setSuggestions([]);
      setLoading(false);
      setIsTyping(false);
      setShowDropdown(true);
      lastQueryRef.current = "";
      return;
    }
    
    const requestId = Date.now();
    setLastRequestId(requestId);
    setIsTyping(true);
    setLoading(true);
    setShowDropdown(true);
    
    if (cacheRef.current.has(val)) {
      setSuggestions(cacheRef.current.get(val));
      setLoading(false);
      setIsTyping(false);
      lastQueryRef.current = val;
      return;
    }
    
    debounceRef.current = setTimeout(async () => {
      if (requestId !== lastRequestId) {
        setLoading(false);
        setIsTyping(false);
        return;
      }
      if (val.length < 3) {
        setSuggestions([]);
        setLoading(false);
        setIsTyping(false);
        return;
      }
      if (lastQueryRef.current === val) {
        setLoading(false);
        setIsTyping(false);
        return;
      }
      
      lastQueryRef.current = val;
      
      try {
        const results = await geocode(val);
        if (requestId === lastRequestId) {
          cacheRef.current.set(val, results);
          if (cacheRef.current.size > 50) {
            const firstKey = cacheRef.current.keys().next().value;
            cacheRef.current.delete(firstKey);
          }
          setSuggestions(results);
        }
      } catch (error) {
        if (requestId === lastRequestId) setSuggestions([]);
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
    clearDebounce();
    cancelPendingRequest();
  };

  const handleClearAll = () => {
    clearRecentSearches();
    setRecentSearches([]);
    setShowAllRecent(false);
  };

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
      {/* Loading skeleton shown while searching */}
      {loading && (
        <div className="search-skeleton">
          <div className="search-skeleton-line" style={{ width: "85%" }} />
          <div className="search-skeleton-line" style={{ width: "70%" }} />
          <div className="search-skeleton-line" style={{ width: "90%" }} />
        </div>
      )}

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
                  <div style={{ width: "20px", display: "flex", justifyContent: "center" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                  </div>
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

          {showCurrentLocationOption && (
            <div
              onClick={() => { onUseCurrentLocation(); setShowDropdown(false); }}
              style={{ padding: "12px 16px", cursor: "pointer", display: "flex", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: 600, color: "#2563eb", background: "var(--cl-option)" }}
            >
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#2563eb", boxShadow: "0 0 6px #2563eb" }} />
              Use my current location
            </div>
          )}

          {loading && (
            <div style={{ padding: "12px 16px", fontSize: "13px", color: "var(--sub)", display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "14px", height: "14px", border: "2px solid var(--border)", borderTopColor: accentColor, borderRadius: "50%", animation: "ugspin 0.7s linear infinite" }} />
              Searching...
            </div>
          )}

          {!loading && suggestions.length > 0 && (
            <>
              <div style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {isTyping ? "Suggestions (keep typing for more)" : "Suggestions"}
              </div>
              {suggestions.slice(0, 7).map((loc, i) => {
                const type = getSuggestionType(loc.name);
                return (
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
                    <div style={{ width: "20px", display: "flex", justifyContent: "center", color: accentColor }}>
                      <SuggestionIcon type={type} />
                    </div>
                    <span style={{ flex: 1 }}>{loc.name}</span>
                    {loc.dist > 0.5 && <span style={{ fontSize: "11px", opacity: 0.5 }}>{loc.dist.toFixed(1)}km</span>}
                  </div>
                );
              })}
            </>
          )}

          {!loading && suggestions.length === 0 && value.length >= 3 && !showCurrentLocationOption && (
            <div style={{ padding: "12px 16px", fontSize: "13px", color: "var(--sub)" }}>
              No results — try a different name
            </div>
          )}
        </div>
      )}
    </div>
  );
}