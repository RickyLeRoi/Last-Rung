// test/scenarios.js
'use strict';
// Scenarios run both by the Node golden (test/golden.js) and by the browser golden (test/e2e/golden.js):
// the same level, the same seeded Math.random and the same input timeline, so their frames can be compared.
// Actions: [kind, keyCode] with kind = 'tap' | 'down' | 'up', keyed by the frame in which they are applied.
const SEA_ACTIONS = { 300: ['tap', 'KeyX'], 400: ['down', 'KeyE'], 470: ['up', 'KeyE'], 650: ['tap', 'KeyZ'] };

// level: null = the title screen; policySeed: seed of randomKeysPolicy (null = no arrow keys).
const SHARED_SCENARIOS = {
  G01: { id: 'G01', seed: 1001, level: null, frames: 240, policySeed: null, actions: {} },
  G03: { id: 'G03', seed: 1003, level: 1, frames: 2400, policySeed: 11, actions: SEA_ACTIONS },
  G07: { id: 'G07', seed: 1007, level: 5, frames: 1800, policySeed: 55, actions: {} },
  G08: { id: 'G08', seed: 1008, level: 10, frames: 1800, policySeed: 100, actions: {} },
};

module.exports = { SEA_ACTIONS, SHARED_SCENARIOS };
