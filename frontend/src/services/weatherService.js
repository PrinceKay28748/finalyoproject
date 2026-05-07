// Weather service - Open-Meteo API (free, no API key required)
// Cached for 10 minutes to respect rate limits

const CACHE_KEY = 'ug_weather_cache';
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

// Legon campus coordinates
const LEGON_LAT = 5.6502;
const LEGON_LNG = -0.1869;

// Weather code mapping to human-readable conditions
export const WEATHER_CODES = {
  0: { label: 'Clear sky', icon: '☀️', effect: 'sun', description: 'Sunny and clear' },
  1: { label: 'Mainly clear', icon: '🌤️', effect: 'sun-cloud', description: 'Partly sunny' },
  2: { label: 'Partly cloudy', icon: '⛅', effect: 'clouds', description: 'Partly cloudy' },
  3: { label: 'Overcast', icon: '☁️', effect: 'clouds', description: 'Cloudy' },
  45: { label: 'Fog', icon: '🌫️', effect: 'fog', description: 'Foggy, limited visibility' },
  48: { label: 'Depositing rime fog', icon: '🌫️', effect: 'fog', description: 'Foggy' },
  51: { label: 'Light drizzle', icon: '🌧️', effect: 'rain-light', description: 'Light drizzle' },
  53: { label: 'Moderate drizzle', icon: '🌧️', effect: 'rain', description: 'Drizzling' },
  55: { label: 'Dense drizzle', icon: '🌧️', effect: 'rain-heavy', description: 'Heavy drizzle' },
  56: { label: 'Freezing drizzle', icon: '❄️', effect: 'rain', description: 'Freezing drizzle' },
  57: { label: 'Dense freezing drizzle', icon: '❄️', effect: 'rain', description: 'Freezing drizzle' },
  61: { label: 'Slight rain', icon: '🌧️', effect: 'rain-light', description: 'Light rain' },
  63: { label: 'Moderate rain', icon: '🌧️', effect: 'rain', description: 'Moderate rain' },
  65: { label: 'Heavy rain', icon: '🌧️', effect: 'rain-heavy', description: 'Heavy rain' },
  66: { label: 'Light freezing rain', icon: '❄️', effect: 'rain', description: 'Freezing rain' },
  67: { label: 'Heavy freezing rain', icon: '❄️', effect: 'rain', description: 'Heavy freezing rain' },
  71: { label: 'Slight snow', icon: '❄️', effect: 'snow', description: 'Light snow' },
  73: { label: 'Moderate snow', icon: '❄️', effect: 'snow', description: 'Snowing' },
  75: { label: 'Heavy snow', icon: '❄️', effect: 'snow-heavy', description: 'Heavy snow' },
  77: { label: 'Snow grains', icon: '❄️', effect: 'snow', description: 'Snow grains' },
  80: { label: 'Slight rain showers', icon: '🌦️', effect: 'rain', description: 'Rain showers' },
  81: { label: 'Moderate rain showers', icon: '🌧️', effect: 'rain', description: 'Rain showers' },
  82: { label: 'Violent rain showers', icon: '🌧️', effect: 'rain-heavy', description: 'Violent rain' },
  85: { label: 'Slight snow showers', icon: '🌨️', effect: 'snow', description: 'Snow showers' },
  86: { label: 'Heavy snow showers', icon: '🌨️', effect: 'snow-heavy', description: 'Heavy snow showers' },
  95: { label: 'Thunderstorm', icon: '⛈️', effect: 'storm', description: 'Thunderstorm' },
  96: { label: 'Thunderstorm with hail', icon: '⛈️', effect: 'storm', description: 'Thunderstorm with hail' },
  99: { label: 'Thunderstorm with heavy hail', icon: '⛈️', effect: 'storm', description: 'Severe thunderstorm' },
};

// Get cached weather or null
function getCachedWeather() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const { data, timestamp } = JSON.parse(cached);
    const now = Date.now();
    
    if (now - timestamp < CACHE_DURATION_MS) {
      return data;
    }
    return null;
  } catch (e) {
    console.warn('[Weather] Cache read failed:', e);
    return null;
  }
}

// Save weather to cache
function cacheWeather(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      data,
      timestamp: Date.now()
    }));
  } catch (e) {
    console.warn('[Weather] Cache write failed:', e);
  }
}

// Fetch current weather from Open-Meteo
export async function fetchWeather() {
  // Check cache first
  const cached = getCachedWeather();
  if (cached) {
    console.log('[Weather] Using cached data');
    return cached;
  }
  
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LEGON_LAT}&longitude=${LEGON_LNG}&current_weather=true&hourly=precipitation_probability&timezone=auto`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    
    const data = await response.json();
    
    if (!data.current_weather) {
      throw new Error('No weather data in response');
    }
    
    const weatherData = {
      temperature: Math.round(data.current_weather.temperature),
      weatherCode: data.current_weather.weathercode,
      windSpeed: data.current_weather.windspeed,
      isDay: data.current_weather.is_day === 1,
      precipitationProb: data.hourly?.precipitation_probability?.[0] || 0,
      timestamp: new Date().toISOString()
    };
    
    // Add human-readable info
    const weatherInfo = WEATHER_CODES[weatherData.weatherCode] || WEATHER_CODES[0];
    weatherData.condition = weatherInfo.label;
    weatherData.icon = weatherInfo.icon;
    weatherData.effect = weatherInfo.effect;
    weatherData.description = weatherInfo.description;
    
    // Cache the data
    cacheWeather(weatherData);
    
    console.log('[Weather] Fetched:', weatherData);
    return weatherData;
    
  } catch (error) {
    console.error('[Weather] Fetch failed:', error);
    
    // Return fallback data
    return {
      temperature: 24,
      weatherCode: 0,
      windSpeed: 5,
      isDay: true,
      precipitationProb: 0,
      condition: 'Weather data unavailable',
      description: 'Using default routing',
      icon: '🌡️',
      effect: 'none',
      isFallback: true
    };
  }
}

// Get routing multipliers based on weather (for costFunction)
export function getWeatherMultipliers(weather) {
  if (!weather || weather.isFallback) {
    return {
      unpavedMultiplier: 1.0,
      lightingMultiplier: 1.0,
      exposedMultiplier: 1.0,
      shadeBonus: 1.0,
      speedReduction: 1.0,
      message: null
    };
  }
  
  const code = weather.weatherCode;
  const isNight = !weather.isDay;
  const isHeavyRain = [65, 67, 82].includes(code);
  const isLightRain = [51, 53, 55, 61, 63, 80, 81].includes(code);
  const isHeat = weather.temperature >= 30;
  const isStorm = [95, 96, 99].includes(code);
  const isSnow = [71, 73, 75, 77, 85, 86].includes(code);
  const isFog = [45, 48].includes(code);
  
  let unpavedMultiplier = 1.0;
  let lightingMultiplier = 1.0;
  let exposedMultiplier = 1.0;
  let shadeBonus = 1.0;
  let speedReduction = 1.0;
  let message = null;
  
  if (isHeavyRain) {
    unpavedMultiplier = 3.0;
    exposedMultiplier = 1.5;
    speedReduction = 1.3;
    message = '⚠️ Heavy rain — avoiding unpaved paths, expect slower travel';
  } else if (isLightRain) {
    unpavedMultiplier = 1.5;
    speedReduction = 1.1;
    message = '🌧️ Light rain — paved paths preferred';
  }
  
  if (isStorm) {
    unpavedMultiplier = 5.0;
    exposedMultiplier = 2.0;
    speedReduction = 1.4;
    message = '⛈️ Storm detected — seeking sheltered routes';
  }
  
  if (isSnow) {
    unpavedMultiplier = 2.5;
    speedReduction = 1.3;
    message = '❄️ Snow — caution on all paths';
  }
  
  if (isFog) {
    lightingMultiplier = 1.5;
    speedReduction = 1.1;
    message = '🌫️ Foggy — reduced visibility, caution advised';
  }
  
  if (isHeat) {
    shadeBonus = 0.7;  // Prefer shaded routes (lower cost = better)
    exposedMultiplier = 1.3;
    speedReduction = 1.15;
    message = '🔥 Heat advisory — preferring shaded routes';
  }
  
  if (isNight) {
    lightingMultiplier = 2.5;  // Unlit paths much worse
    message = message ? `${message} · 🌙 Night time` : '🌙 Night time — prioritizing lit paths';
  }
  
  return {
    unpavedMultiplier,
    lightingMultiplier,
    exposedMultiplier,
    shadeBonus,
    speedReduction,
    message
  };
}