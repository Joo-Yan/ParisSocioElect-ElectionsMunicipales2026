// Shared view state — prevents circular imports between modules.
// All modules read the current view config from here.

export let currentView = 'paris';
export let viewConfig  = null;

export function setView(view, config) {
  currentView = view;
  viewConfig  = config;
}
