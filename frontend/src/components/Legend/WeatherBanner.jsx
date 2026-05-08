// WeatherBanner.jsx - Weather display with voice announcements
import { useEffect, useRef } from 'react';
import { useWeather } from '../../hooks/useWeather';
import { useVoiceGuidance } from '../../hooks/useVoiceGuidance';
import './WeatherBanner.css';

// SVG Refresh Icon
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    formatWeatherMessage,
    getWeatherChange
  } = useWeather();
  
  const { speak, isVoiceEnabled } = useVoiceGuidance();
  const previousWeatherRef = useRef(null);
  const hasSpokenInitialRef = useRef(false);
  
  const display = getWeatherDisplay();
  const hasImpact = hasWeatherImpact();
  const multipliers = getMultipliers();

  // Voice announcements for weather (moved from useWeather to break circular dependency)
  useEffect(() => {
    if (!weather || !isVoiceEnabled || weather.isFallback) return;
    
    // Initial weather announcement (first load only)
    if (!hasSpokenInitialRef.current) {
      hasSpokenInitialRef.current = true;
      const message = formatWeatherMessage(weather, hasImpact);
      setTimeout(() => speak(message, { priority: 'normal' }), 500);
    }
    
    // Check for weather condition change
    if (previousWeatherRef.current) {
      const change = getWeatherChange(previousWeatherRef.current, weather);
      if (change && change.type === 'condition_change') {
        const message = `Weather update: ${change.newCondition} detected, ${change.temperature} degrees. Routing adjusted for conditions.`;
        speak(message, { priority: 'normal' });
      }
    }
    
    previousWeatherRef.current = weather;
  }, [weather, isVoiceEnabled, speak, formatWeatherMessage, hasImpact, getWeatherChange]);

  // Handle manual refresh with voice confirmation
  const handleRefresh = async () => {
    await refreshWeather();
    if (isVoiceEnabled && weather && !weather.isFallback) {
      const temp = Math.round(weather.temperature);
      const condition = weather.condition || 'Unknown';
      speak(`Weather refreshed: ${condition}, ${temp} degrees.`, { priority: 'normal' });
    }
  };

  if (!weather) {
    return (
      <div className="weather-banner weather-banner--loading">
        <span className="weather-icon">🌡️</span>
        <span className="weather-text">Loading weather...</span>
      </div>
    );
  }
  
  return (
    <div className={`weather-banner ${hasImpact ? 'weather-banner--impact' : ''}`}>
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
        >
          <RefreshIcon />
        </button>
      </div>
      
      {multipliers.message && (
        <div className={`weather-message ${hasImpact ? 'weather-message--active' : ''}`}>
          <span className="message-icon">{display.icon}</span>
          <span className="message-text">{multipliers.message}</span>
        </div>
      )}
      
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