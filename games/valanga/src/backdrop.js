// games/valanga/src/backdrop.js
'use strict';
// Mountain ranges behind the slope, scrolling on both axes. The seed is one number drawn from the level generator
// (where the old hand-made ridge drew its phase), so the rest of the level layout stays the same.
function makeBackdrop(seed) {
  const random = mulberry32(seed), config = CONFIG.backdrop;
  const ridgeLayer = (shape, factor, fill, edge) => ({ factor, factorY: factor, baseY: config.baseY, profile: Parallax.ridge(random, { ...shape, baseY: config.baseY }), fill, edge });
  return [
    ridgeLayer(config.peaks, 0.12, '#000', 'dotted'),
    ridgeLayer(config.range, 0.3, '#000', 'dotted'),
  ];
}
