/**
 * Temp tab logic
 */
import OpenMeteo from "../openMeteo.js";

/**
 * Load temperature metrics for the given city and render into the temp panel.
 */
export async function load(city) {
  const el = document.getElementById("temp-content");
  if (!city) {
    el.textContent = "Enter a city to see temperature data.";
    return null;
  }

  el.textContent = "Loading temperature data...";
  const data = await OpenMeteo.getDailyForecast(city, {
    daily: ["temperature_2m_max", "temperature_2m_min"],
  });

  if (!data || !data.daily) {
    el.textContent = "No temperature data available.";
    return data;
  }

  const dates = data.daily.time || [];
  const max = data.daily.temperature_2m_max || [];
  const min = data.daily.temperature_2m_min || [];

  const lines = dates.map((d, i) => `${d}: ${min[i]}° / ${max[i]}°`);
  el.textContent = lines.join("\n");
  return data;
}

export default { load };
