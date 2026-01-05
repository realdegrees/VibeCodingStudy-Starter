const app = {
  init() {
    this.cache();
    this.bind();
    this.loadFavorites();
    this.renderFavorites();
  },

  cache() {
    this.form = document.getElementById('search-form');
    this.input = document.getElementById('city-input');
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
  },

  bind() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const city = this.input.value.trim();
      if (city) this.fetchWeather(city);
    });
    if (this.unitToggle) {
      this.unitToggle.addEventListener('click', (e) => {
        e.preventDefault();
        this.toggleUnit();
      });
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
      const forecastUrl = `${config.API_URL}/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
      const weatherRes = await fetch(forecastUrl);
      if (!weatherRes.ok) throw new Error('Wetterdaten konnten nicht geladen werden');
      const data = await weatherRes.json();

      // Extract humidity & feels-like for the current time
      let humidity = null;
      let feels_like = null;
      try {
        const time = data.current_weather.time;
        const idx = data.hourly.time.indexOf(time);
        if (idx !== -1) {
          humidity = data.hourly.relativehumidity_2m[idx];
          feels_like = data.hourly.apparent_temperature[idx];
        }
      } catch (e) {
        // ignore, optional fields
      }

      const payload = {
        city: placeName,
        lat,
        lon,
        temperature: data.current_weather.temperature,
        windspeed: data.current_weather.windspeed,
        weathercode: data.current_weather.weathercode,
        time: data.current_weather.time,
        humidity,
        feels_like,
        hourly: data.hourly || null,
        daily: data.daily || null,
      };

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
      const forecastUrl = `${config.API_URL}/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relativehumidity_2m,apparent_temperature&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
      const weatherRes = await fetch(forecastUrl);
      if (!weatherRes.ok) throw new Error('Wetterdaten konnten nicht geladen werden');
      const data = await weatherRes.json();

      let humidity = null;
      let feels_like = null;
      try {
        const time = data.current_weather.time;
        const idx = data.hourly.time.indexOf(time);
        if (idx !== -1) {
          humidity = data.hourly.relativehumidity_2m[idx];
          feels_like = data.hourly.apparent_temperature[idx];
        }
      } catch (e) {}

      const payload = {
        city: name || `${lat},${lon}`,
        lat,
        lon,
        temperature: data.current_weather.temperature,
        windspeed: data.current_weather.windspeed,
        weathercode: data.current_weather.weathercode,
        time: data.current_weather.time,
        humidity,
        feels_like,
        hourly: data.hourly || null,
        daily: data.daily || null,
      };
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
      61: ['Leichter Regen', '🌧️'],
      63: ['Mäßiger Regen', '🌧️'],
      65: ['Starker Regen', '🌧️'],
      71: ['Schneefall', '❄️'],
      80: ['Regenschauer', '🌧️'],
      95: ['Gewitter', '⛈️'],
    };
    return map[code] || ['Unbekannt', '❔'];
  },

  displayWeather(d) {
    // Clear left/right columns explicitly
    if (this.leftCol) this.leftCol.innerHTML = '';
    if (this.rightCol) this.rightCol.innerHTML = '';
    const [desc, emoji] = this.weatherCodeToDesc(d.weathercode);

    const card = document.createElement('div');
    card.className = 'weather-card';
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
      favBtn.style.marginLeft = '8px';
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (d.lat && d.lon) this.addFavorite(d.city, d.lat, d.lon);
      });
      // append to leftCol card header area
      const meta = card.querySelector('.weather-meta');
      if (meta) meta.appendChild(favBtn);
    }
    // Details grid (humidity, wind, feels-like, time)
    const details = document.createElement('div');
    details.className = 'weather-details';

    const makeDetail = (label, value) => {
      const el = document.createElement('div');
      el.className = 'detail-item';
      el.innerHTML = `<span class="detail-label">${label}</span><span class="detail-value">${value}</span>`;
      return el;
    };

    details.appendChild(makeDetail('Uhrzeit', this.formatHour(d.time)));
    details.appendChild(makeDetail('Luftfeuchtigkeit', d.humidity != null ? d.humidity + '%' : '—'));
    details.appendChild(makeDetail('Wind', d.windspeed != null ? d.windspeed + ' km/h' : '—'));
    details.appendChild(makeDetail('Gefühlt', d.feels_like != null ? this.formatTemp(d.feels_like) : '—'));

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
        for (let i = start; i < end; i++) {
          const t = times[i];
          const temp = d.hourly.temperature_2m[i];
          const hum = Array.isArray(d.hourly.relativehumidity_2m) ? d.hourly.relativehumidity_2m[i] : null;
          const app = Array.isArray(d.hourly.apparent_temperature) ? d.hourly.apparent_temperature[i] : null;
          const item = document.createElement('div');
          item.className = 'hourly-item';
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
        ph.className = 'hourly-item';
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
          const wcode = Array.isArray(d.daily.weathercode) ? d.daily.weathercode[i] : null;
          const [wdesc, wemoji] = this.weatherCodeToDesc(wcode);

          const card = document.createElement('div');
          card.className = 'daily-card';
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
        ph.className = 'daily-card';
        ph.textContent = 'Tagesdaten nicht verfügbar.';
        weeklyContainer.appendChild(ph);
        if (this.weeklySection) this.weeklySection.classList.remove('hidden');
      }
    }
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
    // avoid duplicates by lat/lon
    if (this.favorites.some(f => f.lat === lat && f.lon === lon)) return;
    this.favorites.push({ name, lat, lon });
    this.saveFavorites();
    this.renderFavorites();
  },

  removeFavorite(idx) {
    if (!this.favorites) return;
    this.favorites.splice(idx, 1);
    this.saveFavorites();
    this.renderFavorites();
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
      el.innerHTML = `<div class="fav-name">${f.name}</div>`;
      el.addEventListener('click', () => this.fetchWeather({ name: f.name, lat: f.lat, lon: f.lon }));
      const btn = document.createElement('button');
      btn.innerHTML = '✕';
      btn.title = 'Entfernen';
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.removeFavorite(i); });
      el.appendChild(btn);
      this.favContainer.appendChild(el);
    });
  },

  setStatus(text) {
    this.status.textContent = text;
  },
};

// Start app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// Note: `config` is expected on `window.config` (see `js/config.js`).
