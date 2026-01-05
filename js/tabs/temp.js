/**
 * Temp tab logic
 */
import OpenMeteo from "../openMeteo.js";
import { createLineChart } from "../charts/simpleCharts.js";

/**
 * Load temperature metrics for the given city and render into the temp panel.
 */
export async function load(city) {
  const el = document.getElementById("temp-content");
  if (!city) {
    el.textContent = "Enter a city to see temperature data.";
    return null;
  }
  const canvas = document.getElementById("temp-canvas");
  el.hidden = true;
  canvas.hidden = false;
  const chart = createLineChart(canvas, { strokeStyle: "#e74c3c", title: `Temperature — ${city}`, yLabel: "°C" });
  canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  canvas.getContext("2d").font = "12px sans-serif";
  canvas.getContext("2d").fillText("Loading temperature...", 10, 20);

  const data = await OpenMeteo.getHourlyByType(city, "temp", { startDate: new Date(), endDate: new Date(new Date().getTime() + 48 * 60 * 60 * 1000) });
  if (!data || !data.hourly) {
    el.hidden = false;
    el.textContent = "No temperature data available.";
    canvas.hidden = true;
    return data;
  }

  const dates = data.hourly.time || [];
  const temps = data.hourly.temperature_2m || [];
  chart.update({ labels: dates, series: temps });
  return data;
}

export default { load };
