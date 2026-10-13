// games/sabbia/test/scenarios.js
'use strict';
// Scenarios run both by the Node golden (golden.js) and by the browser golden (engine/test/e2e/golden.js): the same level, the same seeded
// Math.random and the same input timeline, so their frames can be compared.
// Actions: [kind, keyCode] with kind = 'tap' | 'down' | 'up', keyed by the frame in which they are applied.
const BRUSH_ACTIONS = { 100: ['down', 'Space'], 400: ['up', 'Space'], 500: ['tap', 'KeyX'], 600: ['down', 'Space'], 900: ['up', 'Space'], 1000: ['tap', 'KeyC'], 1100: ['down', 'Space'], 1300: ['up', 'Space'] };

// level: null = the title screen; policySeed: seed of randomKeysPolicy (null = no arrow keys); query: the same level in the browser.
const withQuery = scenario => ({ ...scenario, query: scenario.level ? '&livello=' + scenario.level : '' });
const SHARED_SCENARIOS = Object.fromEntries(Object.entries({
  S01: { id: 'S01', seed: 5001, level: null, frames: 240, policySeed: null, actions: {} },
  S02: { id: 'S02', seed: 5002, level: 2, frames: 1800, policySeed: 11, actions: BRUSH_ACTIONS },
  S03: { id: 'S03', seed: 5003, level: 3, frames: 1800, policySeed: 22, actions: BRUSH_ACTIONS },
  S04: { id: 'S04', seed: 5004, level: 5, frames: 1800, policySeed: 33, actions: BRUSH_ACTIONS },
}).map(([id, scenario]) => [id, withQuery(scenario)]));

module.exports = { BRUSH_ACTIONS, SHARED_SCENARIOS };
