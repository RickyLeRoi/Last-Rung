#!/usr/bin/env node
// games/valanga/test/golden.js
'use strict';
// Golden snapshots (engine/test/golden.js): shared scenarios, tutorial, daily challenge, scripted rescuer, replay.
const { runGolden, framed, randomInput, replayScenario, sharedScenario, playLevel, tapKey, decodeActions } = require('../../../engine/test/golden');
const { rescuerKeys } = require('./autopilot');
const { SHARED_SCENARIOS, SLOPE_ACTIONS } = require('./scenarios');

const rescuer = (driver, i) => {
  const plan = rescuerKeys(driver.hook);
  driver.set(plan.keys);
  if (plan.dig) driver.keyDown('Space'); else driver.keyUp('Space');
  if (plan.probe && i % 2 === 0) driver.keyDown('KeyX'); else driver.keyUp('KeyX');
};

runGolden('valanga', [
  ...Object.values(SHARED_SCENARIOS).map(sharedScenario),
  { id: 'V05', seed: 3005, run: framed({ start: driver => { driver.tap('Enter'); driver.tap('Enter'); }, frames: 1500, input: randomInput(55, { 200: tapKey('KeyX'), 600: tapKey('KeyX') }) }) },
  { id: 'V06', seed: 3006, run: framed({ start: driver => driver.play(driver.hook.dailySpec('2026-10-13')), frames: 1800, input: randomInput(66, decodeActions(SLOPE_ACTIONS)) }) },
  { id: 'V07', seed: 3007, run: framed({ start: playLevel(1), frames: 3000, input: rescuer }) },
  replayScenario({ id: 'V08', seed: 3008, level: 2, frames: 1500, input: randomInput(88, decodeActions(SLOPE_ACTIONS)) }),
]);
