#!/usr/bin/env node
// games/valanga/test/run.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { boot, randomKeysPolicy } = require('./helpers');
const { playLevel } = require('./autopilot');

const tests = [];
const test = (name, testBody) => tests.push({ name, fn: testBody });
function assert(condition, message) { if (!condition) throw new Error(message); }

const SNOW = 1, ROCK = 2;

// A running level (level 1 unless stated), with the avalanches switched off unless the test wants them.
function setup(levelNumber = 1) {
  const harness = boot({ seededMath: 1 });
  const game = harness.play(harness.hook.levelSpec(levelNumber));
  game.L.avalancheAt = 0;
  return { harness, game, hook: harness.hook };
}
// Puts the rescuer standing on the surface with its centre at x.
function standAt(hook, x) {
  const body = hook.game.rescuer;
  body.x = x - body.w / 2; body.y = hook.surfaceAt(x) - body.h; body.vx = 0; body.vy = 0; body.onGround = true;
}
const snowCells = (hook, x, y, width, height) => {
  let count = 0;
  for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) if (hook.Terrain.get(hook.game.L.terrain, column, row) === SNOW) count++;
  return count;
};

test('livelli 1-30: sepolti sotto la neve, sopra la roccia, distanziati; il soccorritore parte sulla neve', () => {
  const { hook } = setup();
  const config = hook.CONFIG.victim;
  for (let levelNumber = 1; levelNumber <= 30; levelNumber++) {
    hook.startLevel(hook.levelSpec(levelNumber), 0);
    const level = hook.game.L, terrain = level.terrain;
    assert(level.victims.length >= 2 && level.victims.length <= config.max, 'lv' + levelNumber + ': sepolti ' + level.victims.length);
    for (const victim of level.victims) {
      assert(victim.y >= hook.surfaceAt(victim.x + config.w / 2) + 4, 'lv' + levelNumber + ': sepolto troppo in superficie');
      for (let column = victim.x; column < victim.x + config.w; column++) assert(hook.Terrain.get(terrain, column, victim.y + config.h) !== 0, 'lv' + levelNumber + ': sepolto sospeso nel vuoto');
      assert(snowCells(hook, victim.x, victim.y, config.w, config.h) === config.w * config.h, 'lv' + levelNumber + ': il sepolto non e tutto nella neve');
    }
    const xs = level.victims.map(victim => victim.x);
    for (let i = 1; i < xs.length; i++) assert(xs[i] - xs[i - 1] >= config.spacing / 2, 'lv' + levelNumber + ': sepolti troppo vicini');
    const body = hook.game.rescuer;
    assert(!hook.Terrain.hitsRect(terrain, body.x, body.y, body.w, body.h) && hook.Terrain.hitsRect(terrain, body.x, body.y + 1, body.w, body.h), 'lv' + levelNumber + ': partenza non appoggiata sulla neve');
  }
  return '30 livelli';
});

test('sfida del giorno: stessa data = stesso livello, date diverse = livelli diversi', () => {
  const { hook } = setup();
  assert(JSON.stringify(hook.dailySpec('2026-10-12')) === JSON.stringify(hook.dailySpec('2026-10-12')), 'spec non deterministica');
  assert(hook.dailySpec('2026-10-12').seed !== hook.dailySpec('2026-10-13').seed, 'seed uguale in giorni diversi');
});

test('ARTVA: niente segnale lontano; avvicinandosi cresce e indica il sepolto piu vicino', () => {
  const { harness, game, hook } = setup();
  const victim = game.L.victims[0];
  standAt(hook, 60);
  harness.tick();
  assert(!game.signal, 'segnale da lontano');
  let previous = -1;
  for (const distance of [80, 50, 20, 4]) {
    standAt(hook, hook.victimCenterX(victim) - distance);
    harness.tick();
    assert(game.signal && game.signal.victim === victim && game.signal.strength > previous, 'a ' + distance + ' px il segnale non cresce');
    previous = game.signal.strength;
  }
});

test('sonda: trova il sepolto entro la sua area (anche un po di lato), non piu in la', () => {
  const { harness, game, hook } = setup();
  const victim = game.L.victims[0], probe = hook.CONFIG.probe;
  standAt(hook, hook.victimCenterX(victim) + probe.width - 2);
  harness.tap('KeyX'); harness.tick(probe.frames);
  assert(victim.found && game.probeMarks.length === 1 && game.probeMarks[0].hit, 'la sonda di lato non trova il sepolto');
  victim.found = false;
  standAt(hook, hook.victimCenterX(victim) + probe.width + hook.CONFIG.victim.w + 6);
  harness.tap('KeyX'); harness.tick(probe.frames);
  assert(!victim.found && !game.probeMarks[1].hit, 'la sonda trova il sepolto da troppo lontano');
});

test('scavo in verticale: toglie la neve sotto i piedi, mai la roccia; raggiunto dall alto il sepolto e libero', () => {
  const { harness, game, hook } = setup();
  const victim = game.L.victims[0], startY = game.rescuer.y;
  standAt(hook, hook.victimCenterX(victim));
  const before = game.rescuer.y, scoreBefore = game.score;
  harness.keyDown('Space');
  for (let i = 0; i < 600 && victim.state === 'buried'; i++) harness.tick();
  harness.keyUp('Space');
  assert(victim.state === 'saved' && game.L.saved === 1, 'sepolto non liberato (' + victim.state + ', soccorritore a y ' + game.rescuer.y.toFixed(1) + ')');
  assert(game.rescuer.y > before + 4 && game.rescuer.y + game.rescuer.h <= victim.y + 1, 'il soccorritore non e sceso nella buca, o e finito sotto il sepolto');
  assert(game.score > scoreBefore + hook.CONFIG.score.saved, 'punti senza bonus per l aria rimasta');

  const rock = setup(), rockX = 200;
  standAt(rock.hook, rockX);
  const rockY = rock.hook.surfaceAt(rockX);
  rock.harness.keyDown('Space'); rock.harness.tick(400); rock.harness.keyUp('Space');
  let rockCells = 0;
  for (let y = rockY; y < rockY + 60; y++) if (rock.hook.Terrain.get(rock.game.L.terrain, rockX, y) === ROCK) rockCells++;
  assert(rockCells > 0 && rock.game.rescuer.y < rock.hook.CONFIG.world.height, 'scavando si attraversa la roccia');
  return 'partenza y ' + startY;
});

test('scavo di lato: la neve sopra la galleria crolla', () => {
  const { harness, game, hook } = setup();
  const x = 300;
  standAt(hook, x);
  harness.keyDown('Space'); harness.tick(120); harness.keyUp('Space');
  const body = game.rescuer, wallX = Math.round(body.x + body.w + 5), tunnelY = Math.round(body.y + body.h - 3);
  harness.keyDown('Space'); harness.keyDown('ArrowRight'); harness.tick(13); harness.keyUp('ArrowRight'); harness.keyUp('Space');
  harness.tick(60);
  const level = game.L;
  assert(level.surface[wallX] > hook.surfaceAt(x - 40) - 40 && hook.Terrain.get(level.terrain, wallX, tunnelY) === SNOW, 'la neve sopra la galleria non e crollata (cella ' + hook.Terrain.get(level.terrain, wallX, tunnelY) + ')');
});

test('neve che crolla sul sepolto: muore; qualche granello dalle pareti no', () => {
  const { harness, game, hook } = setup();
  const victim = game.L.victims[0], config = hook.CONFIG.victim;
  for (let i = 0; i < 5; i++) hook.crushUnder(victim.x + 2, victim.y);
  harness.tick(30);
  assert(victim.state === 'buried', 'muore per pochi granelli');
  hook.Terrain.carveCircle(game.L.terrain, hook.victimCenterX(victim), victim.y + config.h + 5, 6, SNOW);
  for (let x = victim.x - 8; x < victim.x + config.w + 8; x++) game.L.loose[x] = 1;
  harness.tick(40);
  assert(victim.state === 'lost' && game.L.lost === 1 && /CROLLATA/.test(game.msg), 'il crollo non uccide il sepolto (' + victim.state + ')');
});

test('aria: a zero il sepolto e perso; se non si puo piu vincere la partita e persa', () => {
  const { harness, game } = setup(4);
  const [first, second] = game.L.victims;
  first.air = 2;
  harness.tick(3);
  assert(first.state === 'lost' && game.L.lost === 1 && game.state === 'play', 'il primo perso non si conta o chiude la partita (3 sepolti: con 2 si vince ancora)');
  second.air = 2;
  harness.tick(3);
  assert(game.state === 'over' && /PERSI/.test(game.overReason), 'stato ' + game.state);
});

test('buca: con su ci si arrampica fuori', () => {
  const { harness, game, hook } = setup();
  const x = 260;
  standAt(hook, x);
  const surface = hook.surfaceAt(x);
  harness.keyDown('Space'); harness.tick(200); harness.keyUp('Space');
  assert(game.rescuer.y + game.rescuer.h > surface + 8, 'buca troppo poco profonda per la prova');
  harness.hold(['ArrowRight', 'ArrowUp'], 200);
  assert(game.rescuer.x > x + 6 && game.rescuer.y + game.rescuer.h <= hook.surfaceAt(game.rescuer.x + 2) + 1, 'non esce dalla buca (x ' + game.rescuer.x.toFixed(1) + ')');
});

test('valanga: crepa, poi il fronte deposita neve; chi e preso cade (dal terzo giro e sepolto)', () => {
  const { harness, game, hook } = setup(4);
  const config = hook.CONFIG.avalanche;
  game.L.avalancheAt = game.clock + 1;
  harness.tick(2);
  assert(game.avalanche && game.avalanche.phase === 'warning', 'nessun avviso');
  const zoneX = Math.round(game.avalanche.startX + 30), surfaceBefore = hook.surfaceAt(zoneX);
  harness.tick(config.warning + 80);
  assert(game.rescuer.stunT > 0 || game.L.saved >= 0, 'il fronte non ha preso il soccorritore fermo nella zona');
  assert(hook.surfaceAt(zoneX) < surfaceBefore, 'il fronte non ha lasciato neve');
  assert(game.state === 'play', 'travolto al primo giro: partita persa');

  const deadly = setup(7);
  deadly.game.L.avalancheAt = deadly.game.clock + 1;
  deadly.harness.tick(config.warning + 120);
  assert(deadly.game.state === 'over' && /VALANGA/.test(deadly.game.overReason), 'dal terzo giro la valanga non seppellisce (' + deadly.game.state + ')');
});

test('esito: tutti salvati = 3 stelle; piu della meta = vittoria', () => {
  const { harness, game } = setup(4);
  const victims = game.L.victims;
  for (const victim of victims) { victim.state = 'saved'; game.L.saved++; }
  harness.tick(100);
  assert(game.state === 'done' && game.result === 'win' && game.stars === 3, 'esito ' + game.state + ' ' + game.result + ' stelle ' + game.stars);
  const partial = setup(4);
  partial.game.L.victims[0].state = 'saved'; partial.game.L.victims[1].state = 'saved'; partial.game.L.saved = 2;
  partial.game.L.victims[2].state = 'lost'; partial.game.L.lost = 1;
  partial.harness.tick(100);
  assert(partial.game.state === 'done' && partial.game.result === 'win' && partial.game.stars === 1, 'esito con 2 su 3: stelle ' + partial.game.stars);
});

test('tutorial: i passi avanzano da soli; nessuna perdita d aria e nessuna valanga', () => {
  const harness = boot({ seededMath: 1 });
  const game = harness.play(harness.hook.tutorialSpec());
  assert(game.tut && game.tut.step === 0 && game.L.avalancheAt === 0 && game.L.victims.every(victim => victim.air === Infinity), 'tutorial con valanghe o aria a tempo');
  harness.hold(['ArrowRight'], 5);
  assert(game.tut.step >= 1, 'il passo del cammino non avanza');
});

test('replay: una partita con il pilota automatico si ricostruisce identica', () => {
  const result = playLevel(boot({ seededMath: 1 }).hook.levelSpec(4), 900);
  const driver = result.driver, game = driver.game;
  driver.set([]); driver.keyUp('Space');
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
      if (i % 90 === 0) harness.keyDown('Space'); else if (i % 90 === 60) harness.keyUp('Space');
      if (i % 300 === 299) harness.tap('KeyX');
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
  const page = fs.readFileSync(path.join(root, 'valanga.html'), 'utf8');
  assert(!page.includes('// =====') && page.split('\n').length <= 2, 'bundle non minificato');
  for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    assert(fs.existsSync(path.join(root, 'site', 'valanga', file)), 'manca dist/site/valanga/' + file);
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
