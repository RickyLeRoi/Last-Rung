'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

const DIST = path.join(__dirname, '..', 'dist', 'last-rung.html');
const W = 384, H = 216;

function loadSource() {
  const html = fs.readFileSync(DIST, 'utf8');
  return html.match(/<script>([\s\S]*)<\/script>/)[1];
}

const CRC = [];
for (let tableIndex = 0; tableIndex < 256; tableIndex++) { let remainder = tableIndex; for (let bitIndex = 0; bitIndex < 8; bitIndex++) remainder = remainder & 1 ? 0xedb88320 ^ (remainder >>> 1) : remainder >>> 1; CRC[tableIndex] = remainder >>> 0; }
const crc = bytes => { let checksum = 0xffffffff; for (const byteValue of bytes) checksum = CRC[(checksum ^ byteValue) & 255] ^ (checksum >>> 8); return (checksum ^ 0xffffffff) >>> 0; };
function writePng(pixelBuffer, file, scale = 3) {
  const pngWidth = W * scale, pngHeight = H * scale, rawScanlines = Buffer.alloc((pngWidth + 1) * pngHeight);
  for (let y = 0; y < pngHeight; y++) for (let x = 0; x < pngWidth; x++) rawScanlines[y * (pngWidth + 1) + 1 + x] = pixelBuffer[((y / scale) | 0) * W + ((x / scale) | 0)];
  const chunk = (chunkType, chunkData) => {
    const lengthField = Buffer.alloc(4); lengthField.writeUInt32BE(chunkData.length);
    const typeAndData = Buffer.concat([Buffer.from(chunkType), chunkData]);
    const crcField = Buffer.alloc(4); crcField.writeUInt32BE(crc(typeAndData));
    return Buffer.concat([lengthField, typeAndData, crcField]);
  };
  const headerData = Buffer.alloc(13); headerData.writeUInt32BE(pngWidth, 0); headerData.writeUInt32BE(pngHeight, 4); headerData[8] = 8; headerData[9] = 0;
  fs.writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', headerData), chunk('IDAT', zlib.deflateSync(rawScanlines)), chunk('IEND', Buffer.alloc(0))]));
}


// Deterministic replacement for Math.random in the game sandbox: it only feeds rendering and audio, never the simulation.
function seededRandom(seed) {
  let state = seed | 0;
  return {
    next() {
      state = (state + 0x6D2B79F5) | 0;
      let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
      mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
      return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
    },
    save: () => state,
    restore(saved) { state = saved; },
  };
}


// Stable text form of any game object: numbers fixed to 6 decimals, keys sorted, shared level objects replaced by their index.
function encodeStable(value, knownObjects, path = []) {
  if (typeof value === 'number') return Number.isFinite(value) ? value.toFixed(6) : String(value);
  if (value === undefined || typeof value === 'function') return null;
  if (value === null || typeof value !== 'object') return value;
  if (path.length && knownObjects.has(value)) return knownObjects.get(value);
  if (path.includes(value) || path.length > 8) return '[cycle]';
  const nextPath = path.concat([value]);
  if (Array.isArray(value)) return value.map(item => encodeStable(item, knownObjects, nextPath));
  const encoded = {};
  for (const key of Object.keys(value).sort()) encoded[key] = encodeStable(value[key], knownObjects, nextPath);
  return encoded;
}
const sha1 = bytes => crypto.createHash('sha1').update(bytes).digest('hex');

function boot(options = {}) {
  const source = loadSource();
  const seededMath = options.seededMath === undefined ? null : seededRandom(options.seededMath);
  const pixelBuffer = new Uint8Array(W * H);
  const stats = { nonInt: 0, badColor: 0 };
  let offsetX = 0, offsetY = 0, fill = '#fff', compositeOperation = 'source-over', capture = false;
  const fakeContext = {
    get fillStyle() { return fill; },
    set fillStyle(color) { fill = color; if (!(color && color.pattern) && color !== '#fff' && color !== '#000' && color !== '#d00') stats.badColor++; },
    get globalCompositeOperation() { return compositeOperation; },
    set globalCompositeOperation(operation) { compositeOperation = operation; },
    setTransform(scaleX, skewY, skewX, scaleY, translateX, translateY) { offsetX = translateX; offsetY = translateY; if (!Number.isInteger(translateX) || !Number.isInteger(translateY)) stats.nonInt++; },
    createPattern(patternCanvas) { return { pattern: true, c: patternCanvas }; },
    fillRect(x, y, width, height) {
      if (!Number.isInteger(x) || !Number.isInteger(y) || !Number.isInteger(width) || !Number.isInteger(height)) stats.nonInt++;
      if (!capture) return;
      const startX = Math.max(0, x + offsetX), startY = Math.max(0, y + offsetY), endX = Math.min(W, x + offsetX + width), endY = Math.min(H, y + offsetY + height);
      for (let pixelY = startY; pixelY < endY; pixelY++) for (let pixelX = startX; pixelX < endX; pixelX++) {
        const i = pixelY * W + pixelX;
        if (compositeOperation === 'difference') { pixelBuffer[i] = 255 - pixelBuffer[i]; continue; }
        if (fill.pattern) { const patternCanvas = fill.c, patternX = (((pixelX - offsetX) % patternCanvas.width) + patternCanvas.width) % patternCanvas.width, patternY = (((pixelY - offsetY) % patternCanvas.height) + patternCanvas.height) % patternCanvas.height; if (patternCanvas.black.has(patternX + ',' + patternY)) pixelBuffer[i] = 0; }
        else pixelBuffer[i] = fill === '#fff' ? 255 : fill === '#d00' ? 128 : 0;   // blood red renders as gray in screenshots
      }
    },
  };
  const canvas = { style: {}, getContext: () => fakeContext, focus() {} };
  const listeners = {};
  let animationFrameCallback = null, now = 0, hook = null;
  const fakeWindow = { innerWidth: 1200, innerHeight: 700, addEventListener: (eventType, listener) => { (listeners[eventType] = listeners[eventType] || []).push(listener); } };
  const sandbox = {
    window: fakeWindow,
    document: {
      getElementById: id => (id === 'game' ? canvas : null),
      // dither pattern canvas: records black pixels so the fake rasterizer applies the real pattern
      createElement: () => {
        const tileCanvas = { width: 1, height: 1, black: new Set() };
        let fillColor = '#000';
        tileCanvas.getContext = () => ({ set fillStyle(color) { fillColor = color; }, fillRect(x, y, width, height) { if (fillColor === '#000') for (let j = y; j < y + height; j++) for (let i = x; i < x + width; i++) tileCanvas.black.add(i + ',' + j); } });
        return tileCanvas;
      },
    },
    navigator: options.gamepad ? { getGamepads: () => [options.gamepad] } : {},
    location: { search: options.search || '' },
    performance: { now: () => now },
    requestAnimationFrame: callback => { animationFrameCallback = callback; },
    __TEST_HOOK__: testHook => { hook = testHook; },
  };
  if (seededMath) sandbox.Math = Object.assign(Object.create(Math), { random: seededMath.next });
  new Function(...Object.keys(sandbox), source)(...Object.values(sandbox));

  const fire = (type, code) => (listeners[type] || []).forEach(listener => listener({ code, preventDefault() {} }));
  const held = new Set();
  const driver = {
    hook, game: hook.game, stats,
    tick(count = 1) { for (let i = 0; i < count; i++) { now += 1000 / 60 + 1e-7; animationFrameCallback(now); } },   // +1e-7: exactly one simulation step per tick
    keyDown(code) { if (!held.has(code)) { held.add(code); fire('keydown', code); } },
    keyUp(code) { if (held.has(code)) { held.delete(code); fire('keyup', code); } },
    set(keys) {
      for (const code of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
        if (keys.includes(code)) driver.keyDown(code); else driver.keyUp(code);
      }
    },
    tap(code) { driver.keyDown(code); driver.tick(); driver.keyUp(code); },
    hold(keys, count) { for (let i = 0; i < count; i++) { driver.set(keys); driver.tick(); } },
    // Renders the current state once without advancing the simulation and without consuming the seeded Math.random sequence.
    frameHash() {
      const savedRandom = seededMath ? seededMath.save() : null;
      capture = true; animationFrameCallback(now); capture = false;
      if (seededMath) seededMath.restore(savedRandom);
      return sha1(pixelBuffer);
    },
    stateHash(options = {}) {
      const game = hook.game, level = game.L, knownObjects = new Map();
      level.solids.forEach((solid, i) => knownObjects.set(solid, 'solid:' + i));
      level.people.forEach((person, i) => knownObjects.set(person, 'person:' + i));
      level.fires.forEach((fire, i) => knownObjects.set(fire, 'fire:' + i));
      const personFields = ['state', 'x', 'y', 'vx', 'vy', 'kind', 'injured', 't'];
      const snapshot = {
        heli: encodeStable(game.heli, knownObjects),
        people: level.people.map(person => encodeStable(Object.fromEntries(personFields.map(field => [field, person[field]])), knownObjects)),
        saved: level.saved, dead: level.dead, total: level.total, killedByPlayer: level.killedByPlayer,
        score: game.score, particles: game.parts.length, wind: encodeStable(game.wind, knownObjects), camX: encodeStable(game.camX, knownObjects),
        fires: level.fires.map(fire => encodeStable({ hp: fire.hp, press: fire.press }, knownObjects)),
        frame: game.frame,
      };
      if (!options.ignoreState) snapshot.state = game.state;
      return sha1(JSON.stringify(snapshot));
    },
    // Consumes one number: call it last in a scenario. A changed order of Rng calls shows up here even when the state looks equal.
    rngProbe() { return hook.Rng.next(); },
    get buf() { return pixelBuffer; },
    shot(file) { capture = true; now += 1000 / 60 + 1e-7; animationFrameCallback(now); capture = false; writePng(pixelBuffer, file); },
    play(spec) { hook.startLevel(spec, 0); hook.game.state = 'play'; driver.tick(); return hook.game; },
  };
  return driver;
}

function flyTo(driver, targetX, targetY, maxSpeed, tolerance = 2) {
  const heli = driver.game.heli, heliCenterX = heli.x + 16, heliBottomY = heli.y + 16;
  const desiredVelocityX = Math.max(-maxSpeed, Math.min(maxSpeed, (targetX - heliCenterX) * 0.04));
  const desiredVelocityY = Math.max(-maxSpeed * 0.8, Math.min(maxSpeed * 0.8, (targetY - heliBottomY) * 0.04));
  const pressedKeys = [];
  if (heli.vx < desiredVelocityX - 0.03) pressedKeys.push('ArrowRight'); else if (heli.vx > desiredVelocityX + 0.03) pressedKeys.push('ArrowLeft');
  if (heli.vy > desiredVelocityY - 0.02) pressedKeys.push('ArrowUp');
  driver.set(pressedKeys); driver.tick();
  return Math.abs(targetX - heliCenterX) < tolerance && Math.abs(targetY - heliBottomY) < 3;
}
function goTo(driver, getTargetX, getTargetY, maxSpeed, limit = 3000) {
  for (let i = 0; i < limit; i++) {
    if (driver.game.heli.state !== 'fly' || driver.game.state !== 'play') return false;
    if (flyTo(driver, getTargetX(), getTargetY(), maxSpeed)) return true;
  }
  return false;
}

const randomKeysPolicy = seed => frame => {
  const scrambled = Math.sin((frame + seed) * 12.9898) * 43758.5453, fraction = scrambled - Math.floor(scrambled);
  const keys = [];
  if (fraction < 0.55) keys.push('ArrowUp');
  if ((fraction * 7) % 1 < 0.3) keys.push('ArrowLeft'); else if ((fraction * 13) % 1 < 0.4) keys.push('ArrowRight');
  return keys;
};
function place(harness, x, y, velocityX = 0, velocityY = 0) {
  const heli = harness.game.heli;
  heli.ground = null; heli.x = x; heli.y = y; heli.px = x; heli.py = y; heli.vx = velocityX; heli.vy = velocityY;
}
function roofWithoutObstacles(game) {
  const level = game.L;
  return level.solids.find(solid => solid.kind === 'bld' && !solid.safe && solid.w >= 50 &&
    !level.fires.some(fire => fire.x < solid.x + solid.w && fire.x + fire.w > solid.x) &&
    !level.haz.some(hazard => hazard.x1 >= solid.x - 4 && hazard.x0 <= solid.x + solid.w + 4 && hazard.y1 < solid.y + 2 && hazard.y0 < solid.y));
}

module.exports = { boot, flyTo, goTo, randomKeysPolicy, place, roofWithoutObstacles, W, H };
