import './styles.css';
import { VIEW_CONFIG, computeBreaks, setBREAKS } from './layers.js';
import { setView, viewConfig } from './viewstate.js';
import {
  initMap, addDataLayers, clearDataLayers, switchMapLayer, updateLegend,
  setMapCallbacks, getMap
} from './map.js';
import {
  initScatter, highlightScatterPoint, resetScatterHighlight,
  populateAxisSelectors, updateScatterHeader, resetScatterAxes,
  getScatterAxes, setScatterAxes, highlightScatterGroup
} from './scatter.js';
import { isMobileLayout } from './utils.js';
import { updateBarChart, setBarChartHighlightCallback } from './barchart.js';
import { initStory, openStory, closeStory } from './story.js';

// ═══════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════
let currentView  = 'paris';
let currentLayer = 'abstention';
let geojsonData  = null;
let mobileChartCollapsed  = false;
let mobileLayersCollapsed = false;

// Caches to avoid re-fetching / re-computing
const geojsonCache = {};
const breaksCache  = {};
let switchInProgress = false;

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
    `view=${currentView}`,
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
  const vcfg = VIEW_CONFIG[currentView];

  if (params.layer && vcfg.layerMeta[params.layer]) {
    switchLayer(params.layer);
  }
  if (params.x && vcfg.layerMeta[params.x] && !vcfg.layerMeta[params.x].categorical &&
      params.y && vcfg.layerMeta[params.y] && !vcfg.layerMeta[params.y].categorical) {
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
  const params = parseHash();
  // If view changed via hash, trigger view switch then restore full hash state
  if (params.view && params.view !== currentView && VIEW_CONFIG[params.view]) {
    const lat = params.lat ? parseFloat(params.lat) : undefined;
    const lng = params.lng ? parseFloat(params.lng) : undefined;
    const z   = params.z   ? parseFloat(params.z)   : undefined;
    switchView(params.view, {
      skipHashWrite: true,
      center: lat && lng ? [lng, lat] : undefined,
      zoom: z
    }).then(() => applyHashState());
  } else {
    applyHashState();
  }
});

// ═══════════════════════════════════════════════════════════
// Layer button generation
// ═══════════════════════════════════════════════════════════
function buildLayerButtons(vcfg) {
  const container = document.getElementById('layer-controls');
  // Remove existing ctrl-groups
  container.querySelectorAll('.ctrl-group').forEach(g => g.remove());

  for (const group of vcfg.groups) {
    const div = document.createElement('div');
    div.className = 'ctrl-group';
    const title = document.createElement('div');
    title.className = 'group-title';
    title.textContent = group.title;
    div.appendChild(title);

    for (const key of group.keys) {
      const meta  = vcfg.layerMeta[key];
      const party = vcfg.partyMeta[key];
      const btn   = document.createElement('button');
      btn.className = 'layer-btn';
      btn.dataset.layer = key;
      if (party) {
        btn.style.setProperty('--party-color', party.color);
        const badge = document.createElement('span');
        badge.className = 'party-badge';
        badge.style.background = party.color;
        badge.textContent = party.list;
        btn.appendChild(badge);
        btn.appendChild(document.createTextNode(meta.shortLabel));
      } else {
        btn.textContent = meta.shortLabel;
      }
      div.appendChild(btn);
    }
    container.appendChild(div);
  }

  // Attach click listeners
  container.querySelectorAll('.layer-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchLayer(btn.dataset.layer);
      if (isMobileLayout()) {
        mobileLayersCollapsed = true;
        applyMobileLayerState();
      }
      scheduleHashWrite();
    });
  });
}

// ═══════════════════════════════════════════════════════════
// View switching
// ═══════════════════════════════════════════════════════════
async function switchView(view, { skipHashWrite = false, center, zoom } = {}) {
  if (switchInProgress) return;
  if (view === currentView && geojsonCache[view]) return;
  switchInProgress = true;

  try {
    const vcfg = VIEW_CONFIG[view];

    // Fetch + cache data BEFORE mutating any state
    if (!geojsonCache[view]) {
      const resp = await fetch(vcfg.geojsonPath);
      if (!resp.ok) throw new Error(`HTTP ${resp.status} — fichier GeoJSON introuvable`);
      geojsonCache[view] = await resp.json();
      breaksCache[view] = computeBreaks(geojsonCache[view].features, vcfg.layerMeta);
    }

    // Mutate state only after fetch succeeded
    currentView = view;
    setView(view, vcfg);

    // Update header
    document.querySelector('#header .subtitle').textContent = vcfg.subtitle;
    document.querySelectorAll('#view-toggle button').forEach(b =>
      b.classList.toggle('active', b.dataset.view === view));

    // Rebuild layer buttons
    buildLayerButtons(vcfg);

    // Story mode is Paris-only (steps reference Paris-only layers)
    const storyBtn = document.getElementById('story-btn');
    if (storyBtn) storyBtn.style.display = view === 'paris' ? '' : 'none';

    const data = geojsonCache[view];
    setBREAKS(breaksCache[view]);
    geojsonData = data;

    // Map: clear old, apply per-view zoom bounds, fly to new center, add new layers
    clearDataLayers();
    const map = getMap();
    map.setMinZoom(vcfg.mapMinZoom);
    map.flyTo({ center: center || vcfg.mapCenter, zoom: zoom || vcfg.mapZoom, duration: 800 });

    addDataLayers(data);

    // Reset to default layer
    currentLayer = vcfg.defaultLayer;
    switchLayer(currentLayer);
    updateLegend(currentLayer);

    // Reset scatter
    resetScatterAxes('hlm', 'abstention');
    populateAxisSelectors(onAxisChange);
    updateScatterHeader();
    initScatter(geojsonData, { mobileChartCollapsed });

    // Barchart
    updateBarChart(data.features, currentLayer);

    if (!skipHashWrite) scheduleHashWrite();
  } finally {
    switchInProgress = false;
  }
}

// ═══════════════════════════════════════════════════════════
// Axis change callback
// ═══════════════════════════════════════════════════════════
function onAxisChange() {
  if (geojsonData) {
    initScatter(geojsonData, { mobileChartCollapsed });
    updateBarChart(geojsonData.features, currentLayer);
  }
  scheduleHashWrite();
}

// ═══════════════════════════════════════════════════════════
// Init UI controls
// ═══════════════════════════════════════════════════════════

// View toggle
document.getElementById('view-toggle').addEventListener('click', e => {
  const btn = e.target.closest('[data-view]');
  if (btn && btn.dataset.view !== currentView) {
    switchView(btn.dataset.view).catch(err => {
      console.error('View switch failed:', err);
      alert('Impossible de charger les données.\n' + err.message);
    });
  }
});

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
// Layer switching
// ═══════════════════════════════════════════════════════════
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
setBarChartHighlightCallback((groupValue) => {
  highlightScatterGroup(groupValue);
  setTimeout(() => resetScatterHighlight(), 2000);
});

// ═══════════════════════════════════════════════════════════
// Map + Data loading
// ═══════════════════════════════════════════════════════════
const map = initMap();

setMapCallbacks({
  onHover: (featureId) => highlightScatterPoint(featureId),
  onLeave: () => resetScatterHighlight(),
});

// Update hash on map move
map.on('moveend', scheduleHashWrite);

map.on('load', () => {
  // Determine initial view from hash
  const params = parseHash();
  const initialView = (params.view && VIEW_CONFIG[params.view]) ? params.view : 'paris';

  // Set initial viewstate before first render
  setView(initialView, VIEW_CONFIG[initialView]);

  switchView(initialView)
    .then(() => {
      // Apply full hash state (layer, axes, position) after data is loaded
      if (params.layer || params.x || params.lat) {
        applyHashState();
      }
      // Init story after data is ready
      initStory({ switchLayer });
    })
    .catch(err => {
      console.error(err);
      alert('Impossible de charger le GeoJSON.\n' + err.message);
    });
});

// ═══════════════════════════════════════════════════════════
// Story mode
// ═══════════════════════════════════════════════════════════
document.getElementById('story-btn').addEventListener('click', () => {
  openStory();
});
document.getElementById('story-close-btn').addEventListener('click', () => {
  closeStory();
});
document.getElementById('story-exit-btn').addEventListener('click', () => {
  closeStory();
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
    a.download = `socioelect_${currentView}_${currentLayer}_${ts}.png`;
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

  const vcfg = VIEW_CONFIG[currentView];
  const fields = vcfg.csvFields;

  const header = fields.join(';');
  const rows = geojsonData.features.map(f => {
    const p = f.properties;
    return fields.map(field => {
      const val = p[field];
      if (val == null || val === '' || val === 'null') return '';
      // String fields: no decimal conversion
      if (typeof val === 'string' && isNaN(+val)) return val;
      if (['code_bv', 'code_commune', 'arrondissement', 'nom_commune', 'departement'].includes(field)) return val;
      // French locale: comma as decimal separator
      return String(val).replace('.', ',');
    }).join(';');
  });

  const csv = '\uFEFF' + header + '\n' + rows.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = vcfg.csvFilename;
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
