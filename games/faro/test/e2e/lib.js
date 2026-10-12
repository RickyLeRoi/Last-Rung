// games/faro/test/e2e/lib.js
'use strict';
// Faro additions to the engine E2E helpers: the full state read includes the beam, the oil and the ships.
const engineLib = require('../../../../engine/test/e2e/lib');

const state = page => page.evaluate(() => {
  const game = window.__debug.game;
  return { st: game.state, pitch: game.beam.pitch, spread: game.beam.spread, oil: game.oil, sirenT: game.sirenT, lampFlashT: game.lampFlashT, tutorialStep: game.tut ? game.tut.step : -1 };
});

module.exports = { ...engineLib, state };
