// WeatherBanner.jsx - Weather display with voice announcements (no routing impact voice)
import { useEffect, useRef } from 'react';
import { useWeather } from '../../hooks/useWeather';
import { useVoiceGuidance } from '../../hooks/useVoiceGuidance';
import './WeatherBanner.css';

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
    formatWeatherMessage
  } = useWeather();
  
  const { speak, isVoiceEnabled } = useVoiceGuidance();
  
  // Use refs to prevent repeat announcements on re-renders
  const hasSpokenInitialRef = useRef(false);
  const lastSpokenWeatherIdRef = useRef(null);
  
  const display = getWeatherDisplay();
  const hasImpact = hasWeatherImpact();
  const multipliers = getMultipliers();

  // Voice announcements for weather - ONLY weather description, NO routing impact
  useEffect(() => {
    if (!weather || !isVoiceEnabled || weather.isFallback) return;
    
    // Create unique ID for this weather state
    const weatherId = `${weather.condition}-${weather.temperature}`;
    
    // Only speak if weather has actually changed
    if (lastSpokenWeatherIdRef.current !== weatherId) {
      lastSpokenWeatherIdRef.current = weatherId;
      
      // Simple weather announcement - no routing impact
      if (!hasSpokenInitialRef.current) {
        hasSpokenInitialRef.current = true;
        const temp = Math.round(weather.temperature);
        const condition = weather.condition || 'Unknown';
        const message = `Current weather: ${condition}, ${temp} degrees.`;
        setTimeout(() => speak(message, { priority: 'normal' }), 500);
      } else {
        // Weather condition changed - announce update only
        const temp = Math.round(weather.temperature);
        const condition = weather.condition || 'Unknown';
        const message = `Weather update: ${condition}, ${temp} degrees.`;
        speak(message, { priority: 'normal' });
      }
    }
  }, [weather, isVoiceEnabled, speak]);

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