// games/last-rung/test/e2e/lib.js
'use strict';
// Last Rung additions to the engine E2E helpers: the full state read includes the helicopter.
const engineLib = require('../../../../engine/test/e2e/lib');

const state = page => page.evaluate(() => { const game = window.__debug.game, heli = game.heli; return { st: game.state, x: heli.x, y: heli.y, vx: heli.vx, vy: heli.vy, stab: heli.stab, hs: heli.state }; });

module.exports = { ...engineLib, state };
