// games/formicaio/test/scenarios.js
'use strict';
// Scenarios run both by the Node golden (golden.js) and by the browser golden (engine/test/e2e/golden.js): the same level, the same seeded
// Math.random and the same input timeline, so their frames can be compared.
// Actions: [kind, keyCode] with kind = 'tap' | 'down' | 'up', keyed by the frame in which they are applied.
const NEST_ACTIONS = { 200: ['down', 'Space'], 500: ['up', 'Space'], 600: ['tap', 'KeyX'], 900: ['tap', 'KeyZ'], 1200: ['tap', 'KeyZ'], 1500: ['tap', 'KeyC'], 1600: ['down', 'Space'], 1800: ['up', 'Space'] };

// level: null = the title screen; policySeed: seed of randomKeysPolicy (null = no arrow keys); query: the same level in the browser.
const withQuery = scenario => ({ ...scenario, query: scenario.level ? '&livello=' + scenario.level : '' });
const SHARED_SCENARIOS = Object.fromEntries(Object.entries({
  A01: { id: 'A01', seed: 4001, level: null, frames: 240, policySeed: null, actions: {} },
  A02: { id: 'A02', seed: 4002, level: 1, frames: 2400, policySeed: 11, actions: NEST_ACTIONS },
  A03: { id: 'A03', seed: 4003, level: 2, frames: 2400, policySeed: 22, actions: NEST_ACTIONS },
  A04: { id: 'A04', seed: 4004, level: 3, frames: 2400, policySeed: 33, actions: NEST_ACTIONS },
}).map(([id, scenario]) => [id, withQuery(scenario)]));

module.exports = { NEST_ACTIONS, SHARED_SCENARIOS };
