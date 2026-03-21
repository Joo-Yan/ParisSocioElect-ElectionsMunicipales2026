import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { COLORS, BREAKS, LAYER_META, PARTY_META } from './layers.js';
import { formatValue } from './utils.js';

let map;
let hoveredBvId = null;

// Callbacks set by main.js for cross-module coordination
let onHoverBv = null;
let onLeaveBv = null;

export function setMapCallbacks({ onHover, onLeave }) {
  onHoverBv = onHover;
  onLeaveBv = onLeave;
}

export function getMap() {
  return map;
}

export function initMap() {
  map = new maplibregl.Map({
    container: 'map',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
    center: [2.3522, 48.8566],
    zoom: 11.2,
    minZoom: 10,
    maxZoom: 16
  });
  map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
  return map;
}

export function buildColorExpr(layer) {
  const { field } = LAYER_META[layer];
  const colors    = COLORS[layer];
  const b         = BREAKS[layer];
  if (!b) return '#555555';
  return [
    'case',
    ['==', ['get', field], null], '#555555',
    ['step', ['get', field],
      colors[0], b.Q1, colors[1], b.Q2, colors[2], b.Q3, colors[3], b.Q4, colors[4]
    ]
  ];
}

export function addDataLayers(data) {
  const featuresWithId = {
    ...data,
    features: data.features.map((f, i) => ({ ...f, id: i }))
  };

  map.addSource('bureaux-vote', {
    type: 'geojson',
    data: featuresWithId,
    generateId: false
  });

  map.addLayer({
    id: 'bv-fill',
    type: 'fill',
    source: 'bureaux-vote',
    paint: {
      'fill-color': buildColorExpr('abstention'),
      'fill-opacity': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 1.0,
        0.78
      ]
    }
  });

  map.addLayer({
    id: 'bv-outline',
    type: 'line',
    source: 'bureaux-vote',
    paint: {
      'line-color': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], '#ffffff',
        'rgba(255,255,255,0.15)'
      ],
      'line-width': [
        'case',
        ['boolean', ['feature-state', 'hover'], false], 2,
        0.5
      ]
    }
  });

  setupTooltip();
  return featuresWithId;
}

export function switchMapLayer(layer) {
  if (map.getLayer('bv-fill')) {
    map.setPaintProperty('bv-fill', 'fill-color', buildColorExpr(layer));
  }
}

export function updateLegend(layer) {
  const meta   = LAYER_META[layer];
  const colors = COLORS[layer];
  const b      = BREAKS[layer];
  const party  = PARTY_META[layer];

  document.getElementById('legend-title').textContent = meta.label;

  const badge = document.getElementById('legend-party-badge');
  if (party) {
    badge.textContent       = party.list;
    badge.style.background  = party.color;
    badge.style.display     = 'inline-flex';
    badge.style.alignItems  = 'center';
    badge.style.padding     = '1px 5px';
    badge.style.borderRadius = '3px';
    badge.style.fontSize    = '8.5px';
    badge.style.fontWeight  = '700';
    badge.style.letterSpacing = '0.4px';
    badge.style.color       = '#fff';
  } else {
    badge.style.display = 'none';
  }

  const bar = document.getElementById('legend-bar');
  bar.innerHTML = '';
  colors.forEach(c => {
    const d = document.createElement('div');
    d.style.background = c;
    bar.appendChild(d);
  });

  if (!b) return;

  const fmt = v => meta.decimals === 0
    ? Math.round(v).toLocaleString('fr-FR')
    : v.toFixed(meta.decimals);

  document.getElementById('leg-min').textContent = '< ' + fmt(b.Q1) + meta.unit;
  document.getElementById('leg-mid').textContent = fmt(b.Q2) + meta.unit;
  document.getElementById('leg-max').textContent = '> ' + fmt(b.Q4) + meta.unit;
}

function setupTooltip() {
  const tooltip = document.getElementById('tooltip');

  map.on('mousemove', 'bv-fill', e => {
    map.getCanvas().style.cursor = 'crosshair';
    const props = e.features[0].properties;
    const id    = e.features[0].id;

    if (hoveredBvId !== null && hoveredBvId !== id) {
      map.setFeatureState({ source: 'bureaux-vote', id: hoveredBvId }, { hover: false });
    }
    hoveredBvId = id;
    map.setFeatureState({ source: 'bureaux-vote', id: id }, { hover: true });

    const fmt = (v, d=1) => (v == null || v === 'null') ? '–'
      : (d === 0 ? Math.round(+v).toLocaleString('fr-FR') : (+v).toFixed(d));

    const candidateRows = [
      { key: 'gregoire',  field: 'pct_gregoire',  name: 'Grégoire' },
      { key: 'dati',      field: 'pct_dati',      name: 'Dati' },
      { key: 'chikirou',  field: 'pct_chikirou',  name: 'Chikirou' },
      { key: 'bournazel', field: 'pct_bournazel', name: 'Bournazel' },
      { key: 'knafo',     field: 'pct_knafo',     name: 'Knafo' }
    ].filter(c => props[c.field] != null && props[c.field] !== 'null');

    const candidatesHtml = candidateRows.length ? `
      <div class="tip-candidates">
        ${candidateRows.map(c => `
          <div class="tip-cand">
            <span class="tip-cand-dot" style="background:${PARTY_META[c.key].color}"></span>
            <span class="tip-cand-name">${c.name}</span>
            <span class="tip-cand-pct">${fmt(props[c.field])}%</span>
          </div>
        `).join('')}
      </div>` : '';

    tooltip.innerHTML = `
      <div class="tip-title">BV ${props.code_bv}${props.arrondissement ? ' · ' + props.arrondissement : ''}</div>
      <div class="tip-row"><span class="tip-label">Inscrits</span><span class="tip-val">${fmt(props.inscrits, 0)}</span></div>
      <div class="tip-row"><span class="tip-label">Abstention</span><span class="tip-val">${fmt(props.taux_abstention)} %</span></div>
      <div class="tip-row"><span class="tip-label">Revenu médian</span><span class="tip-val">${fmt(props.revenu_median, 0)} €/UC</span></div>
      <div class="tip-row"><span class="tip-label">HLM</span><span class="tip-val">${fmt(props.n_hlm, 0)} (${fmt(props.hlm_density, 0)}/km²)</span></div>
      ${candidatesHtml}
      <div class="tip-warn">
        ⚠ L'abstention est calculée sur les inscrits uniquement.
        Dans les quartiers HLM, le taux réel de non-participation
        est probablement sous-estimé (Braconnier &amp; Dormagen, 2007).
      </div>
    `;

    const rect = map.getCanvas().getBoundingClientRect();
    let tx = e.originalEvent.clientX - rect.left + 14;
    let ty = e.originalEvent.clientY - rect.top  - 20;
    if (tx + 270 > rect.width)  tx = e.originalEvent.clientX - rect.left - 274;
    if (ty + 160 > rect.height) ty = e.originalEvent.clientY - rect.top  - 160;
    tooltip.style.left    = tx + 'px';
    tooltip.style.top     = ty + 'px';
    tooltip.style.display = 'block';

    if (onHoverBv) onHoverBv(props.code_bv);
  });

  map.on('mouseleave', 'bv-fill', () => {
    map.getCanvas().style.cursor = '';
    tooltip.style.display = 'none';
    if (hoveredBvId !== null) {
      map.setFeatureState({ source: 'bureaux-vote', id: hoveredBvId }, { hover: false });
      hoveredBvId = null;
    }
    if (onLeaveBv) onLeaveBv();
  });
}

export function flyToFeature(feature) {
  if (!feature.geometry || !feature.geometry.coordinates) return;
  try {
    const coords = feature.geometry.type === 'Polygon'
      ? feature.geometry.coordinates[0]
      : feature.geometry.coordinates[0][0];
    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const cx = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const cy = (Math.min(...lats) + Math.max(...lats)) / 2;
    map.easeTo({ center: [cx, cy], duration: 300 });
  } catch { /* boundary geometry edge case */ }
}
