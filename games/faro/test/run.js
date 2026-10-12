#!/usr/bin/env node
// games/faro/test/run.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { boot, randomKeysPolicy } = require('./helpers');
const { playLevel } = require('./autopilot');

const tests = [];
const test = (name, testBody) => tests.push({ name, fn: testBody });
function assert(condition, message) { if (!condition) throw new Error(message); }

// A running level with the ships and rocks the test needs (the generated ones are removed).
function setup(levelNumber = 1, { rocks = [], ships = [] } = {}) {
  const harness = boot({ seededMath: 1 });
  const game = harness.play(harness.hook.levelSpec(levelNumber));
  game.L.rocks = rocks.map(rock => ({ seen: false, ...rock }));
  game.L.ships = ships.map((ship, id) => ({ id, t: 0, speed: 0.3, lane: 1, laneF: 1, x: 300, state: 'sail', lit: 0, stateT: 0, ...ship }));
  game.L.total = game.L.ships.length;
  return { harness, game, hook: harness.hook };
}
// The lamp relights itself as soon as there is oil, so darkness means no oil (and a ship far away at sea, so that it does not recharge quickly).
function darken(game) {
  game.oil = 0;
  if (game.L.ships.some(ship => ship.state === 'sail')) return;
  game.L.ships.push({ id: 99, t: 0, speed: 0, lane: 1, laneF: 1, x: 395, state: 'sail', lit: 0, stateT: 0 });
  game.L.total++;
}
const sailingShip = (overrides = {}) => ({ state: 'sail', x: 300, lane: 1, laneF: 1, ...overrides });

test('livelli 1-30: scogli distanziati (sempre una corsia libera), navi e scogli entro i limiti', () => {
  const { hook } = setup();
  for (let levelNumber = 1; levelNumber <= 30; levelNumber++) {
    hook.startLevel(hook.levelSpec(levelNumber), 0);
    const level = hook.game.L;
    assert(level.rocks.length >= 2 && level.ships.length >= 4, 'lv' + levelNumber + ': troppo pochi scogli o navi');
    assert(level.ships.length <= hook.CONFIG.waves.maxShips, 'lv' + levelNumber + ': troppe navi');
    const xs = level.rocks.map(rock => rock.x).sort((first, second) => first - second);
    for (let i = 1; i < xs.length; i++) assert(xs[i] - xs[i - 1] >= 24, 'lv' + levelNumber + ': scogli troppo vicini (' + xs[i - 1] + ', ' + xs[i] + ')');
    assert(level.rocks.every(rock => rock.lane >= 0 && rock.lane <= 2 && rock.x > hook.CONFIG.port.lightX + 30 && !rock.seen), 'lv' + levelNumber + ': scoglio fuori posto');
    assert(level.ships.every(ship => ship.lane >= 0 && ship.lane <= 2 && ship.state === 'wait'), 'lv' + levelNumber + ': nave fuori posto');
  }
  return '30 livelli';
});

test('sfida del giorno: stessa data = stesso livello, date diverse = livelli diversi', () => {
  const { hook } = setup();
  assert(JSON.stringify(hook.dailySpec('2026-10-12')) === JSON.stringify(hook.dailySpec('2026-10-12')), 'spec non deterministica');
  assert(hook.dailySpec('2026-10-12').seed !== hook.dailySpec('2026-10-13').seed, 'seed uguale in giorni diversi');
});

test('gli scogli sono nascosti finche non li illumina il fascio, il porto, un fulmine o il lampo', () => {
  const rocks = [{ x: 140, lane: 0 }, { x: 200, lane: 1 }, { x: 260, lane: 2 }];
  const { harness, game, hook } = setup(1, { rocks });
  darken(game);
  harness.tick(30);
  assert(game.L.rocks.every(rock => !rock.seen), 'scogli visti senza luce');
  game.oil = hook.CONFIG.oil.max; game.beam.on = true;
  game.beam.pitch = 0.3; game.beam.spread = 0;
  harness.tick(2);
  assert(game.L.rocks.some(rock => rock.seen), 'il fascio non rivela nulla');
  harness.tap('KeyX'); harness.tick(2);
  assert(game.L.rocks.every(rock => rock.seen), 'il lampo non rivela tutti gli scogli');
});

test('una nave illuminata segue la corsia del centro del fascio; al buio mantiene la sua', () => {
  const { harness, game, hook } = setup(1, { ships: [sailingShip({ x: 300, speed: 0, lane: 0, laneF: 0 })] });
  const ship = game.L.ships[0], lamp = hook.CONFIG.lamp, config = hook.CONFIG;
  darken(game);
  game.beam.pitch = 0.6;
  harness.tick(60);
  assert(ship.lane === 0 && ship.lit === 0, 'la nave cambia corsia senza luce');
  game.oil = config.oil.max; game.beam.on = true; game.beam.spread = 0;
  // Centre line 10 px below the ship's lane: close enough to light it, far enough to pull it to the next lane.
  const centerY = config.sea.base + config.sea.laneOffsets[0] + 10 - hook.SHIP_LIGHT_HEIGHT;
  game.beam.pitch = Math.atan2(centerY - lamp.y, ship.x + 8 - lamp.x);
  harness.tick(80);
  assert(ship.lit > 0, 'la nave non e illuminata');
  assert(ship.lane === 1 && Math.abs(ship.laneF - 1) < 0.01, 'la nave non segue il fascio (lane ' + ship.lane + ', laneF ' + ship.laneF.toFixed(2) + ')');
});

test('una nave vicina alla linea centrale del fascio la segue, anche con il cono stretto e vicino al faro', () => {
  const { harness, game, hook } = setup(1, { ships: [sailingShip({ x: 160, speed: 0, lane: 0, laneF: 0 })] });
  const ship = game.L.ships[0], lamp = hook.CONFIG.lamp, config = hook.CONFIG;
  game.beam.spread = 0;
  // Centre line exactly on lane 1: 14 px from the ship, wider than the narrow lit cone next to the lamp but inside the following band.
  const centerY = config.sea.base + config.sea.laneOffsets[1] - hook.SHIP_LIGHT_HEIGHT;
  game.beam.pitch = Math.atan2(centerY - lamp.y, ship.x + 8 - lamp.x);
  harness.tick(80);
  assert(ship.following, 'la nave vicina al centro del fascio non lo segue');
  assert(ship.lane === 1 && Math.abs(ship.laneF - 1) < 0.01, 'la nave non raggiunge la corsia del fascio (lane ' + ship.lane + ', laneF ' + ship.laneF.toFixed(2) + ')');
});

test('uno scoglio affonda la nave nella stessa corsia, non quelle in altre corsie', () => {
  const rocks = [{ x: 200, lane: 1 }];
  const { harness, game } = setup(1, { rocks, ships: [sailingShip({ x: 207, lane: 1, laneF: 1 }), sailingShip({ x: 207, lane: 2, laneF: 2 })] });
  game.beam.on = false;
  harness.tick(3);
  assert(game.L.ships[0].state === 'sink', 'la nave sullo scoglio non affonda');
  assert(game.L.ships[1].state === 'sail', 'la nave in un\'altra corsia affonda');
  assert(game.L.sunk === 1, 'conteggio affondate ' + game.L.sunk);
  assert(game.L.rocks[0].seen, 'lo scoglio che affonda la nave non viene rivelato');
});

test('porto: la nave che arriva segna punti e non ripete', () => {
  const { harness, game, hook } = setup(1, { ships: [sailingShip({ x: 90 })] });
  const scoreBefore = game.score;
  harness.tick(60);
  assert(game.L.docked === 1 && game.L.ships[0].state === 'dock', 'nave non attraccata');
  assert(game.score === scoreBefore + hook.CONFIG.score.dock, 'punti ' + (game.score - scoreBefore));
});

test('olio: il fascio lo consuma, a zero la lampada si spegne; senza navi si ricarica e riaccende', () => {
  const { harness, game, hook } = setup(1, { ships: [sailingShip({ x: 380 })] });
  const full = game.oil;
  harness.tick(120);
  assert(game.oil < full, 'il fascio non consuma olio');
  game.oil = 0.01; harness.tick(3);
  assert(game.beam.on === false, 'la lampada resta accesa senza olio');
  game.L.ships[0].state = 'dock';
  harness.tick(Math.ceil(hook.CONFIG.oil.restart / hook.CONFIG.oil.recharge) + 10);
  assert(game.beam.on === true && game.oil >= hook.CONFIG.oil.restart, 'la lampada non si riaccende (olio ' + game.oil.toFixed(1) + ')');
});

test('sirena: rallenta le navi, ha un tempo di ricarica; lampo: costa olio e non parte senza', () => {
  const { harness, game, hook } = setup(1, { ships: [sailingShip({ x: 380, speed: 0.4 })] });
  game.beam.on = false; game.wind = 0;
  const ship = game.L.ships[0];
  harness.tick(); const normalStep = -(ship.x - 380) ;
  harness.tap('Space'); harness.tick();
  assert(game.sirenT > 0 && game.sirenCool > 0, 'sirena non attivata');
  const before = ship.x; harness.tick();
  assert(before - ship.x < normalStep * 0.6, 'la sirena non rallenta (passo ' + (before - ship.x).toFixed(3) + ' contro ' + normalStep.toFixed(3) + ')');
  const cooldown = game.sirenCool; harness.tap('Space');
  assert(game.sirenCool <= cooldown, 'la sirena riparte durante la ricarica');

  game.beam.on = true; game.oil = hook.CONFIG.oil.max;
  harness.tap('KeyX'); harness.tick();
  assert(game.lampFlashT > 0 && game.oil < hook.CONFIG.oil.max - hook.CONFIG.oil.flash + 1, 'lampo non attivato o gratis');
  game.lampFlashT = 0; game.oil = hook.CONFIG.oil.flash - 1;
  harness.tap('KeyX'); harness.tick();
  assert(game.lampFlashT === 0, 'il lampo parte senza olio');
});

test('esito: tutte al porto = 3 stelle; metà affondate = sconfitta; più della metà al porto = vittoria', () => {
  let setupResult = setup(1, { ships: [sailingShip({ x: 120, speed: 0.5 }), sailingShip({ x: 130, speed: 0.5 })] });
  setupResult.game.beam.on = false;
  setupResult.harness.tick(600);
  assert(setupResult.game.state === 'done' && setupResult.game.result === 'win' && setupResult.game.stars === 3, 'esito ' + setupResult.game.state + ' ' + setupResult.game.result + ' stelle ' + setupResult.game.stars);

  setupResult = setup(1, { rocks: [{ x: 200, lane: 1 }], ships: [sailingShip({ x: 207 }), sailingShip({ x: 380 })] });
  setupResult.game.beam.on = false;
  setupResult.harness.tick(5);
  assert(setupResult.game.state === 'over' && /AFFONDATE/.test(setupResult.game.overReason), 'sconfitta non rilevata (' + setupResult.game.state + ')');

  setupResult = setup(1, { rocks: [{ x: 200, lane: 1 }], ships: [sailingShip({ x: 207 }), sailingShip({ x: 150, lane: 2, laneF: 2 }), sailingShip({ x: 140, lane: 2, laneF: 2 }), sailingShip({ x: 130, lane: 2, laneF: 2 })] });
  setupResult.game.beam.on = false;
  setupResult.harness.tick(700);
  assert(setupResult.game.state === 'done' && setupResult.game.result === 'win' && setupResult.game.stars === 2, 'esito ' + setupResult.game.state + ' ' + setupResult.game.result + ' stelle ' + setupResult.game.stars);
});

test('tutorial: i passi avanzano da soli quando si fa cio che chiedono', () => {
  const harness = boot({ seededMath: 1 });
  const game = harness.play(harness.hook.tutorialSpec());
  assert(game.tut && game.tut.step === 0, 'il tutorial non parte dal primo passo');
  harness.hold(['ArrowRight'], 5);
  assert(game.tut.step >= 1, 'il passo del fascio non avanza');
  harness.hold(['ArrowUp'], 5);
  assert(game.tut.step >= 2, 'il passo dell\'apertura non avanza');
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
    for (let i = 0; i < 1500; i++) {
      if (i % 10 === 0) harness.set(keysPolicy(i));
      if (i % 200 === 199) harness.tap('Space');
      if (i % 350 === 349) harness.tap('KeyX');
      if (i % 400 === 0) harness.shot(os.devNull);
      harness.tick();
    }
    assert(harness.stats.nonInt === 0, 'lv' + levelNumber + ': coordinate non intere ' + harness.stats.nonInt);
    assert(harness.stats.badColor === 0, 'lv' + levelNumber + ': colori fuori palette ' + harness.stats.badColor);
  }
});

test('build: bundle e pagina presenti, minificati, con manifest e icone', () => {
  const root = path.join(__dirname, '..', '..', '..', 'dist');
  const page = fs.readFileSync(path.join(root, 'faro.html'), 'utf8');
  assert(!page.includes('// =====') && page.split('\n').length <= 2, 'bundle non minificato');
  for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    assert(fs.existsSync(path.join(root, 'site', 'faro', file)), 'manca dist/site/faro/' + file);
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
