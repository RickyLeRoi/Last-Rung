// test/e2e/lib.js
'use strict';
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.join(__dirname, '..', '..');
const DEV_HTML = path.join(ROOT, 'index.html');
const DIST_HTML = path.join(ROOT, 'dist', 'last-rung.html');
const WEB_DIR = path.join(ROOT, 'dist', 'web');
const GAME_URL = 'file://' + DIST_HTML + '?debug';
const DEV_URL = 'file://' + DEV_HTML + '?debug';
const SHOTS = path.join(ROOT, 'test', 'shots');

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
    if (await page.evaluate(() => window.__eli.game.state) === 'play') return;
    await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  }
}

const state = page => page.evaluate(() => { const game = window.__eli.game, heli = game.heli; return { st: game.state, x: heli.x, y: heli.y, vx: heli.vx, vy: heli.vy, stab: heli.stab, hs: heli.state }; });

const waitForState = (page, name, timeout = 3000) => page.waitForFunction(expected => window.__eli.game.state === expected, name, { timeout });

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

module.exports = { DEV_HTML, DEV_URL, DIST_HTML, WEB_DIR, GAME_URL, SHOTS, check, summary, onlyBlackWhite, startPlay, state, waitForState, installManualClock, advance, advanceUntil, collectErrors, openWithClock, enterPlay, hold, staticServer };
