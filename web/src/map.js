import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { BREAKS, LISA_COLORS, CLUSTER_COLORS } from './layers.js';
import { viewConfig, currentView } from './viewstate.js';
import { formatValue } from './utils.js';

let map;
let hoveredId = null;
let _onMouseMove  = null;
let _onMouseLeave = null;

const SOURCE_NAME = 'features';
const FILL_LAYER  = 'feat-fill';
const LINE_LAYER  = 'feat-outline';

// Callbacks set by main.js for cross-module coordination
let onHoverFeature = null;
let onLeaveFeature = null;

export function setMapCallbacks({ onHover, onLeave }) {
  onHoverFeature = onHover;
  onLeaveFeature = onLeave;
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
    minZoom: 8,
    maxZoom: 16,
    preserveDrawingBuffer: true
  });
  map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
  return map;
}

export function buildColorExpr(layer) {
  const vcfg = viewConfig;
  const meta = vcfg.layerMeta[layer];
  if (!meta) return '#555555';
  const { field } = meta;

  // Categorical layers: LISA and cluster (Paris only)
  if (meta.categorical) {
    if (layer.startsWith('lisa_')) {
      return [
        'match', ['get', field],
        'HH', LISA_COLORS.HH,
        'HL', LISA_COLORS.HL,
        'LH', LISA_COLORS.LH,
        'LL', LISA_COLORS.LL,
        LISA_COLORS.NS
      ];
    }
    if (layer === 'cluster') {
      const matchExpr = ['match', ['get', field]];
      for (let i = 0; i < CLUSTER_COLORS.length; i++) {
        matchExpr.push(i, CLUSTER_COLORS[i]);
      }
      matchExpr.push('#404040');
      return matchExpr;
    }
  }

  // Quantile layers: use step expression with computed breaks
  const colors = vcfg.colors[layer];
  const b      = BREAKS[layer];
  if (!colors || !b) return '#555555';
  return [
    'case',
    ['==', ['get', field], null], '#555555',
    ['step', ['get', field],
      colors[0], b.Q1, colors[1], b.Q2, colors[2], b.Q3, colors[3], b.Q4, colors[4]
    ]
  ];
}

export function clearDataLayers() {
  if (_onMouseMove)  map.off('mousemove',  FILL_LAYER, _onMouseMove);
  if (_onMouseLeave) map.off('mouseleave', FILL_LAYER, _onMouseLeave);
  _onMouseMove = _onMouseLeave = null;
  if (map.getLayer(FILL_LAYER))   map.removeLayer(FILL_LAYER);
  if (map.getLayer(LINE_LAYER))   map.removeLayer(LINE_LAYER);
  if (map.getSource(SOURCE_NAME)) map.removeSource(SOURCE_NAME);
  hoveredId = null;
  document.getElementById('tooltip').style.display = 'none';
  if (onLeaveFeature) onLeaveFeature();
}

export function addDataLayers(data) {
  const featuresWithId = {
    ...data,
    features: data.features.map((f, i) => ({ ...f, id: i }))
  };

  map.addSource(SOURCE_NAME, {
    type: 'geojson',
    data: featuresWithId,
    generateId: false
  });

  map.addLayer({
    id: FILL_LAYER,
    type: 'fill',
    source: SOURCE_NAME,
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
    id: LINE_LAYER,
    type: 'line',
    source: SOURCE_NAME,
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
  if (map.getLayer(FILL_LAYER)) {
    map.setPaintProperty(FILL_LAYER, 'fill-color', buildColorExpr(layer));
  }
}

export function updateLegend(layer) {
  const vcfg  = viewConfig;
  const meta  = vcfg.layerMeta[layer];
  const party = vcfg.partyMeta[layer];

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

  // Categorical legends (LISA, cluster)
  if (meta.categorical) {
    const bar = document.getElementById('legend-bar');
    bar.innerHTML = '';

    if (layer.startsWith('lisa_')) {
      const cats = [
        { key: 'HH', color: LISA_COLORS.HH },
        { key: 'HL', color: LISA_COLORS.HL },
        { key: 'LH', color: LISA_COLORS.LH },
        { key: 'LL', color: LISA_COLORS.LL },
        { key: 'NS', color: LISA_COLORS.NS },
      ];
      cats.forEach(c => {
        const d = document.createElement('div');
        d.style.background = c.color;
        bar.appendChild(d);
      });
      document.getElementById('leg-min').textContent = 'HH';
      document.getElementById('leg-mid').textContent = 'LH · HL';
      document.getElementById('leg-max').textContent = 'LL';
    } else if (layer === 'cluster') {
      for (let i = 0; i < 6; i++) {
        const d = document.createElement('div');
        d.style.background = CLUSTER_COLORS[i] || '#404040';
        bar.appendChild(d);
      }
      document.getElementById('leg-min').textContent = 'Cluster 0';
      document.getElementById('leg-mid').textContent = '';
      document.getElementById('leg-max').textContent = 'Cluster N';
    }
    return;
  }

  const colors = vcfg.colors[layer];
  const b      = BREAKS[layer];

  const bar = document.getElementById('legend-bar');
  bar.innerHTML = '';
  if (colors) {
    colors.forEach(c => {
      const d = document.createElement('div');
      d.style.background = c;
      bar.appendChild(d);
    });
  }

  if (!b) return;

  const fmt = v => meta.decimals === 0
    ? Math.round(v).toLocaleString('fr-FR')
    : v.toFixed(meta.decimals);

  document.getElementById('leg-min').textContent = '< ' + fmt(b.Q1) + meta.unit;
  document.getElementById('leg-mid').textContent = fmt(b.Q2) + meta.unit;
  document.getElementById('leg-max').textContent = '> ' + fmt(b.Q4) + meta.unit;
}

// ═══════════════════════════════════════════════════════════
// Tooltip
// ═══════════════════════════════════════════════════════════

function buildParisTooltip(props) {
  const vcfg = viewConfig;
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
          <span class="tip-cand-dot" style="background:${vcfg.partyMeta[c.key].color}"></span>
          <span class="tip-cand-name">${c.name}</span>
          <span class="tip-cand-pct">${fmt(props[c.field])}%</span>
        </div>
      `).join('')}
    </div>` : '';

  return `
    <div class="tip-title">BV ${props.code_bv}${props.arrondissement ? ' · ' + props.arrondissement : ''}</div>
    <div class="tip-row"><span class="tip-label">Inscrits</span><span class="tip-val">${fmt(props.inscrits, 0)}</span></div>
    <div class="tip-row"><span class="tip-label">Abstention 2026</span><span class="tip-val">${fmt(props.taux_abstention)} %</span></div>
    ${props.taux_abstention_2020 != null && props.taux_abstention_2020 !== 'null' ? `
    <div class="tip-row"><span class="tip-label">Abstention 2020</span><span class="tip-val">${fmt(props.taux_abstention_2020)} %</span></div>
    <div class="tip-row"><span class="tip-label">Évolution</span><span class="tip-val" style="color:${+props.delta_abstention > 0 ? '#f4a582' : '#92c5de'}">${+props.delta_abstention > 0 ? '+' : ''}${fmt(props.delta_abstention)} pts</span></div>` : ''}
    <div class="tip-row"><span class="tip-label">Revenu médian</span><span class="tip-val">${fmt(props.revenu_median, 0)} €/UC</span></div>
    <div class="tip-row"><span class="tip-label">HLM</span><span class="tip-val">${fmt(props.n_hlm, 0)} (${fmt(props.hlm_density, 0)}/km²)</span></div>
    ${candidatesHtml}
    ${props.cluster_id != null ? `
    <div class="tip-row" style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08)">
      <span class="tip-label">Cluster</span>
      <span class="tip-val">${props.cluster_id}</span>
    </div>` : ''}
    ${props.lisa_taux_abstention && props.lisa_taux_abstention !== 'NS' ? `
    <div class="tip-row">
      <span class="tip-label">LISA abst.</span>
      <span class="tip-val" style="color:${LISA_COLORS[props.lisa_taux_abstention] || '#888'}">${props.lisa_taux_abstention}</span>
    </div>` : ''}
    ${props.taux_non_inscription != null && props.taux_non_inscription !== 'null' ? `
    <div class="tip-row" style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.08)">
      <span class="tip-label">Non-inscrits est.</span>
      <span class="tip-val">${fmt(props.taux_non_inscription)} %</span>
    </div>
    <div class="tip-row">
      <span class="tip-label">Non-participation réelle</span>
      <span class="tip-val">${fmt(props.taux_non_participation_reel)} %</span>
    </div>` : `
    <div class="tip-warn">
      ⚠ L'abstention est calculée sur les inscrits uniquement.
      Dans les quartiers HLM, le taux réel de non-participation
      est probablement sous-estimé (Braconnier &amp; Dormagen, 2007).
    </div>`}
  `;
}

function buildIdfTooltip(props) {
  const vcfg = viewConfig;
  const fmt = (v, d=1) => (v == null || v === 'null') ? '–'
    : (d === 0 ? Math.round(+v).toLocaleString('fr-FR') : (+v).toFixed(d));

  const familyRows = [
    { key: 'gauche',     field: 'pct_gauche',      name: 'Gauche' },
    { key: 'centre',     field: 'pct_centre',      name: 'Centre' },
    { key: 'droite',     field: 'pct_droite',      name: 'Droite' },
    { key: 'ext_droite', field: 'pct_ext_droite',  name: 'Extr. droite' },
    { key: 'autres',     field: 'pct_autres',      name: 'Autres' },
  ].filter(c => props[c.field] != null && +props[c.field] > 0);

  const familiesHtml = familyRows.length ? `
    <div class="tip-candidates">
      ${familyRows.map(c => `
        <div class="tip-cand">
          <span class="tip-cand-dot" style="background:${vcfg.partyMeta[c.key]?.color || '#888'}"></span>
          <span class="tip-cand-name">${c.name}</span>
          <span class="tip-cand-pct">${fmt(props[c.field])}%</span>
        </div>
      `).join('')}
    </div>` : '';

  return `
    <div class="tip-title">${props.nom_commune || props.code_commune}${props.departement ? ' · Dép. ' + props.departement : ''}</div>
    <div class="tip-row"><span class="tip-label">Inscrits</span><span class="tip-val">${fmt(props.inscrits, 0)}</span></div>
    <div class="tip-row"><span class="tip-label">Abstention</span><span class="tip-val">${fmt(props.taux_abstention)} %</span></div>
    <div class="tip-row"><span class="tip-label">Revenu médian</span><span class="tip-val">${fmt(props.revenu_median, 0)} €/UC</span></div>
    <div class="tip-row"><span class="tip-label">HLM</span><span class="tip-val">${fmt(props.n_hlm, 0)} (${fmt(props.hlm_density, 0)}/km²)</span></div>
    ${familiesHtml}
  `;
}

function setupTooltip() {
  const tooltip = document.getElementById('tooltip');

  _onMouseMove = e => {
    map.getCanvas().style.cursor = 'crosshair';
    const props = e.features[0].properties;
    const id    = e.features[0].id;

    if (hoveredId !== null && hoveredId !== id) {
      map.setFeatureState({ source: SOURCE_NAME, id: hoveredId }, { hover: false });
    }
    hoveredId = id;
    map.setFeatureState({ source: SOURCE_NAME, id: id }, { hover: true });

    tooltip.innerHTML = currentView === 'paris'
      ? buildParisTooltip(props)
      : buildIdfTooltip(props);

    const rect = map.getCanvas().getBoundingClientRect();
    let tx = e.originalEvent.clientX - rect.left + 14;
    let ty = e.originalEvent.clientY - rect.top  - 20;
    if (tx + 270 > rect.width)  tx = e.originalEvent.clientX - rect.left - 274;
    if (ty + 160 > rect.height) ty = e.originalEvent.clientY - rect.top  - 160;
    tooltip.style.left    = tx + 'px';
    tooltip.style.top     = ty + 'px';
    tooltip.style.display = 'block';

    const vcfg = viewConfig;
    if (onHoverFeature) onHoverFeature(props[vcfg.idField]);
  };

  _onMouseLeave = () => {
    map.getCanvas().style.cursor = '';
    tooltip.style.display = 'none';
    if (hoveredId !== null) {
      map.setFeatureState({ source: SOURCE_NAME, id: hoveredId }, { hover: false });
      hoveredId = null;
    }
    if (onLeaveFeature) onLeaveFeature();
  };

  map.on('mousemove',  FILL_LAYER, _onMouseMove);
  map.on('mouseleave', FILL_LAYER, _onMouseLeave);
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
