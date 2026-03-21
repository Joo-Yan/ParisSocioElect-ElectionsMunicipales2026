import * as d3 from 'd3';
import { LAYER_META } from './layers.js';
import { ols, pearsonR, formatAxisTick, isMobileLayout } from './utils.js';
import { flyToFeature } from './map.js';

let scatterCircles = null;

// Current scatter axis state
let scatterXLayer = 'hlm';
let scatterYLayer = 'abstention';

export function getScatterAxes() {
  return { x: scatterXLayer, y: scatterYLayer };
}

export function setScatterAxes(x, y) {
  scatterXLayer = x;
  scatterYLayer = y;
}

export function updateScatterHeader() {
  const xMeta = LAYER_META[scatterXLayer];
  const yMeta = LAYER_META[scatterYLayer];
  document.querySelector('#chart-header h2').textContent =
    `${xMeta.shortLabel} × ${yMeta.shortLabel}`;
}

export function populateAxisSelectors(onChangeCallback) {
  const xSelect = document.getElementById('x-axis-select');
  const ySelect = document.getElementById('y-axis-select');
  const layers = Object.keys(LAYER_META);

  [xSelect, ySelect].forEach(select => {
    select.innerHTML = '';
    layers.forEach(layer => {
      const opt = document.createElement('option');
      opt.value = layer;
      opt.textContent = LAYER_META[layer].shortLabel;
      select.appendChild(opt);
    });
  });

  xSelect.value = scatterXLayer;
  ySelect.value = scatterYLayer;

  xSelect.addEventListener('change', e => {
    scatterXLayer = e.target.value;
    updateScatterHeader();
    if (onChangeCallback) onChangeCallback();
  });

  ySelect.addEventListener('change', e => {
    scatterYLayer = e.target.value;
    updateScatterHeader();
    if (onChangeCallback) onChangeCallback();
  });
}

export function initScatter(data, { mobileChartCollapsed } = {}) {
  if (isMobileLayout() && mobileChartCollapsed) return;

  const container = document.getElementById('scatter-container');
  const W = container.clientWidth;
  const H = container.clientHeight;
  const xMeta = LAYER_META[scatterXLayer];
  const yMeta = LAYER_META[scatterYLayer];

  const margin = { top: 20, right: 20, bottom: 50, left: 52 };
  const width  = W - margin.left - margin.right;
  const height = H - margin.top  - margin.bottom;

  const features = data.features.filter(f =>
    f.properties[xMeta.field] != null && !isNaN(+f.properties[xMeta.field]) &&
    f.properties[yMeta.field] != null && !isNaN(+f.properties[yMeta.field])
  );

  if (features.length === 0) return;

  const xMax = d3.max(features, f => +f.properties[xMeta.field]) * 1.05;
  const yMax = d3.max(features, f => +f.properties[yMeta.field]) * 1.05;

  const xScale = d3.scaleLinear().domain([0, xMax]).range([0, width]);
  const yScale = d3.scaleLinear().domain([0, yMax]).range([height, 0]);

  const arrondissements = [...new Set(features.map(f => f.properties.arrondissement))].sort();
  const colorScale = d3.scaleOrdinal(d3.schemeTableau10).domain(arrondissements);

  const svgEl = d3.select('#scatter');
  svgEl.attr('width', W).attr('height', H);
  svgEl.selectAll('*').remove();

  const g = svgEl.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Grid
  g.append('g').attr('class', 'grid')
    .call(d3.axisLeft(yScale).ticks(5).tickSize(-width).tickFormat(''))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line').attr('stroke', '#0f3460').attr('stroke-dasharray', '3,3'));

  g.append('g').attr('class', 'grid')
    .attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(5).tickSize(-height).tickFormat(''))
    .call(ax => ax.select('.domain').remove())
    .call(ax => ax.selectAll('line').attr('stroke', '#0f3460').attr('stroke-dasharray', '3,3'));

  // Axes
  g.append('g').attr('transform', `translate(0,${height})`)
    .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => formatAxisTick(d, xMeta)))
    .call(ax => ax.select('.domain').attr('stroke', '#0f3460'))
    .call(ax => ax.selectAll('text').attr('fill', '#8892b0').attr('font-size', 10))
    .call(ax => ax.selectAll('line').attr('stroke', '#0f3460'));

  g.append('g')
    .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => formatAxisTick(d, yMeta)))
    .call(ax => ax.select('.domain').attr('stroke', '#0f3460'))
    .call(ax => ax.selectAll('text').attr('fill', '#8892b0').attr('font-size', 10))
    .call(ax => ax.selectAll('line').attr('stroke', '#0f3460'));

  // Axis labels
  g.append('text')
    .attr('x', width / 2).attr('y', height + 40)
    .attr('text-anchor', 'middle').attr('fill', '#8892b0').attr('font-size', 11)
    .text(xMeta.label);

  g.append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -height / 2).attr('y', -42)
    .attr('text-anchor', 'middle').attr('fill', '#8892b0').attr('font-size', 11)
    .text(yMeta.label);

  // OLS regression
  const pts = features.map(f => ({
    x: +f.properties[xMeta.field],
    y: +f.properties[yMeta.field]
  }));
  const r2 = pearsonR(pts) ** 2;
  const r  = pearsonR(pts);

  if (r2 >= 0.1) {
    const reg = ols(pts);
    const x1 = 0, x2 = xMax;
    const y1 = reg.a + reg.b * x1;
    const y2 = reg.a + reg.b * x2;

    g.append('line')
      .attr('x1', xScale(x1)).attr('y1', yScale(y1))
      .attr('x2', xScale(x2)).attr('y2', yScale(y2))
      .attr('stroke', '#f03b20').attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6,3').attr('opacity', 0.8);
  }

  // Data points
  scatterCircles = g.selectAll('circle')
    .data(features)
    .join('circle')
    .attr('cx', f => xScale(+f.properties[xMeta.field]))
    .attr('cy', f => yScale(+f.properties[yMeta.field]))
    .attr('r', 3.5)
    .attr('fill', f => colorScale(f.properties.arrondissement))
    .attr('opacity', 0.65)
    .attr('stroke', 'none')
    .style('cursor', 'crosshair');

  // Scatter hover → map highlight
  scatterCircles
    .on('mouseover', (event, f) => {
      highlightScatterPoint(f.properties.code_bv);
      flyToFeature(f);
    })
    .on('mouseout', () => resetScatterHighlight());

  // Stats
  document.getElementById('stat-r2').textContent = r2.toFixed(3);
  document.getElementById('stat-r').textContent  = r.toFixed(3);
  document.getElementById('stat-n').textContent  = features.length;
}

export function highlightScatterPoint(codeBv) {
  if (!scatterCircles) return;
  scatterCircles
    .attr('r', f => f.properties.code_bv === codeBv ? 7 : 3)
    .attr('opacity', f => f.properties.code_bv === codeBv ? 1 : 0.2)
    .attr('stroke', f => f.properties.code_bv === codeBv ? '#ffffff' : 'none')
    .attr('stroke-width', 1.5);
}

export function resetScatterHighlight() {
  if (!scatterCircles) return;
  scatterCircles
    .attr('r', 3.5)
    .attr('opacity', 0.65)
    .attr('stroke', 'none');
}

export function highlightScatterArrondissement(arrondissement) {
  if (!scatterCircles) return;
  scatterCircles
    .attr('r', f => f.properties.arrondissement === arrondissement ? 5 : 2.5)
    .attr('opacity', f => f.properties.arrondissement === arrondissement ? 1 : 0.15)
    .attr('stroke', f => f.properties.arrondissement === arrondissement ? '#ffffff' : 'none')
    .attr('stroke-width', 1);
}

// ═══════════════════════════════════════════════════════════
// SVG → PNG Export
// ═══════════════════════════════════════════════════════════
function initScatterExport() {
  const btn = document.getElementById('scatter-export-btn');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', () => {
    const svgEl = document.getElementById('scatter');
    if (!svgEl) return;

    const w = +svgEl.getAttribute('width') || svgEl.clientWidth;
    const h = +svgEl.getAttribute('height') || svgEl.clientHeight;

    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgEl);

    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Dark background
    ctx.fillStyle = '#161b22';
    ctx.fillRect(0, 0, w, h);

    const img = new Image();
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);

      const axes = getScatterAxes();
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `socioelect_scatter_${axes.x}_${axes.y}_${ts}.png`;
      a.click();
    };
    img.src = url;
  });
}

// Auto-init on module load
initScatterExport();
