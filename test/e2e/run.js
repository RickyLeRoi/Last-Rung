#!/usr/bin/env node
// test/e2e/run.js
'use strict';
/*
 * Real-browser checks (headless Chromium via Playwright):
 *   NODE_PATH=$(npm root -g) node test/e2e/run.js [suite...]
 */
const path = require('path');
const { chromium } = require('playwright');
const { DIST_HTML, WEB_DIR, summary } = require('./lib');

const SUITES = ['keyboard', 'touch', 'gamepad', 'pwa', 'devpage', 'layout', 'touchui', 'flow', 'visual'];
const requested = process.argv.slice(2);
const unknown = requested.filter(name => !SUITES.includes(name));
if (unknown.length) { console.error('suite sconosciuta: ' + unknown.join(', ') + ' (disponibili: ' + SUITES.join(', ') + ')'); process.exit(2); }

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = { distHtml: DIST_HTML, webDir: WEB_DIR };
  for (const name of SUITES.filter(suite => !requested.length || requested.includes(suite))) await require(path.join(__dirname, name))(browser, ctx);
  await browser.close();
  const { fails, total } = summary();
  console.log(fails ? '\n' + fails + ' controlli falliti su ' + total : '\ntutti i ' + total + ' controlli nel browser superati');
  process.exit(fails ? 1 : 0);
})();
