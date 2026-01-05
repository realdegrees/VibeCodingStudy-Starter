/**
 * Very small, dependency-free chart helpers for line, bar, area and heatmap.
 * Each factory returns { update(data), destroy() }.
 */

function clearCanvas(canvas) {
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function scaleValues(values, height, padding = 20) {
  const numeric = values.map((v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v)));
  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const range = max - min || 1;
  return numeric.map((v) => {
    return padding + (1 - (v - min) / range) * (height - padding * 2);
  });
}

function normalizeSeries(labels = [], values = [], maxPoints = 500) {
  const n = Math.min(Math.max(labels.length, values.length), maxPoints);
  if (n === 0) return { labels: [], series: [] };
  // if input longer than maxPoints, sample
  const step = Math.max(1, Math.floor(Math.max(labels.length, values.length) / n));
  const outLabels = [];
  const outSeries = [];
  for (let i = 0; i < Math.max(labels.length, values.length); i += step) {
    outLabels.push(labels[i] ?? ``);
    outSeries.push(values[i] == null ? 0 : Number(values[i]));
  }
  return { labels: outLabels, series: outSeries };
}

export function createLineChart(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  const { strokeStyle = "#3498db", grid = true, title = "", yLabel = "", xLabel = "", maxPoints = 500 } = opts;

  function draw(labels = [], values = []) {
    clearCanvas(canvas);
    const w = canvas.width;
    const h = canvas.height;
    const norm = normalizeSeries(labels, values, maxPoints);
    labels = norm.labels;
    values = norm.series;

    if (grid) {
      ctx.strokeStyle = "#eee";
      ctx.lineWidth = 1;
      for (let i = 0; i < 5; i++) {
        const y = (h / 5) * i;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    }

    if (!values || values.length === 0) return;
    const xs = values.map((_, i) => (w / Math.max(1, values.length - 1)) * i);
    const ys = scaleValues(values, h);

    // title
    if (title) {
      ctx.fillStyle = "#333";
      ctx.font = "14px sans-serif";
      ctx.fillText(title, 10, 16);
    }

    // yLabel
    if (yLabel) {
      ctx.save();
      ctx.translate(10, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#333";
      ctx.font = "12px sans-serif";
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  return {
    update({ labels, series }) {
      draw(labels, series);
    },
    destroy() {
      clearCanvas(canvas);
    },
  };
}

export function createBarChart(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  const { fillStyle = "#2ecc71", title = "", yLabel = "", maxPoints = 500 } = opts;

  function draw(labels = [], values = []) {
    clearCanvas(canvas);
    const w = canvas.width;
    const h = canvas.height;
    const norm = normalizeSeries(labels, values, maxPoints);
    labels = norm.labels;
    values = norm.series;
    if (!values || values.length === 0) return;
    const barW = w / values.length;
    const max = Math.max(...values) || 1;
    // title
    if (title) {
      ctx.fillStyle = "#333";
      ctx.font = "14px sans-serif";
      ctx.fillText(title, 10, 16);
    }
    // yLabel
    if (yLabel) {
      ctx.save();
      ctx.translate(10, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#333";
      ctx.font = "12px sans-serif";
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }
    values.forEach((v, i) => {
      const barH = (v / max) * (h - 40);
      ctx.fillStyle = fillStyle;
      ctx.fillRect(i * barW + 2, h - barH - 20, Math.max(1, barW - 4), barH);
    });
  }

  return {
    update({ labels, series }) {
      draw(labels, series);
    },
    destroy() {
      clearCanvas(canvas);
    },
  };
}

export function createAreaChart(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");
  const { fillStyle = "rgba(52,152,219,0.3)", strokeStyle = "#2980b9", title = "", yLabel = "", maxPoints = 500 } = opts;

  function draw(labels = [], values = []) {
    clearCanvas(canvas);
    const w = canvas.width;
    const h = canvas.height;
    const norm = normalizeSeries(labels, values, maxPoints);
    labels = norm.labels;
    values = norm.series;
    if (!values || values.length === 0) return;
    const xs = values.map((_, i) => (w / Math.max(1, values.length - 1)) * i);
    const ys = scaleValues(values, h);

    if (title) {
      ctx.fillStyle = "#333";
      ctx.font = "14px sans-serif";
      ctx.fillText(title, 10, 16);
    }
    if (yLabel) {
      ctx.save();
      ctx.translate(10, h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = "#333";
      ctx.font = "12px sans-serif";
      ctx.fillText(yLabel, 0, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.lineTo(w, h - 20);
    ctx.lineTo(0, h - 20);
    ctx.closePath();
    ctx.fillStyle = fillStyle;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(xs[0], ys[0]);
    for (let i = 1; i < xs.length; i++) ctx.lineTo(xs[i], ys[i]);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  return {
    update({ labels, series }) {
      draw(labels, series);
    },
    destroy() {
      clearCanvas(canvas);
    },
  };
}

export function createHeatmap(canvas, opts = {}) {
  const ctx = canvas.getContext("2d");

  function draw(grid = [[]], xLabels = [], yLabels = []) {
    clearCanvas(canvas);
    const w = canvas.width;
    const h = canvas.height;
    const rows = grid.length;
    const cols = grid[0] ? grid[0].length : 0;
    if (rows === 0 || cols === 0) return;
    const cellW = w / cols;
    const cellH = h / rows;
    let min = Infinity;
    let max = -Infinity;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const v = grid[r][c] ?? 0;
        if (v < min) min = v;
        if (v > max) max = v;
      }
    const range = max - min || 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = grid[r][c] ?? 0;
        const t = (v - min) / range;
        const color = `rgb(${Math.round(255 * (1 - t))},${Math.round(255 * t)},150)`;
        ctx.fillStyle = color;
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
  }

  return {
    update({ grid, xLabels, yLabels }) {
      draw(grid, xLabels, yLabels);
    },
    destroy() {
      clearCanvas(canvas);
    },
  };
}

export default {
  createLineChart,
  createBarChart,
  createAreaChart,
  createHeatmap,
};
