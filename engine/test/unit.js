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

test('interpolateTable: valori interi, frazionari e fuori tabella', () => {
  const { interpolateTable } = loadScripts(['engine/core/util.js'], ['interpolateTable']);
  const table = [8, 22, 36];
  assertEqual([0, 1, 2].map(index => interpolateTable(table, index)), [8, 22, 36], 'indici interi');
  assertEqual([interpolateTable(table, 0.5), interpolateTable(table, 1.25)], [15, 25.5], 'indici frazionari');
  assertEqual([interpolateTable(table, -3), interpolateTable(table, 9)], [8, 36], 'fuori tabella');
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

test('geometry: coneContains (portata, apertura, larghezza minima vicino al vertice, cono verso sinistra)', () => {
  const { coneContains } = loadScripts(['engine/core/geometry.js'], ['coneContains']);
  const cone = { x: 0, y: 0, pitch: 0.5, half: 0.1, length: 100 };
  const onAxis = distance => [Math.cos(0.5) * distance, Math.sin(0.5) * distance];
  assert(coneContains(cone, ...onAxis(50)), 'punto sulla linea centrale');
  assert(!coneContains(cone, ...onAxis(101)), 'punto oltre la portata');
  assert(!coneContains(cone, -10, 5), 'punto dietro il vertice');
  assert(!coneContains(cone, 50, 0), 'punto fuori apertura (angolo 0 contro 0,5 +- 0,1)');
  const nearApex = [Math.cos(0.5) * 10 + 2, Math.sin(0.5) * 10 - 3];
  assert(!coneContains(cone, ...nearApex), 'vicino al vertice il cono e stretto');
  assert(coneContains(cone, ...nearApex, 7), 'con larghezza minima 7 px il punto vicino al vertice e dentro');
  const leftCone = { ...cone, facing: -1 }, [axisX, axisY] = onAxis(50);
  assert(coneContains(leftCone, -axisX, axisY) && !coneContains(leftCone, axisX, axisY), 'il cono verso sinistra e lo specchio di quello verso destra');
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

test('Weather: neve (caduta e deriva lente); i valori di default sono quelli della pioggia di prima', () => {
  const { Weather, Rng } = loadScripts(['engine/core/util.js', 'engine/world/weather.js'], ['Weather', 'Rng']);
  const world = { wind: 0, camX: 0, width: 384, height: 216, waterY: () => Infinity, onHitWater() {} };
  const drops = () => [{ x: 100, y: 50, s: 1 }];
  const rain = drops(), explicit = drops(), snow = drops();
  Rng.seed(3); Weather.updateRain(rain, world);
  Rng.seed(3); Weather.updateRain(explicit, { ...world, fall: 4, fallSpread: 1, drift: 0.5 });
  Rng.seed(3); Weather.updateRain(snow, { ...world, fall: 0.5, fallSpread: 0.3, drift: 0.1 });
  assertEqual(rain, explicit, 'default = valori espliciti');
  assertEqual(rain[0], { x: 100.5, y: 55, s: 1 }, 'pioggia');
  assertEqual(snow[0], { x: 100.1, y: 50.8, s: 1 }, 'neve');
});

test('Terrain: materiali, bordi del mondo, scavo e riempimento per materiale, superficie', () => {
  const { Terrain } = loadScripts(['engine/world/terrain.js'], ['Terrain']);
  const terrain = Terrain.make(40, 30);
  Terrain.fillRect(terrain, 0, 20, 40, 10, 2);
  Terrain.fillRect(terrain, 0, 12, 40, 8, 1);
  assertEqual([Terrain.get(terrain, 5, 5), Terrain.get(terrain, 5, 15), Terrain.get(terrain, 5, 25)], [0, 1, 2], 'vuoto, neve, roccia');
  assert(Terrain.isSolid(terrain, -1, 5) && Terrain.isSolid(terrain, 40, 5) && Terrain.isSolid(terrain, 5, 30) && !Terrain.isSolid(terrain, 5, -1), 'fuori dal mondo: pareti e fondo pieni, cielo vuoto');
  assertEqual(Terrain.surfaceY(terrain, 10, 0), 12, 'superficie');
  const removed = Terrain.carveCircle(terrain, 10, 16, 4, 1);
  assert(removed > 20 && Terrain.get(terrain, 10, 19) === 0 && Terrain.get(terrain, 10, 20) === 2, 'lo scavo della neve non tocca la roccia (' + removed + ' celle)');
  assertEqual(Terrain.surfaceY(terrain, 10, 0), 20, 'la superficie scende fino alla roccia dopo lo scavo');
  const filled = Terrain.fillCircle(terrain, 10, 16, 4, 1, true);
  assertEqual(filled, removed, 'riempire solo il vuoto rimette le stesse celle');
  assert(Terrain.carveCircle(terrain, 30, 25, 3) > 0, 'lo scavo senza materiale toglie anche la roccia');
  assertEqual(Terrain.carveCircle(terrain, 30, 25, 3), 0, 'un secondo scavo nello stesso punto non toglie nulla');
});

test('Terrain: settleColumn fa cadere solo il materiale sciolto, una riga per volta', () => {
  const { Terrain } = loadScripts(['engine/world/terrain.js'], ['Terrain']);
  const terrain = Terrain.make(5, 12);
  Terrain.fillRect(terrain, 0, 10, 5, 2, 2);
  Terrain.fillRect(terrain, 2, 2, 1, 3, 1);
  Terrain.fillRect(terrain, 3, 4, 1, 1, 2);
  const moves = [];
  assertEqual(Terrain.settleColumn(terrain, 2, 1, (x, y) => moves.push([x, y])), 3, 'tre celle di neve scendono insieme');
  assertEqual(moves, [[2, 5], [2, 4], [2, 3]], 'nuove posizioni, dal basso');
  assertEqual(Terrain.settleColumn(terrain, 3, 1), 0, 'la roccia sospesa non cade');
  let frames = 0;
  while (Terrain.settleColumn(terrain, 2, 1) && frames < 20) frames++;
  assertEqual([Terrain.get(terrain, 2, 9), Terrain.get(terrain, 2, 7), Terrain.get(terrain, 2, 6)], [1, 1, 0], 'la neve si posa sulla roccia');
});

test('Terrain: moveRect si ferma sulle pareti, sale i gradini bassi, non attraversa i muri sottili', () => {
  const { Terrain } = loadScripts(['engine/world/terrain.js'], ['Terrain']);
  const terrain = Terrain.make(60, 40);
  Terrain.fillRect(terrain, 0, 30, 60, 10, 2);
  Terrain.fillRect(terrain, 20, 28, 10, 2, 2);
  Terrain.fillRect(terrain, 40, 10, 1, 20, 2);
  const body = { x: 10, y: 20, w: 4, h: 8 };
  let result = Terrain.moveRect(terrain, body, 0, 5, 0);
  assert(result.hitY && body.y === 22, 'atterraggio sul pavimento (y ' + body.y + ')');
  result = Terrain.moveRect(terrain, body, 10, 0, 0);
  assert(result.hitX && body.x === 16, 'senza gradino si ferma contro lo scalino (x ' + body.x + ')');
  result = Terrain.moveRect(terrain, body, 10, 0, 2);
  assert(!result.hitX && body.x === 26 && body.y === 20, 'con gradino 2 sale lo scalino (' + body.x + ', ' + body.y + ')');
  result = Terrain.moveRect(terrain, body, 30, 0, 2);
  assert(result.hitX && body.x === 36, 'il muro sottile ferma il corpo (x ' + body.x + ')');
});

test('Terrain: draw disegna solo la finestra, con bordi bianchi e retino per materiale', () => {
  const dom = fakeDom();
  const { Terrain } = loadScripts(['engine/core/util.js', 'engine/core/geometry.js', 'engine/gfx/gfx.js', 'engine/world/terrain.js'], ['Terrain'], { ...dom, CONFIG: { W: 384, H: 216 } });
  const terrain = Terrain.make(100, 50);
  Terrain.fillRect(terrain, 0, 30, 100, 20, 1);
  const pattern = { pattern: true };
  dom.fills.length = 0;
  Terrain.draw(terrain, 10, 20, 50, 20, { 1: pattern });
  assert(dom.fills.every(fill => fill.x >= 10 && fill.x < 60 && fill.y >= 20 && fill.y < 40), 'disegno fuori dalla finestra');
  assert(dom.fills.some(fill => fill.fillStyle === pattern) && dom.fills.some(fill => fill.fillStyle === '#fff' && fill.y === 30 && fill.w === 1), 'retino o bordo mancanti');
});

const parallax = dom => loadScripts(['engine/core/util.js', 'engine/core/geometry.js', 'engine/gfx/gfx.js', 'engine/gfx/parallax.js'], ['Parallax', 'mulberry32'], { ...dom, CONFIG: { W: 384, H: 216 } });

test('Parallax: ridge periodico, nei limiti e uguale a parita di seed; blocks prende il tetto piu alto', () => {
  const { Parallax, mulberry32 } = parallax(fakeDom());
  const options = { period: 192, step: 48, baseY: 150, lowest: 10, amplitude: 40, roughness: 0.3 };
  const first = Parallax.ridge(mulberry32(7), options), second = Parallax.ridge(mulberry32(7), options);
  assertEqual([...first], [...second], 'stesso seed');
  assert(first.every(top => top >= 100 && top <= 140), 'tetti fuori dai limiti');
  assert(Math.abs(first[191] - first[0]) <= 3, 'il profilo non si richiude sul periodo');
  const profile = Parallax.blocks([{ x: 10, y: 50, w: 4 }, { x: 12, y: 40, w: 4 }], 8, 10);
  assertEqual([...profile].map(top => top === 32767 ? null : top), [null, null, 50, 50, 40, 40, 40, 40, null, null]);
});

test('Parallax: draw con pattern, bordo, dettagli e scorrimento; covers coerente con il profilo', () => {
  const dom = fakeDom();
  const { Parallax } = parallax(dom);
  const pattern = { pattern: true };
  const profile = new Int16Array(8).fill(32767);
  profile[2] = 100; profile[3] = 100; profile[4] = 90;
  const layer = { factor: 0.5, baseY: 120, profile, fill: pattern, edge: 'solid', details: [3, 110, 3, 95] };
  dom.fills.length = 0;
  Parallax.draw([layer], 0, 0);
  assert(dom.fills.every(fill => Number.isInteger(fill.x) && Number.isInteger(fill.y) && Number.isInteger(fill.w) && Number.isInteger(fill.h)), 'coordinate non intere');
  assert(dom.fills.some(fill => fill.fillStyle === pattern && fill.x === 2 && fill.y === 100 && fill.w === 2 && fill.h === 20), 'riempimento a retino mancante');
  assert(dom.fills.some(fill => fill.fillStyle === '#fff' && fill.x === 10 && fill.y === 100 && fill.h === 20), 'il profilo non si ripete');
  assert(dom.fills.some(fill => fill.fillStyle === '#fff' && fill.x === 3 && fill.y === 110 && fill.w === 1), 'dettaglio dentro la sagoma mancante');
  assert(!dom.fills.some(fill => fill.x === 3 && fill.y === 95), 'dettaglio sopra la sagoma disegnato');
  assert(dom.fills.some(fill => fill.x === 2 && fill.y <= 119 && fill.y + fill.h > 119 && fill.w === 1) && dom.fills.some(fill => fill.x === 4 && fill.y <= 119 && fill.y + fill.h > 119 && fill.w === 1), 'lati verticali mancanti');
  dom.fills.length = 0;
  Parallax.draw([layer], 4, 0);
  assert(dom.fills.some(fill => fill.fillStyle === pattern && fill.x === 0 && fill.y === 100 && fill.w === 2), 'con camera 4 e fattore 0,5 lo strato scorre di 2');
  const covers = Parallax.covers([{ ...layer, factor: 0 }], 123, 0);
  assertEqual(covers.slice(0, 6), [2, 4, 99, 4, 5, 89], 'coperture');
  dom.fills.length = 0;
  Parallax.draw([{ ...layer, factor: 0, factorY: 0.5, fill: '#000' }], 0, 20);
  assert(dom.fills.some(fill => fill.fillStyle === '#000' && fill.x === 2 && fill.y === 90 && fill.h === 20), 'scorrimento verticale o riempimento nero');
});

test('Particles: i detriti si posano sul terreno del gioco (hook solidAt)', () => {
  const { Particles } = loadScripts(['engine/core/util.js', 'engine/world/particles.js'], ['Particles']);
  const chunk = { t: 'chunk', x: 10, y: 0, w: 2, h: 2, vx: 0.5, vy: 1, life: 400 };
  const list = [chunk], groundY = 40;
  const world = { wind: 0, gravity: 0.1, screenHeight: 500, max: 10, waterY: () => Infinity, solids: [], hooks: { solidAt: (x, y, w, h) => y + h > groundY } };
  for (let i = 0; i < 300; i++) Particles.update(list, world);
  assert(chunk.y + chunk.h <= groundY && chunk.y + chunk.h > groundY - 1.5, 'il detrito non si posa sul terreno (y ' + chunk.y.toFixed(2) + ')');
  assertEqual(chunk.vy, 0, 'il detrito resta fermo');
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
