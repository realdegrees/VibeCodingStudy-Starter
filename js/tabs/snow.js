/**
 * Snow tab logic
 */
import OpenMeteo from "../openMeteo.js";
import { createBarChart } from "../charts/simpleCharts.js";

/**
 * Load snowfall metrics for the given city and render into the snow panel.
 */
export async function load(city) {
  const el = document.getElementById("snow-content");
  if (!city) {
    el.textContent = "Enter a city to see snow data.";
    return null;
  }

  const canvas = document.getElementById("snow-canvas");
  el.hidden = true;
  canvas.hidden = false;
  const chart = createBarChart(canvas, { fillStyle: "#95a5a6", title: `Snowfall — ${city}`, yLabel: "cm" });

  const data = await OpenMeteo.getHourlyByType(city, "snow", { startDate: new Date(), endDate: new Date(new Date().getTime() + 48 * 60 * 60 * 1000) });

  if (!data || !data.hourly) {
    el.hidden = false;
    el.textContent = "No snow data available.";
    canvas.hidden = true;
    return data;
  }

  const dates = data.hourly.time || [];
  const snow = data.hourly.snowfall || [];
  chart.update({ labels: dates, series: snow });
  return data;
}

export default { load };
