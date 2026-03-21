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

export const PARTY_META = {
  gregoire:  { list: 'LUG',  label: 'Union des gauches', color: '#E91E8C' },
  dati:      { list: 'LUD',  label: 'Droite',            color: '#1A5CB8' },
  chikirou:  { list: 'LFI',  label: 'France Insoumise',  color: '#CC0000' },
  bournazel: { list: 'LUC',  label: 'Centre',            color: '#E07B00' },
  knafo:     { list: 'LEXD', label: 'Extrême droite',    color: '#1E5F8A' },
  autres:    { list: '–',    label: 'Autres listes',     color: '#555e6d' }
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
  autres:     { field: 'pct_autres',      label: 'Autres listes (%)',     shortLabel: 'Autres listes',      unit: '%',       decimals: 1 }
};

// ═══════════════════════════════════════════════════════════
// DYNAMIC BREAKPOINTS — computed from GeoJSON data
// ═══════════════════════════════════════════════════════════

/** Holds dynamically computed quintile breakpoints per layer */
export let BREAKS = {};

/**
 * Compute quintile breakpoints (Q1–Q4) from feature data.
 * Call this once after loading GeoJSON.
 */
export function computeBreaks(features) {
  BREAKS = {};
  for (const [layer, meta] of Object.entries(LAYER_META)) {
    const values = features
      .map(f => f.properties[meta.field])
      .filter(v => v != null && !isNaN(+v))
      .map(Number)
      .sort((a, b) => a - b);

    if (values.length === 0) continue;

    BREAKS[layer] = {
      Q1: d3.quantile(values, 0.2),
      Q2: d3.quantile(values, 0.4),
      Q3: d3.quantile(values, 0.6),
      Q4: d3.quantile(values, 0.8),
    };
  }
  return BREAKS;
}
