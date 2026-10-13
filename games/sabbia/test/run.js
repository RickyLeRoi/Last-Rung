#!/usr/bin/env node
// games/sabbia/test/run.js
'use strict';
const fs = require('fs');
const path = require('path');
const { boot } = require('./helpers');

const tests = [];
const test = (name, testBody) => tests.push({ name, fn: testBody });
function assert(condition, message) { if (!condition) throw new Error(message); }

// An empty laboratory: build a scene with put(), let it run with run(frames). The brush stays still and paints nothing.
function laboratory() {
  const harness = boot({ seededMath: 1, skipRender: true });
  harness.play(harness.hook.labSpec());
  const hook = harness.hook, game = hook.game, world = game.L.world, M = hook.MATERIAL;
  const put = (x, y, width, height, id, temperature) => {
    for (let row = y; row < y + height; row++) for (let column = x; column < x + width; column++) hook.setCell(world, hook.cellIndex(column, row), id, temperature);
    hook.countMaterials(world);
  };
  const at = (x, y) => world.material[hook.cellIndex(x, y)];
  const heatAt = (x, y) => world.temperature[hook.cellIndex(x, y)];
  const count = id => world.counts[id];
  const run = frames => harness.tick(frames);
  return { harness, hook, game, world, M, put, at, heatAt, count, run };
}
const COLUMNS = 192, ROWS = 96;

test('sabbia: cade, si ammucchia a cumulo e non si perde', () => {
  const { M, put, at, count, run } = laboratory();
  put(94, 0, 4, 30, M.sand);
  run(400);
  assert(count(M.sand) === 120, 'sabbia persa: ' + count(M.sand));
  let peak = 0;
  for (let y = 0; y < ROWS; y++) if (at(95, y) === M.sand) { peak = ROWS - y; break; }
  let base = 0;
  for (let x = 0; x < COLUMNS; x++) if (at(x, ROWS - 1) === M.sand) base++;
  assert(peak >= 4 && base > peak, 'non e un cumulo: altezza ' + peak + ', base ' + base);
  return 'altezza ' + peak + ', base ' + base;
});

test("acqua: scende e si stende sul fondo; la sabbia ci affonda", () => {
  const { M, put, at, count, run } = laboratory();
  put(80, 10, 30, 10, M.water);
  run(600);
  assert(count(M.water) === 300, 'acqua persa: ' + count(M.water));
  for (let x = 0; x < COLUMNS; x++) assert(at(x, ROWS - 1) === M.water, 'il fondo non e coperto alla colonna ' + x);
  put(96, 60, 2, 2, M.sand);
  run(200);
  assert(at(96, ROWS - 1) === M.sand || at(97, ROWS - 1) === M.sand || at(95, ROWS - 1) === M.sand, 'la sabbia non affonda nell acqua');
});

test('gas: vapore e aria calda salgono, aria fredda scende', () => {
  const { M, put, world, hook, run } = laboratory();
  put(40, 60, 4, 4, M.steam, 300);
  put(100, 60, 4, 4, M.hotAir, 1000);
  put(150, 20, 4, 4, M.coldAir, -500);
  run(30);
  const rows = id => { const found = []; for (let index = 0; index < world.material.length; index++) if (world.material[index] === id) found.push(Math.floor(index / COLUMNS)); return found; };
  const mean = list => list.reduce((sum, value) => sum + value, 0) / list.length;
  assert(mean(rows(M.steam)) < 55, 'il vapore non sale: ' + mean(rows(M.steam)).toFixed(1));
  assert(mean(rows(M.hotAir)) < 55, "l'aria calda non sale: " + mean(rows(M.hotAir)).toFixed(1));
  assert(mean(rows(M.coldAir)) > 26, "l'aria fredda non scende: " + mean(rows(M.coldAir)).toFixed(1));
});

test("ferro: porta il calore da un capo all'altro, il legno no", () => {
  const { M, put, heatAt, run } = laboratory();
  put(20, 80, 60, 2, M.iron);
  put(20, 90, 60, 2, M.wood);
  for (let i = 0; i < 300; i++) { put(20, 78, 2, 2, M.iron, 900); put(20, 88, 2, 2, M.wood, 200); run(1); }
  assert(heatAt(35, 80) > 60, 'il ferro non si scalda a 15 celle dalla fonte: ' + heatAt(35, 80).toFixed(1));
  assert(heatAt(35, 90) < 25, 'il legno conduce troppo: ' + heatAt(35, 90).toFixed(1));
  return 'a 15 celle: ferro ' + heatAt(35, 80).toFixed(0) + ' gradi, legno ' + heatAt(35, 90).toFixed(0);
});

test("pentola di ferro con acqua e fuoco sotto: il vapore esce e l'acqua finisce", () => {
  const { M, put, count, run } = laboratory();
  put(80, 60, 2, 24, M.iron); put(110, 60, 2, 24, M.iron); put(80, 84, 32, 2, M.iron);
  put(82, 70, 28, 14, M.water);
  const initial = count(M.water);
  let steamSeen = 0;
  for (let frame = 0; frame < 6000 && count(M.water) > initial * 0.05; frame++) {
    if (frame % 20 === 0) put(84, 88, 24, 4, M.fire);
    run(1);
    steamSeen = Math.max(steamSeen, count(M.steam));
  }
  assert(steamSeen > 20, 'niente vapore: ' + steamSeen);
  assert(count(M.water) <= initial * 0.05, "l'acqua non e finita: " + count(M.water) + '/' + initial);
  return 'acqua ' + initial + ' -> ' + count(M.water);
});

test("erba: toccata dal fuoco brucia tutta; il legno brucia piu a lungo", () => {
  const { M, put, count, run } = laboratory();
  put(10, 90, 170, 2, M.grass);
  put(10, 88, 2, 2, M.fire);
  for (let frame = 0; frame < 2000 && count(M.grass); frame++) run(1);
  assert(count(M.grass) === 0, 'erba rimasta: ' + count(M.grass));
  const wood = laboratory();
  wood.put(90, 80, 4, 4, wood.M.wood, 400);
  wood.run(150);
  const grass = laboratory();
  grass.put(90, 80, 4, 4, grass.M.grass, 400);
  grass.run(150);
  assert(wood.count(wood.M.fire) > 0 && grass.count(grass.M.fire) === 0, 'dopo 150 frame: fuoco del legno ' + wood.count(wood.M.fire) + ', dell erba ' + grass.count(grass.M.fire));
});

test("fuoco e acqua: l'acqua diventa vapore e il fuoco si spegne; il fuoco morente lascia aria calda", () => {
  const { M, put, count, run } = laboratory();
  put(90, 92, 4, 4, M.water);
  put(90, 88, 4, 4, M.fire);
  run(3);
  assert(count(M.steam) > 0, 'nessun vapore');
  assert(count(M.fire) < 16, 'il fuoco non si spegne: ' + count(M.fire));
  const alone = laboratory();
  alone.put(90, 90, 2, 2, alone.M.fire);
  let hot = 0;
  for (let frame = 0; frame < 300; frame++) { alone.run(1); hot = Math.max(hot, alone.count(alone.M.hotAir)); }
  assert(alone.count(alone.M.fire) === 0 && hot > 0, 'fuoco ' + alone.count(alone.M.fire) + ', aria calda vista ' + hot);
});

test("aria fredda: spegne il fuoco e fa condensare il vapore; l'aria calda e quella fredda svaniscono", () => {
  const { M, put, count, run } = laboratory();
  put(90, 90, 4, 4, M.fire);
  put(90, 86, 4, 4, M.coldAir);
  run(3);
  assert(count(M.fire) < 16, 'il fuoco non si spegne');
  const rain = laboratory();
  rain.put(90, 40, 6, 3, rain.M.steam, 150);
  rain.put(90, 30, 6, 6, rain.M.coldAir);
  rain.run(20);
  assert(rain.count(rain.M.water) > 0, 'il vapore non condensa');
  const fade = laboratory();
  fade.put(90, 60, 3, 3, fade.M.hotAir);
  fade.put(40, 10, 3, 3, fade.M.coldAir);
  fade.run(3000);
  assert(fade.count(fade.M.hotAir) === 0 && fade.count(fade.M.coldAir) === 0, 'calda ' + fade.count(fade.M.hotAir) + ', fredda ' + fade.count(fade.M.coldAir));
});

test("acido: scioglie erba, legno e sabbia, il ferro molto piu piano, e si consuma; nell'acqua si diluisce", () => {
  const eats = (material, frames) => {
    const lab = laboratory();
    lab.put(80, 80, 30, 16, lab.M[material]);
    const before = lab.count(lab.M[material]);
    lab.put(80, 60, 30, 4, lab.M.acid);
    lab.run(frames);
    return { eaten: before - lab.count(lab.M[material]), acid: lab.count(lab.M.acid) };
  };
  const grass = eats('grass', 300), wood = eats('wood', 300), sand = eats('sand', 300), iron = eats('iron', 300);
  assert(grass.eaten > 0 && wood.eaten > 0 && sand.eaten > 0, 'erba ' + grass.eaten + ', legno ' + wood.eaten + ', sabbia ' + sand.eaten);
  assert(iron.eaten < wood.eaten, 'il ferro si scioglie quanto il legno: ' + iron.eaten + ' contro ' + wood.eaten);
  assert(grass.acid < 120, "l'acido non si consuma: " + grass.acid);
  const dilute = laboratory();
  dilute.put(60, 80, 70, 16, dilute.M.water);
  dilute.put(90, 70, 6, 4, dilute.M.acid);
  dilute.run(2000);
  assert(dilute.count(dilute.M.acid) < 24, "l'acido non si diluisce: " + dilute.count(dilute.M.acid));
  return 'mangiati in 300 frame: erba ' + grass.eaten + ', legno ' + wood.eaten + ', sabbia ' + sand.eaten + ', ferro ' + iron.eaten;
});

test('cielo aperto: il vapore che arriva in cima se ne va', () => {
  const { M, put, count, run } = laboratory();
  put(80, 20, 20, 4, M.steam, 300);
  run(1500);
  assert(count(M.steam) + count(M.water) < 80, 'vapore e acqua rimasti: ' + (count(M.steam) + count(M.water)));
});

test('pennello: dipinge solo nella zona e nelle celle libere, consuma il materiale, la gomma non tocca la scena', () => {
  const harness = boot({ seededMath: 1, skipRender: true });
  const hook = harness.hook, game = harness.play(hook.levelSpec(1)), level = game.L, world = level.world, M = hook.MATERIAL;
  const budget = level.budget[M.sand];
  harness.keyDown('Space'); harness.tick(10); harness.keyUp('Space');
  assert(level.budget[M.sand] < budget && level.budget[M.sand] === budget - (world.counts[M.sand]), 'budget ' + budget + ' -> ' + level.budget[M.sand] + ', sabbia ' + world.counts[M.sand]);
  game.cursor.x = 150; game.cursor.y = 60;
  const before = world.counts[M.sand];
  harness.keyDown('Space'); harness.tick(5); harness.keyUp('Space');
  assert(world.counts[M.sand] === before, 'ha dipinto fuori dalla zona');
  const lab = boot({ seededMath: 1, skipRender: true });
  const labGame = lab.play(lab.hook.labSpec());
  lab.hook.game.L.world.locked[lab.hook.cellIndex(96, 30)] = 1;
  lab.hook.setCell(labGame.L.world, lab.hook.cellIndex(96, 31), M.iron);
  labGame.L.world.material[lab.hook.cellIndex(96, 30)] = M.iron;
  labGame.L.world.locked[lab.hook.cellIndex(96, 30)] = 1;
  labGame.selected = labGame.L.palette.length - 1;
  labGame.cursor.x = 96; labGame.cursor.y = 30;
  lab.keyDown('Space'); lab.tick(2); lab.keyUp('Space');
  assert(labGame.L.world.material[lab.hook.cellIndex(96, 30)] === M.iron, 'la gomma ha tolto una cella della scena');
  assert(labGame.L.world.material[lab.hook.cellIndex(96, 31)] === M.empty, 'la gomma non toglie il ferro dipinto');
});

test('sfide 1-12, sfida del giorno e addestramento: scene costruite, obiettivi a zero, budget che cala ai giri successivi', () => {
  const harness = boot({ seededMath: 1, skipRender: true }), hook = harness.hook;
  for (const spec of [hook.tutorialSpec(), hook.dailySpec('2026-10-13'), ...Array.from({ length: 12 }, (_, i) => hook.levelSpec(i + 1))]) {
    hook.startLevel(spec, 0);
    const level = hook.game.L, label = spec.tutorial ? 'addestramento' : 'sfida ' + spec.n;
    assert(level.palette.length >= 1, label + ': palette vuota');
    if (!level.goal) continue;
    assert(level.goal.progress() < 1, label + ': obiettivo gia raggiunto (' + level.goal.progress() + ')');
    assert(level.time > 0 && level.time < Infinity, label + ': tempo ' + level.time);
  }
  hook.startLevel(hook.levelSpec(1), 0); const first = Object.values(hook.game.L.budget)[0];
  hook.startLevel(hook.levelSpec(7), 0); const second = Object.values(hook.game.L.budget)[0];
  assert(second < first, 'il budget non cala al secondo giro: ' + first + ' -> ' + second);
});

test('replay: stesso seme e stessi input, stesso mondo', () => {
  const harness = boot({ seededMath: 1, skipRender: true }), hook = harness.hook, game = harness.play(hook.levelSpec(2));
  for (let i = 0; i < 400; i++) { harness.set(i % 50 < 25 ? ['ArrowRight'] : ['ArrowLeft']); if (i % 3) harness.keyDown('Space'); else harness.keyUp('Space'); if (i === 100) harness.tap('KeyX'); else harness.tick(); }
  harness.set([]); harness.keyUp('Space');
  const hash = harness.stateHash({ ignoreState: true });
  game.state = 'done';
  hook.startReplay();
  for (let i = 0; i < 2000 && game.state === 'replay'; i++) harness.tick();
  assert(harness.stateHash({ ignoreState: true }) === hash, 'il replay diverge');
});

test('prestazioni: un passo con meta della griglia in movimento resta sotto i 4 ms', () => {
  const { M, put, run } = laboratory();
  put(0, 0, 192, 20, M.sand); put(0, 20, 192, 20, M.water); put(0, 60, 192, 6, M.wood); put(40, 70, 100, 10, M.fire); put(0, 85, 192, 6, M.steam);
  run(30);
  const start = process.hrtime.bigint();
  run(200);
  const perFrame = Number(process.hrtime.bigint() - start) / 1e6 / 200;
  assert(perFrame < 4, perFrame.toFixed(2) + ' ms per frame');
  return perFrame.toFixed(2) + ' ms per frame';
});

test('build: bundle e pagina presenti, minificati, con manifest e icone', () => {
  const root = path.join(__dirname, '..', '..', '..', 'dist');
  const page = fs.readFileSync(path.join(root, 'sabbia.html'), 'utf8');
  assert(!page.includes('// =====') && page.split('\n').length <= 2, 'bundle non minificato');
  for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    assert(fs.existsSync(path.join(root, 'site', 'sabbia', file)), 'manca dist/site/sabbia/' + file);
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
