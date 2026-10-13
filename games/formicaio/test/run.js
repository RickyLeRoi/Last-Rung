#!/usr/bin/env node
// games/formicaio/test/run.js
'use strict';
const fs = require('fs');
const path = require('path');
const { boot } = require('./helpers');
const { playLevel } = require('./autopilot');

const tests = [];
const test = (name, testBody) => tests.push({ name, fn: testBody });
function assert(condition, message) { if (!condition) throw new Error(message); }

const SOIL = 1, SAND = 2, STONE = 3, WATER = 5;

// A running level (level 1 unless stated) without spiders and showers unless the test wants them.
function setup(levelNumber = 1) {
  const harness = boot({ seededMath: 1 });
  const game = harness.play(harness.hook.levelSpec(levelNumber));
  game.L.spiders = []; game.L.showers = []; game.L.foodSchedule = [];
  return { harness, game, hook: harness.hook };
}
// Holds the keys while the cursor goes to (x, y); with Space the cursor lays a trail on the way.
function moveCursor(harness, x, y, withTrail) {
  const cursor = harness.game.cursor;
  if (withTrail) harness.keyDown('Space'); else harness.keyUp('Space');
  for (let i = 0; i < 400; i++) {
    const keys = [];
    if (x - cursor.x > 1.2) keys.push('ArrowRight'); else if (cursor.x - x > 1.2) keys.push('ArrowLeft');
    if (y - cursor.y > 1.2) keys.push('ArrowDown'); else if (cursor.y - y > 1.2) keys.push('ArrowUp');
    if (!keys.length) break;
    harness.set(keys); harness.tick();
  }
  harness.set([]); harness.keyUp('Space'); harness.tick();
}
const countMaterial = (hook, material, x0, y0, x1, y1) => {
  let count = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (hook.Terrain.get(hook.game.L.terrain, x, y) === material) count++;
  return count;
};
const plainChamber = (hook, x, y) => ({ x, y, r: hook.CONFIG.chamber.radius, type: 'nursery', complete: true });

test('livelli 1-30 e addestramento: nido aperto, ingresso sul centro di una cella, cibo fuori dal nido', () => {
  const { hook } = setup();
  for (const spec of [hook.tutorialSpec(), ...Array.from({ length: 30 }, (_, i) => hook.levelSpec(i + 1))]) {
    hook.startLevel(spec, 0);
    const game = hook.game, level = game.L, queen = level.queenChamber, label = spec.tutorial ? 'addestramento' : 'lv' + spec.n;
    assert(hook.Terrain.get(level.terrain, queen.x, queen.y) === 0, label + ': camera della regina piena');
    assert(hook.cellCenter(hook.cellOf(level.entranceX)) === level.entranceX, label + ': ingresso fuori dal centro della cella');
    assert(hook.isWalkable(hook.cellOf(level.entranceX), hook.cellOf(level.groundY + 6)), label + ': pozzo non percorribile');
    assert(game.ants.length === hook.CONFIG.ants.start, label + ': operaie iniziali ' + game.ants.length);
    assert(level.foods.every(food => Math.abs(food.x - level.entranceX) >= hook.CONFIG.food.minDistance), label + ': cibo sopra il nido');
    assert(countMaterial(hook, STONE, queen.x - 20, queen.y - 20, queen.x + 20, queen.y + 20) === 0, label + ': pietre nel nido');
  }
});

test('pista sotto terra: ordini di scavo, la galleria si apre e il cumulo cresce; la pietra non si scava', () => {
  const { harness, game, hook } = setup();
  const level = game.L, queen = level.queenChamber, surfaceBefore = hook.surfaceAt(level.entranceX + 6);
  moveCursor(harness, queen.x + queen.r - 2, queen.y, false);
  moveCursor(harness, queen.x + 36, queen.y, true);
  const orders = level.digOrder.reduce((sum, value) => sum + value, 0);
  assert(orders >= 6, 'ordini di scavo: ' + orders);
  harness.tick(1500);
  assert(level.dug >= 6, 'celle scavate: ' + level.dug);
  assert(hook.Terrain.get(level.terrain, queen.x + 24, queen.y) === 0, 'galleria non aperta');
  assert(level.moundCells > 0 && hook.surfaceAt(level.entranceX + 6) <= surfaceBefore, 'il cumulo non cresce (' + level.moundCells + ')');
  hook.Terrain.fillCircle(level.terrain, queen.x - 40, queen.y, 6, STONE, false);
  moveCursor(harness, queen.x - 40, queen.y, false);
  moveCursor(harness, queen.x - 40, queen.y + 1, true);
  assert(!level.digOrder[hook.gridIndex(hook.cellOf(queen.x - 40), hook.cellOf(queen.y))], 'ordine di scavo sulla pietra');
  return 'scavate ' + level.dug + ', cumulo ' + level.moundCells;
});

test("pista sull'erba: il cibo vicino diventa noto, le operaie lo portano nel nido; senza rinforzo la pista svanisce", () => {
  const { harness, game, hook } = setup();
  const level = game.L, food = level.foods[0], direction = Math.sign(food.x - level.entranceX);
  moveCursor(harness, level.entranceX + direction * 8, level.groundY - 3, false);
  moveCursor(harness, food.x, hook.surfaceAt(food.x) - 3, true);
  harness.tick(hook.CONFIG.ants.fieldEvery);
  assert(level.knownFood.includes(food), 'il cibo non e noto');
  harness.tick(1500);
  assert(level.delivered > 0, 'nessuna consegna');
  const decay = level.trailDecay;
  level.foods.length = 0;
  game.ants.forEach(ant => { ant.carry = null; });
  harness.tick(Math.ceil((1 - hook.CONFIG.trail.known) / decay) + 30);
  assert(level.pheromone.every(value => value < hook.CONFIG.trail.known), 'la pista non svanisce');
  return 'consegnati ' + level.delivered;
});

test('camere: una camera scavata si completa; la dispensa alza le scorte; la nursery ospita la covata', () => {
  const { harness, game, hook } = setup();
  const level = game.L, queen = level.queenChamber, x = queen.x + 30, y = queen.y + 4;
  moveCursor(harness, queen.x + queen.r - 2, queen.y, false);
  moveCursor(harness, x, queen.y, true);
  moveCursor(harness, x, y, true);
  harness.tap('KeyX');
  const chamber = level.chambers[1];
  assert(chamber && chamber.type === 'nursery' && !chamber.complete, 'camera non creata');
  for (let i = 0; i < 4000 && !chamber.complete; i++) harness.tick();
  assert(chamber.complete, 'camera non completata');
  harness.tap('KeyX');
  assert(chamber.type === 'pantry', 'il secondo tasto non la cambia in dispensa');
  assert(hook.stockCapacity() === hook.CONFIG.chamber.baseStock + hook.CONFIG.chamber.pantryCap, 'capacita delle scorte ' + hook.stockCapacity());
  return 'completa al frame ' + game.frame;
});

test('covata: uovo, larva (mangia due volte), pupa e operaia nei tempi del config; senza posto o senza cibo si ferma', () => {
  const { harness, game, hook } = setup();
  const brood = hook.CONFIG.brood, level = game.L;
  game.ants.forEach(ant => { ant.job = 'home'; });
  level.foods.length = 0;
  game.stock = 10; game.layT = brood.layEvery - 1;
  harness.tick(1);
  assert(game.brood.length === 1 && game.brood[0].stage === 'egg' && game.stock === 9, 'la regina non depone');
  const egg = game.brood[0];
  harness.tick(brood.egg);
  assert(egg.stage === 'larva', 'dopo ' + brood.egg + ' frame: ' + egg.stage);
  harness.tick(1);
  assert(egg.fed === 1, 'la larva non mangia alla schiusa');
  game.stock = 0;
  const waiting = egg.t;
  harness.tick(brood.larva);
  assert(egg.fed === 1 && egg.t <= Math.max(waiting, brood.larva / 2), 'la larva cresce senza cibo (t=' + egg.t + ')');
  game.stock = 10;
  harness.tick(brood.larva + brood.pupa + 5);
  const before = hook.CONFIG.ants.start;
  assert(game.ants.length > before && level.born >= 1, 'nessuna operaia nata (' + game.ants.length + ')');
  game.brood = [];
  game.stock = 50; game.layT = 0;
  harness.tick(brood.layEvery * 6);
  const inQueen = game.brood.filter(item => item.chamber === level.queenChamber).length;
  assert(inQueen <= hook.CONFIG.chamber.queenCap, 'covata oltre il posto nella camera della regina: ' + inQueen);
  return 'nate ' + level.born;
});

test('ragno: mangia la formica isolata, un gruppo lo scaccia, sotto terra non arriva', () => {
  const { harness, game, hook } = setup();
  const level = game.L, x = level.entranceX + 120;
  level.spiders = [{ x, dir: 1, speed: 0, scaredT: 0, eatT: 0 }];
  game.ants.length = 0;
  const lone = hook.spawnAnt(x, hook.surfaceAt(x) - 2);
  lone.job = 'home'; lone.t = 1000;
  assert(lone && hook.cellCenter(lone.cellY) < level.groundY, 'formica non sull erba');
  harness.tick(2);
  assert(!game.ants.includes(lone) && level.lostAnts === 1, 'la formica isolata non e stata mangiata');
  level.spiders[0].eatT = 0;
  for (let i = 0; i < 4; i++) { const ant = hook.spawnAnt(x - 6 + i * 4, hook.surfaceAt(x) - 2); ant.job = 'home'; ant.t = 1000; }
  harness.tick(2);
  assert(level.spiders[0].scaredT > 0 && level.lostAnts === 1, 'il gruppo non scaccia il ragno');
  const deep = hook.spawnAnt(level.queenChamber.x, level.queenChamber.y);
  level.spiders[0] = { x: level.queenChamber.x, dir: 1, speed: 0, scaredT: 0, eatT: 0 };
  deep.t = 1000;
  harness.tick(2);
  assert(game.ants.includes(deep), 'il ragno ha preso una formica sotto terra');
});

test("pioggia: l'acqua entra dall'ingresso e scende; il tappo la ferma; la regina sommersa fa perdere", () => {
  const { harness, game, hook } = setup(2);
  const level = game.L, rain = hook.CONFIG.rain, queen = level.queenChamber;
  level.showers = [{ start: game.clock + 1, end: game.clock + 1 + 600 }];
  harness.tick(300);
  const water = countMaterial(hook, WATER, queen.x - 20, level.groundY, queen.x + 20, queen.y + queen.r + 2);
  assert(water > 0 && game.rain.length > 0, 'nessuna acqua nel pozzo');
  const plugged = setup(2);
  const plugLevel = plugged.game.L;
  moveCursor(plugged.harness, plugLevel.entranceX, plugLevel.groundY + 6, false);
  plugged.harness.tap('KeyC');
  assert(plugLevel.plugs.length === 1, 'tappo non segnato');
  for (let i = 0; i < 2000 && plugLevel.plugs.length; i++) plugged.harness.tick();
  assert(!plugLevel.plugs.length, 'le formiche non hanno messo il tappo');
  plugLevel.showers = [{ start: plugged.game.clock + 1, end: plugged.game.clock + 1 + 600 }];
  plugged.harness.tick(700);
  const below = countMaterial(plugged.hook, WATER, plugLevel.entranceX - 8, plugLevel.groundY + 10, plugLevel.entranceX + 8, plugLevel.height);
  assert(below === 0, 'acqua sotto il tappo: ' + below);
  hook.Terrain.fillCircle(level.terrain, queen.x, queen.y, queen.r, WATER, true);
  harness.tick(rain.queenDrown + 5);
  assert(game.state === 'over' && /REGINA/.test(game.overReason), 'regina sommersa: ' + game.state + ' ' + game.overReason);
});

test('sabbia: crolla nella galleria scavata sotto; una formica sotto la frana viene spinta fuori o si perde', () => {
  const { harness, game, hook } = setup();
  const level = game.L, x = level.queenChamber.x + 40, y = level.queenChamber.y;
  hook.Terrain.fillRect(level.terrain, x - 6, y - 14, 12, 10, SAND);
  hook.Terrain.carveCircle(level.terrain, x, y, 3);
  for (let column = x - 6; column < x + 6; column++) level.looseSand[column] = 1;
  hook.Terrain.fillRect(level.terrain, x - 6, y - 4, 12, 2, 0);
  for (let column = x - 6; column < x + 6; column++) level.looseSand[column] = 1;
  game.ants.length = 0;
  const buried = hook.spawnAnt(x, y);
  buried.job = 'home'; buried.t = 1000;
  harness.tick(30);
  assert(countMaterial(hook, SAND, x - 6, y - 3, x + 6, y + 4) > 0, 'la sabbia non e caduta');
  const alive = game.ants.includes(buried);
  assert(alive ? hook.cellMaterial(buried.cellX, buried.cellY) === 0 : level.lostAnts === 1, 'formica dentro la sabbia senza essere spinta fuori');
  return alive ? 'spinta fuori' : 'persa sotto la frana';
});

test('richiamo: niente nuove raccoglitrici finche e attivo; si spegne con lo stesso tasto', () => {
  const { harness, game, hook } = setup();
  const level = game.L, food = level.foods[0];
  harness.tap('KeyZ');
  assert(game.recall, 'Z non attiva il richiamo');
  for (let cellX = hook.cellOf(Math.min(food.x, level.entranceX)); cellX <= hook.cellOf(Math.max(food.x, level.entranceX)); cellX++) level.pheromone[hook.gridIndex(cellX, hook.cellOf(level.groundY - 3))] = 1;
  harness.tick(600);
  assert(!game.ants.some(ant => ant.job === 'forage' && !ant.carry), 'raccoglitrici al lavoro durante il richiamo');
  harness.tap('KeyZ');
  harness.tick(300);
  assert(!game.recall && game.ants.some(ant => ant.job === 'forage'), 'nessuna raccoglitrice dopo il richiamo');
});

test("fine: a fine stagione vince solo con l'obiettivo, le stelle seguono le regole; colonia estinta = game over", () => {
  const { harness, game, hook } = setup();
  const level = game.L;
  game.clock = level.season - 1;
  harness.tick(70);
  assert(game.state === 'done' && game.result === 'fail' && game.stars === 0, 'sotto obiettivo: ' + game.state + ' ' + game.result);
  const second = setup();
  const secondLevel = second.game.L;
  while (second.game.ants.length < secondLevel.target) second.hook.spawnAnt(secondLevel.queenChamber.x, secondLevel.queenChamber.y);
  second.game.clock = secondLevel.season - 1;
  second.harness.tick(70);
  assert(second.game.result === 'win' && second.game.stars === 2, 'obiettivo senza perdite: ' + second.game.result + ' ' + second.game.stars + ' stelle');
  const third = setup();
  while (third.game.ants.length < Math.ceil(third.game.L.target * 1.5)) third.hook.spawnAnt(third.game.L.queenChamber.x, third.game.L.queenChamber.y);
  third.harness.tick(70);
  assert(third.game.state === 'done' && third.game.stars === 3, 'una volta e mezza: ' + third.game.state + ' ' + third.game.stars);
  const fourth = setup();
  fourth.game.ants.length = 0; fourth.game.brood = []; fourth.game.stock = 0;
  fourth.harness.tick(2);
  assert(fourth.game.state === 'over', 'colonia estinta: ' + fourth.game.state);
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
  return result.workers + '/' + result.target + ' operaie, ' + result.stars + ' stelle';
});

test('build: bundle e pagina presenti, minificati, con manifest e icone', () => {
  const root = path.join(__dirname, '..', '..', '..', 'dist');
  const page = fs.readFileSync(path.join(root, 'formicaio.html'), 'utf8');
  assert(!page.includes('// =====') && page.split('\n').length <= 2, 'bundle non minificato');
  for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    assert(fs.existsSync(path.join(root, 'site', 'formicaio', file)), 'manca dist/site/formicaio/' + file);
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
