const app = {
  init() {
    this.cache();
    this.bind();
  },

  cache() {
    this.form = document.getElementById('search-form');
    this.input = document.getElementById('city-input');
    this.status = document.getElementById('status');
    this.weatherEl = document.getElementById('weather');
    this.leftCol = document.getElementById('weather-left');
    this.rightCol = document.getElementById('weather-right');
  },

  bind() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      const city = this.input.value.trim();
      if (city) this.fetchWeather(city);
    });
  },

  async fetchWeather(city) {
    try {
      this.setStatus(`Suche nach „${city}“...`);

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
        temperature: data.current_weather.temperature,
        windspeed: data.current_weather.windspeed,
        weathercode: data.current_weather.weathercode,
        time: data.current_weather.time,
        humidity,
        feels_like,
        hourly: data.hourly || null,
        daily: data.daily || null,
      };

      this.displayWeather(payload);
      this.setStatus('');
    } catch (err) {
      this.setStatus(err.message || 'Fehler bei der Anfrage');
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
        <div class="weather-main">${Math.round(d.temperature)}° — ${desc}</div>
        <div class="weather-meta">${d.city} · ${new Date(d.time).toLocaleString()}</div>
        <div class="weather-meta">Wind: ${d.windspeed} km/h${d.humidity != null ? ' · Luftfeuchtigkeit: ' + d.humidity + '%' : ''}${d.feels_like != null ? ' · Gefühlt: ' + Math.round(d.feels_like) + '°' : ''}</div>
      </div>
    `;

    if (this.leftCol) this.leftCol.appendChild(card);
    else this.weatherEl.appendChild(card);
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
    details.appendChild(makeDetail('Gefühlt', d.feels_like != null ? Math.round(d.feels_like) + '°' : '—'));

    if (this.rightCol) this.rightCol.appendChild(details);
    else this.weatherEl.appendChild(details);
    // Hourly
    const hourlyContainer = document.getElementById('hourly');
    if (hourlyContainer) {
      hourlyContainer.innerHTML = '';
      if (d.hourly && Array.isArray(d.hourly.time) && Array.isArray(d.hourly.temperature_2m)) {
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
          const temp = Math.round(d.hourly.temperature_2m[i]);
          const item = document.createElement('div');
          item.className = 'hourly-item';
          item.setAttribute('role', 'listitem');
          item.innerHTML = `<div class="hourly-time">${this.formatHour(t)}</div><div class="hourly-emoji">${this.simpleTempEmoji(d.hourly.temperature_2m[i])}</div><div class="hourly-temp">${temp}°</div>`;
          hourlyContainer.appendChild(item);
        }
      } else {
        const ph = document.createElement('div');
        ph.className = 'hourly-item';
        ph.textContent = 'Stündliche Daten nicht verfügbar.';
        hourlyContainer.appendChild(ph);
      }
    }

    // Weekly
    const weeklyContainer = document.getElementById('weekly');
    if (weeklyContainer) {
      weeklyContainer.innerHTML = '';
      if (d.daily && Array.isArray(d.daily.time) && d.daily.time.length > 0) {
        for (let i = 0; i < d.daily.time.length; i++) {
          const day = d.daily.time[i];
          const max = Array.isArray(d.daily.temperature_2m_max) ? Math.round(d.daily.temperature_2m_max[i]) : null;
          const min = Array.isArray(d.daily.temperature_2m_min) ? Math.round(d.daily.temperature_2m_min[i]) : null;
          const wcode = Array.isArray(d.daily.weathercode) ? d.daily.weathercode[i] : null;
          const [wdesc, wemoji] = this.weatherCodeToDesc(wcode);

          const card = document.createElement('div');
          card.className = 'daily-card';
          card.setAttribute('role', 'listitem');
          card.innerHTML = `<div class="daily-day">${this.formatDay(day)}</div><div class="daily-emoji" aria-hidden="true" style="font-size:1.25rem">${wemoji}</div><div class="daily-temps">${max != null ? max + '°' : '--'} / ${min != null ? min + '°' : '--'}</div>`;
          weeklyContainer.appendChild(card);
        }
      } else {
        const ph = document.createElement('div');
        ph.className = 'daily-card';
        ph.textContent = 'Tagesdaten nicht verfügbar.';
        weeklyContainer.appendChild(ph);
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

  setStatus(text) {
    this.status.textContent = text;
  },
};

// Start app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  app.init();
});

// Note: `config` is expected on `window.config` (see `js/config.js`).
