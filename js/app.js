/**
 * Weather App Logic
 * Fetches real-time weather data from Open-Meteo API.
 */

// DOM Elements
const elements = {
  citySearch: document.getElementById('city-search'),
  locationBtn: document.getElementById('location-btn'),
  autocompleteList: document.getElementById('autocomplete-list'),
  currentDate: document.getElementById('current-date'),
  cityName: document.getElementById('city-name'),
  currentTemp: document.getElementById('current-temp'),
  weatherCondition: document.getElementById('weather-condition'),
  humidity: document.getElementById('humidity'),
  windSpeed: document.getElementById('wind-speed'),
  feelsLike: document.getElementById('feels-like'),
  rainChance: document.getElementById('rain-chance'),
  hourlyContainer: document.getElementById('hourly-container')
};

// Language & Unit State
let currentLang = 'en';
let currentUnit = 'celsius'; // 'celsius' or 'fahrenheit'
let forecastView = 'hourly'; // 'hourly' or 'daily'
let currentWeatherData = null; // Store data for switching views

let debounceTimer;
let lastFetchedCity = 'Berlin';
let lastFetchedCoords = null;

const translations = {
  en: {
    searchPlaceholder: "Search for a city...",
    humidity: "Humidity",
    windSpeed: "Wind Speed",
    feelsLike: "Feels Like",
    rainChance: "Rain Chance",
    forecastHourly: "Hourly",
    forecastDaily: "7 Days",
    locationBtn: "Use Current Location",
    now: "Now",
    unitBtn: "Switch Unit"
  },
  de: {
    searchPlaceholder: "Stadt suchen...",
    humidity: "Luftfeuchtigkeit",
    windSpeed: "Windgeschw.",
    feelsLike: "Gefühlt",
    rainChance: "Regenwahrsch.",
    forecastHourly: "Stündlich",
    forecastDaily: "7 Tage",
    locationBtn: "Aktuellen Standort verwenden",
    now: "Jetzt",
    unitBtn: "Einheit wechseln"
  }
};

// Weather Codes Mapping
const weatherCodes = {
  0: { label: { en: 'Clear Sky', de: 'Klarer Himmel' }, icon: '☀️' },
  1: { label: { en: 'Mainly Clear', de: 'Überwiegend klar' }, icon: '🌤️' },
  2: { label: { en: 'Partly Cloudy', de: 'Teils bewölkt' }, icon: '⛅' },
  3: { label: { en: 'Overcast', de: 'Bewölkt' }, icon: '☁️' },
  45: { label: { en: 'Fog', de: 'Nebel' }, icon: '🌫️' },
  48: { label: { en: 'Depositing Rime Fog', de: 'Reifnebel' }, icon: '🌫️' },
  51: { label: { en: 'Light Drizzle', de: 'Leichter Sprühregen' }, icon: '🌧️' },
  53: { label: { en: 'Moderate Drizzle', de: 'Mäßiger Sprühregen' }, icon: '🌧️' },
  55: { label: { en: 'Dense Drizzle', de: 'Dichter Sprühregen' }, icon: '🌧️' },
  61: { label: { en: 'Slight Rain', de: 'Leichter Regen' }, icon: '🌧️' },
  63: { label: { en: 'Moderate Rain', de: 'Mäßiger Regen' }, icon: '🌧️' },
  65: { label: { en: 'Heavy Rain', de: 'Starker Regen' }, icon: '🌧️' },
  71: { label: { en: 'Slight Snow', de: 'Leichter Schneefall' }, icon: '❄️' },
  73: { label: { en: 'Moderate Snow', de: 'Mäßiger Schneefall' }, icon: '❄️' },
  75: { label: { en: 'Heavy Snow', de: 'Starker Schneefall' }, icon: '❄️' },
  77: { label: { en: 'Snow Grains', de: 'Schneegriesel' }, icon: '❄️' },
  80: { label: { en: 'Slight Rain Showers', de: 'Leichte Regenschauer' }, icon: '🌦️' },
  81: { label: { en: 'Moderate Rain Showers', de: 'Mäßige Regenschauer' }, icon: '🌦️' },
  82: { label: { en: 'Violent Rain Showers', de: 'Heftige Regenschauer' }, icon: '⛈️' },
  85: { label: { en: 'Slight Snow Showers', de: 'Leichte Schneeschauer' }, icon: '🌨️' },
  86: { label: { en: 'Heavy Snow Showers', de: 'Starke Schneeschauer' }, icon: '🌨️' },
  95: { label: { en: 'Thunderstorm', de: 'Gewitter' }, icon: '⛈️' },
  96: { label: { en: 'Thunderstorm with Hail', de: 'Gewitter mit Hagel' }, icon: '⛈️' },
  99: { label: { en: 'Heavy Hail Thunderstorm', de: 'Schweres Gewitter mit Hagel' }, icon: '⛈️' }
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
  updateDate();
  // Default City
  fetchWeatherByCityName('Berlin');
  setupEventListeners();
});

function updateDate() {
  const now = new Date();
  const locale = currentLang === 'en' ? 'en-US' : 'de-DE';
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  elements.currentDate.textContent = now.toLocaleDateString(locale, options);
}

function toggleLanguage() {
  currentLang = currentLang === 'en' ? 'de' : 'en';
  document.getElementById('lang-switch').textContent = currentLang === 'en' ? 'DE' : 'EN';
  updateUIText();

  // Re-fetch weather to update translated content and units if needed
  refreshWeatherData();
}

function toggleUnit() {
  currentUnit = currentUnit === 'celsius' ? 'fahrenheit' : 'celsius';
  document.getElementById('unit-switch').textContent = currentUnit === 'celsius' ? '°C' : '°F';
  refreshWeatherData();
}

function toggleForecastView(view) {
  if (forecastView === view) return;
  forecastView = view;

  // Update active class
  const btnHourly = document.getElementById('btn-hourly');
  const btnDaily = document.getElementById('btn-daily');

  if (btnHourly) btnHourly.classList.toggle('active', view === 'hourly');
  if (btnDaily) btnDaily.classList.toggle('active', view === 'daily');

  // Render view
  if (currentWeatherData) {
    if (view === 'hourly') {
      renderHourlyForecast(currentWeatherData.hourly, getCurrentHourIndex(currentWeatherData.hourly));
    } else {
      renderDailyForecast(currentWeatherData.daily);
    }
  }
}

function getCurrentHourIndex(hourly) {
  const now = new Date();
  // Simple search for the current hour
  for (let i = 0; i < hourly.time.length; i++) {
    const date = new Date(hourly.time[i]);
    if (date.getHours() === now.getHours() && date.getDate() === now.getDate()) {
      return i;
    }
  }
  return 0;
}

function refreshWeatherData() {
  if (lastFetchedCoords) {
    fetchWeatherByCoords(lastFetchedCoords.lat, lastFetchedCoords.lon, lastFetchedCoords.name);
  } else if (lastFetchedCity) {
    fetchWeatherByCityName(lastFetchedCity);
  }
}

function updateUIText() {
  // Update static text
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLang][key]) {
      el.textContent = translations[currentLang][key];
    }
  });

  // Update placeholders
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[currentLang][key]) {
      el.placeholder = translations[currentLang][key];
    }
  });

  // Update button titles
  if (elements.locationBtn) {
    elements.locationBtn.title = translations[currentLang].locationBtn;
  }
  const unitBtn = document.getElementById('unit-switch');
  if (unitBtn) {
    unitBtn.title = translations[currentLang].unitBtn;
  }

  updateDate();
}

function setupEventListeners() {
  // Language Switcher
  const langBtn = document.getElementById('lang-switch');
  if (langBtn) {
    langBtn.addEventListener('click', toggleLanguage);
  }

  // Unit Switcher
  const unitBtn = document.getElementById('unit-switch');
  if (unitBtn) {
    unitBtn.addEventListener('click', toggleUnit);
  }

  // Forecast Toggles
  const btnHourly = document.getElementById('btn-hourly');
  const btnDaily = document.getElementById('btn-daily');
  if (btnHourly) btnHourly.addEventListener('click', () => toggleForecastView('hourly'));
  if (btnDaily) btnDaily.addEventListener('click', () => toggleForecastView('daily'));

  // Search on Enter
  if (elements.citySearch) {
    elements.citySearch.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const query = elements.citySearch.value.trim();
        if (query) {
          lastFetchedCity = query;
          lastFetchedCoords = null;
          fetchWeatherByCityName(query);
          elements.autocompleteList.innerHTML = ''; // Clear suggestions
          elements.citySearch.blur();
        }
      }
    });

    // Autocomplete
    elements.citySearch.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      clearTimeout(debounceTimer);

      if (query.length < 2) {
        elements.autocompleteList.innerHTML = '';
        return;
      }

      debounceTimer = setTimeout(() => {
        fetchCitySuggestions(query);
      }, 300);
    });
  }

  // Hide autocomplete when clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== elements.citySearch && e.target !== elements.autocompleteList) {
      elements.autocompleteList.innerHTML = '';
    }
  });

  // Geolocation
  if (elements.locationBtn) {
    elements.locationBtn.addEventListener('click', () => {
      if (navigator.geolocation) {
        elements.locationBtn.style.opacity = '0.5'; // Visual feedback
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            fetchWeatherByCoords(latitude, longitude);
            elements.locationBtn.style.opacity = '1';
          },
          (error) => {
            console.warn("Native geolocation failed:", error);
            // Fallback to IP-based location
            fetchLocationByIP();
          }
        );
      } else {
        alert("Geolocation is not supported by your browser. Trying IP fallback...");
        fetchLocationByIP();
      }
    });
  }
}

async function fetchCitySuggestions(query) {
  try {
    const langParam = currentLang === 'de' ? 'de' : 'en';
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=${langParam}&format=json`;
    const response = await fetch(url);
    const data = await response.json();

    elements.autocompleteList.innerHTML = '';

    if (data.results) {
      data.results.forEach(city => {
        const li = document.createElement('li');
        li.className = 'autocomplete-item';
        // Display layout: City, Country Code
        const locationStr = [city.name, city.admin1, city.country_code].filter(Boolean).join(', ');
        li.innerHTML = `<span>${city.name}</span> <span class="country-code">${city.country_code || ''}</span>`;

        li.addEventListener('click', () => {
          elements.citySearch.value = city.name;
          elements.autocompleteList.innerHTML = '';
          lastFetchedCity = city.name;
          lastFetchedCoords = null;
          fetchWeatherByCoords(city.latitude, city.longitude, city.name);
        });

        elements.autocompleteList.appendChild(li);
      });
    }
  } catch (error) {
    console.error('Error fetching suggestions:', error);
  }
}

async function fetchWeatherByCityName(city) {
  try {
    const langParam = currentLang === 'de' ? 'de' : 'en';
    const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=${langParam}&format=json`;
    const geoResponse = await fetch(geoUrl);
    const geoData = await geoResponse.json();

    if (!geoData.results || geoData.results.length === 0) {
      alert(currentLang === 'de' ? 'Stadt nicht gefunden.' : 'City not found. Please try again.');
      return;
    }

    const { latitude, longitude, name } = geoData.results[0];
    lastFetchedCity = name;
    lastFetchedCoords = null;
    fetchWeatherByCoords(latitude, longitude, name);

  } catch (error) {
    console.error('Error fetching city data:', error);
    alert(currentLang === 'de' ? 'Fehler beim Laden der Stadtdaten.' : 'Failed to fetch city data.');
  }
}

async function fetchWeatherByCoords(lat, lon, cityName = null) {
  try {
    let displayCity = cityName;
    if (!displayCity) {
      displayCity = currentLang === 'de' ? "Mein Standort" : "My Location";
    }

    // Update last fetched coords for refreshing on language switch
    lastFetchedCoords = { lat, lon, name: cityName };

    elements.cityName.textContent = displayCity;

    // Use currentUnit for fetching data
    const unitParam = currentUnit === 'fahrenheit' ? '&temperature_unit=fahrenheit' : '';
    // Added daily parameters and 7 forecast days
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,wind_speed_10m,weather_code&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7${unitParam}`;

    const weatherResponse = await fetch(weatherUrl);
    const weatherData = await weatherResponse.json();

    currentWeatherData = weatherData; // Store for toggling
    renderWeather(weatherData);

  } catch (error) {
    console.error('Error fetching weather:', error);
    alert(currentLang === 'de' ? 'Fehler beim Laden der Wetterdaten.' : 'Failed to fetch weather data.');
  }
}

function renderWeather(data) {
  const current = data.current;
  const hourly = data.hourly;
  const currentIndex = getCurrentHourIndex(hourly);

  const weatherCode = current.weather_code;
  const weatherInfo = weatherCodes[weatherCode] || { label: { en: 'Unknown', de: 'Unbekannt' }, icon: '❓' };

  // Use current language for label
  const conditionLabel = weatherInfo.label[currentLang] || weatherInfo.label['en'];

  elements.currentTemp.textContent = Math.round(current.temperature_2m);

  // Set main unit display
  const unitDisplay = document.querySelector('.temp-display .unit');
  if (unitDisplay) {
    unitDisplay.textContent = currentUnit === 'celsius' ? '°C' : '°F';
  }

  elements.weatherCondition.textContent = conditionLabel;

  // Update Background based on Temperature
  let tempCelsius = current.temperature_2m;
  if (currentUnit === 'fahrenheit') {
    tempCelsius = (current.temperature_2m - 32) * 5 / 9;
  }

  document.body.className = ''; // Reset classes

  if (tempCelsius >= 25) {
    document.body.classList.add('bg-hot');
  } else if (tempCelsius >= 15) {
    document.body.classList.add('bg-warm');
  } else if (tempCelsius >= 5) {
    document.body.classList.add('bg-cool');
  } else {
    document.body.classList.add('bg-cold');
  }

  elements.humidity.textContent = `${current.relative_humidity_2m}%`;
  elements.windSpeed.textContent = `${current.wind_speed_10m} km/h`;

  elements.feelsLike.textContent = `${Math.round(current.apparent_temperature)}${currentUnit === 'celsius' ? '°C' : '°F'}`;

  const rainProb = hourly.precipitation_probability[currentIndex] || 0;
  elements.rainChance.textContent = `${rainProb}%`;

  // Render correct forecast view
  if (forecastView === 'hourly') {
    renderHourlyForecast(hourly, currentIndex);
  } else {
    renderDailyForecast(data.daily);
  }
}

function renderHourlyForecast(hourly, startIndex) {
  elements.hourlyContainer.innerHTML = '';
  // Switch to flex-row for hourly (horizontal scroll)
  elements.hourlyContainer.style.flexDirection = 'row';
  elements.hourlyContainer.style.overflowX = 'auto';
  elements.hourlyContainer.style.flexWrap = 'nowrap';
  elements.hourlyContainer.style.justifyContent = 'flex-start';

  const unitLabel = '°';

  // Display next 24 hours
  for (let i = startIndex; i < startIndex + 24 && i < hourly.time.length; i++) {
    const timeStr = hourly.time[i];
    const date = new Date(timeStr);
    const hour = date.getHours();

    const temp = Math.round(hourly.temperature_2m[i]);
    const code = hourly.weather_code[i];
    const icon = (weatherCodes[code] || { icon: '❓' }).icon;

    // Translated "Now"
    const nowText = translations[currentLang].now;

    const div = document.createElement('div');
    div.className = `hourly-item ${i === startIndex ? 'active' : ''}`;
    div.innerHTML = `
            <span class="time">${i === startIndex ? nowText : hour + ':00'}</span>
            <div class="icon">${icon}</div>
            <span class="temp">${temp}${unitLabel}</span>
        `;
    elements.hourlyContainer.appendChild(div);
  }
}

function renderDailyForecast(daily) {
  elements.hourlyContainer.innerHTML = '';

  // Ensure horizontal layout (same as hourly)
  elements.hourlyContainer.style.flexDirection = 'row';
  elements.hourlyContainer.style.overflowX = 'auto';
  elements.hourlyContainer.style.flexWrap = 'nowrap';
  elements.hourlyContainer.style.justifyContent = 'flex-start';

  const unitLabel = '°';
  const locale = currentLang === 'en' ? 'en-US' : 'de-DE';

  for (let i = 0; i < daily.time.length; i++) {
    const date = new Date(daily.time[i]);
    const dayName = date.toLocaleDateString(locale, { weekday: 'short' }); // Short day name (Mon, Tue)

    // Calculate temperatures
    const maxTemp = Math.round(daily.temperature_2m_max[i]);
    const minTemp = Math.round(daily.temperature_2m_min[i]);

    const code = daily.weather_code[i];
    const icon = (weatherCodes[code] || { icon: '❓' }).icon;

    const div = document.createElement('div');
    div.className = 'hourly-item daily-item';

    // Remove the inline styles that forced list view
    div.removeAttribute('style');

    // Use same inner structure as hourly for consistency
    div.innerHTML = `
            <span class="time">${dayName}</span>
            <div class="icon">${icon}</div>
            <span class="temp" style="font-size: 0.9rem;">${maxTemp}${unitLabel} / ${minTemp}${unitLabel}</span>
        `;
    elements.hourlyContainer.appendChild(div);
  }
}

async function fetchLocationByIP() {
  try {
    const response = await fetch('https://get.geojs.io/v1/ip/geo.json');
    const data = await response.json();
    fetchWeatherByCoords(parseFloat(data.latitude), parseFloat(data.longitude), data.city);
    elements.locationBtn.style.opacity = '1';
  } catch (error) {
    console.error("IP fallback failed:", error);
    alert(currentLang === 'de' ? "Standort konnte nicht ermittelt werden." : "Could not determine location via IP.");
    elements.locationBtn.style.opacity = '1';
  }
}
