#!/usr/bin/env node
// games/abisso/test/run.js
'use strict';
const fs = require('fs');
const path = require('path');
const { boot } = require('./helpers');
const { playLevel, clearanceGrid, findPath } = require('./autopilot');

const tests = [];
const test = (name, testBody) => tests.push({ name, fn: testBody });
function assert(condition, message) { if (!condition) throw new Error(message); }

const ROCK = 1;

// A running level (1 unless stated). The sub is moved by hand where a test needs it.
function setup(levelNumber = 1) {
  const harness = boot({ seededMath: 1, skipRender: true });
  const game = harness.play(harness.hook.levelSpec(levelNumber));
  return { harness, game, hook: harness.hook };
}
// Puts the sub at the centre (x, y), still.
function placeSub(game, x, y) {
  const sub = game.sub;
  sub.x = x - sub.w / 2; sub.y = y - sub.h / 2; sub.vx = 0; sub.vy = 0;
}

test('livelli 1-30 e addestramento: sub raggiungibili dal punto di partenza, aria e batteria coerenti', () => {
  const { hook } = setup();
  const specs = [hook.tutorialSpec(), ...Array.from({ length: 30 }, (_, i) => hook.levelSpec(i + 1))];
  let checked = 0;
  for (const spec of specs) {
    hook.startLevel(spec, 0);
    const level = hook.game.L, label = spec.tutorial ? 'addestramento' : 'lv' + spec.n;
    const grid = clearanceGrid(hook);
    assert(level.divers.length >= 1 && level.divers.length <= hook.CONFIG.diver.max, label + ': sub ' + level.divers.length);
    for (const diver of level.divers) {
      assert(findPath(grid, hook.subCenterX(), hook.subCenterY(), ...hook.diverCenter(diver)), label + ': sub irraggiungibile a ' + diver.x + ',' + diver.y);
      assert(!hook.Terrain.isSolid(level.terrain, diver.x + 4, diver.y + 2), label + ': sub dentro la roccia');
      assert(diver.air > 0, label + ': aria ' + diver.air);
      checked++;
    }
  }
  return checked + ' sub controllati';
});

test('movimento: i propulsori accelerano con inerzia, la velocita e limitata, la corrente spinge', () => {
  const { harness, game, hook } = setup();
  const sub = game.sub;
  placeSub(game, 120, 60);
  harness.set(['ArrowRight']);
  harness.tick(30);
  const speedAfter = sub.vx;
  assert(speedAfter > 0.4, 'accelera poco: ' + speedAfter.toFixed(2));
  harness.set([]);
  harness.tick(20);
  assert(sub.vx > 0 && sub.vx < speedAfter, 'niente inerzia: ' + sub.vx.toFixed(2));
  harness.set(['ArrowRight', 'ArrowDown']);
  harness.tick(300);
  assert(Math.hypot(sub.vx, sub.vy) <= hook.CONFIG.sub.maxSpeed + 1e-6, 'oltre la velocita massima: ' + Math.hypot(sub.vx, sub.vy).toFixed(2));
  const trench = setup(3), tgame = trench.game, current = tgame.L.currents[0];
  placeSub(tgame, current.x + 200, current.y + current.h / 2);
  trench.harness.tick(60);
  assert(Math.sign(tgame.sub.vx) === Math.sign(current.ax) && Math.abs(tgame.sub.vx) > 0.5, 'la corrente non spinge: vx ' + tgame.sub.vx.toFixed(2));
});

test('pareti: il sommergibile non le attraversa, nemmeno quelle sottili; sotto la soglia non si danneggia', () => {
  const { harness, game, hook } = setup();
  const level = game.L, sub = game.sub;
  hook.Terrain.fillRect(level.terrain, 160, 30, 2, 80, ROCK);
  placeSub(game, 120, 70);
  sub.vx = 1.5; harness.set(['ArrowRight']);
  harness.tick(80);
  assert(sub.x + sub.w <= 160.01, 'ha attraversato la parete sottile: x ' + (sub.x + sub.w).toFixed(1));
  const hull = sub.hull;
  harness.set([]);
  placeSub(game, 140, 70); sub.vx = 0.5;
  harness.tick(40);
  assert(sub.hull === hull, 'danno sotto la soglia: ' + sub.hull.toFixed(3));
});

test('urti: sopra la soglia di velocita rovinano lo scafo (in proporzione) e staccano detriti; a scafo zero e game over', () => {
  const { harness, game, hook } = setup();
  const level = game.L, sub = game.sub;
  hook.Terrain.fillRect(level.terrain, 200, 30, 6, 80, ROCK);
  placeSub(game, 150, 70);
  sub.vx = hook.CONFIG.sub.maxSpeed; harness.set(['ArrowRight']);
  harness.tick(40);
  const expected = (hook.CONFIG.sub.maxSpeed - hook.CONFIG.sub.damageSpeed) * hook.CONFIG.sub.damagePerSpeed / 100;
  assert(sub.hull < 1 && Math.abs((1 - sub.hull) - expected) < 0.06, 'danno ' + (1 - sub.hull).toFixed(3) + ' atteso ' + expected.toFixed(3));
  assert(game.parts.some(particle => particle.t === 'chunk'), 'nessun detrito');
  sub.hull = 0.01; sub.vx = 1.5; sub.x = 190;
  harness.tick(10);
  assert(game.state === 'over' && /SCAFO/.test(game.overReason), 'scafo a zero: ' + game.state + ' ' + game.overReason);
});

test('sonar: ha ricarica e costa batteria; rivela i sub nell anello e non quelli lontani', () => {
  const { harness, game, hook } = setup();
  const sub = game.sub, near = game.L.divers[0], far = game.L.divers[game.L.divers.length - 1];
  const [nearX, nearY] = hook.diverCenter(near);
  placeSub(game, nearX + 60, nearY - 20);
  near.found = false; far.found = false;
  const battery = sub.battery;
  harness.tap('Space');
  assert(sub.sonarT > 0 && sub.battery <= battery - hook.CONFIG.battery.sonar + 0.05, 'ricarica o costo mancanti: ' + sub.sonarT + ', batteria ' + (battery - sub.battery).toFixed(2));
  harness.tick(60);
  assert(near.found, 'il sonar non rivela il sub vicino');
  assert(!far.found || Math.hypot(...hook.diverCenter(far).map((value, i) => value - [hook.subCenterX(), hook.subCenterY()][i])) < hook.CONFIG.sonar.range + 40, 'rivela un sub fuori portata');
  const before = sub.battery;
  harness.tap('Space');
  assert(before - sub.battery < hook.CONFIG.battery.sonar / 2, 'secondo sonar durante la ricarica');
});

test('visibilita: pareti e sub entrano nella memoria solo se illuminati; il faro spento non illumina', () => {
  const { harness, game, hook } = setup();
  const level = game.L, sub = game.sub;
  placeSub(game, 110, 90);
  harness.tick(2);
  const seenAt = (x, y) => level.seen[hook.cellOfPixel(y) * level.seenWidth + hook.cellOfPixel(x)];
  assert(seenAt(110, 90), 'l alone intorno al sub non e visto');
  assert(!seenAt(110, 300), 'una zona lontana e gia vista');
  sub.face = 1; sub.lamp = true; sub.vx = 0; sub.vy = 0;
  harness.tick(2);
  const lit = seenAt(110 + 80, 90);
  sub.lamp = false;
  placeSub(game, 110, 150);
  harness.tick(2);
  assert(lit && !seenAt(110 + 80, 150), 'cono del faro: acceso ' + lit + ', spento ' + seenAt(110 + 80, 150));
});

test('batteria: propulsori, faro e sonar la consumano; a zero si sale piano e il faro si spegne', () => {
  const { harness, game, hook } = setup();
  const sub = game.sub;
  const start = sub.battery;
  placeSub(game, 110, 100);
  harness.set(['ArrowDown']); harness.tick(120); harness.set([]);
  const afterThrust = sub.battery;
  assert(afterThrust < start, 'i propulsori non consumano');
  sub.lamp = false; placeSub(game, 110, 100); harness.tick(60);
  const lampOff = afterThrust - sub.battery;
  sub.lamp = true; placeSub(game, 110, 100); const beforeLamp = sub.battery; harness.tick(60);
  assert(beforeLamp - sub.battery > lampOff, 'il faro non consuma');
  sub.battery = 0.001;
  harness.set([]); harness.tick(5);
  assert(!sub.lamp && sub.battery === 0, 'a batteria scarica il faro resta acceso');
  const open = setup(3), openSub = open.game.sub;
  placeSub(open.game, 380, 250);
  openSub.battery = 0;
  open.harness.tick(240);
  assert(openSub.y < 250 - 40, 'senza batteria non risale: y ' + openSub.y.toFixed(1));
  open.harness.set(['ArrowDown']); open.harness.tick(30); open.harness.set([]);
  assert(openSub.vy < 0.1, 'senza batteria i propulsori funzionano');
});

test('sub: salgono a bordo se ci si ferma accanto (due posti), non se si va veloci; scendono alla nave e contano', () => {
  const { harness, game, hook } = setup();
  const level = game.L, sub = game.sub, [first, second, third] = level.divers;
  const move = diver => { const [x, y] = hook.diverCenter(diver); placeSub(game, x, y - 9); };
  move(first); sub.vx = 1.2;
  harness.tick(1);
  assert(first.state === 'waiting', 'e salito a bordo andando veloce');
  sub.vx = 0; sub.vy = 0; move(first);
  harness.tick(2);
  assert(first.state === 'aboard' && sub.aboard.length === 1, 'non sale a bordo da fermo');
  move(second); harness.tick(2);
  assert(second.state === 'aboard' && sub.aboard.length === 2, 'il secondo non sale');
  move(third); harness.tick(2);
  assert(third.state === 'waiting' && sub.aboard.length === 2, 'e salito il terzo con due posti');
  const score = game.score;
  placeSub(game, hook.CONFIG.ship.x + hook.CONFIG.ship.width / 2, hook.CONFIG.world.surface + 8);
  harness.tick(2);
  assert(first.state === 'saved' && second.state === 'saved' && level.saved === 2 && sub.aboard.length === 0, 'non scendono alla nave');
  assert(game.score === score + 2 * hook.CONFIG.score.saved, 'punti ' + (game.score - score));
});

test('aria: a zero il sub e perso; se non si puo piu vincere e game over; l esito e le stelle', () => {
  const { harness, game, hook } = setup();
  const level = game.L;
  level.divers[0].air = 1;
  harness.tick(3);
  assert(level.divers[0].state === 'lost' && level.lost === 1, 'il sub non e perso');
  level.divers[1].air = 1;
  harness.tick(3);
  assert(game.state === 'over' && /PERSI/.test(game.overReason), 'troppi persi: ' + game.state + ' ' + game.overReason);
  const win = setup();
  win.game.L.divers.forEach(diver => { diver.state = 'saved'; win.game.L.saved++; });
  win.harness.tick(80);
  assert(win.game.state === 'done' && win.game.result === 'win' && win.game.stars === 3, 'tutti salvi: ' + win.game.state + ' ' + win.game.stars);
  const hurt = setup();
  hurt.game.L.divers.forEach(diver => { diver.state = 'saved'; hurt.game.L.saved++; });
  hurt.game.sub.minHull = 0.4;
  hurt.harness.tick(80);
  assert(hurt.game.stars === 2, 'scafo sotto la meta: stelle ' + hurt.game.stars);
});

test('limo: un urto sul fondo sopra la velocita minima solleva una nube che dura qualche secondo', () => {
  const { harness, game, hook } = setup();
  const level = game.L, sub = game.sub;
  hook.Terrain.fillRect(level.terrain, 100, 130, 60, 4, hook.CONFIG.material.silt);
  hook.Terrain.fillRect(level.terrain, 100, 134, 60, 40, ROCK);
  placeSub(game, 130, 100);
  sub.vy = 1.3; harness.set(['ArrowDown']);
  harness.tick(60);
  assert(game.silt.length > 0, 'nessuna nube di limo');
  harness.set([]);
  harness.tick(hook.CONFIG.silt.life + 5);
  assert(game.silt.length === 0, 'la nube non si dirada');
});

test('pilota automatico: addestramento e livello 1 vinti; il replay ricostruisce la stessa partita', () => {
  const tutorial = playLevel(boot({ seededMath: 1 }).hook.tutorialSpec());
  assert(tutorial.state === 'done' && tutorial.result === 'win', 'addestramento: ' + tutorial.state + ' ' + tutorial.reason);
  const result = playLevel(boot({ seededMath: 1 }).hook.levelSpec(1));
  assert(result.state === 'done' && result.result === 'win', 'livello 1: ' + result.state + ' ' + result.reason);
  const driver = result.driver, hash = driver.stateHash({ ignoreState: true });
  driver.hook.startReplay();
  for (let i = 0; i < 40000 && driver.game.state === 'replay'; i++) driver.tick();
  assert(driver.stateHash({ ignoreState: true }) === hash, 'il replay diverge');
  return result.saved + '/' + result.total + ' sub, ' + result.stars + ' stelle';
});

test('build: bundle e pagina presenti, minificati, con manifest e icone', () => {
  const root = path.join(__dirname, '..', '..', '..', 'dist');
  const page = fs.readFileSync(path.join(root, 'abisso.html'), 'utf8');
  assert(!page.includes('// =====') && page.split('\n').length <= 2, 'bundle non minificato');
  for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    assert(fs.existsSync(path.join(root, 'site', 'abisso', file)), 'manca dist/site/abisso/' + file);
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
