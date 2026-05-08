// WeatherBanner.jsx - Weather display with voice announcements (ONCE PER SESSION)
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

  // Track if weather has been announced this session
  const hasAnnouncedWeatherRef = useRef(false);
  // Keep stable ref to speak
  const speakRef = useRef(speak);
  useEffect(() => { speakRef.current = speak; }, [speak]);

  // Voice announcement - ONLY ONCE per session, never again
  useEffect(() => {
    if (!weather || !isVoiceEnabled || weather.isFallback) return;
    if (hasAnnouncedWeatherRef.current) return;

    const condition = weather.condition || 'Unknown';
    const temp = Math.round(weather.temperature);
    
    hasAnnouncedWeatherRef.current = true;
    
    // Small delay to ensure it doesn't clash with other voice
    setTimeout(() => {
      speakRef.current(
        `Current weather: ${condition}, ${temp} degrees.`,
        { priority: 'normal' }
      );
    }, 800);
  }, [weather, isVoiceEnabled]); // No speak in deps - using ref

  // Manual refresh - reset announcement gate so user hears the updated weather
  const handleRefresh = async () => {
    hasAnnouncedWeatherRef.current = false;
    await refreshWeather();
    // After refresh, the useEffect above will trigger again
  };

  const display = getWeatherDisplay();
  const hasImpact = hasWeatherImpact();
  const multipliers = getMultipliers();

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