// games/senza-luce/test/e2e/lib.js
'use strict';
// Senza Luce additions to the engine E2E helpers: the full state read includes the boat and the smoke screens.
const engineLib = require('../../../../engine/test/e2e/lib');

const state = page => page.evaluate(() => {
  const game = window.__debug.game, boat = game.boat;
  return { st: game.state, x: boat.x, lane: boat.lane, engineOn: boat.engineOn, smokes: boat.smokes, smokeScreens: game.smokes.length, tutorial: game.L.tutorial, n: game.L.n };
});

module.exports = { ...engineLib, state };
