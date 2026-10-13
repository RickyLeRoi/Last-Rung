// games/sabbia/test/e2e/lib.js
'use strict';
// Sabbia additions to the engine E2E helpers: the full state read includes the brush and the world counts.
const engineLib = require('../../../../engine/test/e2e/lib');

const state = page => page.evaluate(() => {
  const game = window.__debug.game, level = game.L, counts = level.world.counts, MATERIAL = window.__debug.MATERIAL;
  return {
    st: game.state, x: game.cursor.x, y: game.cursor.y, selected: level.palette[game.selected], brush: game.brushSize,
    sand: counts[MATERIAL.sand], water: counts[MATERIAL.water], lab: !!level.lab, tutorial: !!level.tutorial, n: level.n,
  };
});

module.exports = { ...engineLib, state };
