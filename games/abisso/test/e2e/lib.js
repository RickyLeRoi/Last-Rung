// games/abisso/test/e2e/lib.js
'use strict';
// Abisso additions to the engine E2E helpers: the full state read includes the sub, its battery and the lamp.
const engineLib = require('../../../../engine/test/e2e/lib');

const state = page => page.evaluate(() => {
  const game = window.__debug.game, sub = game.sub;
  return { st: game.state, x: sub.x, y: sub.y, battery: sub.battery, lamp: sub.lamp, sonarT: sub.sonarT, tutorial: game.L.tutorial, n: game.L.n, used: game.used };
});

module.exports = { ...engineLib, state };
