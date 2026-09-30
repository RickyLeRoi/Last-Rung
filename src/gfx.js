'use strict';
// Only #fff and #000 (plus blood red) and integer coordinates: no antialiasing, hence no greys.
const Gfx = (() => {
  const { W: SCREEN_WIDTH, H: SCREEN_HEIGHT } = CONFIG;
  const canvas = document.getElementById('game');
  const canvasContext = canvas.getContext('2d', { alpha: false });

  function fit() {
    const touchControls = document.getElementById('touch');
    const gutter = touchControls && touchControls.classList && touchControls.classList.contains('on') ? 2 * 84 : 0;
    const fitScale = Math.min((window.innerWidth - gutter) / SCREEN_WIDTH, window.innerHeight / SCREEN_HEIGHT);
    const integerScale = Math.floor(fitScale);
    // integer scale when it wastes little space (pixel-perfect), fractional otherwise (phones)
    const scale = integerScale >= 1 && integerScale / fitScale > 0.8 ? integerScale : Math.max(0.25, fitScale);
    canvas.style.width = Math.floor(SCREEN_WIDTH * scale) + 'px';
    canvas.style.height = Math.floor(SCREEN_HEIGHT * scale) + 'px';
  }
  window.addEventListener('resize', fit);
  fit();

  const ditherCanvas = document.createElement('canvas');
  ditherCanvas.width = 2; ditherCanvas.height = 2;
  const ditherContext = ditherCanvas.getContext('2d');
  ditherContext.fillStyle = '#000'; ditherContext.fillRect(0, 0, 1, 1); ditherContext.fillRect(1, 1, 1, 1);
  const DITHER = canvasContext.createPattern(ditherCanvas, 'repeat');
  const darkCanvas = document.createElement('canvas');
  darkCanvas.width = 4; darkCanvas.height = 4;
  const darkContext = darkCanvas.getContext('2d');
  darkContext.fillStyle = '#000';
  const darkLitPixels = new Set(['0,0', '2,1', '1,2', '3,3']);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!darkLitPixels.has(x + ',' + y)) darkContext.fillRect(x, y, 1, 1);
  const DARK = canvasContext.createPattern(darkCanvas, 'repeat');
  const duskCanvas = document.createElement('canvas');
  duskCanvas.width = 4; duskCanvas.height = 4;
  const duskContext = duskCanvas.getContext('2d');
  duskContext.fillStyle = '#000';
  const duskLitPixels = new Set(['0,0', '2,0', '3,1', '1,2', '3,2', '0,3']);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (!duskLitPixels.has(x + ',' + y)) duskContext.fillRect(x, y, 1, 1);
  const DUSK = canvasContext.createPattern(duskCanvas, 'repeat');

  const RED = '#d00';   // blood: the only exception to black and white
  const pixel = (x, y) => canvasContext.fillRect(round(x), round(y), 1, 1);

  function horizontalLine(startX, endX, y) {
    startX = round(startX); endX = round(endX); if (endX < startX) { const swapped = startX; startX = endX; endX = swapped; }
    canvasContext.fillRect(startX, round(y), endX - startX + 1, 1);
  }
  function verticalLine(x, startY, endY) {
    startY = round(startY); endY = round(endY); if (endY < startY) { const swapped = startY; startY = endY; endY = swapped; }
    canvasContext.fillRect(round(x), startY, 1, endY - startY + 1);
  }
  function outlineRect(x, y, width, height) {
    x = round(x); y = round(y); width = round(width); height = round(height);
    if (width <= 0 || height <= 0) return;
    canvasContext.fillRect(x, y, width, 1); canvasContext.fillRect(x, y + height - 1, width, 1);
    canvasContext.fillRect(x, y, 1, height); canvasContext.fillRect(x + width - 1, y, 1, height);
  }
  function blackRect(x, y, width, height) {
    canvasContext.fillStyle = '#000'; canvasContext.fillRect(round(x), round(y), round(width), round(height)); canvasContext.fillStyle = '#fff';
  }
  // dot = dashed line
  function drawLine(startX, startY, endX, endY, dot) {
    startX = round(startX); startY = round(startY); endX = round(endX); endY = round(endY);
    const deltaX = Math.abs(endX - startX), stepX = startX < endX ? 1 : -1, deltaY = -Math.abs(endY - startY), stepY = startY < endY ? 1 : -1;
    let error = deltaX + deltaY, i = 0;
    for (;;) {
      if (!dot || (i++ & 1) === 0) canvasContext.fillRect(startX, startY, 1, 1);
      if (startX === endX && startY === endY) break;
      const doubleError = 2 * error;
      if (doubleError >= deltaY) { error += deltaY; startX += stepX; }
      if (doubleError <= deltaX) { error += deltaX; startY += stepY; }
    }
  }
  function drawCircle(centerX, centerY, radius, dot) {
    centerX = round(centerX); centerY = round(centerY); radius = round(radius);
    if (radius <= 0) { canvasContext.fillRect(centerX, centerY, 1, 1); return; }
    let x = radius, y = 0, decision = 1 - radius, i = 0;
    while (x >= y) {
      if (!dot || (i & 1) === 0) {
        canvasContext.fillRect(centerX + x, centerY + y, 1, 1); canvasContext.fillRect(centerX + y, centerY + x, 1, 1);
        canvasContext.fillRect(centerX - y, centerY + x, 1, 1); canvasContext.fillRect(centerX - x, centerY + y, 1, 1);
        canvasContext.fillRect(centerX - x, centerY - y, 1, 1); canvasContext.fillRect(centerX - y, centerY - x, 1, 1);
        canvasContext.fillRect(centerX + y, centerY - x, 1, 1); canvasContext.fillRect(centerX + x, centerY - y, 1, 1);
      }
      i++; y++;
      if (decision < 0) decision += 2 * y + 1; else { x--; decision += 2 * (y - x) + 1; }
    }
  }

  const FONT = {
    A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7], F: [7, 4, 6, 4, 4],
    G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2], K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7],
    M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2], P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5],
    S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2], U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5],
    Y: [5, 5, 2, 2, 2], Z: [7, 1, 2, 4, 7],
    0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6], 4: [5, 5, 7, 1, 1],
    5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 2, 2, 2], 8: [7, 5, 7, 5, 7], 9: [7, 5, 7, 1, 6],
    ' ': [0, 0, 0, 0, 0], ':': [0, 2, 0, 2, 0], '.': [0, 0, 0, 0, 2], ',': [0, 0, 0, 2, 4], '!': [2, 2, 2, 0, 2],
    '?': [6, 1, 2, 0, 2], '-': [0, 0, 7, 0, 0], '+': [0, 2, 7, 2, 0], '/': [1, 1, 2, 4, 4], '%': [5, 1, 2, 4, 5],
    "'": [2, 2, 0, 0, 0], '>': [4, 2, 1, 2, 4], '<': [1, 2, 4, 2, 1], '(': [1, 2, 2, 2, 1], ')': [4, 2, 2, 2, 4],
    '=': [0, 7, 0, 7, 0], '|': [2, 2, 2, 2, 2], '▲': [0, 2, 7, 0, 0], '▼': [0, 7, 2, 0, 0],
  };
  const normalizeText = value => String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const textWidth = (message, scale) => normalizeText(message).length * 4 * (scale || 1) - (scale || 1);

  function text(message, x, y, scale, align) {
    scale = scale || 1; message = normalizeText(message);
    const width = message.length * 4 * scale - scale;
    if (align === 'c') x -= Math.floor(width / 2); else if (align === 'r') x -= width;
    x = round(x); y = round(y);
    for (let i = 0; i < message.length; i++) {
      const glyph = FONT[message[i]] || FONT['?'];
      for (let row = 0; row < 5; row++) {
        const rowBits = glyph[row]; if (!rowBits) continue;
        if (rowBits & 4) canvasContext.fillRect(x, y + row * scale, scale, scale);
        if (rowBits & 2) canvasContext.fillRect(x + scale, y + row * scale, scale, scale);
        if (rowBits & 1) canvasContext.fillRect(x + 2 * scale, y + row * scale, scale, scale);
      }
      x += 4 * scale;
    }
  }
  function textBox(message, x, y, align) {
    const width = textWidth(message, 1);
    const left = align === 'c' ? x - Math.floor(width / 2) : align === 'r' ? x - width : x;
    blackRect(left - 2, y - 2, width + 4, 9);
    text(message, x, y, 1, align);
  }
  function drawPanel(x, y, width, height) {
    blackRect(x, y, width, height); outlineRect(x, y, width, height); outlineRect(x + 2, y + 2, width - 4, height - 4);
  }
  // skew tilts the legs only (swinging hanging people)
  function drawSprite(sprite, x, y, flip, skew) {
    x = round(x); y = round(y);
    const pixels = sprite.p;
    for (let i = 0; i < pixels.length; i += 2) {
      const sourceX = pixels[i], sourceY = pixels[i + 1];
      let offsetX = flip ? sprite.w - 1 - sourceX : sourceX;
      if (skew && sourceY >= 4) offsetX += round(skew * (sourceY - 3) / 4);
      canvasContext.fillRect(x + offsetX, y + sourceY, 1, 1);
    }
  }
  function drawSpriteScaled(sprite, x, y, scale) {
    x = round(x); y = round(y);
    for (let i = 0; i < sprite.p.length; i += 2) canvasContext.fillRect(x + sprite.p[i] * scale, y + sprite.p[i + 1] * scale, scale, scale);
  }

  return { canvas, canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT, DITHER, DARK, DUSK, RED, fit, pixel, horizontalLine, verticalLine, outlineRect, blackRect, drawLine, drawCircle, text, textBox, textWidth, drawPanel, drawSprite, drawSpriteScaled };
})();
