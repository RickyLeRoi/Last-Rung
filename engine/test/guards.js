#!/usr/bin/env node
// engine/test/guards.js
'use strict';
/*
 * Static guards on the sources (no game is run):
 *   - Math.random only where it cannot feed the simulation (rendering and audio)
 *   - no console.log in the game
 *   - engine/ never mentions the game (game., heli, SPRITES, Sfx, the debug global) and reads only the CONFIG keys of the contract
 *   - every source file is listed in the build:js block of its index.html, and every listed file exists
 * Run by engine/test/all.js (npm test, so CI executes it) or on its own: node engine/test/guards.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const ENGINE_FORBIDDEN = [[/\bgame\s*\./, 'game.'], [/\bheli\b/, 'heli'], [/\bSPRITES\b/, 'SPRITES'], [/\bSfx\b/, 'Sfx'], [/\b__eli\b/, '__eli']];
const ENGINE_CONFIG_KEYS = ['W', 'H', 'input', 'maxParticles', 'touchGutter'];
// Rendering and audio never feed the simulation, so they may use Math.random.
const MATH_RANDOM_ALLOWED = [/^games\/[^/]+\/src\/render\.js$/, /^engine\/audio\/synth\.js$/];
const isMathRandomAllowed = file => MATH_RANDOM_ALLOWED.some(pattern => pattern.test(file));

// Pages and the folders whose .js files must be listed in their build:js block: one page per game.
function findPages() {
  const pages = [];
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

function scanEngineCoupling(file, source, problems) {
  source.split('\n').forEach((line, i) => {
    for (const [pattern, name] of ENGINE_FORBIDDEN) if (pattern.test(line)) problems.push(file + ':' + (i + 1) + ': engine accoppiato al gioco (' + name + ')');
    for (const match of line.matchAll(/\bCONFIG\s*\.\s*(\w+)/g)) {
      if (!ENGINE_CONFIG_KEYS.includes(match[1])) problems.push(file + ':' + (i + 1) + ": CONFIG." + match[1] + " non e' nel contratto (ammesse: " + ENGINE_CONFIG_KEYS.join(', ') + ')');
    }
  });
  for (const match of source.matchAll(/\{([^{}]*)\}\s*=\s*CONFIG\b/g)) {
    for (const key of match[1].split(',').map(part => part.split(':')[0].trim()).filter(Boolean)) {
      if (!ENGINE_CONFIG_KEYS.includes(key)) problems.push(file + ': CONFIG.' + key + " (destrutturato) non e' nel contratto");
    }
  }
}

function scanForbiddenCalls(file, problems) {
  const source = stripComments(fs.readFileSync(path.join(ROOT, file), 'utf8'));
  if (file.startsWith('engine/')) scanEngineCoupling(file, source, problems);
  const lines = source.split('\n');
  lines.forEach((line, i) => {
    if (/\bMath\s*\.\s*random\b/.test(line) && !isMathRandomAllowed(file)) problems.push(file + ':' + (i + 1) + ': Math.random fuori da games/*/src/render.js ed engine/audio/synth.js (la simulazione usa Rng)');
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
