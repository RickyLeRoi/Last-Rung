// games/valanga/src/ground.js
'use strict';
// Thin wrappers around the engine terrain plus a cache of the top surface (the snowfall and the drawing read it every frame).
const SNOW = CONFIG.material.snow;
const ROCK = CONFIG.material.rock;

const surfaceAt = x => game.L.surface[clamp(Math.floor(x), 0, game.L.width - 1)];
const groundBelow = (x, fromY) => Terrain.surfaceY(game.L.terrain, x, fromY);
const hitsGround = (x, y, width, height) => Terrain.hitsRect(game.L.terrain, x, y, width, height);

// Columns where the snow may have lost its support: settleSnow() lets it fall until it rests again.
function markLoose(fromX, toX) {
  const level = game.L;
  for (let x = Math.max(0, Math.floor(fromX)); x <= Math.min(level.width - 1, Math.ceil(toX)); x++) level.loose[x] = 1;
}

function refreshSurface(fromX, toX) {
  const level = game.L;
  for (let x = Math.max(0, Math.floor(fromX)); x <= Math.min(level.width - 1, Math.ceil(toX)); x++) level.surface[x] = Terrain.surfaceY(level.terrain, x, 0);
}

function carveSnow(x, y, radius) {
  const removed = Terrain.carveCircle(game.L.terrain, x, y, radius, SNOW);
  if (removed) { refreshSurface(x - radius - 1, x + radius + 1); markLoose(x - radius - 1, x + radius + 1); }
  return removed;
}

function depositSnow(x, y, radius) {
  const added = Terrain.fillCircle(game.L.terrain, x, y, radius, SNOW, true);
  if (added) { refreshSurface(x - radius - 1, x + radius + 1); markLoose(x - radius - 1, x + radius + 1); }
  return added;
}

// Snow is loose: dig under it (sideways) and it comes down, one row per frame. onFall(x, y) is told where each cell lands.
function settleSnow(onFall) {
  const level = game.L;
  let moved = 0;
  for (let x = 0; x < level.width; x++) {
    if (!level.loose[x]) continue;
    const columnMoved = Terrain.settleColumn(level.terrain, x, SNOW, onFall);
    if (columnMoved) { level.surface[x] = Terrain.surfaceY(level.terrain, x, 0); moved += columnMoved; } else level.loose[x] = 0;
  }
  return moved;
}

const addParticle = particle => Particles.add(game.parts, particle, CONFIG.maxParticles);

// Powder stops in the snow, debris lands on it.
const PARTICLE_HOOKS = {
  pixel: particle => { if (!Terrain.isSolid(game.L.terrain, particle.x, particle.y)) return false; particle.life = 0; return true; },
  solidAt: (x, y, width, height) => hitsGround(x, y, width, height),
};

function updateParticles() {
  Particles.update(game.parts, { wind: game.wind, gravity: 0.15, screenHeight: game.L.height, max: CONFIG.maxParticles, waterY: () => Infinity, solids: [], hooks: PARTICLE_HOOKS });
}

function snowBurst(x, y, count, directionX) {
  for (let i = 0; i < count; i++) addParticle({ t: 'chunk', x: x + randomRange(-2, 2), y: y - 2, w: 2, h: 2, vx: directionX * randomRange(0.5, 1.5), vy: -randomRange(0.8, 2), life: 80 });
}
