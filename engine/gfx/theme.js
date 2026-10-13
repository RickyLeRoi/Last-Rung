// engine/gfx/theme.js
'use strict';
/*
 * Day and night. With the device in dark mode everything stays as drawn (night: white on black). In light mode the scene decides:
 * by day black and white swap (white background, black pixels), the coloured pixels keep their colour.
 * Read only while drawing: the simulation never depends on the device theme (the test harness has no matchMedia, so it is always night).
 */
const Theme = (() => {
  const lightQuery = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: light)') : null;
  let current = '';

  const isLightDevice = () => !!(lightQuery && lightQuery.matches);
  // By day: light device theme and a day scene (games skip stars and moon then).
  const isDay = isDayScene => isLightDevice() && !!isDayScene;

  /*
   * Called at the very end of a frame. isDayScene: the level is set by day. repaintColors(): redraws the game's coloured pixels with
   * its own transform (they were inverted with the rest). Writes data-theme on <html> for the page around the canvas.
   */
  function finishFrame(isDayScene, repaintColors) {
    const day = isDay(isDayScene);
    if (day) {
      UI.invert();
      if (repaintColors) repaintColors();
    }
    const theme = day ? 'day' : 'night';
    if (theme === current) return;
    current = theme;
    if (typeof document !== 'undefined' && document.documentElement && document.documentElement.dataset) document.documentElement.dataset.theme = theme;
  }

  return { finishFrame, isDay, isLightDevice };
})();
