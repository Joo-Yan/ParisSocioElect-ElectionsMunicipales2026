import './styles.css';
import { LAYER_META, computeBreaks } from './layers.js';
import { initMap, addDataLayers, switchMapLayer, updateLegend, setMapCallbacks } from './map.js';
import {
  initScatter, highlightScatterPoint, resetScatterHighlight,
  populateAxisSelectors, updateScatterHeader
} from './scatter.js';
import { isMobileLayout } from './utils.js';

// ═══════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════
let currentLayer = 'abstention';
let geojsonData  = null;
let mobileChartCollapsed  = false;
let mobileLayersCollapsed = false;

const GEOJSON_PATH = 'data/processed/paris_2026_t1.geojson';

// ═══════════════════════════════════════════════════════════
// Init UI controls
// ═══════════════════════════════════════════════════════════
populateAxisSelectors(() => {
  if (geojsonData) initScatter(geojsonData, { mobileChartCollapsed });
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
  });
});

function switchLayer(layer) {
  currentLayer = layer;
  document.querySelectorAll('.layer-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.layer === layer);
  });
  switchMapLayer(layer);
  updateLegend(layer);
}

// ═══════════════════════════════════════════════════════════
// Map + Data loading
// ═══════════════════════════════════════════════════════════
const map = initMap();

setMapCallbacks({
  onHover: (codeBv) => highlightScatterPoint(codeBv),
  onLeave: () => resetScatterHighlight(),
});

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
    })
    .catch(err => {
      console.error(err);
      alert('Impossible de charger le GeoJSON.\n' + err.message +
        '\n\nVérifiez que process.py a bien été lancé et que le fichier existe dans data/processed/');
    });
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
  }
});
