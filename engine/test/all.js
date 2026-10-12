#!/usr/bin/env node
// engine/test/all.js
'use strict';
/*
 * npm test: everything that needs no browser, against the bundles in dist/ (run `npm run build` first).
 *   engine unit tests, static guards, conformance, then each game's own suite and golden snapshots.
 * Slow or browser based checks run separately: games/<id>/test/levels.js and engine/test/e2e/run.js.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const steps = [
  ['engine: test unitari', 'engine/test/unit.js'],
  ['engine: guardie statiche', 'engine/test/guards.js'],
  ['engine: conformance', 'engine/test/conformance.js'],
];
const gamesDirectory = path.join(ROOT, 'games');
for (const entry of fs.readdirSync(gamesDirectory, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  for (const [label, file] of [['suite', 'run.js'], ['golden', 'golden.js']]) {
    const relative = 'games/' + entry.name + '/test/' + file;
    if (fs.existsSync(path.join(ROOT, relative))) steps.push([entry.name + ': ' + label, relative]);
  }
}

let failed = 0;
for (const [label, file] of steps) {
  console.log('\n=== ' + label + ' (' + file + ')');
  const result = spawnSync(process.execPath, [path.join(ROOT, file)], { stdio: 'inherit', cwd: ROOT });
  if (result.status !== 0) { failed++; console.log('=== FALLITO: ' + label); }
}
console.log(failed ? '\n' + failed + ' passi falliti su ' + steps.length : '\ntutti i ' + steps.length + ' passi superati');
process.exit(failed ? 1 : 0);
