// WeatherBanner.jsx - Weather display with voice announcements and forecast modal
import { useEffect, useRef, useState } from 'react';
import { useWeather } from '../../hooks/useWeather';
import { useVoiceGuidance } from '../../hooks/useVoiceGuidance';
import { fetchForecast } from '../../services/weatherService';
import { WeatherIcon, CalendarIcon, RefreshIcon, CloseIcon } from '../ui/WeatherIcons';
import './WeatherBanner.css';

export default function WeatherBanner() {
  const { weather, getWeatherDisplay, hasWeatherImpact, getMultipliers, refreshWeather, isLoading } = useWeather();
  const { speak, isVoiceEnabled } = useVoiceGuidance();
  const [forecast, setForecast] = useState(null);
  const [showForecastModal, setShowForecastModal] = useState(false);
  const [isLoadingForecast, setIsLoadingForecast] = useState(false);
  
  const lastSpokenConditionRef = useRef(null);
  const hasSpokenInitialRef = useRef(false);
  const speakRef = useRef(speak);
  
  useEffect(() => { speakRef.current = speak; }, [speak]);

  useEffect(() => {
    if (!weather || !isVoiceEnabled || weather.isFallback) return;
    const condition = weather.condition || 'Unknown';
    const temp = Math.round(weather.temperature);
    if (lastSpokenConditionRef.current === condition) return;
    lastSpokenConditionRef.current = condition;
    
    if (!hasSpokenInitialRef.current) {
      hasSpokenInitialRef.current = true;
      setTimeout(() => speakRef.current(`Current weather: ${condition}, ${temp} degrees.`, { priority: 'normal' }), 800);
    } else {
      speakRef.current(`Weather update: ${condition}, ${temp} degrees.`, { priority: 'normal' });
    }
  }, [weather, isVoiceEnabled]);

  const handleRefresh = async () => {
    lastSpokenConditionRef.current = null;
    await refreshWeather();
  };

  const handleOpenForecast = async () => {
    setShowForecastModal(true);
    if (!forecast) {
      setIsLoadingForecast(true);
      const data = await fetchForecast();
      setForecast(data);
      setIsLoadingForecast(false);
    }
  };

  const display = getWeatherDisplay();
  const hasImpact = hasWeatherImpact();
  const multipliers = getMultipliers();

  if (!weather) {
    return (
      <div className="weather-banner weather-banner--loading">
        <span className="weather-icon-loading">🌡️</span>
        <span className="weather-text">Loading weather...</span>
      </div>
    );
  }

  return (
    <>
      <div className={`weather-banner ${hasImpact ? 'weather-banner--impact' : ''}`}>
        <div className="weather-banner-main">
          <div className="weather-info">
            <div className="weather-icon">
              <WeatherIcon type={display.iconType || 'clouds'} className="w-5 h-5" />
            </div>
            <div className="weather-details">
              <span className="weather-temp">{display.temperature}°C</span>
              <span className="weather-condition">{display.label}</span>
            </div>
          </div>
          
          <div className="weather-actions">
            <button className="weather-forecast-btn" onClick={handleOpenForecast} title="5-day forecast" aria-label="View 5-day forecast">
              <CalendarIcon />
            </button>
            <button className="weather-refresh" onClick={handleRefresh} disabled={isLoading} title="Refresh weather" aria-label="Refresh weather">
              <RefreshIcon />
            </button>
          </div>
        </div>
        
        <div className="weather-impact-badge">
          {hasImpact ? (
            <span className="impact-active">Routing adjusted for conditions</span>
          ) : (
            <span className="impact-normal">Clear conditions — normal routing</span>
          )}
        </div>
      </div>

      {/* Forecast Modal */}
      {showForecastModal && (
        <div className="forecast-modal-overlay" onClick={() => setShowForecastModal(false)}>
          <div className="forecast-modal" onClick={(e) => e.stopPropagation()}>
            <div className="forecast-modal-header">
              <h3>5-Day Forecast</h3>
              <button className="forecast-modal-close" onClick={() => setShowForecastModal(false)}>
                <CloseIcon />
              </button>
            </div>
            
            {isLoadingForecast ? (
              <div className="forecast-loading">
                <div className="forecast-spinner" />
                <span>Loading forecast...</span>
              </div>
            ) : forecast && forecast.length > 0 ? (
              <>
                <div className="forecast-grid">
                  {forecast.map((day, idx) => (
                    <div key={idx} className="forecast-day">
                      <span className="forecast-day-name">{day.dayName}</span>
                      <div className="forecast-day-icon">
                        <WeatherIcon type={day.iconType} className="w-6 h-6" />
                      </div>
                      <span className="forecast-temp-high">{day.tempMax}°</span>
                      <span className="forecast-temp-low">{day.tempMin}°</span>
                      <span className="forecast-condition">{day.condition}</span>
                    </div>
                  ))}
                </div>
                {multipliers.message && (
                  <div className="forecast-note">
                    <span className="forecast-note-icon">⚠️</span>
                    <span className="forecast-note-text">{multipliers.message}</span>
                  </div>
                )}
              </>
            ) : (
              <div className="forecast-error">Unable to load forecast</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}