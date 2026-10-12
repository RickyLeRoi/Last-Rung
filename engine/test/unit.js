// engine/test/unit.js
'use strict';
const zlib = require('zlib');
const { loadScripts, fakeDom } = require('./load');
const { encodeGrayscalePng } = require('../tools/png');

const tests = [];
const test = (name, testBody) => tests.push({ name, fn: testBody });
function assert(condition, message) { if (!condition) throw new Error(message); }
function assertEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual), expectedText = JSON.stringify(expected);
  assert(actualText === expectedText, (label || 'valore') + ': atteso ' + expectedText + ', ottenuto ' + actualText);
}

const util = () => loadScripts(['engine/core/util.js'], ['Rng', 'hashString', 'clamp', 'overlap']);

test('Rng: sequenza fissata per due seed', () => {
  const { Rng } = util();
  Rng.seed(1);
  assertEqual(Array.from({ length: 5 }, () => Rng.next()), [0.6270739405881613, 0.002735721180215478, 0.5274470399599522, 0.9810509674716741, 0.9683778982143849], 'seed 1');
  Rng.seed(0x5bd1e995);
  assertEqual(Array.from({ length: 5 }, () => Rng.next()), [0.6892725960351527, 0.35055600153282285, 0.80590939684771, 0.009658889146521688, 0.6996622360311449], 'seed 0x5bd1e995');
});

test('hashString: valori fissati', () => {
  const { hashString } = util();
  assertEqual(hashString('last-rung-2026-10-12'), 3874880777);
  assertEqual(hashString(''), 2166136261);
});

test('clamp e overlap (i bordi che si toccano non si sovrappongono)', () => {
  const { clamp, overlap } = util();
  assertEqual([clamp(-1, 0, 5), clamp(3, 0, 5), clamp(9, 0, 5)], [0, 3, 5]);
  const base = { x: 0, y: 0, w: 10, h: 10 };
  assert(overlap(base, { x: 5, y: 5, w: 10, h: 10 }), 'rettangoli sovrapposti');
  assert(!overlap(base, { x: 10, y: 0, w: 5, h: 5 }), 'bordo destro a contatto');
  assert(!overlap(base, { x: 0, y: 10, w: 5, h: 5 }), 'bordo inferiore a contatto');
});

test('sprite: makeSprite e outlineSprite', () => {
  const { makeSprite, outlineSprite } = loadScripts(['engine/gfx/sprite.js'], ['makeSprite', 'outlineSprite']);
  assertEqual(makeSprite(['#.', '.#']), { w: 2, h: 2, p: [0, 0, 1, 1] });
  const square = makeSprite(['###', '###', '###']);
  const outline = outlineSprite(square);
  assertEqual(outline.p.length / 2, 8, 'pixel del contorno');
  assert(!outline.p.some((value, i) => i % 2 === 0 && value === 1 && outline.p[i + 1] === 1), 'il centro deve sparire');
});

test('encodeGrayscalePng: firma, IHDR e pixel', () => {
  const pixels = Uint8Array.from([0, 128, 255, 255, 128, 0]);
  const png = encodeGrayscalePng(3, 2, pixels);
  assertEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'firma');
  assertEqual([png.readUInt32BE(16), png.readUInt32BE(20), png[24], png[25]], [3, 2, 8, 0], 'IHDR');
  const idatLength = png.readUInt32BE(33);
  assertEqual(png.subarray(37, 41).toString(), 'IDAT');
  const scanlines = zlib.inflateSync(png.subarray(41, 41 + idatLength));
  assertEqual([...scanlines], [0, 0, 128, 255, 0, 255, 128, 0], 'scanline con byte di filtro');
});

test('geometry: bresenham visita gli estremi e withBounds calcola il riquadro', () => {
  const { bresenham, withBounds } = loadScripts(['engine/core/geometry.js'], ['bresenham', 'withBounds']);
  const visited = [];
  bresenham(0, 0, 3, 1, (x, y, index) => visited.push([x, y, index]));
  assertEqual(visited, [[0, 0, 0], [1, 0, 1], [2, 1, 2], [3, 1, 3]], 'punti');
  const reversed = [];
  bresenham(3.4, 1, 0, 0, (x, y) => reversed.push([x, y]));
  assertEqual([reversed[0], reversed[reversed.length - 1]], [[3, 1], [0, 0]], 'estremi arrotondati');
  const bounded = withBounds({ pts: [4, 9, 2, 7, 6, 8] });
  assertEqual([bounded.x0, bounded.x1, bounded.y0, bounded.y1], [2, 6, 7, 9], 'riquadro');
});

test('Replay.codec: codifica e decodifica identiche', () => {
  const { Replay } = loadScripts(['engine/core/util.js', 'engine/core/replay.js'], ['Replay']);
  const codec = Replay.codec({ axes: ['hx', 'winch'], flags: ['stab', 'drop', 'buoy'] });
  const frame = codec.encode({ hx: -0.25, winch: 1, stab: true, drop: false, buoy: true });
  assertEqual(frame, [-25, 100, 5], 'frame');
  assertEqual(codec.decode(frame), { hx: -0.25, winch: 1, stab: true, drop: false, buoy: true }, 'decode');
});

test('Camera: segue il bersaglio restando nel mondo, il tremolio decade e si azzera', () => {
  const { Camera } = loadScripts(['engine/core/util.js', 'engine/world/camera.js'], ['Camera']);
  assertEqual(Camera.follow(0, -50, 1000, 384, 0.5), 0, 'limite sinistro');
  assertEqual(Camera.follow(0, 5000, 1000, 384, 1), 616, 'limite destro');
  assertEqual(Camera.follow(100, 200, 1000, 384, 0.1), 110, 'interpolazione');
  assertEqual(Camera.decayShake(10), 8.8, 'decadimento');
  assertEqual(Camera.decayShake(0.3), 0, 'sotto soglia');
});

test('Weather: vento nullo senza base, deterministico con base; pioggia con Rng seedato', () => {
  const { Weather, Rng } = loadScripts(['engine/core/util.js', 'engine/world/weather.js'], ['Weather', 'Rng']);
  assertEqual(Weather.wind(0, 12), 0, 'senza vento');
  assertEqual(Weather.wind(2, 3.5), Weather.wind(2, 3.5), 'stesso tempo, stesso vento');
  Rng.seed(5);
  const first = Weather.initRain(4, 384, 216);
  Rng.seed(5);
  assertEqual(Weather.initRain(4, 384, 216), first, 'stessa sequenza dal seed');
  assertEqual(first.length, 4, 'numero di gocce');
});

test('Steps: avanza piu passi nello stesso frame e sceglie il testo per dispositivo', () => {
  const { Steps } = loadScripts(['engine/core/steps.js'], ['Steps'], { UI: { hint: (keyboard, touch) => keyboard + '/' + touch } });
  const state = { step: 0 };
  let advanced = 0;
  const steps = [{ done: () => true }, { done: () => true }, { done: () => false }];
  Steps.update(state, steps, () => advanced++);
  assertEqual([state.step, advanced], [2, 2], 'passi completati');
  assertEqual(Steps.text({ text: 'FISSO' }), 'FISSO');
  assertEqual(Steps.text({ kb: 'A', touch: 'B' }), 'A/B');
});

test('Water: superficie infinita fuori dall acqua, spinta e propagazione delle molle', () => {
  const { Water } = loadScripts(['engine/core/util.js', 'engine/world/water.js'], ['Water']);
  assertEqual(Water.surfaceY(null, 10, 0), Infinity, 'senza acqua');
  const water = Water.make(100, [0, 0, 0], [1, 1, 1], [[0, 50]], 300);
  assertEqual(Water.surfaceY(water, 80, 0), Infinity, 'fuori dai range');
  assertEqual(Water.surfaceY(water, 20, 0), 100, 'acqua ferma');
  Water.push(water, 30, 1, 2);
  assert(water.v[10] === 1 && Math.abs(water.v[9] - 2 / 3) < 1e-6, 'spinta centrata con attenuazione');
  for (let i = 0; i < 5; i++) Water.update(water);
  assert(water.h[12] !== 0, 'la perturbazione si propaga ai vicini');
});

function loadGfx() {
  const dom = fakeDom();
  const { Gfx } = loadScripts(['engine/core/util.js', 'engine/core/geometry.js', 'engine/gfx/gfx.js'], ['Gfx'], { document: dom.document, window: dom.window, CONFIG: { W: 384, H: 216 } });
  dom.fills.length = 0;   // drop the pattern tiles Gfx paints while loading
  const pixels = () => new Set(dom.fills.filter(fill => fill.w === 1 && fill.h === 1).map(fill => fill.x + ',' + fill.y));
  return { Gfx, dom, pixels };
}

test('Gfx: drawLine piena e tratteggiata', () => {
  let setup = loadGfx();
  setup.Gfx.drawLine(0, 0, 5, 0);
  assertEqual(setup.pixels().size, 6, 'linea piena');
  setup = loadGfx();
  setup.Gfx.drawLine(0, 0, 5, 0, true);
  assertEqual(setup.pixels().size, 3, 'linea tratteggiata');
});

test('Gfx: drawCircle simmetrico sui quattro quadranti', () => {
  const { Gfx, pixels } = loadGfx();
  Gfx.drawCircle(10, 10, 3);
  const drawn = pixels();
  assert(drawn.size > 0, 'nessun pixel disegnato');
  for (const key of drawn) {
    const [x, y] = key.split(',').map(Number);
    for (const mirrored of [(20 - x) + ',' + y, x + ',' + (20 - y), (20 - x) + ',' + (20 - y)]) assert(drawn.has(mirrored), key + ' senza il suo speculare ' + mirrored);
  }
});

test('Gfx: larghezza del testo e accenti normalizzati', () => {
  const textSetup = loadGfx();
  assertEqual(textSetup.Gfx.textWidth('ABC'), 11);
  const accented = loadGfx(), plain = loadGfx();
  accented.Gfx.text('CITTÀ', 10, 10);
  plain.Gfx.text('CITTA', 10, 10);
  assertEqual(accented.dom.fills, plain.dom.fills, 'rettangoli disegnati');
});

if (require.main === module) {
  let failed = 0;
  for (const entry of tests) {
    try { entry.fn(); console.log('  OK   ' + entry.name); } catch (error) { failed++; console.log('  FAIL ' + entry.name + '\n       ' + error.message); }
  }
  console.log('\n' + (tests.length - failed) + ' ok, ' + failed + ' falliti');
  process.exit(failed ? 1 : 0);
}
module.exports = { tests };
