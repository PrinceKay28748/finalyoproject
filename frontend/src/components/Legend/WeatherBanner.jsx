// components/Legend/WeatherBanner.jsx
// Weather display with voice announcements.
// Voice fires ONLY when the condition string actually changes — not on re-renders
// or Legend drags — by comparing against a ref instead of putting speak() in deps.

import { useEffect, useRef } from 'react';
import { useWeather } from '../../hooks/useWeather';
import { useVoiceGuidance } from '../../hooks/useVoiceGuidance';
import './WeatherBanner.css';

const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 4v6h-6" />
    <path d="M1 20v-6h6" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
    <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
  </svg>
);

export default function WeatherBanner() {
  const {
    weather,
    getWeatherDisplay,
    hasWeatherImpact,
    getMultipliers,
    refreshWeather,
    isLoading,
  } = useWeather();

  const { speak, isVoiceEnabled } = useVoiceGuidance();

  // Refs track what was last spoken so re-renders never re-trigger voice.
  // We deliberately do NOT put `speak` in the effect dep array — it's stable
  // from useVoiceGuidance but even if it weren't, a new function reference
  // should never cause a repeated announcement.
  const lastSpokenConditionRef = useRef(null);
  const hasSpokenInitialRef    = useRef(false);
  // Keep a stable ref to `speak` so the effect body can call it without
  // listing it as a dependency.
  const speakRef = useRef(speak);
  useEffect(() => { speakRef.current = speak; }, [speak]);

  // Voice announcement — only fires when weather.condition actually changes
  useEffect(() => {
    if (!weather || !isVoiceEnabled || weather.isFallback) return;

    const condition = weather.condition || 'Unknown';
    const temp      = Math.round(weather.temperature);

    // Gate: skip if we already announced this exact condition
    if (lastSpokenConditionRef.current === condition) return;
    lastSpokenConditionRef.current = condition;

    if (!hasSpokenInitialRef.current) {
      hasSpokenInitialRef.current = true;
      // Slight delay so it doesn't clash with the route-calculated announcement
      setTimeout(() => {
        speakRef.current(
          `Current weather: ${condition}, ${temp} degrees.`,
          { priority: 'normal' }
        );
      }, 800);
    } else {
      speakRef.current(
        `Weather update: ${condition}, ${temp} degrees.`,
        { priority: 'normal' }
      );
    }
    // Deps: only the values we actually compare — NOT `speak`
  }, [weather, isVoiceEnabled]);

  // Manual refresh — re-allow announcement for the new condition
  const handleRefresh = async () => {
    // Reset the gate so the updated condition gets announced
    lastSpokenConditionRef.current = null;
    await refreshWeather();
  };

  const display   = getWeatherDisplay();
  const hasImpact = hasWeatherImpact();

  if (!weather) {
    return (
      <div className="weather-banner weather-banner--loading">
        <span className="weather-icon">🌡️</span>
        <span className="weather-text">Loading weather...</span>
      </div>
    );
  }

  return (
    <div className={`weather-banner${hasImpact ? ' weather-banner--impact' : ''}`}>
      <div className="weather-banner-main">
        <div className="weather-info">
          <span className="weather-icon">{display.icon}</span>
          <div className="weather-details">
            <span className="weather-temp">{display.temperature}°C</span>
            <span className="weather-condition">{display.label}</span>
          </div>
        </div>

        <button
          className="weather-refresh"
          onClick={handleRefresh}
          disabled={isLoading}
          title="Refresh weather"
          aria-label="Refresh weather"
        >
          <RefreshIcon />
        </button>
      </div>

      <div className="weather-impact-badge">
        {hasImpact ? (
          <span className="impact-active">🌧️ Routing adjusted for conditions</span>
        ) : (
          <span className="impact-normal">✅ Clear conditions — normal routing</span>
        )}
      </div>
    </div>
  );
}