// games/formicaio/src/grid.js
'use strict';
/*
 * The ants' coarse grid over the terrain mask. A cell is free when the pixel at its centre is empty; above the original ground line
 * it is also walkable only with solid ground under it (ants walk on the grass and on the mound, they do not fly).
 * Distance fields lead the ants: one per goal, recomputed every few frames. A step costs 1 under ground and on a fresh trail,
 * more on open grass: a trail drawn by the player (or left by the foragers) is the path the ants prefer.
 */
const CELL = CONFIG.cell;
const NO_PATH = 32767;

const cellOf = pixel => Math.floor(pixel / CELL);
const cellCenter = index => index * CELL + CELL / 2;
const gridIndex = (cellX, cellY) => cellY * game.L.gridWidth + cellX;
const inGrid = (cellX, cellY) => cellX >= 0 && cellY >= 0 && cellX < game.L.gridWidth && cellY < game.L.gridHeight;
const cellMaterial = (cellX, cellY) => Terrain.get(game.L.terrain, cellCenter(cellX), cellCenter(cellY));
const isUnderground = cellY => cellCenter(cellY) >= game.L.groundY;

// Outside the mask the terrain reads as solid (255): it bounds the world but is no ground to stand on.
function isWalkable(cellX, cellY) {
  if (!inGrid(cellX, cellY) || cellMaterial(cellX, cellY) !== 0) return false;
  if (isUnderground(cellY)) return true;
  for (let deltaX = -1; deltaX <= 1; deltaX++) {
    const below = cellMaterial(cellX + deltaX, cellY + 1);
    if (below !== 0 && below !== 255) return true;
  }
  return false;
}

const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// One pass over the grid per update: the breadth-first searches read this snapshot instead of the terrain.
function walkableGrid() {
  const level = game.L, walkable = new Uint8Array(level.gridWidth * level.gridHeight);
  for (let cellY = 0; cellY < level.gridHeight; cellY++) for (let cellX = 0; cellX < level.gridWidth; cellX++) walkable[cellY * level.gridWidth + cellX] = isWalkable(cellX, cellY) ? 1 : 0;
  return walkable;
}

const isFreshTrail = index => game.L.pheromone[index] >= CONFIG.trail.known;

// Cost of stepping into each cell: open grass costs more than galleries and trails.
function stepCosts(walkable) {
  const level = game.L, width = level.gridWidth, costs = new Uint8Array(walkable.length);
  for (let index = 0; index < costs.length; index++) {
    if (!walkable[index]) continue;
    costs[index] = isUnderground(Math.floor(index / width)) || isFreshTrail(index) ? 1 : CONFIG.trail.offTrailCost;
  }
  return costs;
}

// Shortest paths with small integer costs (one bucket per distance).
function computeField(sources, walkable, costs) {
  const level = game.L, width = level.gridWidth, field = new Int16Array(width * level.gridHeight).fill(NO_PATH), buckets = [[]];
  for (const [cellX, cellY] of sources) {
    const index = gridIndex(cellX, cellY);
    if (field[index] === NO_PATH) { field[index] = 0; buckets[0].push(index); }
  }
  for (let distance = 0; distance < buckets.length; distance++) {
    const bucket = buckets[distance];
    if (!bucket) continue;
    for (let i = 0; i < bucket.length; i++) {
      const index = bucket[i];
      if (field[index] !== distance) continue;
      const cellX = index % width, cellY = (index - cellX) / width;
      for (const [deltaX, deltaY] of NEIGHBOURS) {
        const nextX = cellX + deltaX, nextY = cellY + deltaY;
        if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= level.gridHeight) continue;
        const next = nextY * width + nextX, nextDistance = distance + costs[next];
        if (!walkable[next] || nextDistance >= field[next]) continue;
        field[next] = nextDistance;
        (buckets[nextDistance] = buckets[nextDistance] || []).push(next);
      }
    }
  }
  return field;
}

// Walkable cells whose centre lies within radius px of (x, y).
function cellsInDisc(x, y, radius) {
  const cells = [];
  for (let cellY = cellOf(y - radius); cellY <= cellOf(y + radius); cellY++) {
    for (let cellX = cellOf(x - radius); cellX <= cellOf(x + radius); cellX++) {
      const deltaX = cellCenter(cellX) - x, deltaY = cellCenter(cellY) - y;
      if (deltaX * deltaX + deltaY * deltaY <= radius * radius && isWalkable(cellX, cellY)) cells.push([cellX, cellY]);
    }
  }
  return cells;
}

const DIGGABLE = new Set([CONFIG.material.soil, CONFIG.material.sand]);
const isDigTarget = (cellX, cellY) => game.L.digOrder[gridIndex(cellX, cellY)] === 1 && DIGGABLE.has(cellMaterial(cellX, cellY));

// The dig front: walkable cells next to a dig order that can still be dug (each listed once, in grid order).
function digFront(walkable) {
  const level = game.L, width = level.gridWidth, isFront = new Uint8Array(walkable.length);
  for (let index = 0; index < level.digOrder.length; index++) {
    if (!level.digOrder[index]) continue;
    const cellX = index % width, cellY = (index - cellX) / width;
    if (!isDigTarget(cellX, cellY)) continue;
    for (const [deltaX, deltaY] of NEIGHBOURS) {
      const nextX = cellX + deltaX, nextY = cellY + deltaY;
      if (inGrid(nextX, nextY) && walkable[nextY * width + nextX]) isFront[nextY * width + nextX] = 1;
    }
  }
  const cells = [];
  for (let index = 0; index < isFront.length; index++) if (isFront[index]) cells.push([index % width, Math.floor(index / width)]);
  return cells;
}

function updateFields() {
  const level = game.L, homeSources = [];
  for (const chamber of level.chambers) if (chamber.type !== 'nursery' && chamber.complete) homeSources.push(...cellsInDisc(chamber.x, chamber.y, chamber.r - 1));
  const exitSources = [];
  for (let cellX = cellOf(level.entranceX) - 4; cellX <= cellOf(level.entranceX) + 4; cellX++) {
    for (let cellY = cellOf(level.groundY) - 8; cellY < cellOf(level.groundY); cellY++) if (isWalkable(cellX, cellY)) exitSources.push([cellX, cellY]);
  }
  const foodSources = [];
  for (const food of level.knownFood) foodSources.push(...cellsInDisc(food.x, foodY(food), CELL * 2));
  // The plug cell itself is still open: the ant stands in it or next to it and fills it from there.
  const plugSources = [];
  for (const plug of level.plugs) if (isWalkable(plug.cellX, plug.cellY)) plugSources.push([plug.cellX, plug.cellY]);
  const walkable = walkableGrid(), costs = stepCosts(walkable);
  level.fields = {
    home: computeField(homeSources, walkable, costs),
    dig: computeField(digFront(walkable), walkable, costs),
    food: computeField(foodSources, walkable, costs),
    exit: computeField(exitSources, walkable, costs),
    plug: computeField(plugSources, walkable, costs),
  };
}

const fieldAt = (name, cellX, cellY) => (inGrid(cellX, cellY) ? game.L.fields[name][gridIndex(cellX, cellY)] : NO_PATH);
