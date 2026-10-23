// Level/arena registry. Static manifest only: no side effects, nothing is imported until the player picks an entry.
// SP_LEVELS appear ONLY in the offline START flow; MP_ARENAS appear ONLY under MULTIPLAYER > ARENAS. Never mix the two lists.
export const ENABLED = true;                         // kill switch: false hides every level/arena menu entry (sky-city untouched)
export const SP_LEVELS = [
  { id: 'nostalgia-overdose', name: 'NOSTALGIA OVERDOSE', blurb: 'Greybox — three spaces, power cells, one exit.', mode: 'sp', load: () => import('./od.js') },
];
export const MP_ARENAS = [];
// test-only specs (never listed in menus; reachable through __ng.levels.load('kit-selftest') for QA)
export const TEST_SPECS = [
  { id: 'kit-selftest', name: 'KIT SELFTEST', mode: 'sp', load: () => import('./_selftest.js') },
];
export const findSpec = id => [...SP_LEVELS, ...MP_ARENAS, ...TEST_SPECS].find(s => s.id === id) || null;
