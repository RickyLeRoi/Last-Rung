#!/usr/bin/env node
// games/sabbia/test/golden.js
'use strict';
// Golden snapshots (engine/test/golden.js): shared scenarios, tutorial, laboratory with every material, daily challenge, replay.
const { runGolden, framed, randomInput, replayScenario, sharedScenario, tapKey, decodeActions } = require('../../../engine/test/golden');
const { SHARED_SCENARIOS, BRUSH_ACTIONS } = require('./scenarios');

// Laboratory: a new material every 150 frames, painted for 100 of them.
const laboratoryInput = random => (driver, i) => {
  random(driver, i);
  if (i % 150 === 0) driver.tap('KeyX');
  if (i % 150 === 10) driver.keyDown('Space');
  if (i % 150 === 110) driver.keyUp('Space');
};

runGolden('sabbia', [
  ...Object.values(SHARED_SCENARIOS).map(sharedScenario),
  { id: 'S05', seed: 5005, run: framed({ start: driver => { driver.tap('Enter'); driver.tap('Enter'); }, frames: 1500, input: randomInput(55, decodeActions(BRUSH_ACTIONS)) }) },
  { id: 'S06', seed: 5006, run: framed({ start: driver => driver.play(driver.hook.labSpec()), frames: 1800, input: laboratoryInput(randomInput(66)) }) },
  { id: 'S07', seed: 5007, run: framed({ start: driver => driver.play(driver.hook.dailySpec('2026-10-13')), frames: 1800, input: randomInput(77, { ...decodeActions(BRUSH_ACTIONS), 1400: tapKey('KeyX') }) }) },
  replayScenario({ id: 'S08', seed: 5008, level: 4, frames: 1500, input: randomInput(88, decodeActions(BRUSH_ACTIONS)) }),
]);
