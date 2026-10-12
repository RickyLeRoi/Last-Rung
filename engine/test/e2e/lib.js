// test/e2e/lib.js
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..', '..');
const argumentValue = name => { const index = process.argv.indexOf(name); return index >= 0 ? process.argv[index + 1] : null; };
const GAME_ID = argumentValue('--game') || 'last-rung';
const GAME_DIR = path.join(ROOT, 'games', GAME_ID);
const GAME = JSON.parse(fs.readFileSync(path.join(GAME_DIR, 'game.json'), 'utf8'));
const DEV_HTML = path.join(GAME_DIR, 'index.html');
const DIST_HTML = path.join(ROOT, 'dist', GAME_ID + '.html');
const SITE_DIR = path.join(ROOT, 'dist', 'site');
const WEB_DIR = path.join(SITE_DIR, GAME_ID);
const GAME_URL = 'file://' + DIST_HTML + '?debug';
const DEV_URL = 'file://' + DEV_HTML + '?debug';
const SHOTS = path.join(ROOT, 'dist', 'shots');

let fails = 0;
let total = 0;
const check = (passed, message) => { total++; console.log((passed ? '  OK   ' : '  FAIL ') + message); if (!passed) fails++; };
const summary = () => ({ fails, total });

async function onlyBlackWhite(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('game'), pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let badCount = 0, whiteCount = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const channelValue = pixels[i];
      const isBlood = channelValue === 221 && pixels[i + 1] === 0 && pixels[i + 2] === 0;
      if (!isBlood && (pixels[i + 1] !== channelValue || pixels[i + 2] !== channelValue || (channelValue !== 0 && channelValue !== 255))) badCount++;
      if (channelValue === 255) whiteCount++;
    }
    return { bad: badCount, white: whiteCount };
  });
}

// Two Enter presses within the same frame count as one, hence the retry loop.
async function startPlay(page) {
  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => window.__debug.game.state) === 'play') return;
    await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  }
}

const state = page => page.evaluate(() => ({ st: window.__debug.game.state }));

const waitForState = (page, name, timeout = 3000) => page.waitForFunction(expected => window.__debug.game.state === expected, name, { timeout });

// Replaces performance.now and requestAnimationFrame so tests decide exactly how many 60 Hz steps run.
// Must be installed with page.addInitScript before the game loads.
const manualClockScript = () => {
  const stepMs = 1000 / 60 + 1e-7;
  let now = 0, pending = [];
  performance.now = () => now;
  window.requestAnimationFrame = callback => pending.push(callback);
  const advance = frames => {
    for (let i = 0; i < frames; i++) {
      now += stepMs;
      const due = pending; pending = [];
      for (const callback of due) callback(now);
    }
  };
  const until = (predicate, maxFrames) => {
    for (let i = 0; i < maxFrames; i++) { if (predicate()) return i; advance(1); }
    return predicate() ? maxFrames : -1;
  };
  window.__clock = { advance, until };
};
const installManualClock = page => page.addInitScript(manualClockScript);
const advance = (page, frames) => page.evaluate(count => window.__clock.advance(count), frames);
// Runs frames until the page-side predicate source (a function expression string) is true; returns frames spent or -1.
const advanceUntil = (page, predicateSource, maxFrames) => page.evaluate(({ source, max }) => window.__clock.until(eval(source), max), { source: predicateSource, max: maxFrames });

// Same mulberry32 as the Node harness. WebAudio is removed too: its setup also draws from Math.random and would shift the sequence.
const seededRandomScript = seed => {
  let state = seed | 0;
  Math.random = () => {
    state = (state + 0x6D2B79F5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
  window.AudioContext = undefined;
  window.webkitAudioContext = undefined;
};
const installSeededRandom = (page, seed) => page.addInitScript(seededRandomScript, seed);

// The canvas as one byte per pixel with the Node harness mapping (#fff -> 255, blood red -> 128, #000 -> 0, base64).
// Any other colour is counted in `bad`.
const readGrayFrame = page => page.evaluate(() => {
  const canvas = document.getElementById('game'), pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  const gray = new Uint8Array(canvas.width * canvas.height);
  let bad = 0;
  for (let i = 0, pixelIndex = 0; i < pixels.length; i += 4, pixelIndex++) {
    const red = pixels[i], green = pixels[i + 1], blue = pixels[i + 2];
    if (red === 255 && green === 255 && blue === 255) gray[pixelIndex] = 255;
    else if (red === 221 && green === 0 && blue === 0) gray[pixelIndex] = 128;
    else if (red !== 0 || green !== 0 || blue !== 0) bad++;
  }
  let binary = '';
  for (let i = 0; i < gray.length; i += 8192) binary += String.fromCharCode.apply(null, gray.subarray(i, i + 8192));
  return { bad, base64: btoa(binary) };
});

const collectErrors = page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return errors;
};
// Opens the bundle under the manual clock, already past the first two frames.
async function openWithClock(browser, query = '', viewport = { width: 1280, height: 720 }) {
  const page = await browser.newPage({ viewport });
  const errors = collectErrors(page);
  await installManualClock(page);
  await page.goto(GAME_URL + query);
  await advance(page, 2);
  return { page, errors };
}
// title -> intro -> play with two confirmations, one frame step between them (two Enters in a frame count as one).
async function enterPlay(page) {
  await page.keyboard.press('Enter'); await advance(page, 2);
  await page.keyboard.press('Enter'); await advance(page, 2);
}
async function hold(page, key, frames) {
  await page.keyboard.down(key);
  await advance(page, frames);
  await page.keyboard.up(key);
}

async function staticServer(webDirectory) {
  const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
  const server = http.createServer((request, response) => {
    let requestPath = decodeURIComponent(request.url.split('?')[0]); if (requestPath.endsWith('/')) requestPath += 'index.html';
    const filePath = path.join(webDirectory, requestPath);
    if (!filePath.startsWith(webDirectory) || !fs.existsSync(filePath)) { response.writeHead(404); response.end(); return; }
    response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
    response.end(fs.readFileSync(filePath));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { baseUrl: 'http://localhost:' + server.address().port + '/', close: () => server.close() };
}

module.exports = { ROOT, GAME_ID, GAME_DIR, GAME, SITE_DIR, DEV_HTML, DEV_URL, DIST_HTML, WEB_DIR, GAME_URL, SHOTS, check, summary, onlyBlackWhite, startPlay, state, waitForState, installManualClock, advance, advanceUntil, installSeededRandom, readGrayFrame, collectErrors, openWithClock, enterPlay, hold, staticServer };
