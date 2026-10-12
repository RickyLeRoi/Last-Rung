// games/valanga/test/e2e/lib.js
'use strict';
// Valanga additions to the engine E2E helpers: the full state read includes the rescuer, the probe and the shovel.
const engineLib = require('../../../../engine/test/e2e/lib');

const state = page => page.evaluate(() => {
  const game = window.__debug.game, body = game.rescuer;
  return { st: game.state, x: body.x, y: body.y, probeT: body.probeT, marks: game.probeMarks.length, dug: game.used.dig, tutorial: game.L.tutorial, n: game.L.n };
});

module.exports = { ...engineLib, state };
