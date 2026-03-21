import * as d3 from 'd3';
import { LAYER_META, COLORS } from './layers.js';
import { getMap } from './map.js';

// Rough arrondissement centers for flyTo
const ARR_CENTERS = {
  '1er':  [2.3390, 48.8606], '2e':   [2.3441, 48.8679], '3e':   [2.3607, 48.8641],
  '4e':   [2.3554, 48.8543], '5e':   [2.3479, 48.8443], '6e':   [2.3313, 48.8496],
  '7e':   [2.3137, 48.8570], '8e':   [2.3120, 48.8756], '9e':   [2.3387, 48.8784],
  '10e':  [2.3615, 48.8762], '11e':  [2.3793, 48.8603], '12e':  [2.3966, 48.8398],
  '13e':  [2.3600, 48.8300], '14e':  [2.3263, 48.8275], '15e':  [2.2929, 48.8421],
  '16e':  [2.2622, 48.8580], '17e':  [2.3052, 48.8873], '18e':  [2.3475, 48.8929],
  '19e':  [2.3849, 48.8869], '20e':  [2.3988, 48.8636],
};

let highlightCallback = null;

export function setBarChartHighlightCallback(cb) {
  highlightCallback = cb;
}

export function updateBarChart(features, layer) {
  const container = document.getElementById('barchart-container');
  if (!container) return;

  const meta = LAYER_META[layer];
  // Categorical layers (LISA, cluster) don't aggregate meaningfully
  if (meta.categorical) { container.innerHTML = ''; return; }
  const colors = COLORS[layer];
  // Use the middle (3rd) color from the 5-stop palette
  const barColor = colors[3];

  // Group by arrondissement and compute mean
  const grouped = d3.rollup(
    features.filter(f => f.properties[meta.field] != null && !isNaN(+f.properties[meta.field])),
    v => d3.mean(v, f => +f.properties[meta.field]),
    f => f.properties.arrondissement
  );

  const data = Array.from(grouped, ([arr, val]) => ({ arr, val }))
    .filter(d => d.arr)
    .sort((a, b) => b.val - a.val);

  if (data.length === 0) { container.innerHTML = ''; return; }

  const W = container.clientWidth;
  const barH = 13;
  const gap = 2;
  const labelW = 32;
  const valW = 40;
  const chartW = W - labelW - valW - 8;
  const H = data.length * (barH + gap);

  container.innerHTML = '';
  const svg = d3.select(container).append('svg')
    .attr('width', W).attr('height', H);

  const xScale = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.val) * 1.05])
    .range([0, chartW]);

  const rows = svg.selectAll('g.bar-row')
    .data(data)
    .join('g')
    .attr('class', 'bar-row')
    .attr('transform', (_, i) => `translate(0,${i * (barH + gap)})`)
    .style('cursor', 'pointer');

  // Label
  rows.append('text')
    .attr('x', labelW - 4)
    .attr('y', barH / 2)
    .attr('dy', '0.35em')
    .attr('text-anchor', 'end')
    .attr('fill', 'var(--text-muted)')
    .attr('font-size', '9px')
    .text(d => d.arr);

  // Bar
  rows.append('rect')
    .attr('x', labelW)
    .attr('y', 1)
    .attr('width', d => Math.max(1, xScale(d.val)))
    .attr('height', barH - 2)
    .attr('rx', 2)
    .attr('fill', barColor)
    .attr('opacity', 0.8);

  // Value
  rows.append('text')
    .attr('x', labelW + chartW + 4)
    .attr('y', barH / 2)
    .attr('dy', '0.35em')
    .attr('fill', 'var(--text-primary)')
    .attr('font-size', '9px')
    .text(d => meta.decimals === 0
      ? Math.round(d.val).toLocaleString('fr-FR')
      : d.val.toFixed(meta.decimals));

  // Click → fly to arrondissement
  rows.on('click', (_, d) => {
    const key = d.arr.replace(/ arr\.$/, '');
    const center = ARR_CENTERS[key];
    if (center) {
      const map = getMap();
      if (map) map.flyTo({ center, zoom: 13.5, duration: 600 });
    }
    if (highlightCallback) highlightCallback(d.arr);
  });
}
