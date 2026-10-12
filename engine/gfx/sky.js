// engine/gfx/sky.js
'use strict';
// Night sky: stars and moon drawn only where nothing in the scene covers them (column by column).
const Sky = (() => {
  const { canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT } = Gfx;

  /*
   * cameraX: world x of the left screen edge. covers: flat [fromX, toX, y, ...] in screen columns, everything at or below y is hidden
   * behind the scene. waterY(worldX): water surface (Infinity where there is none). stars: [{ x, y, tw, ph }] (tw: twinkles with phase ph).
   * moon: { x, y, pixels: [[dx, dy], ...] } or null. frame drives the twinkle.
   */
  function drawNight({ cameraX, covers, waterY, stars, moon, frame }) {
    const columnTop = new Int16Array(SCREEN_WIDTH).fill(SCREEN_HEIGHT);
    for (let i = 0; i < covers.length; i += 3) {
      const y = covers[i + 2];
      for (let column = Math.max(0, Math.floor(covers[i])); column < Math.min(SCREEN_WIDTH, Math.ceil(covers[i + 1])); column++) if (y < columnTop[column]) columnTop[column] = y;
    }
    for (let column = 0; column < SCREEN_WIDTH; column++) { const surfaceY = waterY(column + cameraX); if (surfaceY - 1 < columnTop[column]) columnTop[column] = round(surfaceY) - 1; }
    const isVisible = (x, y) => x >= 0 && x < SCREEN_WIDTH && y < columnTop[x];
    for (const star of stars) {
      const x = round(star.x - cameraX * 0.08);
      if (!isVisible(x, star.y) || (star.tw && ((frame + star.ph) % 120) < 10)) continue;
      canvasContext.fillRect(x, star.y, 1, 1);
    }
    if (moon) {
      const moonX = round(moon.x - cameraX * 0.03), moonY = moon.y;
      for (const moonPixel of moon.pixels) if (isVisible(moonX + moonPixel[0], moonY + moonPixel[1])) canvasContext.fillRect(moonX + moonPixel[0], moonY + moonPixel[1], 1, 1);
    }
  }

  return { drawNight };
})();
