#!/usr/bin/env node
// test/guards.js
'use strict';
/*
 * Static guards on the sources (no game is run):
 *   - Math.random only where it cannot feed the simulation (rendering and audio)
 *   - no console.log in the game
 *   - every source file is listed in the build:js block of its index.html, and every listed file exists
 * Run by test/run.js (so CI executes it) or on its own: node test/guards.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MATH_RANDOM_ALLOWED = ['src/render.js', 'engine/audio/synth.js'];

// Pages and the folders whose .js files must be listed in their build:js block. Extended as engine/ and games/ appear.
function findPages() {
  const pages = [{ html: 'index.html', sourceRoots: ['src', 'engine/core', 'engine/gfx', 'engine/audio', 'engine/input', 'engine/world'] }];
  const gamesDirectory = path.join(ROOT, 'games');
  if (fs.existsSync(gamesDirectory)) {
    for (const game of fs.readdirSync(gamesDirectory)) {
      if (fs.existsSync(path.join(gamesDirectory, game, 'index.html'))) pages.push({ html: 'games/' + game + '/index.html', sourceRoots: ['games/' + game + '/src', 'engine/core', 'engine/gfx', 'engine/audio', 'engine/input', 'engine/world'] });
    }
  }
  return pages;
}

function listScripts(relativeDirectory) {
  const directory = path.join(ROOT, relativeDirectory);
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relativePath = relativeDirectory + '/' + entry.name;
    if (entry.isDirectory()) files.push(...listScripts(relativePath));
    else if (entry.name.endsWith('.js')) files.push(relativePath);
  }
  return files;
}

// Blanks comments (keeping newlines, so line numbers stay valid) without touching string contents.
function stripComments(source) {
  let output = '', quote = null;
  for (let i = 0; i < source.length; i++) {
    const character = source[i], next = source[i + 1];
    if (quote) {
      output += character;
      if (character === '\\') { output += next || ''; i++; } else if (character === quote) quote = null;
    } else if (character === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') { output += ' '; i++; }
      output += '\n';
    } else if (character === '/' && next === '*') {
      i += 2; output += '  ';
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) { output += source[i] === '\n' ? '\n' : ' '; i++; }
      output += '  '; i++;
    } else {
      if (character === '"' || character === "'" || character === '`') quote = character;
      output += character;
    }
  }
  return output;
}

function scanForbiddenCalls(file, problems) {
  const lines = stripComments(fs.readFileSync(path.join(ROOT, file), 'utf8')).split('\n');
  lines.forEach((line, i) => {
    if (/\bMath\s*\.\s*random\b/.test(line) && !MATH_RANDOM_ALLOWED.includes(file)) problems.push(file + ':' + (i + 1) + ': Math.random fuori da ' + MATH_RANDOM_ALLOWED.join(', ') + ' (la simulazione usa Rng)');
    if (/\bconsole\s*\.\s*log\b/.test(line)) problems.push(file + ':' + (i + 1) + ': console.log nel gioco');
  });
}

function checkPageScripts({ html, sourceRoots }, problems) {
  const page = fs.readFileSync(path.join(ROOT, html), 'utf8');
  const start = page.indexOf('<!-- build:js'), end = page.indexOf('<!-- /build:js -->');
  if (start < 0 || end < 0) { problems.push(html + ': blocco build:js non trovato'); return; }
  const base = path.posix.dirname(html);
  const listed = [...page.slice(start, end).matchAll(/<script src="([^"]+)"/g)].map(match => path.posix.normalize(base === '.' ? match[1] : base + '/' + match[1]));
  for (const source of listed) if (!fs.existsSync(path.join(ROOT, source))) problems.push(html + ': script elencato ma inesistente: ' + source);
  for (const file of sourceRoots.flatMap(listScripts)) if (!listed.includes(file)) problems.push(html + ': file non elencato nel blocco build:js: ' + file);
  const duplicates = listed.filter((source, i) => listed.indexOf(source) !== i);
  for (const source of duplicates) problems.push(html + ': script elencato due volte: ' + source);
}

function runGuards() {
  const problems = [];
  const pages = findPages();
  const gameFiles = new Set(pages.flatMap(page => page.sourceRoots.flatMap(listScripts)));
  for (const file of [...gameFiles].sort()) scanForbiddenCalls(file, problems);
  for (const page of pages) checkPageScripts(page, problems);
  return { problems, filesScanned: gameFiles.size };
}

if (require.main === module) {
  const { problems, filesScanned } = runGuards();
  for (const problem of problems) console.log('  FAIL ' + problem);
  console.log(problems.length ? '\n' + problems.length + ' violazioni' : 'guardie statiche ok (' + filesScanned + ' file)');
  process.exit(problems.length ? 1 : 0);
}
module.exports = { runGuards };
