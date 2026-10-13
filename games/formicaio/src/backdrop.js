// games/formicaio/src/backdrop.js
'use strict';
// Hills and bushes behind the meadow. They scroll slower than the ground sideways but stay on the horizon vertically (factorY 1).
// Own generator: the level layout and the simulation never see these numbers.
const BACKDROP_SEED_SALT = 0x1b873593;

function makeBackdrop(spec) {
  const random = mulberry32((spec.seed ^ BACKDROP_SEED_SALT) >>> 0), groundY = CONFIG.world.groundY, config = CONFIG.backdrop;
  const ridgeLayer = (shape, factor, edge) => ({ factor, factorY: 1, baseY: groundY, profile: Parallax.ridge(random, { ...shape, baseY: groundY }), fill: '#000', edge });
  return [ridgeLayer(config.hills, 0.2, 'dotted'), ridgeLayer(config.bushes, 0.5, 'solid')];
}
