#!/usr/bin/env node
// engine/tools/build.js
'use strict';
/*
 * Builds every game in games/ (or only the ones named on the command line): node engine/tools/build.js [gameId...]
 *   dist/<id>.html          the game as a single minified file (double click to play)
 *   dist/site/<id>/         the game as an installable PWA (index.html, manifest, icons, service worker)
 *   dist/site/index.html    the hub listing every game found in dist/site
 * Sources stay readable; only the output is minified. Requires `npm install` (terser).
 * A game is games/<id>/ with game.json, index.html (its build:js block lists the scripts, paths relative to that page) and src/.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { encodeGrayscalePng } = require('./png');

let minifyScript;
try {
  ({ minify: minifyScript } = require('terser'));
} catch (error) {
  console.error('terser not found: run `npm install` first.');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..', '..');
const GAMES_DIR = path.join(ROOT, 'games');
const DIST_DIR = path.join(ROOT, 'dist');
const SITE_DIR = path.join(DIST_DIR, 'site');
const SPRITE_WIDTH = 32;
const HUB_TITLE = 'One Bit Games';

const PWA_HEAD_TAGS = '<link rel="manifest" href="manifest.webmanifest">' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="black">' +
  '<link rel="apple-touch-icon" href="icon-192.png">';
const SERVICE_WORKER_REGISTRATION = "<script>if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))" +
  "window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))</script>";

const kilobytes = text => (Buffer.byteLength(text) / 1024).toFixed(1) + ' KB';
const write = (directory, name, content) => fs.writeFileSync(path.join(directory, name), content);
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function insertBefore(html, marker, snippet) {
  const position = html.lastIndexOf(marker);
  return html.slice(0, position) + snippet + html.slice(position);
}

function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{};,>])\s*/g, '$1')
    .replace(/:\s+/g, ':')
    .replace(/;}/g, '}')
    .trim();
}

// Scripts are already minified by terser and must not be touched: whitespace inside strings is significant.
function minifyHtml(html) {
  return html.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)/).map(segment => {
    if (segment.startsWith('<script')) return segment;
    if (segment.startsWith('<style')) return segment.replace(/(<style[^>]*>)([\s\S]*?)(<\/style>)/, (_, open, css, close) => open + minifyCss(css) + close);
    return segment.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ' ').replace(/>\s+</g, '><');
  }).join('').trim();
}

function listGames(requestedIds) {
  const games = fs.readdirSync(GAMES_DIR, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(GAMES_DIR, entry.name, 'game.json')))
    .map(entry => ({ directory: path.join(GAMES_DIR, entry.name), ...JSON.parse(fs.readFileSync(path.join(GAMES_DIR, entry.name, 'game.json'), 'utf8')) }));
  for (const id of requestedIds) if (!games.some(game => game.id === id)) throw new Error('unknown game: ' + id);
  return games.filter(game => !requestedIds.length || requestedIds.includes(game.id));
}

async function buildBundle(game, indexHtml) {
  const scriptBlock = indexHtml.match(/<!-- build:js[^>]*-->([\s\S]*?)<!-- \/build:js -->/);
  if (!scriptBlock) throw new Error(game.id + ': build:js block not found in index.html');
  const sourcePaths = [...scriptBlock[1].matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => path.join(game.directory, match[1]));
  const sources = sourcePaths.map(sourcePath => {
    const code = fs.readFileSync(sourcePath, 'utf8').replace(/^'use strict';\s*/, '');
    return '// ===== ' + path.relative(ROOT, sourcePath).split(path.sep).join('/') + ' =====\n' + code;
  });
  const bundle = "(function () {\n'use strict';\n" + sources.join('\n') + '\n})();';
  const { code: minified } = await minifyScript(bundle, { compress: { passes: 2 }, mangle: true, format: { comments: false } });
  console.log(game.id + ' bundle: ' + sourcePaths.length + ' files, ' + kilobytes(bundle) + ' -> ' + kilobytes(minified));
  return { scriptBlock: scriptBlock[0], minified };
}

// Icon: a sprite read from the game's sources (game.json > icon), white on black.
function readIconRows(game) {
  const icon = game.icon;
  const sourceText = fs.readFileSync(path.join(game.directory, icon.file), 'utf8');
  const spriteMatch = sourceText.match(new RegExp('SPRITES\\.' + icon.sprite + ' = makeSprite\\(\\[([\\s\\S]*?)\\]\\);'));
  if (!spriteMatch) throw new Error(game.id + ': sprite ' + icon.sprite + ' not found in ' + icon.file);
  const rows = [...spriteMatch[1].matchAll(/'([.#]+)'/g)].map(match => match[1]);
  if (icon.rotorRow) rows[0] = '.' + '#'.repeat(SPRITE_WIDTH - 2) + '.';
  rows.push(...(icon.extraRows || []));
  return rows;
}

function renderIcon(iconRows, size, padding) {
  const pixels = new Uint8Array(size * size);
  const cellSize = Math.floor(size / (SPRITE_WIDTH + padding * 2));
  const offsetX = Math.floor((size - SPRITE_WIDTH * cellSize) / 2);
  const offsetY = Math.floor((size - iconRows.length * cellSize) / 2);
  iconRows.forEach((row, rowIndex) => [...row].forEach((cell, columnIndex) => {
    if (cell !== '#') return;
    for (let dy = 0; dy < cellSize; dy++) {
      for (let dx = 0; dx < cellSize; dx++) pixels[(offsetY + rowIndex * cellSize + dy) * size + offsetX + columnIndex * cellSize + dx] = 255;
    }
  }));
  return encodeGrayscalePng(size, size, pixels);
}

function buildManifest(game) {
  return JSON.stringify({
    name: game.title,
    short_name: game.shortName,
    lang: game.lang,
    description: game.description,
    start_url: './',
    scope: './',
    display: 'fullscreen',
    orientation: 'landscape',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  });
}

async function buildServiceWorker(game, version, assets) {
  const source = `'use strict';
const CACHE = '${game.id}-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
// CacheStorage is shared by every game on the same origin: only this game's old versions may be deleted.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('${game.id}-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request)));
});
`;
  return (await minifyScript(source, { compress: true, mangle: true })).code;
}

async function buildWebApp(game, page) {
  const webDir = path.join(SITE_DIR, game.id);
  fs.rmSync(webDir, { recursive: true, force: true });
  fs.mkdirSync(webDir, { recursive: true });
  const iconRows = readIconRows(game);
  write(webDir, 'icon-192.png', renderIcon(iconRows, 192, 3));
  write(webDir, 'icon-512.png', renderIcon(iconRows, 512, 3));
  write(webDir, 'icon-maskable-512.png', renderIcon(iconRows, 512, 9));
  write(webDir, 'manifest.webmanifest', buildManifest(game));
  const webPage = insertBefore(insertBefore(page, '</head>', PWA_HEAD_TAGS), '</body>', SERVICE_WORKER_REGISTRATION);
  write(webDir, 'index.html', webPage);
  const assets = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
  const version = crypto.createHash('sha1').update(webPage).digest('hex').slice(0, 10);
  write(webDir, 'sw.js', await buildServiceWorker(game, version, assets));
  console.log('dist/site/' + game.id + '/: installable app (' + kilobytes(webPage) + ')');
}

async function buildGame(game) {
  const indexHtml = fs.readFileSync(path.join(game.directory, 'index.html'), 'utf8');
  const { scriptBlock, minified } = await buildBundle(game, indexHtml);
  const page = minifyHtml(indexHtml.replace(scriptBlock, () => '<script>' + minified + '</script>'));
  fs.mkdirSync(DIST_DIR, { recursive: true });
  write(DIST_DIR, game.id + '.html', page);
  console.log('dist/' + game.id + '.html: ' + kilobytes(page));
  fs.mkdirSync(SITE_DIR, { recursive: true });
  await buildWebApp(game, page);
}

// The hub lists every game that has been built into dist/site (not only the ones built in this run). It works without JavaScript:
// they are plain links; the script only adds arrow-key navigation.
const HUB_STYLE = 'html,body{margin:0;background:#000;color:#fff;font:bold 16px/1.4 ui-monospace,Menlo,Consolas,monospace}' +
  'main{max-width:720px;margin:0 auto;padding:24px 16px}h1{font-size:24px;letter-spacing:3px;text-transform:uppercase;margin:0 0 24px}' +
  'ul{list-style:none;margin:0;padding:0;display:grid;gap:16px}' +
  'a{display:flex;gap:16px;align-items:center;color:#fff;text-decoration:none;border:2px solid #fff;padding:12px}' +
  'a:focus,a:hover{outline:0;background:#fff;color:#000}img{width:96px;height:96px;image-rendering:pixelated;flex:none}' +
  'strong{display:block;font-size:20px;text-transform:uppercase;letter-spacing:2px}span{display:block;font-weight:normal}';
const HUB_SCRIPT = "document.addEventListener('keydown',e=>{const l=[...document.querySelectorAll('a')],i=l.indexOf(document.activeElement);" +
  "const d=e.key==='ArrowDown'||e.key==='ArrowRight'?1:e.key==='ArrowUp'||e.key==='ArrowLeft'?-1:0;if(!d)return;e.preventDefault();" +
  "l[(i+d+l.length)%l.length].focus()});const f=document.querySelector('a');if(f)f.focus()";

function buildHub() {
  const builtIds = fs.readdirSync(SITE_DIR, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  const games = listGames([]).filter(game => builtIds.includes(game.id));
  const items = games.map(game =>
    '<li><a href="./' + game.id + '/"><img src="' + game.id + '/icon-192.png" alt="">' +
    '<div><strong>' + escapeHtml(game.title) + '</strong><span>' + escapeHtml(game.description) + '</span></div></a></li>').join('');
  const html = '<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + HUB_TITLE + '</title><style>' + HUB_STYLE + '</style></head><body><main><h1>' + HUB_TITLE + '</h1><ul>' + items + '</ul></main>' +
    '<script>' + HUB_SCRIPT + '</script></body></html>';
  write(SITE_DIR, 'index.html', html);
  console.log('dist/site/index.html: hub with ' + games.length + ' game(s)');
}

async function main() {
  for (const game of listGames(process.argv.slice(2))) await buildGame(game);
  buildHub();
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
