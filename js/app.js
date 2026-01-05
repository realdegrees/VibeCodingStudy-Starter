import { config } from './config.js';

const app = {
  unit: 'C', // 'C' or 'F'
  lastWeatherData: null,
  lastLocationName: '',

  formatTemp(celsius) {
    if (typeof celsius !== 'number') return '—';
    if (this.unit === 'C') {
      return `${Math.round(celsius)}<span class="unit">°C</span>`;
    }
    // convert to Fahrenheit
    const f = celsius * 9 / 5 + 32;
    return `${Math.round(f)}<span class="unit">°F</span>`;
  },

  setUnit(u) {
    this.unit = u === 'F' ? 'F' : 'C';
    try { localStorage.setItem('tempUnit', this.unit); } catch (e) {}
    const btn = document.getElementById('unit-toggle');
    if (btn) btn.textContent = (this.unit === 'C' ? '°C' : '°F');
    // re-render last data
    if (this.lastWeatherData) {
      this.displayWeather(this.lastWeatherData, this.lastLocationName);
    }
  },

  toggleUnit() {
    this.setUnit(this.unit === 'C' ? 'F' : 'C');
  },

  async init() {
    // restore unit from localStorage if present
    try { const u = localStorage.getItem('tempUnit'); if (u) this.unit = u; } catch (e) {}
    // ensure toggle button shows correct unit
    const existingBtn = document.getElementById('unit-toggle');
    if (existingBtn) existingBtn.textContent = (this.unit === 'C' ? '°C' : '°F');

    try {
      // Default: Berlin (lat 52.52, lon 13.41)
      const defaultCity = 'Berlin';
      const coords = await this.fetchCoordinates(defaultCity);
      if (coords) {
        const data = await this.fetchWeather(coords.latitude, coords.longitude);
        this.lastWeatherData = data;
        this.lastLocationName = coords.name || defaultCity;
        this.displayWeather(data, coords.name);
      } else {
        // fallback coordinates
        const data = await this.fetchWeather(52.52, 13.41);
        this.lastWeatherData = data;
        this.lastLocationName = 'Berlin';
        this.displayWeather(data, 'Berlin');
      }
    } catch (err) {
      console.error('Init error:', err);
      const el = document.getElementById('weather');
      if (el) {
        el.classList.remove('hidden');
        el.querySelector('.temp').textContent = '—';
        const meta = el.querySelector('.meta');
        if (meta) meta.textContent = 'Fehler beim Laden';
      }
    }
  },

  async fetchWeather(lat, lon) {
    // Request current weather + hourly temperature and wind for next days (timezone=auto for local times)
    const url = `${config.API_URL}/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,windspeed_10m&forecast_days=3&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    return await response.json();
  },

  formatWind(kmh) {
    if (typeof kmh !== 'number') return '—';
    if (this.unit === 'C') {
      return `${Math.round(kmh)} km/h`;
    }
    const mph = kmh * 0.621371;
    return `${Math.round(mph)} mph`;
  },

  displayForecast(data) {
    const container = document.getElementById('forecast');
    if (!container) return;
    container.innerHTML = '';
    const times = data?.hourly?.time || [];
    const temps = data?.hourly?.temperature_2m || [];
    const currentTime = data?.current_weather?.time;

    // find current index in hourly times
    let start = 0;
    if (currentTime) {
      const idx = times.indexOf(currentTime);
      if (idx >= 0) start = idx + 1; // next hour
    }

    const count = 6; // show next 6 entries
    for (let i = 0; i < count; i++) {
      const tIdx = start + i;
      if (tIdx >= times.length) break;
      const timeStr = times[tIdx];
      const tempC = temps[tIdx];

      const item = document.createElement('div');
      item.className = 'forecast-item';
      const timeEl = document.createElement('div');
      timeEl.className = 'time';
      // format time as hour:minute (local)
      // show relative label like "in 1 Std.", "in 2 Std." etc.
      const relHours = i + 1; // next hours after current
      const label = `in ${relHours} Std.`;
      timeEl.textContent = label;

    const windKmh = data?.hourly?.windspeed_10m?.[tIdx];

      const tEl = document.createElement('div');
      tEl.className = 'f-temp';
      tEl.innerHTML = (typeof tempC === 'number') ? this.formatTemp(tempC) : '—';

      const wEl = document.createElement('div');
      wEl.className = 'f-wind';
      wEl.textContent = (typeof windKmh === 'number') ? this.formatWind(windKmh) : '';

      item.appendChild(timeEl);
      item.appendChild(tEl);
      item.appendChild(wEl);
      container.appendChild(item);
    }

    container.classList.remove('hidden');
  },

  async fetchCoordinates(city) {
    if (!city) return null;
    const url = `${config.GEOCODING_URL}/search?name=${encodeURIComponent(city)}&count=1&language=de`;
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('Geocoding request failed', response.status);
      return null;
    }
    const data = await response.json();
    const result = data?.results?.[0];
    if (!result) return null;
    return {
      name: result.name + (result.admin1 ? ', ' + result.admin1 : ''),
      latitude: result.latitude,
      longitude: result.longitude,
    };
  },

  displayWeather(data, locationName = '') {
    // Erwartete Struktur: data.current_weather.temperature
    const temp = data?.current_weather?.temperature;
    const el = document.getElementById('weather');
    if (!el) return;

    el.classList.remove('hidden');
    const tempEl = el.querySelector('.temp');
    const metaEl = el.querySelector('.meta');

    // save last
    this.lastWeatherData = data;
    this.lastLocationName = locationName || this.lastLocationName;

    if (typeof temp === 'number') {
      // Anzeige je nach Einheit
      tempEl.innerHTML = this.formatTemp(temp);
      const windEl = el.querySelector('.wind');
      const currentWind = data?.current_weather?.windspeed;
      if (windEl) windEl.textContent = 'Wind: ' + ((typeof currentWind === 'number') ? this.formatWind(currentWind) : '—');
      if (metaEl) metaEl.textContent = (locationName ? `${locationName} · jetzt` : 'Jetzt');
      // also render forecast strip
      try { this.displayForecast(data); } catch (e) { console.warn('Forecast render failed', e); }
    } else {
      tempEl.textContent = '—';
      if (metaEl) metaEl.textContent = 'Keine Daten';
    }
  },
};

// Start app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  app.init();
  // unit toggle handler
  const unitBtn = document.getElementById('unit-toggle');
  if (unitBtn) unitBtn.addEventListener('click', () => app.toggleUnit());
  // Hook up search form
  const form = document.getElementById('search-form');
  const input = document.getElementById('city-input');
  if (form && input) {
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const city = input.value.trim();
      if (!city) return;

      // show loading state
      const weatherEl = document.getElementById('weather');
      if (weatherEl) {
        weatherEl.classList.remove('hidden');
        weatherEl.querySelector('.temp').textContent = '—';
        weatherEl.querySelector('.meta').textContent = 'Lade…';
      }

      try {
          const coords = await app.fetchCoordinates(city);
          console.log('Search coords:', coords);
        if (!coords) {
          if (weatherEl) weatherEl.querySelector('.meta').textContent = 'Stadt nicht gefunden';
          return;
        }
        const data = await app.fetchWeather(coords.latitude, coords.longitude);
          console.log('Search weather data:', data);
        app.displayWeather(data, coords.name);
      } catch (err) {
        console.error('Search error', err);
        if (weatherEl) weatherEl.querySelector('.meta').textContent = 'Fehler beim Laden';
      }
    });
  }
});
