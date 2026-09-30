#!/usr/bin/env node
'use strict';
/*
 * Builds dist/last-rung.html (single minified file) and dist/web/ (installable PWA).
 * Sources stay readable; only the output is minified. Requires `npm install` (terser).
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

let minifyScript;
try {
  ({ minify: minifyScript } = require('terser'));
} catch (error) {
  console.error('terser not found: run `npm install` first.');
  process.exit(1);
}

const ROOT = __dirname;
const DIST_DIR = path.join(ROOT, 'dist');
const WEB_DIR = path.join(DIST_DIR, 'web');
const SPRITE_WIDTH = 32;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

const PWA_HEAD_TAGS = '<link rel="manifest" href="manifest.webmanifest">' +
  '<meta name="apple-mobile-web-app-status-bar-style" content="black">' +
  '<link rel="apple-touch-icon" href="icon-192.png">';
const SERVICE_WORKER_REGISTRATION = "<script>if('serviceWorker'in navigator&&/^https?:$/.test(location.protocol))" +
  "window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}))</script>";

const kilobytes = text => (Buffer.byteLength(text) / 1024).toFixed(1) + ' KB';
const write = (directory, name, content) => fs.writeFileSync(path.join(directory, name), content);

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

async function buildBundle(indexHtml) {
  const scriptBlock = indexHtml.match(/<!-- build:js[^>]*-->([\s\S]*?)<!-- \/build:js -->/);
  if (!scriptBlock) throw new Error('build:js block not found in index.html');
  const sourcePaths = [...scriptBlock[1].matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  const sources = sourcePaths.map(sourcePath => {
    const code = fs.readFileSync(path.join(ROOT, sourcePath), 'utf8').replace(/^'use strict';\s*/, '');
    return '// ===== ' + sourcePath + ' =====\n' + code;
  });
  const bundle = "(function () {\n'use strict';\n" + sources.join('\n') + '\n})();';
  const { code: minified } = await minifyScript(bundle, { compress: { passes: 2 }, mangle: true, format: { comments: false } });
  console.log('bundle: ' + sourcePaths.length + ' files, ' + kilobytes(bundle) + ' -> ' + kilobytes(minified));
  return { scriptBlock: scriptBlock[0], minified };
}

function encodeGrayscalePng(width, height, pixels) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let value = n;
    for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    return value >>> 0;
  });
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const typedData = Buffer.concat([Buffer.from(type), data]);
    const checksum = Buffer.alloc(4);
    checksum.writeUInt32BE(crc32(typedData));
    return Buffer.concat([length, typedData, checksum]);
  };
  const scanlines = Buffer.alloc((width + 1) * height);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) scanlines[row * (width + 1) + 1 + column] = pixels[row * width + column];
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  return Buffer.concat([PNG_SIGNATURE, chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(scanlines)), chunk('IEND', Buffer.alloc(0))]);
}

// Icon: the heli sprite (read from sprites.js) with rotor blades and ladder, white on black.
function readIconRows() {
  const spriteSource = fs.readFileSync(path.join(ROOT, 'src', 'sprites.js'), 'utf8').match(/SPRITES\.heli = makeSprite\(\[([\s\S]*?)\]\);/)[1];
  const rows = [...spriteSource.matchAll(/'([.#]+)'/g)].map(match => match[1]);
  rows[0] = '.' + '#'.repeat(30) + '.';
  rows.push('..............#..#..............', '..............####..............');
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

function buildManifest() {
  return JSON.stringify({
    name: 'Last Rung',
    short_name: 'Last Rung',
    lang: 'it',
    description: 'Soccorso in elicottero, pixel art bianco su nero.',
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

async function buildServiceWorker(version, assets) {
  const source = `'use strict';
const CACHE = 'last-rung-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request)));
});
`;
  return (await minifyScript(source, { compress: true, mangle: true })).code;
}

async function buildWebApp(page) {
  fs.mkdirSync(WEB_DIR, { recursive: true });
  const iconRows = readIconRows();
  write(WEB_DIR, 'icon-192.png', renderIcon(iconRows, 192, 3));
  write(WEB_DIR, 'icon-512.png', renderIcon(iconRows, 512, 3));
  write(WEB_DIR, 'icon-maskable-512.png', renderIcon(iconRows, 512, 9));
  write(WEB_DIR, 'manifest.webmanifest', buildManifest());
  const webPage = insertBefore(insertBefore(page, '</head>', PWA_HEAD_TAGS), '</body>', SERVICE_WORKER_REGISTRATION);
  write(WEB_DIR, 'index.html', webPage);
  const assets = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'];
  const version = crypto.createHash('sha1').update(webPage).digest('hex').slice(0, 10);
  write(WEB_DIR, 'sw.js', await buildServiceWorker(version, assets));
  console.log('dist/web/: installable app (' + kilobytes(webPage) + ')');
}

async function main() {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const { scriptBlock, minified } = await buildBundle(indexHtml);
  const page = minifyHtml(indexHtml.replace(scriptBlock, () => '<script>' + minified + '</script>'));
  fs.mkdirSync(DIST_DIR, { recursive: true });
  write(DIST_DIR, 'last-rung.html', page);
  console.log('dist/last-rung.html: ' + kilobytes(page));
  await buildWebApp(page);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
