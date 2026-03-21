import './styles.css';
import { LAYER_META, computeBreaks } from './layers.js';
import { initMap, addDataLayers, switchMapLayer, updateLegend, setMapCallbacks, getMap } from './map.js';
import {
  initScatter, highlightScatterPoint, resetScatterHighlight,
  populateAxisSelectors, updateScatterHeader,
  getScatterAxes, setScatterAxes, highlightScatterArrondissement
} from './scatter.js';
import { isMobileLayout } from './utils.js';
import { updateBarChart, setBarChartHighlightCallback } from './barchart.js';

// ═══════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════
let currentLayer = 'abstention';
let geojsonData  = null;
let mobileChartCollapsed  = false;
let mobileLayersCollapsed = false;

const GEOJSON_PATH = 'data/processed/paris_2026_t1.geojson';

// ═══════════════════════════════════════════════════════════
// URL Hash State
// ═══════════════════════════════════════════════════════════
function parseHash() {
  const hash = window.location.hash.replace(/^#/, '');
  const params = {};
  hash.split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
  });
  return params;
}

function writeHash() {
  const map = getMap();
  const axes = getScatterAxes();
  const center = map ? map.getCenter() : { lat: 48.8566, lng: 2.3522 };
  const zoom = map ? map.getZoom() : 11.2;
  const parts = [
    `layer=${currentLayer}`,
    `x=${axes.x}`,
    `y=${axes.y}`,
    `z=${zoom.toFixed(1)}`,
    `lat=${center.lat.toFixed(4)}`,
    `lng=${center.lng.toFixed(4)}`
  ];
  history.replaceState(null, '', '#' + parts.join('&'));
}

let hashWriteTimer = null;
function scheduleHashWrite() {
  clearTimeout(hashWriteTimer);
  hashWriteTimer = setTimeout(writeHash, 300);
}

function applyHashState() {
  const params = parseHash();
  if (params.layer && LAYER_META[params.layer]) {
    switchLayer(params.layer);
  }
  if (params.x && LAYER_META[params.x] && params.y && LAYER_META[params.y]) {
    setScatterAxes(params.x, params.y);
    document.getElementById('x-axis-select').value = params.x;
    document.getElementById('y-axis-select').value = params.y;
    updateScatterHeader();
    if (geojsonData) initScatter(geojsonData, { mobileChartCollapsed });
  }
  const map = getMap();
  if (map && params.lat && params.lng && params.z) {
    map.jumpTo({
      center: [parseFloat(params.lng), parseFloat(params.lat)],
      zoom: parseFloat(params.z)
    });
  }
}

window.addEventListener('hashchange', () => {
  applyHashState();
});

// ═══════════════════════════════════════════════════════════
// Init UI controls
// ═══════════════════════════════════════════════════════════
populateAxisSelectors(() => {
  if (geojsonData) {
    initScatter(geojsonData, { mobileChartCollapsed });
    updateBarChart(geojsonData.features, currentLayer);
  }
  scheduleHashWrite();
});
updateScatterHeader();

document.getElementById('mobile-layer-toggle').addEventListener('click', () => {
  if (!isMobileLayout()) return;
  mobileLayersCollapsed = !mobileLayersCollapsed;
  applyMobileLayerState();
});

document.getElementById('mobile-chart-toggle').addEventListener('click', () => {
  if (!isMobileLayout()) return;
  mobileChartCollapsed = !mobileChartCollapsed;
  applyMobileChartState();
});

syncMobileLayout();

// ═══════════════════════════════════════════════════════════
// Layer buttons
// ═══════════════════════════════════════════════════════════
document.querySelectorAll('.layer-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    switchLayer(btn.dataset.layer);
    if (isMobileLayout()) {
      mobileLayersCollapsed = true;
      applyMobileLayerState();
    }
    scheduleHashWrite();
  });
});

function switchLayer(layer) {
  currentLayer = layer;
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layer === layer);
  });
  switchMapLayer(layer);
  updateLegend(layer);
  if (geojsonData) {
    updateBarChart(geojsonData.features, layer);
  }
}

// ═══════════════════════════════════════════════════════════
// Barchart → scatter highlight
// ═══════════════════════════════════════════════════════════
setBarChartHighlightCallback((arrondissement) => {
  highlightScatterArrondissement(arrondissement);
  // Reset after 2s
  setTimeout(() => resetScatterHighlight(), 2000);
});

// ═══════════════════════════════════════════════════════════
// Map + Data loading
// ═══════════════════════════════════════════════════════════
const map = initMap();

setMapCallbacks({
  onHover: (codeBv) => highlightScatterPoint(codeBv),
  onLeave: () => resetScatterHighlight(),
});

// Update hash on map move
map.on('moveend', scheduleHashWrite);

map.on('load', () => {
  fetch(GEOJSON_PATH)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status} — fichier GeoJSON introuvable`);
      return r.json();
    })
    .then(data => {
      geojsonData = data;

      // Dynamic breakpoints — computed from actual data
      computeBreaks(data.features);

      const featuresWithId = addDataLayers(data);
      updateLegend('abstention');
      initScatter(featuresWithId, { mobileChartCollapsed });
      updateBarChart(data.features, currentLayer);

      // Apply URL hash state after data is loaded
      const params = parseHash();
      if (params.layer) applyHashState();

      // Write initial hash
      scheduleHashWrite();
    })
    .catch(err => {
      console.error(err);
      alert('Impossible de charger le GeoJSON.\n' + err.message +
        '\n\nVérifiez que process.py a bien été lancé et que le fichier existe dans data/processed/');
    });
});

// ═══════════════════════════════════════════════════════════
// Map Screenshot Export
// ═══════════════════════════════════════════════════════════
document.getElementById('map-export-btn').addEventListener('click', () => {
  const mapInst = getMap();
  if (!mapInst) return;
  try {
    const dataUrl = mapInst.getCanvas().toDataURL('image/png');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `socioelect_paris_${currentLayer}_${ts}.png`;
    a.click();
  } catch (e) {
    console.error('Map export failed:', e);
    alert('Export échoué. Le basemap peut bloquer le canvas CORS.');
  }
});

// ═══════════════════════════════════════════════════════════
// CSV Data Download
// ═══════════════════════════════════════════════════════════
document.getElementById('csv-download-btn').addEventListener('click', () => {
  if (!geojsonData) { alert('Données non chargées.'); return; }

  const fields = [
    'code_bv', 'arrondissement', 'inscrits',
    'taux_abstention', 'revenu_median', 'hlm_density', 'n_hlm',
    'pct_gregoire', 'pct_dati', 'pct_chikirou', 'pct_bournazel', 'pct_knafo', 'pct_autres',
    'lisa_taux_abstention', 'lisa_revenu_median', 'lisa_hlm_density', 'cluster_id'
  ];

  const header = fields.join(';');
  const rows = geojsonData.features.map(f => {
    const p = f.properties;
    return fields.map(field => {
      const val = p[field];
      if (val == null || val === '' || val === 'null') return '';
      if (field === 'code_bv' || field === 'arrondissement') return val;
      // French locale: comma as decimal separator
      return String(val).replace('.', ',');
    }).join(';');
  });

  const csv = '\uFEFF' + header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'socioelect_paris_donnees.csv';
  a.click();
  URL.revokeObjectURL(url);
});

// ═══════════════════════════════════════════════════════════
// Mobile layout helpers
// ═══════════════════════════════════════════════════════════
function applyMobileLayerState() {
  const collapsed = isMobileLayout() && mobileLayersCollapsed;
  document.body.classList.toggle('mobile-layers-collapsed', collapsed);
  const toggle = document.getElementById('mobile-layer-toggle');
  if (toggle) {
    toggle.textContent = collapsed ? 'Afficher les couches' : 'Masquer les couches';
  }
}

function applyMobileChartState() {
  const collapsed = isMobileLayout() && mobileChartCollapsed;
  document.body.classList.toggle('mobile-chart-collapsed', collapsed);
  const toggle = document.getElementById('mobile-chart-toggle');
  if (toggle) {
    toggle.textContent = collapsed ? 'Ouvrir le graphique' : 'Réduire le graphique';
  }
  if (!collapsed && geojsonData) {
    initScatter(geojsonData, { mobileChartCollapsed });
  }
}

function syncMobileLayout() {
  if (isMobileLayout()) {
    if (!document.body.classList.contains('mobile-chart-collapsed') && !mobileChartCollapsed) {
      mobileChartCollapsed = true;
    }
    if (!document.body.classList.contains('mobile-layers-collapsed') && !mobileLayersCollapsed) {
      mobileLayersCollapsed = true;
    }
  } else {
    mobileChartCollapsed = false;
    mobileLayersCollapsed = false;
  }
  applyMobileLayerState();
  applyMobileChartState();
}

window.addEventListener('resize', () => {
  syncMobileLayout();
  if (geojsonData) {
    initScatter(geojsonData, { mobileChartCollapsed });
    updateBarChart(geojsonData.features, currentLayer);
  }
});
