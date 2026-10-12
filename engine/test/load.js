// engine/test/load.js
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..', '..');

// Runs classic scripts (paths relative to the repository root) in one sandbox, like the browser does, and returns the
// requested top-level globals. Top-level const/let are not properties of the sandbox, hence the exports expression.
function loadScripts(scriptPaths, globalNames, sandbox = {}) {
  const source = scriptPaths.map(file => fs.readFileSync(path.join(ROOT, file), 'utf8')).join('\n;\n') +
    '\n;({ ' + globalNames.join(', ') + ' })';
  return vm.runInNewContext(source, vm.createContext(sandbox));
}

// Just enough DOM for Gfx: every fillRect call is recorded, patterns and helper canvases are inert.
function fakeDom({ width = 384, height = 216 } = {}) {
  const fills = [];
  const context = {
    fillStyle: '#fff',
    fillRect: (x, y, w, h) => fills.push({ x, y, w, h, fillStyle: context.fillStyle }),
    createPattern: () => ({}),
    save() {}, restore() {}, setTransform() {}, clearRect() {}, drawImage() {},
  };
  const canvas = { style: {}, width: 0, height: 0, getContext: () => context };
  const document = { getElementById: () => canvas, createElement: () => ({ ...canvas, style: {}, getContext: () => context }) };
  const window = { innerWidth: width * 2, innerHeight: height * 2, addEventListener() {} };
  return { document, window, fills, context };
}

module.exports = { loadScripts, fakeDom };
