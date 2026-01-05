const app = {
  init() {
    this.cache();
    this.bind();
    this.loadFavorites();
    this.renderFavorites();
    
    // Load last search
    const last = localStorage.getItem('lastCity');
    if (last) {
      try {
        const parsed = JSON.parse(last);
        if (parsed.lat && parsed.lon) {
          this.fetchForecastByCoords(parsed.lat, parsed.lon, parsed.name);
        } else {
          this.fetchWeather(parsed);
        }
      } catch(e) {
        // legacy or string
        this.fetchWeather(last);
      }
    }
  },

  cache() {
    this.form = document.getElementById('search-form');
    this.input = document.getElementById('city-input');
    this.locationBtn = document.getElementById('location-btn');
    this.status = document.getElementById('status');
    this.weatherEl = document.getElementById('weather');
    this.leftCol = document.getElementById('weather-left');
    this.rightCol = document.getElementById('weather-right');
    this.todaySection = document.getElementById('today-hourly');
    this.weeklySection = document.getElementById('weekly-forecast');
    this.unitToggle = document.getElementById('unit-toggle');
    this.unit = 'C'; // 'C' or 'F'
    this.lastData = null; // store raw payload (C) for re-render on toggle
    this.favContainer = document.getElementById('favorites');
    this.suggestions = document.getElementById('suggestions');
    this.suggestionItems = [];
    this.suggestionIndex = -1;
  },

  bind() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const city = this.input.value.trim();
      if (city) this.fetchWeather(city);
    });
    if (this.locationBtn) {
      this.locationBtn.addEventListener('click', () => this.handleLocation());
    }
    if (this.unitToggle) {
      this.unitToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleUnit();
      });
    }
    // autocomplete handlers
    if (this.input) {
      this.input.addEventListener('input', (e) => {
        const q = e.target.value.trim();
        this.debouncedSuggest(q);
      });
      this.input.addEventListener('keydown', (e) => this.handleInputKeydown(e));
      document.addEventListener('click', (e) => {
        if (!this.suggestions) return;
        if (!this.suggestions.contains(e.target) && e.target !== this.input) this.hideSuggestions();
      });
    }
  },

  // debounce helper
  debouncedSuggest: (function () {
    let timer = null;
    return function (q) {
      clearTimeout(timer);
      timer = setTimeout(() => { app.fetchSuggestions(q); }, 300);
    };
  })(),

  async fetchSuggestions(q) {
    if (!q || q.length < 2) { this.hideSuggestions(); return; }
    try {
      const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=6`);
      if (!res.ok) return this.hideSuggestions();
      const data = await res.json();
      const results = data.results || [];
      this.showSuggestions(results);
    } catch (e) { this.hideSuggestions(); }
  },

  showSuggestions(list) {
    if (!this.suggestions) return;
    this.suggestions.innerHTML = '';
    this.suggestionItems = [];
    this.suggestionIndex = -1;
    if (!list || list.length === 0) { this.hideSuggestions(); return; }
    list.forEach((p, i) => {
      const li = document.createElement('li');
      li.className = 'suggestion-item';
      li.setAttribute('role', 'option');
      const name = `${p.name}${p.admin1 ? ', ' + p.admin1 : ''}${p.country ? ', ' + p.country : ''}`;
      li.innerHTML = `<div class="suggestion-name">${name}</div><div class="suggestion-sub">${p.latitude.toFixed(2)}, ${p.longitude.toFixed(2)}</div>`;
      li.dataset.lat = p.latitude;
      li.dataset.lon = p.longitude;
      li.dataset.name = name;
      li.addEventListener('click', () => {
        if (this.input) this.input.value = name;
        this.hideSuggestions();
        this.fetchWeather({ name, lat: p.latitude, lon: p.longitude });
      });
      this.suggestions.appendChild(li);
      this.suggestionItems.push(li);
    });
    this.suggestions.classList.remove('hidden');
  },

  hideSuggestions() {
    if (!this.suggestions) return;
    this.suggestions.classList.add('hidden');
    this.suggestions.innerHTML = '';
    this.suggestionItems = [];
    this.suggestionIndex = -1;
  },

  handleInputKeydown(e) {
    if (!this.suggestionItems || this.suggestionItems.length === 0) return;
    const key = e.key;
    if (key === 'ArrowDown') {
      e.preventDefault();
      this.suggestionIndex = Math.min(this.suggestionIndex + 1, this.suggestionItems.length - 1);
      this.updateSuggestionActive();
    } else if (key === 'ArrowUp') {
      e.preventDefault();
      this.suggestionIndex = Math.max(this.suggestionIndex - 1, 0);
      this.updateSuggestionActive();
    } else if (key === 'Enter') {
      if (this.suggestionIndex >= 0 && this.suggestionItems[this.suggestionIndex]) {
        e.preventDefault();
        const li = this.suggestionItems[this.suggestionIndex];
        const name = li.dataset.name;
        const lat = Number(li.dataset.lat);
        const lon = Number(li.dataset.lon);
        if (this.input) this.input.value = name;
        this.hideSuggestions();
        this.fetchWeather({ name, lat, lon });
      }
    } else if (key === 'Escape') {
      this.hideSuggestions();
    }
  },

  updateSuggestionActive() {
    this.suggestionItems.forEach((it, idx) => {
      if (idx === this.suggestionIndex) it.classList.add('active'); else it.classList.remove('active');
    });
    const active = this.suggestionItems[this.suggestionIndex];
    if (active) active.scrollIntoView({ block: 'nearest' });
  },

  handleLocation() {
    if (!navigator.geolocation) {
      alert('Geolocation ist nicht verfügbar.');
      return;
    }
    this.setStatus('Ermittle Standort...');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=de`);
          let name = 'Mein Standort';
          if (res.ok) {
             const data = await res.json();
             if (data.results && data.results.length > 0) {
               name = data.results[0].name;
             }
          }
          if (this.input) this.input.value = name;
          this.fetchForecastByCoords(latitude, longitude, name);
        } catch (e) {
          this.fetchForecastByCoords(latitude, longitude, 'Mein Standort');
        }
      },
      (err) => {
        console.warn('Geolocation failed, trying IP fallback...', err);
        this.fetchLocationByIP();
      },
      { timeout: 10000, enableHighAccuracy: false }
    );
  },

  async fetchLocationByIP() {
    try {
      this.setStatus('Ermittle Standort via IP...');
      const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
      if (!res.ok) throw new Error('IP Location failed');
      const data = await res.json();
      const latitude = parseFloat(data.latitude);
      const longitude = parseFloat(data.longitude);
      const city = data.city || 'Mein Standort';
      
      if (this.input) this.input.value = city;
      this.fetchForecastByCoords(latitude, longitude, city);
    } catch (e) {
      console.error(e);
      this.setStatus('Standort konnte nicht ermittelt werden.');
      setTimeout(() => this.setStatus(''), 3000);
    }
  },

  async fetchWeather(city) {
    try {
      // support passing a favorite object {name, lat, lon}
      if (city && typeof city === 'object' && city.lat && city.lon) {
        return this.fetchForecastByCoords(city.lat, city.lon, city.name || city.city);
      }
      this.setStatus(`Suche nach „${city}“...`);
      // hide forecast sections while loading / on new search
      if (this.todaySection) this.todaySection.classList.add('hidden');
      if (this.weeklySection) this.weeklySection.classList.add('hidden');
      const hourlyEl = document.getElementById('hourly'); if (hourlyEl) hourlyEl.innerHTML = '';
      const weeklyEl = document.getElementById('weekly'); if (weeklyEl) weeklyEl.innerHTML = '';

      // Geocoding (Open-Meteo geocoding API)
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          city
        )}&count=1`
      );

      if (!geoRes.ok) throw new Error('Geocoding fehlgeschlagen');
      const geo = await geoRes.json();
      if (!geo.results || geo.results.length === 0) {
        this.setStatus('Keine Stadt gefunden. Bitte Namen prüfen.');
        return;
      }

      const place = geo.results[0];
      const lat = place.latitude;
      const lon = place.longitude;
      const placeName = `${place.name}${place.admin1 ? ', ' + place.admin1 : ''}${place.country ? ', ' + place.country : ''}`;

      this.setStatus(`Lade Wetter für ${placeName}...`);

      // Forecast: include hourly temperatures, humidity, apparent temp and daily summaries
      // Using 'current' parameter for robust current weather data including humidity/feels_like
      const forecastUrl = `${config.API_URL}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,visibility,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`;
      const weatherRes = await fetch(forecastUrl);
      if (!weatherRes.ok) throw new Error('Wetterdaten konnten nicht geladen werden');
      const data = await weatherRes.json();

      const current = data.current || {};
      
      const payload = {
        city: placeName,
        lat,
        lon,
        temperature: current.temperature_2m,
        windspeed: current.wind_speed_10m,
        winddir: current.wind_direction_10m,
        weathercode: current.weather_code,
        time: current.time,
        humidity: current.relative_humidity_2m,
        feels_like: current.apparent_temperature,
        pressure: current.surface_pressure,
        visibility: current.visibility,
        hourly: data.hourly || null,
        daily: data.daily || null,
        sunrise: data.daily?.sunrise?.[0],
        sunset: data.daily?.sunset?.[0],
        uv_index: data.daily?.uv_index_max?.[0],
        precip_prob: data.daily?.precipitation_probability_max?.[0],
      };

      // Save to localStorage
      localStorage.setItem('lastCity', JSON.stringify({ name: placeName, lat, lon }));

      // store raw payload (temperatures are in °C from API)
      this.lastData = payload;
      this.displayWeather(this.lastData);
      this.setStatus('');
    } catch (err) {
      this.setStatus(err.message || 'Fehler bei der Anfrage');
      if (this.todaySection) this.todaySection.classList.add('hidden');
      if (this.weeklySection) this.weeklySection.classList.add('hidden');
    }
  },

  async fetchForecastByCoords(lat, lon, name) {
    try {
      this.setStatus(`Lade Wetter für ${name || lat + ',' + lon}...`);
      if (this.todaySection) this.todaySection.classList.add('hidden');
      if (this.weeklySection) this.weeklySection.classList.add('hidden');
      const forecastUrl = `${config.API_URL}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,visibility,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,weather_code,sunrise,sunset,uv_index_max,precipitation_probability_max&timezone=auto`;
      const weatherRes = await fetch(forecastUrl);
      if (!weatherRes.ok) throw new Error('Wetterdaten konnten nicht geladen werden');
      const data = await weatherRes.json();

      const current = data.current || {};

      const payload = {
        city: name || `${lat},${lon}`,
        lat,
        lon,
        temperature: current.temperature_2m,
        windspeed: current.wind_speed_10m,
        winddir: current.wind_direction_10m,
        weathercode: current.weather_code,
        time: current.time,
        humidity: current.relative_humidity_2m,
        feels_like: current.apparent_temperature,
        pressure: current.surface_pressure,
        visibility: current.visibility,
        hourly: data.hourly || null,
        daily: data.daily || null,
        sunrise: data.daily?.sunrise?.[0],
        sunset: data.daily?.sunset?.[0],
        uv_index: data.daily?.uv_index_max?.[0],
        precip_prob: data.daily?.precipitation_probability_max?.[0],
      };
      
      // Save to localStorage
      localStorage.setItem('lastCity', JSON.stringify({ name: payload.city, lat, lon }));

      this.lastData = payload;
      this.displayWeather(this.lastData);
      this.setStatus('');
    } catch (err) {
      this.setStatus(err.message || 'Fehler beim Laden');
    }
  },

  weatherCodeToDesc(code) {
    // Minimal mapping to description + emoji for visual hint
    const map = {
      0: ['Klar', '☀️'],
      1: ['Teilweise bewölkt', '🌤️'],
      2: ['Bewölkt', '⛅'],
      3: ['Bedeckt', '☁️'],
      45: ['Nebel', '🌫️'],
      48: ['Gefrierender Nebel', '🌫️❄️'],
      51: ['Leichter Nieselregen', '🌦️'],
      53: ['Mäßiger Nieselregen', '🌦️'],
      55: ['Starker Nieselregen', '🌧️'],
      56: ['Leichter gefrierender Nieselregen', '🌧️❄️'],
      57: ['Starker gefrierender Nieselregen', '🌧️❄️'],
      61: ['Leichter Regen', '🌧️'],
      63: ['Mäßiger Regen', '🌧️'],
      65: ['Starker Regen', '🌧️'],
      66: ['Leichter gefrierender Regen', '🌧️❄️'],
      67: ['Starker gefrierender Regen', '🌧️❄️'],
      71: ['Leichter Schneefall', '❄️'],
      73: ['Mäßiger Schneefall', '❄️'],
      75: ['Starker Schneefall', '❄️'],
      77: ['Schneegriesel', '❄️'],
      80: ['Leichte Regenschauer', '🌦️'],
      81: ['Mäßige Regenschauer', '🌦️'],
      82: ['Starke Regenschauer', '🌧️'],
      85: ['Leichte Schneeschauer', '❄️'],
      86: ['Starke Schneeschauer', '❄️'],
      95: ['Gewitter', '⛈️'],
      96: ['Gewitter mit leichtem Hagel', '⛈️🌨️'],
      99: ['Gewitter mit starkem Hagel', '⛈️🌨️'],
    };
    return map[code] || ['Unbekannt', '❔'];
  },

  updateTheme(code) {
    // Remove existing theme classes
    document.body.classList.remove(
      'theme-sunny', 'theme-cloudy', 'theme-rainy', 
      'theme-snowy', 'theme-foggy', 'theme-stormy'
    );

    let themeClass = '';
    
    // Map WMO codes to themes
    if (code === 0 || code === 1) {
      themeClass = 'theme-sunny';
    } else if (code === 2 || code === 3) {
      themeClass = 'theme-cloudy';
    } else if (code === 45 || code === 48) {
      themeClass = 'theme-foggy';
    } else if (
      (code >= 51 && code <= 67) || 
      (code >= 80 && code <= 82)
    ) {
      themeClass = 'theme-rainy';
    } else if (
      (code >= 71 && code <= 77) || 
      (code >= 85 && code <= 86)
    ) {
      themeClass = 'theme-snowy';
    } else if (code >= 95 && code <= 99) {
      themeClass = 'theme-stormy';
    } else {
      // Default fallback if code not matched (e.g. unknown)
      themeClass = 'theme-cloudy'; 
    }

    if (themeClass) {
      document.body.classList.add(themeClass);
    }
  },

  displayWeather(d) {
    // Update theme based on weather code
    this.updateTheme(d.weathercode);

    // Clear left/right columns explicitly
    if (this.leftCol) this.leftCol.innerHTML = '';
    if (this.rightCol) this.rightCol.innerHTML = '';
    const [desc, emoji] = this.weatherCodeToDesc(d.weathercode);

    const card = document.createElement('div');
    card.className = 'weather-card animate-enter';
    card.innerHTML = `
      <div class="weather-left">
        <div class="weather-emoji" aria-hidden="true" style="font-size:2rem">${emoji}</div>
      </div>
      <div>
        <div class="weather-main">${this.formatTemp(d.temperature)} — ${desc}</div>
        <div class="weather-meta">${d.city}</div>
      </div>
    `;

    if (this.leftCol) this.leftCol.appendChild(card);
    else this.weatherEl.appendChild(card);
    // add favorite button
    if (card && this.favContainer) {
      const favBtn = document.createElement('button');
      favBtn.className = 'fav-add';
      favBtn.title = 'Zu Favoriten hinzufügen';
      favBtn.textContent = '❤';
      
      // reflect current favorite state
      const isFav = (d.lat != null && d.lon != null) ? this.isFavorite(d.lat, d.lon) : false;
      if (isFav) favBtn.classList.add('active');
      
      // Accessibility
      favBtn.setAttribute('aria-label', isFav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen');
      favBtn.setAttribute('aria-pressed', isFav ? 'true' : 'false');

      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (d.lat != null && d.lon != null) {
          // toggle favorite
          if (this.isFavorite(d.lat, d.lon)) {
            this.removeFavoriteByCoords(d.lat, d.lon);
            favBtn.classList.remove('active');
            favBtn.setAttribute('aria-label', 'Zu Favoriten hinzufügen');
            favBtn.setAttribute('aria-pressed', 'false');
          } else {
            this.addFavorite(d.city, d.lat, d.lon);
            favBtn.classList.add('active');
            favBtn.setAttribute('aria-label', 'Aus Favoriten entfernen');
            favBtn.setAttribute('aria-pressed', 'true');
          }
        }
      });
      // append to leftCol card header area
      const meta = card.querySelector('.weather-meta');
      if (meta) meta.appendChild(favBtn);
    }
    // Details grid (humidity, wind, feels-like, time)
    const details = document.createElement('div');
    details.className = 'weather-details animate-enter';

    const makeDetail = (label, value) => {
      const el = document.createElement('div');
      el.className = 'detail-item';
      el.innerHTML = `<span class="detail-label">${label}</span><span class="detail-value">${value}</span>`;
      return el;
    };

    details.appendChild(makeDetail('Uhrzeit', this.formatHour(d.time)));
    details.appendChild(makeDetail('Luftfeuchtigkeit', d.humidity != null ? d.humidity + '%' : '—'));
    details.appendChild(makeDetail('Wind', d.windspeed != null ? `${d.windspeed} km/h ${this.getWindDir(d.winddir)}` : '—'));
    details.appendChild(makeDetail('Gefühlt', d.feels_like != null ? this.formatTemp(d.feels_like) : '—'));
    if (d.precip_prob != null) details.appendChild(makeDetail('Regenrisiko', d.precip_prob + '%'));
    if (d.visibility != null) details.appendChild(makeDetail('Sichtweite', (d.visibility / 1000).toFixed(1) + ' km'));
    if (d.sunrise) details.appendChild(makeDetail('Sonnenaufgang', this.formatHour(d.sunrise)));
    if (d.sunset) details.appendChild(makeDetail('Sonnenuntergang', this.formatHour(d.sunset)));
    if (d.uv_index != null) details.appendChild(makeDetail('UV-Index', d.uv_index));
    if (d.pressure != null) details.appendChild(makeDetail('Luftdruck', d.pressure + ' hPa'));

    if (this.rightCol) this.rightCol.appendChild(details);
    else this.weatherEl.appendChild(details);
    // Hourly
    const hourlyContainer = document.getElementById('hourly');
    if (hourlyContainer) {
      hourlyContainer.innerHTML = '';
      if (d.hourly && Array.isArray(d.hourly.time) && Array.isArray(d.hourly.temperature_2m)) {
        // show today section
        if (this.todaySection) this.todaySection.classList.remove('hidden');
        // find nearest hour index to current time (robust against formatting/timezone differences)
        const times = d.hourly.time;
        const target = d.time ? new Date(d.time).getTime() : Date.now();
        let nearestIdx = 0;
        let nearestDiff = Infinity;
        for (let i = 0; i < times.length; i++) {
          const tms = new Date(times[i]).getTime();
          const diff = Math.abs(tms - target);
          if (diff < nearestDiff) {
            nearestDiff = diff;
            nearestIdx = i;
          }
        }

        const start = nearestIdx;
        const end = Math.min(times.length, start + 24);
        
        // Render Chart
        this.renderHourlyChart(
          times.slice(start, end), 
          d.hourly.temperature_2m.slice(start, end),
          d.hourly.relative_humidity_2m ? d.hourly.relative_humidity_2m.slice(start, end) : [],
          d.hourly.apparent_temperature ? d.hourly.apparent_temperature.slice(start, end) : []
        );

        for (let i = start; i < end; i++) {
          const t = times[i];
          const temp = d.hourly.temperature_2m[i];
          const hum = Array.isArray(d.hourly.relative_humidity_2m) ? d.hourly.relative_humidity_2m[i] : null;
          const app = Array.isArray(d.hourly.apparent_temperature) ? d.hourly.apparent_temperature[i] : null;
          const item = document.createElement('div');
          item.className = 'hourly-item animate-enter';
          item.setAttribute('role', 'listitem');
          item.dataset.time = t;
          if (hum != null) item.dataset.humidity = hum;
          if (app != null) item.dataset.apparent = app;
          item.dataset.temp = temp;
          item.innerHTML = `<div class="hourly-time">${this.formatHour(t)}</div><div class="hourly-emoji">${this.simpleTempEmoji(temp)}</div><div class="hourly-temp">${this.formatTemp(temp)}</div>`;
          // tooltip handlers
          item.addEventListener('mouseenter', (ev) => this.showForecastTooltip(ev.currentTarget, 'hourly'));
          item.addEventListener('mouseleave', () => this.hideForecastTooltip());
          hourlyContainer.appendChild(item);
        }
      } else {
        const ph = document.createElement('div');
        ph.className = 'hourly-item animate-enter';
        ph.textContent = 'Stündliche Daten nicht verfügbar.';
        hourlyContainer.appendChild(ph);
        if (this.todaySection) this.todaySection.classList.remove('hidden');
      }
    }

    // Weekly
    const weeklyContainer = document.getElementById('weekly');
    if (weeklyContainer) {
      weeklyContainer.innerHTML = '';
      if (d.daily && Array.isArray(d.daily.time) && d.daily.time.length > 0) {
        // show weekly section
        if (this.weeklySection) this.weeklySection.classList.remove('hidden');
        for (let i = 0; i < d.daily.time.length; i++) {
          const day = d.daily.time[i];
          const max = Array.isArray(d.daily.temperature_2m_max) ? d.daily.temperature_2m_max[i] : null;
          const min = Array.isArray(d.daily.temperature_2m_min) ? d.daily.temperature_2m_min[i] : null;
          const wcode = Array.isArray(d.daily.weather_code) ? d.daily.weather_code[i] : (Array.isArray(d.daily.weathercode) ? d.daily.weathercode[i] : null);
          const [wdesc, wemoji] = this.weatherCodeToDesc(wcode);

          const card = document.createElement('div');
          card.className = 'daily-card animate-enter';
          card.setAttribute('role', 'listitem');
          card.dataset.day = day;
          card.dataset.max = max;
          card.dataset.min = min;
          card.dataset.wcode = wcode;
          card.dataset.wdesc = wdesc;
          card.innerHTML = `<div class="daily-day">${this.formatDay(day)}</div><div class="daily-emoji" aria-hidden="true" style="font-size:1.25rem">${wemoji}</div><div class="daily-temps">${max != null ? this.formatTemp(max) : '--'} / ${min != null ? this.formatTemp(min) : '--'}</div>`;
          // tooltip handlers
          card.addEventListener('mouseenter', (ev) => this.showForecastTooltip(ev.currentTarget, 'daily'));
          card.addEventListener('mouseleave', () => this.hideForecastTooltip());
          weeklyContainer.appendChild(card);
        }
      } else {
        const ph = document.createElement('div');
        ph.className = 'daily-card animate-enter';
        ph.textContent = 'Tagesdaten nicht verfügbar.';
        weeklyContainer.appendChild(ph);
        if (this.weeklySection) this.weeklySection.classList.remove('hidden');
      }
    }
  },

  getWindDir(deg) {
    if (deg == null) return '';
    const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round(deg / 45) % 8;
    return dirs[idx];
  },

  formatHour(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return iso;
    }
  },

  formatDay(iso) {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (e) {
      return iso;
    }
  },

  simpleTempEmoji(temp) {
    if (temp <= 0) return '❄️';
    if (temp <= 10) return '🧥';
    if (temp <= 20) return '🌤️';
    if (temp <= 28) return '☀️';
    return '🔥';
  },

  // Tooltip helpers
  showForecastTooltip(el, type) {
    this.hideForecastTooltip();
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    let html = '';
    if (type === 'hourly') {
      const time = el.dataset.time;
      const temp = el.dataset.temp;
      const hum = el.dataset.humidity;
      const app = el.dataset.apparent;
      html += `<div><span class="k">Zeit:</span><span class="v">${this.formatHour(time)}</span></div>`;
      html += `<div><span class="k">Temperatur:</span><span class="v">${this.formatTemp(Number(temp))}</span></div>`;
      if (hum != null) html += `<div><span class="k">Luftfeuchte:</span><span class="v">${hum}%</span></div>`;
      if (app != null) html += `<div><span class="k">Gefühlt:</span><span class="v">${this.formatTemp(Number(app))}</span></div>`;
    } else if (type === 'daily') {
      const day = el.dataset.day;
      const max = el.dataset.max;
      const min = el.dataset.min;
      const wdesc = el.dataset.wdesc;
      html += `<div><span class="k">Tag:</span><span class="v">${this.formatDay(day)}</span></div>`;
      html += `<div><span class="k">Wetter:</span><span class="v">${wdesc}</span></div>`;
      if (max != null || min != null) html += `<div><span class="k">Max / Min:</span><span class="v">${max != null ? this.formatTemp(Number(max)) : '--'} / ${min != null ? this.formatTemp(Number(min)) : '--'}</span></div>`;
    }
    tooltip.innerHTML = html;
    document.body.appendChild(tooltip);
    // position tooltip centered above element
    const rect = el.getBoundingClientRect();
    const tRect = tooltip.getBoundingClientRect();
    const top = rect.top + window.scrollY - tRect.height - 8;
    const left = rect.left + window.scrollX + (rect.width - tRect.width) / 2;
    tooltip.style.top = `${Math.max(8, top)}px`;
    tooltip.style.left = `${Math.max(8, left)}px`;
    this._currentTooltip = tooltip;
  },

  hideForecastTooltip() {
    if (this._currentTooltip) {
      this._currentTooltip.remove();
      this._currentTooltip = null;
    }
  },

  renderHourlyChart(times, temps, humidities, apparents) {
    const container = document.getElementById('hourly-chart');
    if (!container) return;
    container.innerHTML = '';

    // Dimensions
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 150;
    const padding = 20;

    // Data slice (next 24h)
    const dataTimes = times;
    const dataTemps = temps;

    if (dataTemps.length < 2) return;

    // Scales
    const minTemp = Math.min(...dataTemps) - 2;
    const maxTemp = Math.max(...dataTemps) + 2;
    const range = maxTemp - minTemp;

    const getX = (i) => padding + (i / (dataTemps.length - 1)) * (width - 2 * padding);
    const getY = (temp) => height - padding - ((temp - minTemp) / range) * (height - 2 * padding);

    // Generate Path
    let d = `M ${getX(0)} ${getY(dataTemps[0])}`;
    for (let i = 1; i < dataTemps.length; i++) {
      // Simple line for now, could be bezier
      d += ` L ${getX(i)} ${getY(dataTemps[i])}`;
    }

    // Area Path (close to bottom)
    let areaD = d + ` L ${getX(dataTemps.length - 1)} ${height} L ${getX(0)} ${height} Z`;

    // SVG
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'chart-svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');

    // Defs for gradient
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    defs.innerHTML = `
      <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="var(--primary-color)" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="var(--primary-color)" stop-opacity="0"/>
      </linearGradient>
    `;
    svg.appendChild(defs);

    // Area
    const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    areaPath.setAttribute('d', areaD);
    areaPath.setAttribute('class', 'chart-area');
    svg.appendChild(areaPath);

    // Line
    const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    linePath.setAttribute('d', d);
    linePath.setAttribute('class', 'chart-line');
    svg.appendChild(linePath);

    // Points
    dataTemps.forEach((temp, i) => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', getX(i));
      circle.setAttribute('cy', getY(temp));
      circle.setAttribute('r', 4);
      circle.setAttribute('class', 'chart-point');
      
      // Data attributes for tooltip
      circle.dataset.time = dataTimes[i];
      circle.dataset.temp = temp;
      if (humidities && humidities[i] != null) circle.dataset.humidity = humidities[i];
      if (apparents && apparents[i] != null) circle.dataset.apparent = apparents[i];

      // Tooltip handlers
      circle.addEventListener('mouseenter', (ev) => this.showForecastTooltip(ev.currentTarget, 'hourly'));
      circle.addEventListener('mouseleave', () => this.hideForecastTooltip());
      
      svg.appendChild(circle);
    });

    container.appendChild(svg);
  },

  tempCtoF(c) {
    return c * 9 / 5 + 32;
  },

  formatTemp(valueC) {
    if (valueC == null || isNaN(valueC)) return '--';
    if (this.unit === 'C') return `${Math.round(valueC)}°C`;
    return `${Math.round(this.tempCtoF(valueC))}°F`;
  },

  toggleUnit() {
    this.unit = this.unit === 'C' ? 'F' : 'C';
    if (this.unitToggle) {
      const pressed = this.unit === 'F';
      this.unitToggle.setAttribute('aria-pressed', pressed ? 'true' : 'false');
      this.unitToggle.textContent = this.unit === 'C' ? '°C' : '°F';
      this.unitToggle.title = this.unit === 'C' ? 'Wechsel zu °F' : 'Wechsel zu °C';
    }
    // re-render last data if present
    if (this.lastData) this.displayWeather(this.lastData);
  },

  // Favorites management
  loadFavorites() {
    try {
      const raw = localStorage.getItem('vibe_favorites');
      this.favorites = raw ? JSON.parse(raw) : [];
    } catch (e) {
      this.favorites = [];
    }
  },

  saveFavorites() {
    try {
      localStorage.setItem('vibe_favorites', JSON.stringify(this.favorites || []));
    } catch (e) {}
  },

  addFavorite(name, lat, lon) {
    if (!name || lat == null || lon == null) return;
    this.favorites = this.favorites || [];
    // toggle: if exists, remove; otherwise add
    const existsIdx = this.favorites.findIndex(f => f.lat === lat && f.lon === lon);
    if (existsIdx !== -1) {
      this.removeFavorite(existsIdx);
      return;
    }
    this.favorites.push({ name, lat, lon });
    this.saveFavorites();
    this.renderFavorites();
  },

  isFavorite(lat, lon) {
    if (!this.favorites) return false;
    return this.favorites.some(f => f.lat === lat && f.lon === lon);
  },

  removeFavoriteByCoords(lat, lon) {
    if (!this.favorites) return;
    const idx = this.favorites.findIndex(f => f.lat === lat && f.lon === lon);
    if (idx !== -1) this.removeFavorite(idx);
  },

  removeFavorite(idx) {
    if (!this.favorites) return;
    this.favorites.splice(idx, 1);
    this.saveFavorites();
    this.renderFavorites();
    // if current displayed location was removed, re-render to update heart state
    if (this.lastData && this.lastData.lat != null && this.lastData.lon != null) {
      const stillFav = this.isFavorite(this.lastData.lat, this.lastData.lon);
      if (!stillFav) this.displayWeather(this.lastData);
    }
  },

  renderFavorites() {
    if (!this.favContainer) return;
    this.favContainer.innerHTML = '';
    if (!this.favorites || this.favorites.length === 0) {
      const p = document.createElement('div');
      p.className = 'fav-empty';
      p.textContent = 'Keine Favoriten. Suche eine Stadt und klicke ❤';
      this.favContainer.appendChild(p);
      return;
    }
    this.favorites.forEach((f, i) => {
      const el = document.createElement('div');
      el.className = 'favorite-item';
      el.setAttribute('role', 'button');
      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-label', `Wetter für ${f.name} laden`);
      el.innerHTML = `<div class="fav-name">${f.name}</div>`;
      
      const loadFav = () => {
        if (this.input) this.input.value = f.name;
        this.fetchWeather({ name: f.name, lat: f.lat, lon: f.lon });
      };

      el.addEventListener('click', loadFav);
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          loadFav();
        }
      });

      const btn = document.createElement('button');
      btn.innerHTML = '✕';
      btn.title = 'Entfernen';
      btn.setAttribute('aria-label', `${f.name} aus Favoriten entfernen`);
      btn.addEventListener('click', (e) => { 
        e.stopPropagation(); 
        this.removeFavorite(i); 
      });
      el.appendChild(btn);
      this.favContainer.appendChild(el);
    });
  },

  setStatus(text) {
    if (!text) {
      this.status.innerHTML = '';
      return;
    }
    
    const isLoading = text.endsWith('...');
    if (isLoading) {
      this.status.innerHTML = `<div class="spinner"></div><span>${text}</span>`;
    } else {
      // If it's not loading, it's likely an error or info message
      this.status.innerHTML = `<span>${text}</span>`;
    }
  },
};

// Start app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// Note: `config` is expected on `window.config` (see `js/config.js`).
