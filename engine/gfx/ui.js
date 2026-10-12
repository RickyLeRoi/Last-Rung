// engine/gfx/ui.js
'use strict';
// Small drawing helpers shared by every game's HUD and panels.
const UI = (() => {
  const { canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT, RED, outlineRect, text, drawSpriteScaled } = Gfx;

  // Text variant for the active input device (Input.device: 'touch', 'pad' or keyboard).
  const hint = (keyboard, touch, gamepad) => (Input.device === 'touch' ? touch : Input.device === 'pad' ? gamepad : keyboard);

  function bar(x, y, width, fraction) {
    outlineRect(x, y, width, 7);
    canvasContext.fillRect(x + 1, y + 1, round((width - 2) * clamp(fraction, 0, 1)), 5);
  }

  // Three stars centered on the screen; sprites = { on, off }.
  function stars(sprites, count, y) {
    for (let i = 0; i < 3; i++) drawSpriteScaled(i < count ? sprites.on : sprites.off, SCREEN_WIDTH / 2 - 31 + i * 22, y, 2);
  }

  function lines(textLines, centerX, startY, step) {
    textLines.forEach((line, i) => text(line, centerX, startY + i * step, 1, 'c'));
  }

  // Red pixels are queued and painted last, so a full-screen inversion does not turn them blue.
  const redPixels = [];
  const red = {
    add(x, y) { redPixels.push(x, y); },
    clear() { redPixels.length = 0; },
    flush() {
      if (!redPixels.length) return;
      canvasContext.fillStyle = RED;
      for (let i = 0; i < redPixels.length; i += 2) canvasContext.fillRect(redPixels[i], redPixels[i + 1], 1, 1);
      canvasContext.fillStyle = '#fff';
    },
  };

  function invert() {
    canvasContext.fillStyle = '#fff';
    canvasContext.globalCompositeOperation = 'difference';
    canvasContext.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    canvasContext.globalCompositeOperation = 'source-over';
  }

  return { hint, bar, stars, lines, red, invert };
})();
