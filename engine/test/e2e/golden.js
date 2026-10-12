// engine/test/e2e/golden.js
'use strict';
/*
 * Golden frames in the real browser: manual clock + seeded Math.random + real keyboard events, so the pixels are
 * reproducible. Baseline: games/<id>/test/golden/<id>.browser.json (rewritten by `node engine/test/e2e/run.js golden --update`); scenarios: games/<id>/test/scenarios.js.
 * It also asserts that every frame is pixel-identical to the Node harness on the same scenario: the fake canvas is faithful
 * (checked on the first run, 0 differing pixels in all four scenarios, night and fog included), so the Node goldens are enough for the rest.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GAME_URL, GAME_ID, GAME_DIR, check, installManualClock, installSeededRandom, advance, readGrayFrame, collectErrors } = require('./lib');
const { boot, randomKeysPolicy } = require('../harness');
const SCENARIOS_FILE = path.join(GAME_DIR, 'test', 'scenarios.js');

const BASELINE_FILE = path.join(GAME_DIR, 'test', 'golden', GAME_ID + '.browser.json');
const CHECKPOINT_EVERY = 300;
const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

// Same driver interface for the browser and for the Node harness, so one runner executes both.
function browserDriver(page) {
  const held = new Set();
  let pendingFrames = 0;
  const flush = async () => { if (pendingFrames) { const frames = pendingFrames; pendingFrames = 0; await advance(page, frames); } };
  const press = async code => { await flush(); if (!held.has(code)) { held.add(code); await page.keyboard.down(code); } };
  const release = async code => { await flush(); if (held.has(code)) { held.delete(code); await page.keyboard.up(code); } };
  return {
    async start(level) {
      if (level) { await page.evaluate(() => { window.__debug.game.state = 'play'; }); pendingFrames = 1; }
    },
    async set(keys) { for (const code of ARROWS) await (keys.includes(code) ? press(code) : release(code)); },
    async act(kind, code) {
      if (kind === 'down') await press(code);
      else if (kind === 'up') await release(code);
      else { await press(code); await advance(page, 1); await release(code); }
    },
    async tick(count) { pendingFrames += count; },
    async capture() { await flush(); const frame = await readGrayFrame(page); return { bad: frame.bad, bytes: Buffer.from(frame.base64, 'base64') }; },
  };
}
function nodeDriver(scenario) {
  const driver = boot({ game: GAME_ID, seededMath: scenario.seed });
  return {
    async start(level) { if (level) driver.play(driver.hook.levelSpec(level)); },
    async set(keys) { driver.set(keys); },
    async act(kind, code) { if (kind === 'down') driver.keyDown(code); else if (kind === 'up') driver.keyUp(code); else driver.tap(code); },
    async tick(count) { driver.tick(count); },
    async capture() { driver.frameHash(); return { bad: 0, bytes: Buffer.from(driver.buf) }; },
  };
}

async function runScenario(scenario, driver) {
  const policy = scenario.policySeed === null ? null : randomKeysPolicy(scenario.policySeed);
  await driver.start(scenario.level);
  const checkpoints = [];
  for (let i = 0; i < scenario.frames; i++) {
    if (policy && i % 9 === 0) await driver.set(policy(i));
    const action = scenario.actions[i];
    if (action) await driver.act(action[0], action[1]);
    await driver.tick(1);
    if ((i + 1) % CHECKPOINT_EVERY === 0 || i + 1 === scenario.frames) checkpoints.push({ at: i + 1, ...(await driver.capture()) });
  }
  return checkpoints;
}

const sha1 = bytes => crypto.createHash('sha1').update(bytes).digest('hex');
const differingPixels = (first, second) => { let count = 0; for (let i = 0; i < first.length; i++) if (first[i] !== second[i]) count++; return count; };

module.exports = async (browser, ctx) => {
  if (!fs.existsSync(SCENARIOS_FILE)) { console.log('  --   golden browser: nessuno scenario per ' + GAME_ID + ' (si aggiungono dopo l approvazione della versione giocabile)'); return; }
  const { SHARED_SCENARIOS } = require(SCENARIOS_FILE);
  const baseline = fs.existsSync(BASELINE_FILE) ? JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8')) : { game: GAME_ID, scenarios: {} };
  const results = {};
  for (const scenario of Object.values(SHARED_SCENARIOS)) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = collectErrors(page);
    await installManualClock(page);
    await installSeededRandom(page, scenario.seed);
    await page.goto(GAME_URL + scenario.query);
    const browserFrames = await runScenario(scenario, browserDriver(page));
    await page.close();
    const nodeFrames = await runScenario(scenario, nodeDriver(scenario));

    const outsidePalette = browserFrames.reduce((total, frame) => total + frame.bad, 0);
    const hashes = browserFrames.map(frame => ({ at: frame.at, frame: sha1(frame.bytes) }));
    results[scenario.id] = { checkpoints: hashes };
    const fidelity = browserFrames.map((frame, i) => differingPixels(frame.bytes, nodeFrames[i].bytes));
    const whitePixels = browserFrames.map(frame => frame.bytes.filter(value => value === 255).length);
    check(fidelity.every(count => count === 0) && whitePixels.every(count => count > 0),
      'golden browser ' + scenario.id + ': frame identici a quelli dell\'harness Node (pixel diversi per checkpoint: ' + fidelity.join(', ') + ')');

    check(outsidePalette === 0 && errors.length === 0, 'golden browser ' + scenario.id + ': solo #fff/#000/#d00 e nessun errore (' + outsidePalette + ' pixel fuori palette)' + (errors.length ? ': ' + errors.join(' | ') : ''));
    if (ctx.update) continue;
    const expected = baseline.scenarios[scenario.id];
    const firstDifference = !expected ? 'nessuna baseline (lancia node engine/test/e2e/run.js golden --update)'
      : hashes.length !== expected.checkpoints.length ? 'numero di checkpoint diverso'
      : (hashes.find((hash, i) => hash.at !== expected.checkpoints[i].at || hash.frame !== expected.checkpoints[i].frame) || {}).at;
    check(firstDifference === undefined, 'golden browser ' + scenario.id + ': ' + (firstDifference === undefined ? hashes.length + ' frame identici alla baseline' : 'primo checkpoint divergente: ' + firstDifference));
  }
  if (ctx.update) {
    fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
    fs.writeFileSync(BASELINE_FILE, JSON.stringify({ game: GAME_ID, scenarios: results }, null, 1) + '\n');
    console.log('  baseline scritta in ' + path.relative(process.cwd(), BASELINE_FILE));
  }
};
