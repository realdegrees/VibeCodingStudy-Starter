/**
 * Sun tab logic
 */
import OpenMeteo from "../openMeteo.js";

/**
 * Load solar metrics (sunrise/sunset) for the given city and render into the sun panel.
 */
export async function load(city) {
  const el = document.getElementById("sun-content");
  if (!city) {
    el.textContent = "Enter a city to see sun data.";
    return null;
  }

  el.textContent = "Loading sun data...";
  const data = await OpenMeteo.getDailyForecast(city, {
    daily: ["sunrise", "sunset"],
  });

  if (!data || !data.daily) {
    el.textContent = "No sun data available.";
    return data;
  }

  const dates = data.daily.time || [];
  const sunrise = data.daily.sunrise || [];
  const sunset = data.daily.sunset || [];

  const lines = dates.map((d, i) => `${d}: sunrise ${sunrise[i]}  •  sunset ${sunset[i]}`);
  el.textContent = lines.join("\n");
  return data;
}

export default { load };
