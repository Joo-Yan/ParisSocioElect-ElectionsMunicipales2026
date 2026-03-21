import * as d3 from 'd3';

// ═══════════════════════════════════════════════════════════
// COLOR SCALES — static per layer
// ═══════════════════════════════════════════════════════════
export const COLORS = {
  abstention: ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026'],
  revenu:     ['#edf8fb','#b3cde3','#8c96c6','#8856a7','#810f7c'],
  hlm:        ['#ffffcc','#c2e699','#78c679','#31a354','#006837'],
  gregoire:   ['#fce4f3','#f4a8d4','#ec6db5','#d41880','#9d005d'],
  dati:       ['#dde8ff','#99b8ec','#5585d8','#1a5cb8','#0a2f70'],
  chikirou:   ['#ffe5e5','#ffaaaa','#ee5555','#cc0000','#840000'],
  bournazel:  ['#fff3e0','#ffcc80','#ffa040','#e07b00','#904000'],
  knafo:      ['#dde8f5','#90b8d8','#4d88b8','#1e5f8a','#0a3050'],
  autres:     ['#f0f0f0','#d0d0d0','#a0a0a0','#6b6b6b','#404040']
};

export const IDF_COLORS = {
  abstention:  ['#ffffb2','#fecc5c','#fd8d3c','#f03b20','#bd0026'],
  revenu:      ['#edf8fb','#b3cde3','#8c96c6','#8856a7','#810f7c'],
  hlm:         ['#ffffcc','#c2e699','#78c679','#31a354','#006837'],
  gauche:      ['#fce4f3','#f4a8d4','#ec6db5','#d41880','#9d005d'],
  centre:      ['#fff3e0','#ffcc80','#ffa040','#e07b00','#904000'],
  droite:      ['#dde8ff','#99b8ec','#5585d8','#1a5cb8','#0a2f70'],
  ext_droite:  ['#ffe5e5','#ffaaaa','#ee5555','#cc0000','#840000'],
  autres:      ['#f0f0f0','#d0d0d0','#a0a0a0','#6b6b6b','#404040']
};

export const PARTY_META = {
  gregoire:  { list: 'LUG',  label: 'Union des gauches', color: '#E91E8C' },
  dati:      { list: 'LUD',  label: 'Droite',            color: '#1A5CB8' },
  chikirou:  { list: 'LFI',  label: 'France Insoumise',  color: '#CC0000' },
  bournazel: { list: 'LUC',  label: 'Centre',            color: '#E07B00' },
  knafo:     { list: 'LEXD', label: 'Extrême droite',    color: '#1E5F8A' },
  autres:    { list: '–',    label: 'Autres listes',     color: '#555e6d' }
};

export const IDF_PARTY_META = {
  gauche:     { list: 'G',   label: 'Gauche',         color: '#E91E8C' },
  centre:     { list: 'C',   label: 'Centre',         color: '#E07B00' },
  droite:     { list: 'D',   label: 'Droite',         color: '#1A5CB8' },
  ext_droite: { list: 'ED',  label: 'Extrême droite', color: '#CC0000' },
  autres:     { list: '–',   label: 'Autres',         color: '#555e6d' }
};

export const LAYER_META = {
  abstention: { field: 'taux_abstention', label: 'Abstention (%)',        shortLabel: 'Taux d\'abstention', unit: '%',       decimals: 1 },
  revenu:     { field: 'revenu_median',   label: 'Revenu médian (€/UC)',  shortLabel: 'Revenu médian',      unit: '€',       decimals: 0 },
  hlm:        { field: 'hlm_density',     label: 'Densité HLM (log/km²)', shortLabel: 'Densité HLM',        unit: ' /km²',   decimals: 0 },
  gregoire:   { field: 'pct_gregoire',    label: 'Score Grégoire (%)',    shortLabel: 'Grégoire',           unit: '%',       decimals: 1 },
  dati:       { field: 'pct_dati',        label: 'Score Dati (%)',        shortLabel: 'Dati',               unit: '%',       decimals: 1 },
  chikirou:   { field: 'pct_chikirou',    label: 'Score Chikirou (%)',    shortLabel: 'Chikirou',           unit: '%',       decimals: 1 },
  bournazel:  { field: 'pct_bournazel',   label: 'Score Bournazel (%)',   shortLabel: 'Bournazel',          unit: '%',       decimals: 1 },
  knafo:      { field: 'pct_knafo',       label: 'Score Knafo (%)',       shortLabel: 'Knafo',              unit: '%',       decimals: 1 },
  autres:     { field: 'pct_autres',      label: 'Autres listes (%)',     shortLabel: 'Autres listes',      unit: '%',       decimals: 1 },
  // Spatial analysis layers (categorical — no quintile breaks)
  lisa_abstention: { field: 'lisa_taux_abstention', label: 'LISA · Abstention',    shortLabel: 'LISA Abstention', unit: '',  decimals: 0, categorical: true },
  lisa_revenu:     { field: 'lisa_revenu_median',   label: 'LISA · Revenu',        shortLabel: 'LISA Revenu',     unit: '',  decimals: 0, categorical: true },
  lisa_hlm:        { field: 'lisa_hlm_density',     label: 'LISA · HLM',           shortLabel: 'LISA HLM',        unit: '',  decimals: 0, categorical: true },
  cluster:         { field: 'cluster_id',           label: 'Typologie sociale',    shortLabel: 'Clusters',        unit: '',  decimals: 0, categorical: true },
};

export const IDF_LAYER_META = {
  abstention:  { field: 'taux_abstention', label: 'Abstention (%)',        shortLabel: 'Abstention',    unit: '%',     decimals: 1 },
  revenu:      { field: 'revenu_median',   label: 'Revenu médian (€/UC)',  shortLabel: 'Revenu médian', unit: '€',     decimals: 0 },
  hlm:         { field: 'hlm_density',     label: 'Densité HLM (/km²)',    shortLabel: 'Densité HLM',   unit: ' /km²', decimals: 0 },
  gauche:      { field: 'pct_gauche',      label: 'Gauche (%)',            shortLabel: 'Gauche',        unit: '%',     decimals: 1 },
  centre:      { field: 'pct_centre',      label: 'Centre (%)',            shortLabel: 'Centre',        unit: '%',     decimals: 1 },
  droite:      { field: 'pct_droite',      label: 'Droite (%)',            shortLabel: 'Droite',        unit: '%',     decimals: 1 },
  ext_droite:  { field: 'pct_ext_droite',  label: 'Extrême droite (%)',    shortLabel: 'Extr. droite',  unit: '%',     decimals: 1 },
  autres:      { field: 'pct_autres',      label: 'Autres listes (%)',     shortLabel: 'Autres',        unit: '%',     decimals: 1 },
};

// LISA categorical colors: HH (hot-hot), HL, LH, LL (cold-cold), NS (not significant)
export const LISA_COLORS = {
  'HH': '#e41a1c',   // red — high surrounded by high
  'HL': '#ff7f7f',   // light red — high surrounded by low (spatial outlier)
  'LH': '#7fbfff',   // light blue — low surrounded by high (spatial outlier)
  'LL': '#2166ac',   // blue — low surrounded by low
  'NS': '#404040',   // dark gray — not significant
};

// Cluster categorical colors (up to 8 clusters)
export const CLUSTER_COLORS = [
  '#e41a1c', '#377eb8', '#4daf4a', '#984ea3',
  '#ff7f00', '#ffff33', '#a65628', '#f781bf',
];

// ═══════════════════════════════════════════════════════════
// VIEW CONFIGURATION — per-view registry
// ═══════════════════════════════════════════════════════════
export const VIEW_CONFIG = {
  paris: {
    geojsonPath:  'data/processed/paris_2026_t1.geojson',
    layerMeta:    LAYER_META,
    colors:       COLORS,
    partyMeta:    PARTY_META,
    idField:      'code_bv',
    groupField:   'arrondissement',
    mapCenter:    [2.3522, 48.8566],
    mapZoom:      11.2,
    mapMinZoom:   10,
    subtitle:     'Municipales 2026 · Premier tour · ~900 bureaux de vote',
    unitLabel:    'bureau de vote',
    groupLabel:   'arrondissement',
    defaultLayer: 'abstention',
    groups: [
      { title: 'Socio-éco',        keys: ['abstention','revenu','hlm'] },
      { title: 'Candidats',        keys: ['gregoire','dati','chikirou','bournazel','knafo','autres'] },
      { title: 'Analyse spatiale', keys: ['lisa_abstention','lisa_revenu','lisa_hlm','cluster'] },
    ],
    csvFields: [
      'code_bv', 'arrondissement', 'inscrits',
      'taux_abstention', 'revenu_median', 'hlm_density', 'n_hlm',
      'pct_gregoire', 'pct_dati', 'pct_chikirou', 'pct_bournazel', 'pct_knafo', 'pct_autres',
      'lisa_taux_abstention', 'lisa_revenu_median', 'lisa_hlm_density', 'cluster_id'
    ],
    csvFilename: 'socioelect_paris_donnees.csv',
  },
  idf: {
    geojsonPath:  'data/processed/idf_2026_t1.geojson',
    layerMeta:    IDF_LAYER_META,
    colors:       IDF_COLORS,
    partyMeta:    IDF_PARTY_META,
    idField:      'code_commune',
    groupField:   'departement',
    mapCenter:    [2.35, 48.70],
    mapZoom:      9.5,
    mapMinZoom:   8,
    subtitle:     'Municipales 2026 · Premier tour · 1 265 communes IDF',
    unitLabel:    'commune',
    groupLabel:   'département',
    defaultLayer: 'abstention',
    groups: [
      { title: 'Socio-éco',           keys: ['abstention','revenu','hlm'] },
      { title: 'Familles politiques', keys: ['gauche','centre','droite','ext_droite','autres'] },
    ],
    csvFields: [
      'code_commune', 'nom_commune', 'departement', 'inscrits',
      'taux_abstention', 'revenu_median', 'hlm_density', 'n_hlm', 'area_km2',
      'pct_gauche', 'pct_centre', 'pct_droite', 'pct_ext_droite', 'pct_autres'
    ],
    csvFilename: 'socioelect_idf_donnees.csv',
  },
};

// ═══════════════════════════════════════════════════════════
// DYNAMIC BREAKPOINTS — computed from GeoJSON data
// ═══════════════════════════════════════════════════════════

/** Holds dynamically computed quintile breakpoints per layer */
export let BREAKS = {};

/**
 * Replace the current BREAKS object contents.
 * Uses Object.assign + key deletion to preserve the live ES module binding.
 */
export function setBREAKS(newBreaks) {
  for (const key of Object.keys(BREAKS)) delete BREAKS[key];
  Object.assign(BREAKS, newBreaks);
}

/**
 * Compute quintile breakpoints (Q1–Q4) from feature data.
 * @param {Array} features - GeoJSON features
 * @param {Object} layerMeta - layer metadata to compute breaks for
 * @returns {Object} breaks keyed by layer name
 */
export function computeBreaks(features, layerMeta = LAYER_META) {
  const breaks = {};
  for (const [layer, meta] of Object.entries(layerMeta)) {
    if (meta.categorical) continue;
    const values = features
      .map(f => f.properties[meta.field])
      .filter(v => v != null && !isNaN(+v))
      .map(Number)
      .sort((a, b) => a - b);

    if (values.length === 0) continue;

    breaks[layer] = {
      Q1: d3.quantile(values, 0.2),
      Q2: d3.quantile(values, 0.4),
      Q3: d3.quantile(values, 0.6),
      Q4: d3.quantile(values, 0.8),
    };
  }
  return breaks;
}
