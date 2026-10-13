// games/valanga/test/scenarios.js
'use strict';
// Scenarios run both by the Node golden (golden.js) and by the browser golden (engine/test/e2e/golden.js): the same level, the same seeded
// Math.random and the same input timeline, so their frames can be compared.
// Actions: [kind, keyCode] with kind = 'tap' | 'down' | 'up', keyed by the frame in which they are applied.
const SLOPE_ACTIONS = { 300: ['tap', 'KeyX'], 400: ['down', 'Space'], 700: ['up', 'Space'], 1200: ['tap', 'KeyX'], 1300: ['down', 'Space'], 1500: ['up', 'Space'] };

// level: null = the title screen; policySeed: seed of randomKeysPolicy (null = no arrow keys); query: the same level in the browser.
const withQuery = scenario => ({ ...scenario, query: scenario.level ? '&livello=' + scenario.level : '' });
const SHARED_SCENARIOS = Object.fromEntries(Object.entries({
  V01: { id: 'V01', seed: 3001, level: null, frames: 240, policySeed: null, actions: {} },
  V02: { id: 'V02', seed: 3002, level: 1, frames: 2400, policySeed: 11, actions: SLOPE_ACTIONS },
  V03: { id: 'V03', seed: 3003, level: 2, frames: 2400, policySeed: 22, actions: SLOPE_ACTIONS },
  V04: { id: 'V04', seed: 3004, level: 3, frames: 2400, policySeed: 33, actions: SLOPE_ACTIONS },
}).map(([id, scenario]) => [id, withQuery(scenario)]));

module.exports = { SLOPE_ACTIONS, SHARED_SCENARIOS };
