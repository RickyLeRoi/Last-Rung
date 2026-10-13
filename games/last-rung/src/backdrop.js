// games/last-rung/src/backdrop.js
'use strict';
// Parallax backdrop per scenario. Own generator: the level layout and the simulation never see these numbers.
const BACKDROP_SEED_SALT = 0x2545f491;

function backdropLights(random, layer, count, clusterWidth) {
  const profile = layer.profile, details = [];
  const centerX = Math.floor(random() * profile.length);
  for (let i = 0; i < count; i++) {
    const x = (centerX + Math.floor(random() * clusterWidth)) % profile.length, room = layer.baseY - profile[x] - 3;
    if (room > 0) details.push(x, profile[x] + 2 + Math.floor(random() * room));
  }
  return details;
}

function cityLayer(skyline, horizon) {
  if (!skyline.length) return null;
  const offsetX = skyline[0].x, last = skyline[skyline.length - 1];
  const blocks = skyline.map(building => ({ x: building.x, y: building.y, w: building.w + 1 }));
  const details = [];
  for (const building of skyline) for (let i = 0; i < building.lights.length; i += 2) details.push(building.x + building.lights[i] - offsetX, building.y + building.lights[i + 1]);
  return { factor: 0.35, offsetX, wrap: false, baseY: horizon, profile: Parallax.blocks(blocks, offsetX, last.x + last.w + 1 - offsetX), fill: '#000', edge: 'dotted', details };
}

function makeBackdrop(level) {
  const random = mulberry32((level.spec.seed ^ BACKDROP_SEED_SALT) >>> 0), horizon = level.horizon, config = CONFIG.backdrop;
  const ridgeLayer = (shape, factor, fill, edge) => ({ factor, baseY: horizon, profile: Parallax.ridge(random, { ...shape, baseY: horizon }), fill, edge });
  const layers = [];
  if (level.sc.id === 'storm') {
    layers.push(ridgeLayer(config.stormCoast, 0.04, '#000', 'dotted'));
  } else if (level.sc.id === 'sea') {
    layers.push(ridgeLayer(config.seaMountains, 0.04, '#000', 'dotted'));
    const coast = ridgeLayer(config.seaCoast, 0.1, '#000', 'solid');
    coast.details = [];
    for (let village = 0; village < config.villages; village++) coast.details.push(...backdropLights(random, coast, 6, 40));
    layers.push(coast);
  } else {
    const shapes = level.sc.id === 'fire' ? config.fire : config.city;
    layers.push(ridgeLayer(shapes.mountains, 0.05, '#000', 'dotted'));
    const hills = ridgeLayer(shapes.hills, 0.15, Gfx.DARK, 'solid');
    hills.details = backdropLights(random, hills, 10, hills.profile.length);
    layers.push(hills);
  }
  const city = cityLayer(level.skyline, horizon);
  if (city) layers.push(city);
  return layers;
}
