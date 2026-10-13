// games/formicaio/src/soil.js
'use strict';
// Terrain changes: digging, the mound, plugs, sand that slides into the galleries and rain water that runs down them.
// Every change refreshes the surface cache and marks the columns whose loose material may move.
const MATERIAL = CONFIG.material;

const surfaceAt = x => game.L.surface[clamp(Math.floor(x), 0, game.L.width - 1)];
const foodY = food => surfaceAt(food.x) - 1;

function touchColumns(fromX, toX) {
  const level = game.L;
  for (let x = Math.max(0, Math.floor(fromX)); x <= Math.min(level.width - 1, Math.ceil(toX)); x++) {
    level.surface[x] = Terrain.surfaceY(level.terrain, x, 0);
    level.looseSand[x] = 1;
    level.looseWater[x] = 1;
  }
  level.fieldsDirty = true;
}

// One cell of soil or sand dug out by an ant; the disc never eats stone, roots or water.
function digCell(cellX, cellY) {
  const level = game.L, x = cellCenter(cellX), y = cellCenter(cellY), radius = CONFIG.dig.radius;
  Terrain.carveCircle(level.terrain, x, y, radius, MATERIAL.soil);
  Terrain.carveCircle(level.terrain, x, y, radius, MATERIAL.sand);
  level.digOrder[gridIndex(cellX, cellY)] = 0;
  level.dug++;
  touchColumns(x - radius - 1, x + radius + 1);
  for (let i = 0; i < 3; i++) addParticle({ t: 'chunk', x: x + randomRange(-1, 1), y, w: 1, h: 1, vx: randomRange(-0.6, 0.6), vy: -randomRange(0.3, 0.9), life: 40 });
}

function plugCell(cellX, cellY) {
  const level = game.L, x = cellCenter(cellX), y = cellCenter(cellY), radius = CONFIG.dig.radius;
  Terrain.fillCircle(level.terrain, x, y, radius, MATERIAL.soil, true);
  touchColumns(x - radius - 1, x + radius + 1);
}

// The mound around the entrance: each grain goes where the cone is lowest compared with its ideal shape, never into the hole.
function moundColumn(fromMound) {
  const level = game.L, center = level.entranceX, hole = CONFIG.nest.shaftRadius + 2;
  let bestX = -1, bestScore = -Infinity;
  for (let x = center - 22; x <= center + 22; x++) {
    const distance = Math.abs(x - center);
    if (distance <= hole || x < 0 || x >= level.width) continue;
    const ideal = level.groundY - Math.max(0, 14 - distance * 0.6), room = surfaceAt(x) - ideal;
    const score = fromMound ? -room : room;
    if (score > bestScore || (score === bestScore && x < bestX)) { bestScore = score; bestX = x; }
  }
  return bestX;
}

function dumpSoil() {
  const level = game.L, x = moundColumn(false);
  if (x < 0) return;
  Terrain.fillRect(level.terrain, x, surfaceAt(x) - 1, 1, 1, MATERIAL.sand);
  level.moundCells++;
  touchColumns(x, x);
}

function takeSoil() {
  const level = game.L;
  if (level.moundCells <= 0) return;
  const x = moundColumn(true);
  if (x < 0 || Terrain.get(level.terrain, x, surfaceAt(x)) !== MATERIAL.sand) return;
  Terrain.fillRect(level.terrain, x, surfaceAt(x), 1, 1, 0);
  level.moundCells--;
  touchColumns(x, x);
}

// Sand with nothing under it falls one row per frame; anyone in its way is pushed out or crushed (ants.js).
function settleSand() {
  const level = game.L;
  let moved = 0;
  for (let x = 0; x < level.width; x++) {
    if (!level.looseSand[x]) continue;
    const columnMoved = Terrain.settleColumn(level.terrain, x, MATERIAL.sand);
    if (columnMoved) { level.surface[x] = Terrain.surfaceY(level.terrain, x, 0); level.looseWater[x] = 1; moved += columnMoved; } else level.looseSand[x] = 0;
  }
  if (moved) level.fieldsDirty = true;
  return moved;
}

// Water runs down and sideways (engine liquid); resting water soaks into the soil under it, slowly.
function flowWater() {
  const level = game.L, parity = game.frame & 1;
  let moved = 0;
  const markNeighbours = (fromX, toX) => {
    for (const x of [fromX - 1, fromX, fromX + 1, toX - 1, toX + 1]) if (x >= 0 && x < level.width) level.looseWater[x] = 1;
  };
  for (let x = 0; x < level.width; x++) {
    if (!level.looseWater[x]) continue;
    const columnMoved = Terrain.flowColumn(level.terrain, x, MATERIAL.water, parity, markNeighbours);
    level.surface[x] = Terrain.surfaceY(level.terrain, x, 0);
    if (columnMoved) { moved += columnMoved; continue; }
    if (!soakColumn(x)) level.looseWater[x] = 0;
  }
  if (moved) level.fieldsDirty = true;
}

// Returns true while the column still holds water (it must be checked again).
function soakColumn(x) {
  const level = game.L, terrain = level.terrain;
  let hasWater = false;
  for (let y = level.height - 1; y >= 0; y--) {
    if (Terrain.get(terrain, x, y) !== MATERIAL.water) continue;
    hasWater = true;
    const below = Terrain.get(terrain, x, y + 1);
    if ((below === MATERIAL.soil || below === MATERIAL.sand) && chance(CONFIG.rain.absorb)) {
      Terrain.fillRect(terrain, x, y, 1, 1, 0);
      level.fieldsDirty = true;
    }
    return true;
  }
  return hasWater;
}

const isRaining = () => game.L.showers.some(shower => game.clock >= shower.start && game.clock < shower.end);

// During a shower water pours into every open hole: columns where the ground is dug below the original grass line.
function pourRain() {
  const level = game.L;
  if (!isRaining() || game.clock % CONFIG.rain.dropEvery) return;
  for (let x = 0; x < level.width; x++) {
    if (level.surface[x] <= level.groundY + 3) continue;
    if (Terrain.get(level.terrain, x, level.groundY - 2) !== 0) continue;
    Terrain.fillRect(level.terrain, x, level.groundY - 2, 1, 1, MATERIAL.water);
    level.looseWater[x] = 1;
  }
}

const addParticle = particle => Particles.add(game.parts, particle, CONFIG.maxParticles);

const PARTICLE_HOOKS = {
  pixel: particle => { if (!Terrain.isSolid(game.L.terrain, particle.x, particle.y)) return false; particle.life = 0; return true; },
  solidAt: (x, y, width, height) => Terrain.hitsRect(game.L.terrain, x, y, width, height),
};

function updateParticles() {
  Particles.update(game.parts, { wind: game.wind, gravity: 0.15, screenHeight: game.L.height, max: CONFIG.maxParticles, waterY: () => Infinity, solids: [], hooks: PARTICLE_HOOKS });
}
