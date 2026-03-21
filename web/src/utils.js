import * as d3 from 'd3';

/**
 * Ordinary Least Squares regression: y = a + bx
 */
export function ols(pts) {
  const n     = pts.length;
  const sumX  = d3.sum(pts, p => p.x);
  const sumY  = d3.sum(pts, p => p.y);
  const sumXY = d3.sum(pts, p => p.x * p.y);
  const sumX2 = d3.sum(pts, p => p.x * p.x);
  const b     = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const a     = (sumY - b * sumX) / n;
  return { a, b };
}

/**
 * Pearson correlation coefficient
 */
export function pearsonR(pts) {
  const meanX = d3.mean(pts, p => p.x);
  const meanY = d3.mean(pts, p => p.y);
  const num   = d3.sum(pts, p => (p.x - meanX) * (p.y - meanY));
  const den   = Math.sqrt(
    d3.sum(pts, p => (p.x - meanX) ** 2) *
    d3.sum(pts, p => (p.y - meanY) ** 2)
  );
  return den === 0 ? 0 : num / den;
}

export function formatValue(value, meta, compact = false) {
  if (value == null || Number.isNaN(+value)) return '–';
  if (meta.decimals === 0) return Math.round(+value).toLocaleString('fr-FR');
  return (+value).toFixed(compact ? Math.min(meta.decimals, 1) : meta.decimals);
}

export function formatAxisTick(value, meta) {
  const base = formatValue(value, meta, true);
  if (base === '–') return base;
  return meta.unit === '%' ? base + '%' : base;
}

export function isMobileLayout() {
  return window.innerWidth <= 768;
}
