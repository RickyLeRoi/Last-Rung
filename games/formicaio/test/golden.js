#!/usr/bin/env node
// games/formicaio/test/golden.js
'use strict';
// Golden snapshots (engine/test/golden.js): shared scenarios, tutorial, daily challenge, scripted player, replay.
const { runGolden, framed, randomInput, replayScenario, sharedScenario, playLevel, decodeActions } = require('../../../engine/test/golden');
const { createPlanner } = require('./autopilot');
const { SHARED_SCENARIOS, NEST_ACTIONS } = require('./scenarios');

// The scripted player, one frame at a time (a tap is a key held for one frame).
function planned() {
  let decide = null, held = null;
  return (driver, i) => {
    if (!decide) decide = createPlanner(driver.hook);
    if (held) { driver.keyUp(held); held = null; }
    const move = decide();
    driver.set(move.keys);
    if (move.space) driver.keyDown('Space'); else driver.keyUp('Space');
    if (move.tap) { driver.keyDown(move.tap); held = move.tap; }
  };
}

runGolden('formicaio', [
  ...Object.values(SHARED_SCENARIOS).map(sharedScenario),
  { id: 'A05', seed: 4005, run: framed({ start: driver => { driver.tap('Enter'); driver.tap('Enter'); }, frames: 1500, input: randomInput(55, decodeActions(NEST_ACTIONS)) }) },
  { id: 'A06', seed: 4006, run: framed({ start: driver => driver.play(driver.hook.dailySpec('2026-10-13')), frames: 1800, input: randomInput(66, decodeActions(NEST_ACTIONS)) }) },
  { id: 'A07', seed: 4007, run: framed({ start: playLevel(2), frames: 4200, input: planned() }) },
  replayScenario({ id: 'A08', seed: 4008, level: 1, frames: 1500, input: randomInput(88, decodeActions(NEST_ACTIONS)) }),
]);
