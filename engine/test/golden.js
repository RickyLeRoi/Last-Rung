// engine/test/golden.js
'use strict';
/*
 * Node golden snapshots shared by the games (Last Rung and the Faro keep their own older copy of the same logic).
 * A game lists its scenarios in games/<id>/test/golden.js and calls runGolden(): fixed scenarios with deterministic input (and a seeded
 * Math.random for the renderer) are hashed every 300 frames (simulation state + rendered frame) plus a final probe of the simulation
 * RNG. Any change in behaviour, pixels or order of Rng calls makes it fail.
 *   node games/<id>/test/golden.js            compare every scenario with games/<id>/test/golden/<id>.json
 *   node games/<id>/test/golden.js X03        only one scenario
 *   node games/<id>/test/golden.js --update   rewrite the baseline (only after an intentional change, with the user's approval)
 */
const fs = require('fs');
const path = require('path');
const { boot, randomKeysPolicy } = require('./harness');

const CHECKPOINT_EVERY = 300;

const tapKey = code => driver => driver.tap(code);
const downKey = code => driver => driver.keyDown(code);
const upKey = code => driver => driver.keyUp(code);
const decodeActions = data => Object.fromEntries(Object.entries(data).map(([frame, [kind, code]]) => [frame, kind === 'tap' ? tapKey(code) : kind === 'down' ? downKey(code) : upKey(code)]));

// Runs `frames` ticks; input(driver, i) is called before each tick; a checkpoint every 300 frames and at the end.
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

// Arrow keys from randomKeysPolicy every 9 frames, plus the scripted actions keyed by frame.
const randomInput = (policySeed, actions = {}) => {
  const policy = policySeed === null ? null : randomKeysPolicy(policySeed);
  return (driver, i) => {
    if (policy && i % 9 === 0) driver.set(policy(i));
    if (actions[i]) actions[i](driver);
  };
};

const playLevel = levelNumber => driver => driver.play(driver.hook.levelSpec(levelNumber));

// A scenario shared with the browser golden (games/<id>/test/scenarios.js): level null = the title screen.
const sharedScenario = ({ id, seed, level, frames, policySeed, actions }) => ({
  id, seed, run: framed({ start: level ? playLevel(level) : () => {}, frames, input: randomInput(policySeed, decodeActions(actions)) }),
});

// Plays until the state leaves 'play' (or the limit), then `tail` frames more; a checkpoint every 300 frames and at the end.
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

// Plays `frames` of a level with `input`, then replays the recording: the replayed state must equal the recorded one.
function replayScenario({ id, seed, level, frames, input }) {
  return { id, seed, run: (driver, record) => {
    playLevel(level)(driver);
    for (let i = 0; i < frames && driver.game.state === 'play'; i++) { input(driver, i); driver.tick(); }
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
  } };
}

function execute(gameId, scenario) {
  const driver = boot({ game: gameId, seededMath: scenario.seed });
  const checkpoints = [];
  const record = (at, hashes) => checkpoints.push({ at, state: hashes ? hashes.state : driver.stateHash(), frame: hashes ? hashes.frame : driver.frameHash() });
  scenario.run(driver, record);
  const rng = driver.rngProbe();
  return { checkpoints, end: { state: driver.game.state, frame: driver.game.frame, score: driver.game.score }, rng };
}

function describeDifference(gameId, id, expected, actual) {
  if (!expected) return id + ': nessuna baseline (lancia node games/' + gameId + '/test/golden.js --update dopo aver verificato)';
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

function runGolden(gameId, scenarios) {
  const baselineFile = path.join(__dirname, '..', '..', 'games', gameId, 'test', 'golden', gameId + '.json');
  const args = process.argv.slice(2);
  const update = args.includes('--update');
  const wanted = args.filter(argument => !argument.startsWith('--'));
  const unknown = wanted.filter(id => !scenarios.some(scenario => scenario.id === id));
  if (unknown.length) { console.error('scenario sconosciuto: ' + unknown.join(', ')); process.exit(2); }
  const selected = scenarios.filter(scenario => !wanted.length || wanted.includes(scenario.id));
  const baseline = fs.existsSync(baselineFile) ? JSON.parse(fs.readFileSync(baselineFile, 'utf8')) : { game: gameId, scenarios: {} };

  let failures = 0;
  const startTime = Date.now();
  for (const scenario of selected) {
    const scenarioStart = Date.now();
    let result;
    try { result = execute(gameId, scenario); } catch (error) { failures++; console.log('  FAIL ' + scenario.id + ': ' + (error.stack || error).toString().split('\n').slice(0, 3).join(' | ')); continue; }
    if (update) { baseline.scenarios[scenario.id] = result; console.log('  AGGIORNATO ' + scenario.id + ' (' + result.checkpoints.length + ' checkpoint)'); continue; }
    const difference = describeDifference(gameId, scenario.id, baseline.scenarios[scenario.id], result);
    if (difference) { failures++; console.log('  FAIL ' + difference); }
    else console.log('  OK   ' + scenario.id + '  (' + result.checkpoints.length + ' checkpoint, ' + (Date.now() - scenarioStart) + ' ms)');
  }
  if (update && !failures) {
    const ordered = {};
    for (const scenario of scenarios) if (baseline.scenarios[scenario.id]) ordered[scenario.id] = baseline.scenarios[scenario.id];
    fs.mkdirSync(path.dirname(baselineFile), { recursive: true });
    fs.writeFileSync(baselineFile, JSON.stringify({ game: gameId, scenarios: ordered }, null, 1) + '\n');
    console.log('baseline scritta in ' + path.relative(process.cwd(), baselineFile));
  }
  console.log('\n' + (failures ? failures + ' scenari falliti' : 'golden ' + (update ? 'aggiornati' : 'identici')) + ' (' + ((Date.now() - startTime) / 1000).toFixed(1) + ' s)');
  process.exit(failures ? 1 : 0);
}

module.exports = { runGolden, framed, randomInput, untilEnd, replayScenario, sharedScenario, playLevel, tapKey, downKey, upKey, decodeActions };
