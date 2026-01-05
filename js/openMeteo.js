/**
 * Open-Meteo API wrapper.
 */

const GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";

/**
 * Format a Date or string into YYYY-MM-DD.
 */
function formatDateToYMD(dateInput) {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Perform a simple fetch and parse JSON with error handling.
 */
async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

/**
 * Geocode a city name to latitude/longitude using Open-Meteo's geocoding API.
 */
export async function geocodeCity(cityName) {
  const encoded = encodeURIComponent(cityName);
  const url = `${GEOCODING_BASE}?name=${encoded}&count=1`;
  const data = await fetchJson(url);
  if (!data || !data.results || data.results.length === 0) {
    throw new Error("City not found");
  }
  const top = data.results[0];
  return {
    latitude: top.latitude,
    longitude: top.longitude,
    name: top.name,
    country: top.country,
  };
}

/**
 * Get current weather for a city.
 */
export async function getCurrentWeather(cityName) {
  const location = await geocodeCity(cityName);
  const url = `${OPEN_METEO_BASE}?latitude=${location.latitude}&longitude=${location.longitude}&current_weather=true&timezone=auto`;
  const data = await fetchJson(url);
  return {
    location,
    current: data.current_weather,
  };
}

/**
 * Get hourly forecast for a city.
 */
export async function getHourlyForecast(cityName, options = {}) {
  const {
    hourly = ["temperature_2m", "relativehumidity_2m"],
    startDate = new Date(),
    endDate = new Date(new Date().getTime() + 24 * 60 * 60 * 1000),
  } = options;

  const location = await geocodeCity(cityName);
  const start = formatDateToYMD(startDate);
  const end = formatDateToYMD(endDate);
  const hourlyParam = hourly.join(",");
  const url = `${OPEN_METEO_BASE}?latitude=${location.latitude}&longitude=${location.longitude}&hourly=${hourlyParam}&start_date=${start}&end_date=${end}&timezone=auto`;
  const data = await fetchJson(url);
  return {
    location,
    hourly: data.hourly,
  };
}

/**
 * Get daily forecast for a city.
 */
export async function getDailyForecast(cityName, options = {}) {
  const {
    daily = ["temperature_2m_max", "temperature_2m_min", "precipitation_sum"],
    startDate = new Date(),
    endDate = new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
  } = options;

  const location = await geocodeCity(cityName);
  const start = formatDateToYMD(startDate);
  const end = formatDateToYMD(endDate);
  const dailyParam = daily.join(",");
  const url = `${OPEN_METEO_BASE}?latitude=${location.latitude}&longitude=${location.longitude}&daily=${dailyParam}&start_date=${start}&end_date=${end}&timezone=auto`;
  const data = await fetchJson(url);
  return {
    location,
    daily: data.daily,
  };
}

export default {
  geocodeCity,
  getCurrentWeather,
  getHourlyForecast,
  getDailyForecast,
};
