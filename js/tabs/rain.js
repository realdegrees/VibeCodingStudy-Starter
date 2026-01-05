/**
 * Rain tab logic
 */
import OpenMeteo from "../openMeteo.js";

/**
 * Load rainfall metrics for the given city and render into the rain panel.
 */
export async function load(city) {
  const el = document.getElementById("rain-content");
  if (!city) {
    el.textContent = "Enter a city to see rain data.";
    return null;
  }

  el.textContent = "Loading rain data...";
  const data = await OpenMeteo.getDailyForecast(city, {
    daily: ["precipitation_sum"],
  });

  if (!data || !data.daily) {
    el.textContent = "No rain data available.";
    return data;
  }

  const dates = data.daily.time || [];
  const precip = data.daily.precipitation_sum || [];

  const lines = dates.map((d, i) => `${d}: ${precip[i]} mm`);
  el.textContent = lines.join("\n");
  return data;
}

export default { load };
