#!/usr/bin/env node
// engine/test/e2e/run.js
'use strict';
/*
 * Real-browser checks (headless Chromium via Playwright):
 *   NODE_PATH=$(npm root -g) node engine/test/e2e/run.js [--game <id>] [suite...] [--update]
 * Generic suites (this folder) run against any game; game suites live in games/<id>/test/e2e/*.js (lib.js excluded).
 * In every page, window.__debug is an alias of the game's debug global (game.json > debugGlobal, set by the ?debug URL parameter).
 * --update rewrites the browser golden baseline (only after an intentional change, with the user's approval).
 */
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { GAME_ID, GAME_DIR, GAME, summary } = require('./lib');

const GENERIC_SUITES = ['devpage', 'layout', 'pwa', 'golden', 'hub'];
const gameSuiteDirectory = path.join(GAME_DIR, 'test', 'e2e');
const gameSuites = fs.existsSync(gameSuiteDirectory)
  ? fs.readdirSync(gameSuiteDirectory).filter(file => file.endsWith('.js') && file !== 'lib.js').map(file => file.slice(0, -3))
  : [];
const suiteFiles = { ...Object.fromEntries(GENERIC_SUITES.map(name => [name, path.join(__dirname, name)])), ...Object.fromEntries(gameSuites.map(name => [name, path.join(gameSuiteDirectory, name)])) };

const args = process.argv.slice(2);
const update = args.includes('--update');
const gameFlagIndex = args.indexOf('--game');
const requested = args.filter((argument, i) => !argument.startsWith('--') && i !== gameFlagIndex + 1);
const unknown = requested.filter(name => !suiteFiles[name]);
if (unknown.length) { console.error('suite sconosciuta: ' + unknown.join(', ') + ' (disponibili: ' + Object.keys(suiteFiles).join(', ') + ')'); process.exit(2); }

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (...contextArguments) => {
    const context = await newContext(...contextArguments);
    await context.addInitScript(name => { Object.defineProperty(window, '__debug', { configurable: true, get: () => window[name] }); }, GAME.debugGlobal);
    return context;
  };
  const ctx = { gameId: GAME_ID, update };
  console.log('gioco: ' + GAME_ID);
  for (const name of Object.keys(suiteFiles).filter(suite => !requested.length || requested.includes(suite))) await require(suiteFiles[name])(browser, ctx);
  await browser.close();
  const { fails, total } = summary();
  console.log(fails ? '\n' + fails + ' controlli falliti su ' + total : '\ntutti i ' + total + ' controlli nel browser superati');
  process.exit(fails ? 1 : 0);
})();
