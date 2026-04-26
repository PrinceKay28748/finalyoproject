import { useState, useEffect, useRef, useCallback } from "react";
import { geocode, resolveLocalLocation } from "../../services/geocoding";
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
  const [resolvingLocation, setResolvingLocation] = useState(false);
  
  const debounceRef = useRef(null);
  const inputRef = useRef(null);
  const dropdownRef = useRef(null);
  const abortControllerRef = useRef(null);
  const lastQueryRef = useRef("");
  const cacheRef = useRef(new Map());

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    
    const handleUpdate = () => {
      setRecentSearches(getRecentSearches());
    };
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
      console.log(`[Search] Cache hit for "${val}"`);
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

  const handleSelect = async (loc) => {
    // If local result without coordinates, resolve it
    if (loc.source === "local" && (!loc.lat || !loc.lng)) {
      setResolvingLocation(true);
      setShowDropdown(false);
      
      try {
        const resolved = await resolveLocalLocation(loc.name);
        if (resolved && resolved.lat && resolved.lng) {
          onChange(resolved.name);
          onSelect(resolved);
          saveRecentSearch(resolved);
        } else {
          console.error("[Search] Failed to resolve location:", loc.name);
          onChange(loc.name);
          onSelect(loc);
          saveRecentSearch(loc);
        }
      } catch (err) {
        console.error("[Search] Error resolving location:", err);
        onChange(loc.name);
        onSelect(loc);
        saveRecentSearch(loc);
      } finally {
        setResolvingLocation(false);
      }
    } else {
      onChange(loc.name);
      onSelect(loc);
      saveRecentSearch(loc);
    }
    
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

  const getLocationIcon = (loc) => {
    if (loc.source === "local") return "📍";
    if (loc.name.toLowerCase().includes("hall")) return "🏛️";
    if (loc.name.toLowerCase().includes("library")) return "📚";
    if (loc.name.toLowerCase().includes("road")) return "🛣️";
    if (loc.name.toLowerCase().includes("market")) return "🛒";
    return "📍";
  };

  return (
    <div style={{ position: "relative", width: "100%" }}>
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
        {(loading || resolvingLocation) && (
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
                  <span style={{ fontSize: "14px" }}>🕘</span>
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

          {!loading && !resolvingLocation && suggestions.length > 0 && (
            <>
              <div style={{ padding: "8px 12px", fontSize: "11px", fontWeight: 600, color: "var(--text-secondary)", borderBottom: "1px solid var(--border)" }}>
                {isTyping ? "Suggestions" : "Suggestions"}
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
                  <span style={{ fontSize: "14px" }}>{getLocationIcon(loc)}</span>
                  <span style={{ flex: 1 }}>{loc.name}</span>
                  {loc.source === "local" && <span style={{ fontSize: "10px", opacity: 0.5, background: "#e2e8f0", padding: "2px 6px", borderRadius: "12px" }}>Campus</span>}
                  {loc.dist > 0.5 && loc.source !== "local" && <span style={{ fontSize: "11px", opacity: 0.5 }}>{loc.dist.toFixed(1)}km</span>}
                </div>
              ))}
            </>
          )}

          {!loading && !resolvingLocation && suggestions.length === 0 && value.length >= 3 && !showCurrentLocationOption && (
            <div style={{ padding: "12px 16px", fontSize: "13px", color: "var(--sub)" }}>
              No results — try a different name
            </div>
          )}
        </div>
      )}
      
      {resolvingLocation && (
        <div style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.8)",
          color: "white",
          padding: "8px 16px",
          borderRadius: "40px",
          fontSize: "12px",
          zIndex: 10000,
          pointerEvents: "none"
        }}>
          Getting location...
        </div>
      )}
    </div>
  );
}