// engine/gfx/sprite.js
'use strict';
function makeSprite(rows) {
  const pixels = [];
  rows.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] === '#') pixels.push(x, y); });
  return { w: rows[0].length, h: rows.length, p: pixels };
}
function outlineSprite(sprite) {
  const filled = new Set();
  for (let i = 0; i < sprite.p.length; i += 2) filled.add(sprite.p[i] + ',' + sprite.p[i + 1]);
  const pixels = [];
  for (let i = 0; i < sprite.p.length; i += 2) {
    const x = sprite.p[i], y = sprite.p[i + 1];
    if (!filled.has((x - 1) + ',' + y) || !filled.has((x + 1) + ',' + y) || !filled.has(x + ',' + (y - 1)) || !filled.has(x + ',' + (y + 1))) pixels.push(x, y);
  }
  return { w: sprite.w, h: sprite.h, p: pixels };
}
