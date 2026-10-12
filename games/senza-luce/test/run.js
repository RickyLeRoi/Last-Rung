#!/usr/bin/env node
// games/senza-luce/test/run.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { boot, randomKeysPolicy } = require('./helpers');
const { playLevel } = require('./autopilot');

const tests = [];
const test = (name, testBody) => tests.push({ name, fn: testBody });
function assert(condition, message) { if (!condition) throw new Error(message); }

// A running level with only the watchers and crates the test needs (the generated ones are removed).
function setup(levelNumber = 1, { towers = [], patrols = [], crates = [], boat = {} } = {}) {
  const harness = boot({ seededMath: 1 });
  const game = harness.play(harness.hook.levelSpec(levelNumber));
  game.L.towers = towers;
  game.L.patrols = patrols.map(patrol => ({ x: 600, x0: 400, x1: 800, dir: -1, lane: 1, laneF: patrol.lane === undefined ? 1 : patrol.lane, homeLane: 1, targetLane: 1, mode: 'patrol', modeT: 0, targetX: 0, ...patrol }));
  game.L.crates = crates.map(crate => ({ taken: false, ...crate }));
  game.L.fogBanks = [];
  Object.assign(game.boat, boat);
  return { harness, game, hook: harness.hook };
}
// A patrol that stays where it is, facing `dir` (a suspicious patrol already at its target does not move).
const stillPatrol = (x, dir, lane = 1) => ({ x, x0: x, x1: x, dir, lane, laneF: lane, homeLane: lane, targetLane: lane, mode: 'suspect', modeT: 100000, targetX: x + 12 });

test('livelli 1-30: fari distanti (i fasci non si toccano), partenza fuori dalla luce, casse e motovedette entro i limiti', () => {
  const { hook } = setup();
  const CONFIG = hook.CONFIG;
  for (let levelNumber = 1; levelNumber <= 30; levelNumber++) {
    hook.startLevel(hook.levelSpec(levelNumber), 0);
    const level = hook.game.L, startX = hook.game.boat.x;
    const xs = level.towers.map(tower => tower.x).sort((first, second) => first - second);
    assert(xs.length >= 2, 'lv' + levelNumber + ': meno di due fari');
    for (let i = 1; i < xs.length; i++) assert(xs[i] - xs[i - 1] >= 2 * CONFIG.tower.length - 40, 'lv' + levelNumber + ': fari troppo vicini (' + xs[i - 1] + ', ' + xs[i] + ')');
    assert(xs[xs.length - 1] + CONFIG.tower.length < startX, 'lv' + levelNumber + ': la partenza e alla portata di un faro');
    assert(level.patrols.every(patrol => patrol.x1 + CONFIG.patrol.length * CONFIG.moon.factor + 24 < startX), 'lv' + levelNumber + ': motovedetta vicina alla partenza');
    assert(level.crates.length === CONFIG.crates.count && level.crates.every(crate => crate.x > CONFIG.cove.x && crate.x < startX), 'lv' + levelNumber + ': casse fuori posto');
    assert(level.dawnAt > (startX - CONFIG.cove.x) / CONFIG.boat.maxSpeed * 3, 'lv' + levelNumber + ': alba troppo presto');
  }
  return '30 livelli';
});

test('sfida del giorno: stessa data = stesso livello, date diverse = livelli diversi', () => {
  const { hook } = setup();
  assert(JSON.stringify(hook.dailySpec('2026-10-12')) === JSON.stringify(hook.dailySpec('2026-10-12')), 'spec non deterministica');
  assert(hook.dailySpec('2026-10-12').seed !== hook.dailySpec('2026-10-13').seed, 'seed uguale in giorni diversi');
});

test('faro rotante: illumina un lato, si spegne girandosi verso di noi, poi illumina l altro lato', () => {
  const { hook } = setup();
  const tower = { x: 500, period: 480, phase: 0 }, sides = new Set();
  let darkFrames = 0, previous = null, changes = 0;
  for (let clock = 0; clock < 480; clock++) {
    const cone = hook.towerCone(tower, clock), side = cone ? cone.facing : 0;
    if (!cone) darkFrames++; else sides.add(cone.facing);
    if (previous !== null && side !== previous) changes++;
    previous = side;
  }
  assert(sides.has(1) && sides.has(-1), 'il fascio non illumina entrambi i lati');
  assert(darkFrames > 60 && darkFrames < 300, 'buio per ' + darkFrames + ' frame su 480');
  assert(changes === 4, 'cambi di stato in un giro: ' + changes + ' (attesi 4: lato, buio, altro lato, buio)');
  const full = hook.towerCone(tower, 0), turning = hook.towerCone(tower, 60);
  assert(turning.pitch > full.pitch, 'girandosi il fascio non si accorcia verso il faro');
});

test('nel cono di una motovedetta l allarme sale, al buio scende', () => {
  const { harness, game } = setup(2, { patrols: [stillPatrol(500, 1)], boat: { x: 560, lane: 1, laneF: 1 } });
  harness.tick(30);
  assert(game.seen && game.alert > 20, 'la barca nel cono non e vista (allerta ' + game.alert.toFixed(1) + ')');
  const peak = game.alert;
  game.L.patrols[0].dir = -1; game.L.patrols[0].targetX = 500 - 300;
  game.L.patrols[0].x = 300;
  harness.tick(30);
  assert(!game.seen && game.alert < peak - 5, 'al buio l allerta non scende (' + peak.toFixed(1) + ' -> ' + game.alert.toFixed(1) + ')');
});

test('allarme pieno: le motovedette inseguono; dopo un po al buio ti perdono di vista', () => {
  const { harness, game, hook } = setup(2, { patrols: [stillPatrol(500, 1)], boat: { x: 580, lane: 0, laneF: 0 } });
  game.alert = 99;
  game.boat.lane = 1; game.boat.laneF = 1;
  harness.tick(3);
  assert(game.alarmT > 0 && game.alarms === 1 && game.L.patrols[0].mode === 'chase', 'allarme non scattato');
  game.L.patrols[0].x = 100;
  harness.tick(hook.CONFIG.alert.alarmFrames + 5);
  assert(game.alarmT === 0 && game.L.patrols[0].mode === 'patrol' && game.alert <= hook.CONFIG.alert.afterAlarm, 'l allarme non finisce (' + game.alarmT + ', ' + game.L.patrols[0].mode + ')');
});

test('cattura: toccare una motovedetta nella stessa corsia e game over, in un altra corsia no', () => {
  let setupResult = setup(2, { patrols: [stillPatrol(500, -1, 2)], boat: { x: 505, lane: 1, laneF: 1 } });
  setupResult.harness.tick(3);
  assert(setupResult.game.state === 'play', 'catturato da una motovedetta in un altra corsia');
  setupResult = setup(2, { patrols: [stillPatrol(500, -1, 1)], boat: { x: 505, lane: 1, laneF: 1 } });
  setupResult.harness.tick(3);
  assert(setupResult.game.state === 'over' && /CATTURATO/.test(setupResult.game.overReason), 'non catturato (' + setupResult.game.state + ')');
});

test('fumogeno: la luce non lo attraversa; sono solo due', () => {
  const { harness, game } = setup(2, { patrols: [stillPatrol(480, 1)], boat: { x: 560, lane: 1, laneF: 1 } });
  harness.tick(5);
  assert(game.seen, 'la barca non e vista prima del fumogeno');
  harness.tap('Space'); harness.tick(5);
  assert(game.smokes.length === 1 && !game.seen, 'il fumogeno non nasconde la barca');
  harness.tap('Space'); harness.tap('Space');
  assert(game.boat.smokes === 0 && game.smokes.length === 2, 'fumogeni: ' + game.boat.smokes + ' rimasti, ' + game.smokes.length + ' in mare');
});

test('rumore: a tutto gas la motovedetta vicina si gira; piano (Maiusc) e a motore spento no', () => {
  const patrol = { x: 700, x0: 650, x1: 750, dir: 1, lane: 0, laneF: 0, homeLane: 0, targetLane: 0 };
  let setupResult = setup(2, { patrols: [patrol], boat: { x: 760, lane: 2, laneF: 2 } });
  setupResult.harness.hold(['ArrowLeft'], 100);
  assert(setupResult.game.L.patrols[0].mode === 'suspect', 'a tutto gas la motovedetta non sente nulla (' + setupResult.game.L.patrols[0].mode + ')');

  setupResult = setup(2, { patrols: [patrol], boat: { x: 760, lane: 2, laneF: 2 } });
  setupResult.harness.keyDown('ShiftLeft'); setupResult.harness.hold(['ArrowLeft'], 100); setupResult.harness.keyUp('ShiftLeft');
  assert(setupResult.game.L.patrols[0].mode === 'patrol' && setupResult.game.boat.vx < -0.2, 'piano: la motovedetta sente lo stesso, o la barca non si muove');

  setupResult = setup(2, { patrols: [patrol], boat: { x: 760, lane: 2, laneF: 2 } });
  setupResult.harness.tap('KeyX');
  setupResult.harness.hold(['ArrowLeft'], 300);
  assert(!setupResult.game.boat.engineOn && setupResult.game.L.patrols[0].mode === 'patrol', 'a motore spento la motovedetta sente');
  assert(setupResult.game.boat.vx > 0 && setupResult.game.boat.x > 760, 'a motore spento la corrente non porta la barca al largo (vx ' + setupResult.game.boat.vx.toFixed(2) + ')');
});

test('tempesta: il fulmine alza l allarme vicino a una motovedetta, non nella nebbia', () => {
  const { harness, game, hook } = setup(2, { patrols: [stillPatrol(500, -1, 0)], boat: { x: 600, lane: 2, laneF: 2 } });
  game.lightningT = 1;
  harness.tick();
  assert(game.alert >= hook.CONFIG.storm.alert - 1, 'il fulmine non scopre la barca (allerta ' + game.alert.toFixed(1) + ')');
  game.alert = 0;
  game.L.fogBanks = [{ x: 550, w: 120, speed: 0 }];
  game.lightningT = 1;
  harness.tick();
  assert(game.alert < 1, 'il fulmine scopre la barca nella nebbia');
});

test('nebbia: dentro un banco i coni lontani non vedono, quelli vicini si', () => {
  const { harness, game } = setup(3, { patrols: [stillPatrol(420, 1)], boat: { x: 520, lane: 1, laneF: 1 } });
  game.L.fogBanks = [{ x: 480, w: 120, speed: 0 }];
  harness.tick(5);
  assert(!game.seen, 'vista nella nebbia da lontano');
  // 35 px from the searchlight: inside the fog's sight distance and inside the cone (closer than ~25 px the boat is under the beam).
  game.L.patrols[0].x = 478; game.L.patrols[0].targetX = 490;
  harness.tick(3);
  assert(game.seen, 'non vista nella nebbia da vicino');
});

test('corsie: una per spinta, anche tenendo premuto', () => {
  const { harness, game } = setup(2, { boat: { lane: 0, laneF: 0 } });
  harness.hold(['ArrowDown'], 30);
  assert(game.boat.lane === 1, 'tenendo premuto cambia piu di una corsia (' + game.boat.lane + ')');
  harness.hold([], 2); harness.hold(['ArrowDown'], 2); harness.hold([], 2); harness.hold(['ArrowDown'], 2);
  assert(game.boat.lane === 2, 'due spinte non portano alla corsia 2 (' + game.boat.lane + ')');
});

test('casse: si raccolgono nella stessa corsia, non in un altra', () => {
  const { harness, game, hook } = setup(2, { crates: [{ x: 600, lane: 1 }, { x: 600, lane: 2 }], boat: { x: 593, lane: 1, laneF: 1 } });
  const scoreBefore = game.score;
  harness.tick(2);
  assert(game.L.crates[0].taken && !game.L.crates[1].taken, 'casse: ' + game.L.crates.map(crate => crate.taken).join(','));
  assert(game.L.cratesTaken === 1 && game.score === scoreBefore + hook.CONFIG.score.crate, 'punti o conteggio sbagliati');
});

test('grotta: vittoria con 3 stelle (tutte le casse, mai scoperto), 2 (con allarme) o 1 (casse mancanti)', () => {
  const play = (alarms, missing) => {
    const { harness, game, hook } = setup(2, { crates: [{ x: 300, lane: 1, taken: !missing }], boat: { lane: 1, laneF: 1 } });
    game.boat.x = hook.CONFIG.cove.x + 3;
    game.L.cratesTaken = missing ? 0 : 1;
    game.alarms = alarms;
    harness.hold(['ArrowLeft'], 120);
    return game;
  };
  let game = play(0, false);
  assert(game.state === 'done' && game.result === 'win' && game.stars === 3, 'esito ' + game.state + ' ' + game.result + ' stelle ' + game.stars);
  game = play(1, false);
  assert(game.state === 'done' && game.stars === 2, 'con un allarme: stelle ' + game.stars);
  game = play(0, true);
  assert(game.state === 'done' && game.stars === 1, 'senza tutte le casse: stelle ' + game.stars);
});

test('alba: allo scadere del tempo la partita e persa', () => {
  const { harness, game } = setup(2);
  game.clock = game.L.dawnAt - 2;
  harness.tick(3);
  assert(game.state === 'over' && /SOLE/.test(game.overReason), 'stato ' + game.state + ' (' + game.overReason + ')');
});

test('tutorial: i passi avanzano da soli; nessuna cattura e nessuna alba', () => {
  const harness = boot({ seededMath: 1 });
  const game = harness.play(harness.hook.tutorialSpec());
  assert(game.tut && game.tut.step === 0 && game.L.dawnAt === 0, 'il tutorial non parte dal primo passo o ha l alba');
  harness.hold(['ArrowLeft'], 5);
  assert(game.tut.step >= 1, 'il passo del gas non avanza');
  harness.hold(['ArrowLeft', 'ArrowDown'], 3);
  assert(game.tut.step >= 2, 'il passo delle corsie non avanza');
  const patrol = game.L.patrols[0];
  game.boat.x = patrol.x; game.boat.lane = patrol.lane; game.boat.laneF = patrol.laneF;
  harness.tick(5);
  assert(game.state === 'play', 'nel tutorial la motovedetta cattura');
});

test('replay: una partita con il pilota automatico si ricostruisce identica', () => {
  const result = playLevel(boot({ seededMath: 1 }).hook.levelSpec(2), 1500);
  const driver = result.driver, game = driver.game;
  driver.set([]);
  if (game.state === 'play') game.state = 'pause';
  const recordedFrames = game.rec.frames.length;
  const recorded = driver.stateHash({ ignoreState: true });
  driver.hook.startReplay();
  assert(game.state === 'replay', 'replay non avviato');
  for (let ticks = 0; game.state === 'replay' && game.replay.i < recordedFrames && ticks < 100000; ticks++) driver.tick();
  assert(driver.stateHash({ ignoreState: true }) === recorded, 'il replay diverge dalla partita registrata (' + recordedFrames + ' frame)');
  return recordedFrames + ' frame';
});

test('smoke: input casuali su livelli di tutti gli scenari, solo pixel interi B/N', () => {
  for (const levelNumber of [1, 2, 3, 4, 8, 12]) {
    const harness = boot({ seededMath: levelNumber }); harness.play(harness.hook.levelSpec(levelNumber));
    const keysPolicy = randomKeysPolicy(levelNumber);
    for (let i = 0; i < 1500 && harness.game.state === 'play'; i++) {
      if (i % 10 === 0) harness.set(keysPolicy(i));
      if (i % 300 === 299) harness.tap('Space');
      if (i % 450 === 449) harness.tap('KeyX');
      if (i % 400 === 0) harness.shot(os.devNull);
      harness.tick();
    }
    harness.shot(os.devNull);
    assert(harness.stats.nonInt === 0, 'lv' + levelNumber + ': coordinate non intere ' + harness.stats.nonInt);
    assert(harness.stats.badColor === 0, 'lv' + levelNumber + ': colori fuori palette ' + harness.stats.badColor);
  }
});

test('build: bundle e pagina presenti, minificati, con manifest e icone', () => {
  const root = path.join(__dirname, '..', '..', '..', 'dist');
  const page = fs.readFileSync(path.join(root, 'senza-luce.html'), 'utf8');
  assert(!page.includes('// =====') && page.split('\n').length <= 2, 'bundle non minificato');
  for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    assert(fs.existsSync(path.join(root, 'site', 'senza-luce', file)), 'manca dist/site/senza-luce/' + file);
  }
  return (page.length / 1024).toFixed(1) + ' KB';
});

(async () => {
  const filter = process.argv[2];
  let pass = 0, fail = 0;
  for (const entry of tests) {
    if (filter && !entry.name.includes(filter)) continue;
    const startTime = Date.now();
    try {
      const info = await entry.fn();
      pass++;
      console.log('  OK   ' + entry.name + (info ? '  [' + info + ']' : '') + '  (' + (Date.now() - startTime) + ' ms)');
    } catch (error) {
      fail++;
      console.log('  FAIL ' + entry.name + '\n       ' + (error.stack || error).toString().split('\n').slice(0, 4).join('\n       '));
    }
  }
  console.log('\n' + pass + ' ok, ' + fail + ' falliti');
  process.exit(fail ? 1 : 0);
})();
