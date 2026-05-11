// Weather service - Open-Meteo API (free, no API key required)
// Cached for 10 minutes to respect rate limits

const CACHE_KEY = 'ug_weather_cache';
const FORECAST_CACHE_KEY = 'ug_forecast_cache';
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Legon campus coordinates
const LEGON_LAT = 5.6502;
const LEGON_LNG = -0.1869;

// Weather code mapping to human-readable conditions with SVG paths
export const WEATHER_CODES = {
  0: { label: 'Clear sky', effect: 'sun', description: 'Sunny and clear', svg: 'M12 3v1m0 16v1M5.6 5.6l.7.7m12.1 12.1l.7.7M3 12h1m16 0h1M5.6 18.4l.7-.7m12.1-12.1l.7-.7' },
  1: { label: 'Mainly clear', effect: 'sun-cloud', description: 'Partly sunny', svg: 'M12 3v1m0 16v1M5.6 5.6l.7.7m12.1 12.1l.7.7M3 12h1m16 0h1M5.6 18.4l.7-.7m12.1-12.1l.7-.7' },
  2: { label: 'Partly cloudy', effect: 'clouds', description: 'Partly cloudy', svg: 'M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z' },
  3: { label: 'Overcast', effect: 'clouds', description: 'Cloudy', svg: 'M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z' },
  45: { label: 'Fog', effect: 'fog', description: 'Foggy, limited visibility', svg: 'M4 12h16M6 16h12M8 8h8' },
  48: { label: 'Fog', effect: 'fog', description: 'Foggy', svg: 'M4 12h16M6 16h12M8 8h8' },
  51: { label: 'Light drizzle', effect: 'rain-light', description: 'Light drizzle', svg: 'M8 13v4M12 13v4M16 13v4M18 13v4' },
  53: { label: 'Moderate drizzle', effect: 'rain', description: 'Drizzling', svg: 'M6 13v4M10 13v4M14 13v4M18 13v4' },
  55: { label: 'Heavy drizzle', effect: 'rain-heavy', description: 'Heavy drizzle', svg: 'M5 13v5M9 13v5M13 13v5M17 13v5M20 13v5' },
  61: { label: 'Light rain', effect: 'rain-light', description: 'Light rain', svg: 'M8 13v4M12 13v4M16 13v4' },
  63: { label: 'Moderate rain', effect: 'rain', description: 'Moderate rain', svg: 'M6 13v4M10 13v4M14 13v4M18 13v4' },
  65: { label: 'Heavy rain', effect: 'rain-heavy', description: 'Heavy rain', svg: 'M5 13v5M9 13v5M13 13v5M17 13v5' },
  71: { label: 'Light snow', effect: 'snow', description: 'Light snow', svg: 'M8 13l2-2M12 11l2 2M16 13l-2 2M10 15l2 2M14 17l2-2' },
  73: { label: 'Moderate snow', effect: 'snow', description: 'Snowing', svg: 'M6 12l2-2M10 10l2 2M14 12l-2 2M12 16l2 2M8 14l-2 2' },
  75: { label: 'Heavy snow', effect: 'snow-heavy', description: 'Heavy snow', svg: 'M5 11l2-2M9 9l2 2M13 11l-2 2M11 15l2 2M7 13l-2 2' },
  80: { label: 'Rain showers', effect: 'rain', description: 'Rain showers', svg: 'M7 13v4M11 13v4M15 13v4' },
  81: { label: 'Rain showers', effect: 'rain', description: 'Rain showers', svg: 'M6 13v4M10 13v4M14 13v4M18 13v4' },
  82: { label: 'Violent rain', effect: 'rain-heavy', description: 'Violent rain', svg: 'M5 13v5M9 13v5M13 13v5M17 13v5' },
  85: { label: 'Snow showers', effect: 'snow', description: 'Snow showers', svg: 'M8 12l1-1M11 11l1 1M14 12l-1 1M12 14l1 1' },
  86: { label: 'Heavy snow showers', effect: 'snow-heavy', description: 'Heavy snow showers', svg: 'M6 11l2-2M10 9l2 2M14 11l-2 2M12 15l2 2' },
  95: { label: 'Thunderstorm', effect: 'storm', description: 'Thunderstorm', svg: 'M8 10l4-4l2 2l-4 4l-2-2zM12 6v2M16 10h-2' },
  96: { label: 'Thunderstorm', effect: 'storm', description: 'Thunderstorm with hail', svg: 'M8 10l4-4l2 2l-4 4l-2-2zM12 6v2M16 10h-2' },
  99: { label: 'Thunderstorm', effect: 'storm', description: 'Severe thunderstorm', svg: 'M7 9l4-3l3 2l-4 3l-3-2zM11 4v3M15 8h-2' },
};

// SVG Weather Icons (clean, professional)
export const WeatherIcon = ({ type, className = "w-8 h-8" }) => {
  const icons = {
    sun: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
    clouds: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z" />
      </svg>
    ),
    rain: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z" />
        <line x1="8" y1="15" x2="8" y2="19" />
        <line x1="12" y1="15" x2="12" y2="20" />
        <line x1="16" y1="15" x2="16" y2="19" />
      </svg>
    ),
    snow: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z" />
        <line x1="10" y1="15" x2="10" y2="18" />
        <line x1="14" y1="15" x2="14" y2="18" />
        <line x1="8.5" y1="17" x2="11.5" y2="17" />
        <line x1="12.5" y1="17" x2="15.5" y2="17" />
      </svg>
    ),
    storm: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z" />
        <polygon points="12 8 10 13 14 13 12 18" />
      </svg>
    ),
    fog: (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 6c-3 0-5 2-5 5c0 2.5 2 5 5 5h10c2.5 0 4-2 4-4c0-2-1.5-4-4-4c-.5-3-3-5-6-5z" />
        <line x1="4" y1="16" x2="20" y2="16" />
        <line x1="6" y1="18" x2="18" y2="18" />
      </svg>
    )
  };
  return icons[type] || icons.clouds;
};

// Get cached weather or null
function getCachedWeather() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION_MS) return data;
    return null;
  } catch (e) { return null; }
}

function cacheWeather(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {}
}

// Get cached forecast
function getCachedForecast() {
  try {
    const cached = localStorage.getItem(FORECAST_CACHE_KEY);
    if (!cached) return null;
    const { data, timestamp } = JSON.parse(cached);
    if (Date.now() - timestamp < CACHE_DURATION_MS) return data;
    return null;
  } catch (e) { return null; }
}

function cacheForecast(data) {
  try {
    localStorage.setItem(FORECAST_CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
  } catch (e) {}
}

// Fetch current weather from Open-Meteo
export async function fetchWeather() {
  const cached = getCachedWeather();
  if (cached) return cached;
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LEGON_LAT}&longitude=${LEGON_LNG}&current_weather=true&hourly=precipitation_probability&timezone=auto`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.current_weather) throw new Error('No weather data');
    
    const weatherInfo = WEATHER_CODES[data.current_weather.weathercode] || WEATHER_CODES[0];
    const weatherData = {
      temperature: Math.round(data.current_weather.temperature),
      weatherCode: data.current_weather.weathercode,
      windSpeed: data.current_weather.windspeed,
      isDay: data.current_weather.is_day === 1,
      precipitationProb: data.hourly?.precipitation_probability?.[0] || 0,
      condition: weatherInfo.label,
      effect: weatherInfo.effect,
      description: weatherInfo.description,
      iconType: weatherInfo.effect === 'sun' ? 'sun' : 
                 weatherInfo.effect.includes('rain') ? 'rain' :
                 weatherInfo.effect.includes('snow') ? 'snow' :
                 weatherInfo.effect === 'storm' ? 'storm' :
                 weatherInfo.effect === 'fog' ? 'fog' : 'clouds',
      timestamp: new Date().toISOString()
    };
    cacheWeather(weatherData);
    return weatherData;
  } catch (error) {
    console.error('[Weather] Fetch failed:', error);
    return {
      temperature: 24, weatherCode: 0, windSpeed: 5, isDay: true,
      precipitationProb: 0, condition: 'Weather unavailable', effect: 'none',
      iconType: 'clouds', isFallback: true
    };
  }
}

// Fetch 5-day forecast
export async function fetchForecast() {
  const cached = getCachedForecast();
  if (cached) return cached;
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LEGON_LAT}&longitude=${LEGON_LNG}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=5`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!data.daily) throw new Error('No forecast data');
    
    const forecast = [];
    for (let i = 0; i < data.daily.time.length; i++) {
      const weatherInfo = WEATHER_CODES[data.daily.weather_code[i]] || WEATHER_CODES[0];
      forecast.push({
        date: new Date(data.daily.time[i]),
        dayName: new Date(data.daily.time[i]).toLocaleDateString('en-US', { weekday: 'short' }),
        tempMax: Math.round(data.daily.temperature_2m_max[i]),
        tempMin: Math.round(data.daily.temperature_2m_min[i]),
        condition: weatherInfo.label,
        iconType: weatherInfo.effect === 'sun' ? 'sun' : 
                   weatherInfo.effect.includes('rain') ? 'rain' :
                   weatherInfo.effect.includes('snow') ? 'snow' :
                   weatherInfo.effect === 'storm' ? 'storm' :
                   weatherInfo.effect === 'fog' ? 'fog' : 'clouds',
        effect: weatherInfo.effect
      });
    }
    cacheForecast(forecast);
    return forecast;
  } catch (error) {
    console.error('[Weather] Forecast fetch failed:', error);
    return null;
  }
}

// Get routing multipliers
export function getWeatherMultipliers(weather) {
  if (!weather || weather.isFallback) {
    return { unpavedMultiplier: 1.0, lightingMultiplier: 1.0, exposedMultiplier: 1.0, shadeBonus: 1.0, speedReduction: 1.0, message: null };
  }
  
  const code = weather.weatherCode;
  const isNight = !weather.isDay;
  const isHeavyRain = [65, 67, 82].includes(code);
  const isLightRain = [51, 53, 55, 61, 63, 80, 81].includes(code);
  const isHeat = weather.temperature >= 30;
  const isStorm = [95, 96, 99].includes(code);
  const isSnow = [71, 73, 75, 77, 85, 86].includes(code);
  const isFog = [45, 48].includes(code);
  
  let unpavedMultiplier = 1.0, lightingMultiplier = 1.0, exposedMultiplier = 1.0, shadeBonus = 1.0, speedReduction = 1.0, message = null;
  
  if (isHeavyRain) {
    unpavedMultiplier = 3.0; exposedMultiplier = 1.5; speedReduction = 1.3;
    message = 'Heavy rain — avoiding unpaved paths';
  } else if (isLightRain) {
    unpavedMultiplier = 1.5; speedReduction = 1.1;
    message = 'Light rain — paved paths preferred';
  }
  if (isStorm) {
    unpavedMultiplier = 5.0; exposedMultiplier = 2.0; speedReduction = 1.4;
    message = 'Storm detected — seeking sheltered routes';
  }
  if (isSnow) {
    unpavedMultiplier = 2.5; speedReduction = 1.3;
    message = 'Snow — caution on all paths';
  }
  if (isFog) {
    lightingMultiplier = 1.5; speedReduction = 1.1;
    message = 'Foggy — reduced visibility';
  }
  if (isHeat) {
    shadeBonus = 0.7; exposedMultiplier = 1.3; speedReduction = 1.15;
    message = 'Heat advisory — preferring shaded routes';
  }
  if (isNight) {
    lightingMultiplier = 2.5;
    message = message ? `${message} · Night time` : 'Night time — prioritizing lit paths';
  }
  
  return { unpavedMultiplier, lightingMultiplier, exposedMultiplier, shadeBonus, speedReduction, message };
}