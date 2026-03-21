import { getMap } from './map.js';

// ═══════════════════════════════════════════════════════════
// Story steps — each drives a layer switch + map flyTo
// ═══════════════════════════════════════════════════════════
const STEPS = [
  {
    id: 'intro',
    title: 'Paris 2026 : anatomie de l\'abstention',
    body: 'Au premier tour des élections municipales de 2026, 39\u202f% des Parisiens inscrits ne se sont pas déplacés. Mais cette moyenne cache une géographie très inégale — un écart de plus de 30 points entre les bureaux de vote les plus mobilisés et les plus abstentionnistes.',
    layer: 'abstention',
    center: [2.3522, 48.8566],
    zoom: 11.2,
  },
  {
    id: 'ne-abstention',
    title: 'Le nord-est délaisse les urnes',
    body: 'Dans les 18e, 19e et 20e arrondissements, l\'abstention dépasse souvent 50\u202f%. À l\'inverse, le 7e et le 6e affichent moins de 25\u202f%. Une fracture géographique héritée des inégalités sociales, visible à l\'œil nu sur la carte.',
    layer: 'abstention',
    center: [2.375, 48.875],
    zoom: 12.5,
  },
  {
    id: 'revenu',
    title: 'Revenu et participation : un lien fort',
    body: 'Le revenu médian par unité de consommation explique à lui seul 35\u202f% de la variance du taux d\'abstention (r²\u202f≈\u202f0,35). Le gradient est visible à l\'œil nu : ouest riche et mobilisé, est populaire et abstentionniste.',
    layer: 'revenu',
    center: [2.3522, 48.8566],
    zoom: 11.2,
  },
  {
    id: 'hlm',
    title: 'Logement social et désengagement',
    body: 'La densité de logements sociaux (HLM) est un second marqueur fort. Les grands ensembles du nord-est parisien cumulent précarité et abstention élevée. HLM et revenu sont les deux faces d\'une même exclusion structurelle.',
    layer: 'hlm',
    center: [2.3522, 48.8566],
    zoom: 11.2,
  },
  {
    id: 'lisa',
    title: 'Des îlots spatiaux bien délimités',
    body: 'L\'analyse LISA (Moran local, p\u202f<\u202f0,05) révèle que le phénomène n\'est pas aléatoire : les bureaux à forte abstention se regroupent. En rouge foncé, les clusters « chauds » (HH) du nord-est. En bleu foncé, les clusters « froids » (LL) de l\'ouest. Les tons pâles signalent des outliers spatiaux.',
    layer: 'lisa_abstention',
    center: [2.3522, 48.8566],
    zoom: 11.2,
  },
  {
    id: 'cluster',
    title: 'Trois Paris en un',
    body: 'La classification automatique K-means identifie trois profils nets : le <strong>Paris populaire</strong> du nord-est (HLM, revenu bas, forte abstention), le <strong>Paris aisé</strong> de l\'ouest (revenu élevé, forte participation), et un <strong>Paris mixte</strong> intermédiaire formant un anneau autour du centre.',
    layer: 'cluster',
    center: [2.3522, 48.8566],
    zoom: 11.2,
  },
  {
    id: 'delta',
    title: '2020 → 2026 : la mobilisation recule',
    body: 'Par rapport aux élections de 2020, l\'abstention a progressé dans presque tous les bureaux parisiens. Le nord-est concentre les plus fortes hausses (en rouge), creusant encore l\'écart avec l\'ouest — où quelques bureaux enregistrent une légère amélioration (en bleu).',
    layer: 'delta_abstention',
    center: [2.3522, 48.8566],
    zoom: 11.2,
  },
  {
    id: 'non-participation',
    title: 'La non-participation réelle : +10 points',
    body: 'En intégrant les non-inscrits estimés d\'après le recensement INSEE 2021, la non-participation réelle dépasse 50\u202f% dans de nombreux bureaux. L\'abstention officielle de 39\u202f% sous-estime structurellement le désengagement — une large part des non-inscrits résident dans les mêmes quartiers défavorisés.',
    layer: 'non_participation',
    center: [2.3522, 48.8566],
    zoom: 11.2,
  },
];

let _callbacks = null;
let _observer  = null;
let _activeIdx = -1;

// ═══════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════

/** Call once after data is loaded. `callbacks.switchLayer(layerKey)` must be provided. */
export function initStory(callbacks) {
  _callbacks = callbacks;
  buildStepEls();
}

export function openStory() {
  document.body.classList.add('story-mode');
  const scroll = document.getElementById('story-scroll');
  if (scroll) scroll.scrollTop = 0;
  _activeIdx = -1;
  activateStep(0);
  setupObserver();
}

export function closeStory() {
  document.body.classList.remove('story-mode');
  teardownObserver();
  _activeIdx = -1;
}

// ═══════════════════════════════════════════════════════════
// Internal helpers
// ═══════════════════════════════════════════════════════════

function activateStep(idx) {
  if (idx === _activeIdx) return;
  _activeIdx = idx;

  document.querySelectorAll('.story-step').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });

  const step = STEPS[idx];
  if (!step) return;

  if (_callbacks?.switchLayer) {
    _callbacks.switchLayer(step.layer);
  }

  const map = getMap();
  if (map && step.center && step.zoom) {
    map.flyTo({ center: step.center, zoom: step.zoom, duration: 900 });
  }
}

function buildStepEls() {
  const container = document.getElementById('story-steps');
  if (!container) return;
  container.innerHTML = '';

  STEPS.forEach((step, idx) => {
    const el = document.createElement('div');
    el.className = 'story-step';
    el.dataset.idx = String(idx);
    el.innerHTML = `
      <div class="story-step-num">${String(idx + 1).padStart(2, '0')}</div>
      <h3 class="story-step-title">${step.title}</h3>
      <p class="story-step-body">${step.body}</p>
    `;
    container.appendChild(el);
  });
}

function setupObserver() {
  teardownObserver();
  const scroll = document.getElementById('story-scroll');
  if (!scroll) return;

  _observer = new IntersectionObserver(
    (entries) => {
      let best = null;
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (!best || entry.intersectionRatio > best.intersectionRatio) {
            best = entry;
          }
        }
      }
      if (best) {
        activateStep(parseInt(best.target.dataset.idx, 10));
      }
    },
    {
      root: scroll,
      rootMargin: '-15% 0px -45% 0px',
      threshold: [0, 0.25, 0.5, 0.75, 1.0],
    }
  );

  document.querySelectorAll('.story-step').forEach(el => _observer.observe(el));
}

function teardownObserver() {
  if (_observer) { _observer.disconnect(); _observer = null; }
}
