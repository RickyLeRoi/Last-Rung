// games/formicaio/test/e2e/lib.js
'use strict';
// Formicaio additions to the engine E2E helpers: the full state read includes the cursor, the orders and the colony.
const engineLib = require('../../../../engine/test/e2e/lib');

const state = page => page.evaluate(() => {
  const game = window.__debug.game, level = game.L;
  return {
    st: game.state, x: game.cursor.x, y: game.cursor.y, orders: level.digOrder.reduce((sum, value) => sum + value, 0),
    chambers: level.chambers.length, recall: game.recall, ants: game.ants.length, tutorial: level.tutorial, n: level.n,
  };
});

module.exports = { ...engineLib, state };
