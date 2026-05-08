// WeatherBanner.jsx - Weather display with voice announcements (ONCE EVER)
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

  // Track if weather has been announced EVER in this session
  const hasAnnouncedWeatherRef = useRef(false);
  const speakRef = useRef(speak);
  const weatherRef = useRef(weather);
  
  useEffect(() => { speakRef.current = speak; }, [speak]);
  useEffect(() => { weatherRef.current = weather; }, [weather]);

  // Voice announcement - runs only once total, no matter what
  useEffect(() => {
    if (hasAnnouncedWeatherRef.current) return;
    if (!isVoiceEnabled) return;
    
    // Small delay to wait for weather data
    const timer = setTimeout(() => {
      const currentWeather = weatherRef.current;
      if (!currentWeather || currentWeather.isFallback) return;
      
      const condition = currentWeather.condition || 'Unknown';
      const temp = Math.round(currentWeather.temperature);
      
      hasAnnouncedWeatherRef.current = true;
      speakRef.current(
        `Current weather: ${condition}, ${temp} degrees.`,
        { priority: 'normal' }
      );
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [isVoiceEnabled]); // Intentionally NO weather in deps!

  // Manual refresh - reset announcement so user hears updated weather
  const handleRefresh = async () => {
    hasAnnouncedWeatherRef.current = false;
    await refreshWeather();
    // The useEffect will trigger again after refresh (isVoiceEnabled unchanged but will re-run)
    setTimeout(() => {
      const currentWeather = weatherRef.current;
      if (currentWeather && !currentWeather.isFallback) {
        const condition = currentWeather.condition || 'Unknown';
        const temp = Math.round(currentWeather.temperature);
        hasAnnouncedWeatherRef.current = true;
        speakRef.current(
          `Weather refreshed: ${condition}, ${temp} degrees.`,
          { priority: 'normal' }
        );
      }
    }, 500);
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