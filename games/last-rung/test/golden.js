#!/usr/bin/env node
// games/last-rung/test/golden.js
'use strict';
/*
 * Golden snapshots: fixed scenarios with deterministic input (and a seeded Math.random for the renderer) are hashed every
 * 300 frames (simulation state + rendered frame) plus a final probe of the simulation RNG. Any refactor that changes
 * behaviour, pixels or the order of Rng calls makes this fail.
 *   node games/last-rung/test/golden.js            compare every scenario with games/last-rung/test/golden/last-rung.json
 *   node games/last-rung/test/golden.js G04        only one scenario
 *   node games/last-rung/test/golden.js --update   rewrite the baseline (only after an intentional change, with the user's approval)
 */
const fs = require('fs');
const path = require('path');
const { boot, randomKeysPolicy, place, roofWithoutObstacles } = require('./helpers');
const { rescueOne } = require('./autopilot');
const { SEA_ACTIONS: SEA_ACTION_DATA, SHARED_SCENARIOS } = require('./scenarios');

const BASELINE_FILE = path.join(__dirname, 'golden', 'last-rung.json');
const CHECKPOINT_EVERY = 300;

const tapKey = code => driver => driver.tap(code);
const downKey = code => driver => driver.keyDown(code);
const upKey = code => driver => driver.keyUp(code);

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

const decodeActions = data => Object.fromEntries(Object.entries(data).map(([frame, [kind, code]]) => [frame, kind === 'tap' ? tapKey(code) : kind === 'down' ? downKey(code) : upKey(code)]));
const SEA_ACTIONS = decodeActions(SEA_ACTION_DATA);
const sharedScenario = ({ id, seed, level, frames, policySeed, actions }) => ({ id, seed, run: framed({ start: level ? playLevel(level) : nothing, frames, input: policySeed === null ? nothing : randomInput(policySeed, decodeActions(actions)) }) });

// [from, to, keys]: the arrow keys held from frame `from` up to (excluding) `to`.
const TUTORIAL_FLIGHT = [[0, 60, ['ArrowUp']], [61, 180, ['ArrowRight']], [181, 240, ['ArrowDown']], [241, 330, ['ArrowLeft']], [331, 400, ['ArrowUp']],
  [500, 650, ['ArrowRight']], [800, 860, ['ArrowUp']], [861, 1000, ['ArrowLeft']], [1100, 1180, ['ArrowDown']], [1200, 1400, ['ArrowRight', 'ArrowUp']]];
const TUTORIAL_ACTIONS = { 60: tapKey('KeyX'), 400: downKey('KeyE'), 500: upKey('KeyE'), 700: tapKey('KeyZ'), 1000: downKey('KeyE'), 1090: upKey('KeyE') };

const markEveryoneSaved = driver => {
  const game = driver.game;
  game.L.people.forEach(person => { person.state = 'saved'; person.on = game.L.safe; person.rel = 2; game.L.saved++; });
};

// Level 2 run shared by G04 and the replay scenario G14.
const stormRun = framed({ start: playLevel(2), frames: 2400, input: randomInput(22, SEA_ACTIONS) });

const SCENARIOS = [
  sharedScenario(SHARED_SCENARIOS.G01),
  { id: 'G02', seed: 1002, run: framed({
    start: driver => { driver.tap('Enter'); driver.tick(2); driver.tap('Enter'); },
    frames: 1500,
    input: (driver, i) => {
      const segment = TUTORIAL_FLIGHT.find(([from, to]) => i >= from && i < to);
      driver.set(segment ? segment[2] : []);
      if (TUTORIAL_ACTIONS[i]) TUTORIAL_ACTIONS[i](driver);
    } }) },
  sharedScenario(SHARED_SCENARIOS.G03),
  { id: 'G04', seed: 1004, run: stormRun },
  { id: 'G05', seed: 1005, run: framed({ start: playLevel(3), frames: 2400, input: randomInput(33, { 1500: tapKey('Space') }) }) },
  { id: 'G06', seed: 1006, run: framed({ start: playLevel(4), frames: 2400, input: randomInput(44, { 600: tapKey('KeyC'), 900: tapKey('KeyC') }) }) },
  sharedScenario(SHARED_SCENARIOS.G07),
  sharedScenario(SHARED_SCENARIOS.G08),
  { id: 'G09', seed: 1009, run: framed({ start: playLevel(13), frames: 1800, input: randomInput(130) }) },
  { id: 'G10', seed: 1010, run: framed({ start: driver => driver.play(driver.hook.dailySpec('2026-10-12')), frames: 1800, input: randomInput(7) }) },
  { id: 'G11', seed: 1011, run: (driver, record) => {
    rescueOne(driver.hook.levelSpec(1), 0, driver);
    record(driver.game.frame);
  } },
  { id: 'G12', seed: 1012, run: framed({
    start: driver => {
      const game = driver.play(driver.hook.levelSpec(4));
      const rooftop = roofWithoutObstacles(game);
      place(driver, rooftop.x - 40, rooftop.y + 10, 2.4, 0);
    },
    frames: 300,
    input: (driver, i) => driver.set(i < 20 ? ['ArrowRight'] : []) }) },
  { id: 'G13', seed: 1013, run: framed({
    start: driver => { driver.play(driver.hook.levelSpec(1)); markEveryoneSaved(driver); },
    frames: 200,
    input: (driver, i) => driver.set(i < 100 ? ['ArrowUp'] : []) }) },
  { id: 'G14', seed: 1004, run: (driver, record) => {
    stormRun(driver, nothing);
    const game = driver.game;
    driver.set([]);
    if (game.state === 'play') game.state = 'pause';   // the replay must end at exactly this point
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
  { id: 'G15', seed: 1015, run: framed({
    start: driver => { driver.play(driver.hook.levelSpec(6)).softFlash = true; },
    frames: 1200,
    input: randomInput(66) }) },
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
  if (!expected) return id + ': nessuna baseline (lancia node games/last-rung/test/golden.js --update dopo aver verificato)';
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
  const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : { game: 'last-rung', scenarios: {} };

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
    fs.writeFileSync(BASELINE_FILE, JSON.stringify({ game: 'last-rung', scenarios: ordered }, null, 1) + '\n');
    console.log('baseline scritta in ' + path.relative(process.cwd(), BASELINE_FILE));
  }
  console.log('\n' + (failures ? failures + ' scenari falliti' : 'golden ' + (update ? 'aggiornati' : 'identici')) + ' (' + ((Date.now() - startTime) / 1000).toFixed(1) + ' s)');
  process.exit(failures ? 1 : 0);
}
main();
