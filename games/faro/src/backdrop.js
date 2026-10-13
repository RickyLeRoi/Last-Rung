// games/faro/src/backdrop.js
'use strict';
// Far coast behind the sea. Own generator: the level layout and the simulation never see these numbers.
// The sea fits one screen, so the layers do not scroll: depth comes from overlap and sparser edges.
const BACKDROP_SEED_SALT = 0x3c6ef372;

function makeBackdrop(spec) {
  const random = mulberry32((spec.seed ^ BACKDROP_SEED_SALT) >>> 0), horizon = CONFIG.sea.base, config = CONFIG.backdrop;
  const ridgeLayer = (shape, edge) => ({ factor: 0, baseY: horizon, profile: Parallax.ridge(random, { ...shape, baseY: horizon }), fill: '#000', edge });
  const mountains = ridgeLayer(config.mountains, 'dotted'), coast = ridgeLayer(config.coast, 'dotted');
  coast.details = [];
  const villageX = CONFIG.W / 2 + Math.floor(random() * CONFIG.W / 3);
  for (let i = 0; i < config.lights; i++) {
    const x = villageX + Math.floor(random() * 40), room = horizon - coast.profile[x % coast.profile.length] - 3;
    if (room > 0) coast.details.push(x, coast.profile[x % coast.profile.length] + 2 + Math.floor(random() * room));
  }
  return [mountains, coast];
}
