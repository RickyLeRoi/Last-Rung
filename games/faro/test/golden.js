#!/usr/bin/env node
// games/faro/test/golden.js
'use strict';
/*
 * Golden snapshots: fixed scenarios with deterministic input (and a seeded Math.random for the renderer) are hashed every
 * 300 frames (simulation state + rendered frame) plus a final probe of the simulation RNG. Any refactor that changes
 * behaviour, pixels or the order of Rng calls makes this fail.
 *   node games/faro/test/golden.js            compare every scenario with games/faro/test/golden/faro.json
 *   node games/faro/test/golden.js F03        only one scenario
 *   node games/faro/test/golden.js --update   rewrite the baseline (only after an intentional change, with the user's approval)
 */
const fs = require('fs');
const path = require('path');
const { boot, randomKeysPolicy } = require('./helpers');
const { keeperKeys, wantsSiren } = require('./autopilot');
const { SHARED_SCENARIOS } = require('./scenarios');

const BASELINE_FILE = path.join(__dirname, 'golden', 'faro.json');
const CHECKPOINT_EVERY = 300;

const tapKey = code => driver => driver.tap(code);
const downKey = code => driver => driver.keyDown(code);
const upKey = code => driver => driver.keyUp(code);
const decodeActions = data => Object.fromEntries(Object.entries(data).map(([frame, [kind, code]]) => [frame, kind === 'tap' ? tapKey(code) : kind === 'down' ? downKey(code) : upKey(code)]));

// Runs `frames` ticks; input(driver, i) is called before each tick; a checkpoint is recorded every 300 frames and at the end.
function framed({ start, frames, input }) {
  return (driver, record) => {
    start(driver);
    for (let i = 0; i < frames; i++) {
      input(driver, i);
      driver.tick();
      if ((i + 1) % CHECKPOINT_EVERY === 0 || i + 1 === frames) record(i + 1);
    }
  };
}
const randomInput = (policySeed, actions = {}) => {
  const policy = randomKeysPolicy(policySeed);
  return (driver, i) => {
    if (i % 9 === 0) driver.set(policy(i));
    if (actions[i]) actions[i](driver);
  };
};
const playLevel = levelNumber => driver => driver.play(driver.hook.levelSpec(levelNumber));
const nothing = () => {};
const sharedScenario = ({ id, seed, level, frames, policySeed, actions }) => ({ id, seed, run: framed({ start: level ? playLevel(level) : nothing, frames, input: policySeed === null ? nothing : randomInput(policySeed, decodeActions(actions)) }) });

// Plays until the state leaves 'play' (or the limit), then keeps going for `tail` frames; a checkpoint every 300 frames and at the end.
function untilEnd({ start, input, limit, tail }) {
  return (driver, record) => {
    start(driver);
    let frame = 0, endedAt = null;
    while (frame < limit && (endedAt === null || frame < endedAt + tail)) {
      input(driver, frame);
      driver.tick();
      frame++;
      if (endedAt === null && driver.game.state !== 'play') endedAt = frame;
      if (frame % CHECKPOINT_EVERY === 0) record(frame);
    }
    record(frame);
  };
}

// [from, to, keys]: the arrow keys held from frame `from` up to (excluding) `to`.
const TUTORIAL_BEAM = [[0, 40, ['ArrowRight']], [80, 120, ['ArrowUp']], [200, 260, ['ArrowLeft']], [400, 480, ['ArrowDown']], [700, 800, ['ArrowRight']], [1000, 1100, ['ArrowLeft', 'ArrowUp']]];
const TUTORIAL_ACTIONS = { 300: tapKey('Space'), 600: tapKey('KeyX'), 900: tapKey('Space') };

// Level 2 with the F03 input, stopped as soon as the game leaves 'play': the replay ends at exactly that point.
const stormInput = randomInput(22, decodeActions(SHARED_SCENARIOS.F03.actions));
function stormRunUntilEnd(driver) {
  playLevel(2)(driver);
  for (let i = 0; i < 2400 && driver.game.state === 'play'; i++) { stormInput(driver, i); driver.tick(); }
}

const SCENARIOS = [
  sharedScenario(SHARED_SCENARIOS.F01),
  sharedScenario(SHARED_SCENARIOS.F02),
  sharedScenario(SHARED_SCENARIOS.F03),
  sharedScenario(SHARED_SCENARIOS.F04),
  { id: 'F05', seed: 2005, run: framed({
    start: driver => { driver.tap('Enter'); driver.tap('Enter'); },
    frames: 1500,
    input: (driver, i) => {
      const held = TUTORIAL_BEAM.find(([from, to]) => i >= from && i < to);
      driver.set(held ? held[2] : []);
      if (TUTORIAL_ACTIONS[i]) TUTORIAL_ACTIONS[i](driver);
    } }) },
  { id: 'F06', seed: 2006, run: framed({ start: playLevel(4), frames: 2400, input: randomInput(44, { 600: tapKey('Space'), 1200: tapKey('KeyX') }) }) },
  { id: 'F07', seed: 2007, run: framed({ start: driver => driver.play(driver.hook.dailySpec('2026-10-12')), frames: 1800, input: randomInput(7) }) },
  { id: 'F08', seed: 2008, run: untilEnd({
    start: playLevel(1),
    input: driver => { driver.set(keeperKeys(driver.hook)); if (wantsSiren(driver.hook)) driver.tap('Space'); },
    limit: 4000, tail: 200 }) },
  { id: 'F09', seed: 2009, run: untilEnd({ start: playLevel(2), input: () => {}, limit: 4000, tail: 300 }) },
  { id: 'F10', seed: 2004, run: (driver, record) => {
    stormRunUntilEnd(driver);
    const game = driver.game;
    driver.set([]);
    if (game.state === 'play') game.state = 'pause';
    const recordedFrames = game.rec.frames.length;
    const recorded = { state: driver.stateHash({ ignoreState: true }), frame: driver.frameHash() };
    driver.hook.startReplay();
    if (game.state !== 'replay') throw new Error('replay non avviato');
    for (let ticks = 0; game.state === 'replay' && game.replay.i < recordedFrames && ticks < 100000; ticks++) driver.tick();
    const replayed = { state: driver.stateHash({ ignoreState: true }), frame: driver.frameHash() };
    if (recorded.state !== replayed.state) throw new Error('il replay diverge dalla partita registrata (' + recordedFrames + ' frame)');
    record('registrata', recorded);
    record('replay', replayed);
  } },
  { id: 'F11', seed: 2011, run: framed({ start: driver => { driver.play(driver.hook.levelSpec(5)); }, frames: 1200, input: randomInput(55, { 100: tapKey('KeyX'), 140: tapKey('KeyX') }) }) },
];

function execute(scenario) {
  const driver = boot({ seededMath: scenario.seed });
  const checkpoints = [];
  const record = (at, hashes) => checkpoints.push({ at, state: hashes ? hashes.state : driver.stateHash(), frame: hashes ? hashes.frame : driver.frameHash() });
  scenario.run(driver, record);
  const rng = driver.rngProbe();
  return { checkpoints, end: { state: driver.game.state, frame: driver.game.frame, score: driver.game.score }, rng };
}

function describeDifference(id, expected, actual) {
  if (!expected) return id + ': nessuna baseline (lancia node games/faro/test/golden.js --update dopo aver verificato)';
  const messages = [];
  const count = Math.max(expected.checkpoints.length, actual.checkpoints.length);
  for (let i = 0; i < count; i++) {
    const before = expected.checkpoints[i], after = actual.checkpoints[i];
    if (!before || !after) { messages.push('numero di checkpoint diverso (' + expected.checkpoints.length + ' -> ' + actual.checkpoints.length + ')'); break; }
    const changed = ['state', 'frame'].filter(field => before[field] !== after[field]).map(field => field === 'state' ? 'stato' : 'frame');
    if (before.at !== after.at || changed.length) { messages.push('primo checkpoint divergente: ' + after.at + (changed.length ? ' (cambiato: ' + changed.join(', ') + ')' : '')); break; }
  }
  if (expected.rng !== actual.rng) messages.push('cambiato: rng (ordine o numero delle chiamate a Rng)');
  if (JSON.stringify(expected.end) !== JSON.stringify(actual.end)) messages.push('fine scenario ' + JSON.stringify(expected.end) + ' -> ' + JSON.stringify(actual.end));
  return messages.length ? id + ': ' + messages.join('; ') : null;
}

function main() {
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const wanted = args.filter(argument => !argument.startsWith('--'));
  const unknown = wanted.filter(id => !SCENARIOS.some(scenario => scenario.id === id));
  if (unknown.length) { console.error('scenario sconosciuto: ' + unknown.join(', ')); process.exit(2); }
  const selected = SCENARIOS.filter(scenario => !wanted.length || wanted.includes(scenario.id));
  const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : { game: 'faro', scenarios: {} };

  let failures = 0;
  const startTime = Date.now();
  for (const scenario of selected) {
    const scenarioStart = Date.now();
    let result;
    try { result = execute(scenario); } catch (error) { failures++; console.log('  FAIL ' + scenario.id + ': ' + (error.stack || error).toString().split('\n').slice(0, 3).join(' | ')); continue; }
    if (update) { baseline.scenarios[scenario.id] = result; console.log('  AGGIORNATO ' + scenario.id + ' (' + result.checkpoints.length + ' checkpoint)'); continue; }
    const difference = describeDifference(scenario.id, baseline.scenarios[scenario.id], result);
    if (difference) { failures++; console.log('  FAIL ' + difference); }
    else console.log('  OK   ' + scenario.id + '  (' + result.checkpoints.length + ' checkpoint, ' + (Date.now() - scenarioStart) + ' ms)');
  }
  if (update && !failures) {
    const ordered = {};
    for (const scenario of SCENARIOS) if (baseline.scenarios[scenario.id]) ordered[scenario.id] = baseline.scenarios[scenario.id];
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify({ game: 'faro', scenarios: ordered }, null, 1) + '\n');
    console.log('baseline scritta in ' + path.relative(process.cwd(), BASELINE_FILE));
  }
  console.log('\n' + (failures ? failures + ' scenari falliti' : 'golden ' + (update ? 'aggiornati' : 'identici')) + ' (' + ((Date.now() - startTime) / 1000).toFixed(1) + ' s)');
  process.exit(failures ? 1 : 0);
}
main();
