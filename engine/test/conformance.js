#!/usr/bin/env node
// engine/test/conformance.js
'use strict';
/*
 * Suite every game must pass, run against the built bundle dist/<id>.html in the Node harness:
 *   node engine/test/conformance.js [gameId...]
 * It only uses what the engine contract guarantees: the test hook (game, CONFIG, startLevel, startReplay, Rng, Input) and the key
 * bindings the game declared. Game specific behaviour belongs in games/<id>/test/.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { boot } = require('./harness');

const ROOT = path.join(__dirname, '..', '..');
const REQUIRED_HOOK_KEYS = ['game', 'CONFIG', 'startLevel', 'startReplay', 'Rng', 'Input'];

function assert(condition, message) { if (!condition) throw new Error(message); }

// Small deterministic generator for the test inputs (the games' Rng must not be disturbed).
function lcg(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

const keyFor = (bindings, edge) => Object.keys(bindings.keyEdges).find(code => bindings.keyEdges[code] === edge);

function listGames(requestedIds) {
  const ids = fs.readdirSync(path.join(ROOT, 'games'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(ROOT, 'games', entry.name, 'game.json'))).map(entry => entry.name);
  return ids.filter(id => !requestedIds.length || requestedIds.includes(id));
}

// Plays with random key presses taken from the game's own bindings.
function randomPlay(driver, bindings, random, frames, { allowFlowKeys }) {
  const flowEdges = new Set(['pause', 'restart', 'replay', 'daily', 'skip', 'mute']);
  const tapKeys = Object.keys(bindings.keyEdges).filter(code => allowFlowKeys || !flowEdges.has(bindings.keyEdges[code]));
  const holdKeys = bindings.blockKeys.filter(code => !bindings.keyEdges[code]);
  const held = new Set();
  for (let i = 0; i < frames; i++) {
    if (i % 12 === 0) for (const code of holdKeys) { if (random() < 0.45) { driver.keyDown(code); held.add(code); } else { driver.keyUp(code); held.delete(code); } }
    if (random() < 0.04 && tapKeys.length) driver.tap(tapKeys[Math.floor(random() * tapKeys.length)]);
    else driver.tick();
  }
  for (const code of held) driver.keyUp(code);
}

function toPlay(driver, bindings) {
  const confirm = keyFor(bindings, 'confirm');
  driver.tap(confirm);   // title -> intro
  driver.tap(confirm);   // intro -> play
  assert(driver.game.state === 'play', 'confirm due volte dal titolo non porta a play (' + driver.game.state + ')');
}

const checks = [
  ['si avvia dal bundle, test hook completo, parte dal titolo', (id) => {
    const driver = boot({ game: id, seededMath: 1 });
    for (const key of REQUIRED_HOOK_KEYS) assert(key in driver.hook, 'test hook senza ' + key);
    assert(driver.game.state === 'title', 'stato iniziale ' + driver.game.state);
    assert(driver.hook.Input.bindings && driver.hook.Input.bindings.keyEdges, 'Input non configurato');
  }],

  ['flusso: confirm -> intro -> play; pausa ferma i frame; restart li azzera', (id) => {
    const driver = boot({ game: id, seededMath: 2 });
    const bindings = driver.hook.Input.bindings, game = driver.game;
    toPlay(driver, bindings);
    driver.tick(60);
    driver.tap(keyFor(bindings, 'pause'));
    assert(game.state === 'pause', 'pausa non attivata (' + game.state + ')');
    const frozenAt = game.frame;
    driver.tick(30);
    assert(game.frame === frozenAt, 'la simulazione avanza in pausa');
    driver.tap(keyFor(bindings, 'pause'));
    assert(game.state === 'play', 'la pausa non si chiude');
    driver.tick(30);
    assert(game.frame > frozenAt, 'la simulazione non riparte');
    driver.tap(keyFor(bindings, 'restart'));
    driver.tick(2);
    assert(game.state !== 'title' && game.frame < 10, 'restart non azzera i frame (' + game.frame + ')');
  }],

  ['3000 frame di input casuali dai bindings: nessuna eccezione, solo interi, solo #fff/#000/#d00', (id) => {
    for (const seed of [11, 12]) {
      const driver = boot({ game: id, seededMath: seed });
      const bindings = driver.hook.Input.bindings, random = lcg(seed);
      toPlay(driver, bindings);
      randomPlay(driver, bindings, random, 3000, { allowFlowKeys: true });
      for (let i = 0; i < 4; i++) { driver.shot(os.devNull); driver.tick(50); }
      assert(driver.stats.nonInt === 0, 'coordinate non intere: ' + driver.stats.nonInt);
      assert(driver.stats.badColor === 0, 'colori fuori palette: ' + driver.stats.badColor);
    }
  }],

  ['replay deterministico: 1200 frame casuali, poi lo stesso stato', (id) => {
    for (const seed of [21, 22, 23]) {
      const driver = boot({ game: id, seededMath: seed });
      const bindings = driver.hook.Input.bindings, game = driver.game, random = lcg(seed);
      toPlay(driver, bindings);
      for (let i = 0; i < 1200 && game.state === 'play'; i++) randomPlay(driver, bindings, random, 1, { allowFlowKeys: false });
      for (const code of bindings.blockKeys) driver.keyUp(code);
      if (game.state === 'play') game.state = 'pause';   // the replay must end at exactly this point
      const recordedFrames = game.rec.frames.length;
      assert(recordedFrames > 0, 'nessun frame registrato');
      const recorded = driver.stateHash({ ignoreState: true });
      driver.hook.startReplay();
      assert(game.state === 'replay', 'replay non avviato');
      for (let ticks = 0; game.state === 'replay' && game.replay.i < recordedFrames && ticks < 100000; ticks++) driver.tick();
      assert(driver.stateHash({ ignoreState: true }) === recorded, 'il replay diverge dalla partita registrata (seed ' + seed + ', ' + recordedFrames + ' frame)');
    }
  }],
];

let failed = 0;
const games = listGames(process.argv.slice(2));
if (!games.length) { console.log('nessun gioco da verificare'); process.exit(1); }
for (const id of games) {
  console.log('conformance: ' + id);
  for (const [name, run] of checks) {
    const startTime = Date.now();
    try { run(id); console.log('  OK   ' + name + '  (' + (Date.now() - startTime) + ' ms)'); }
    catch (error) { failed++; console.log('  FAIL ' + name + '\n       ' + String(error.stack || error).split('\n').slice(0, 4).join('\n       ')); }
  }
}
console.log('\n' + (failed ? failed + ' controlli di conformance falliti' : 'conformance ok'));
process.exit(failed ? 1 : 0);
