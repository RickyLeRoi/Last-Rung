// games/faro/test/scenarios.js
'use strict';
// Scenarios run both by the Node golden (golden.js) and by the browser golden (engine/test/e2e/golden.js): the same level, the same seeded
// Math.random and the same input timeline, so their frames can be compared.
// Actions: [kind, keyCode] with kind = 'tap' | 'down' | 'up', keyed by the frame in which they are applied.
const SEA_ACTIONS = { 500: ['tap', 'Space'], 900: ['tap', 'KeyX'], 1300: ['down', 'ArrowUp'], 1360: ['up', 'ArrowUp'] };

// level: null = the title screen; policySeed: seed of randomKeysPolicy (null = no arrow keys).
// query: extra URL parameters that start the scenario's level in the browser; level: the same for the Node harness (hook.levelSpec).
const withQuery = scenario => ({ ...scenario, query: scenario.level ? '&livello=' + scenario.level : '' });
const SHARED_SCENARIOS = Object.fromEntries(Object.entries({
  F01: { id: 'F01', seed: 2001, level: null, frames: 240, policySeed: null, actions: {} },
  F02: { id: 'F02', seed: 2002, level: 1, frames: 2400, policySeed: 11, actions: SEA_ACTIONS },
  F03: { id: 'F03', seed: 2003, level: 2, frames: 2400, policySeed: 22, actions: SEA_ACTIONS },
  F04: { id: 'F04', seed: 2004, level: 3, frames: 2400, policySeed: 33, actions: SEA_ACTIONS },
}).map(([id, scenario]) => [id, withQuery(scenario)]));

module.exports = { SEA_ACTIONS, SHARED_SCENARIOS };
