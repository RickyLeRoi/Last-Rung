// games/abisso/src/level.js
'use strict';
const SCENARIOS = [
  { id: 'cave', name: 'GROTTA', hint: 'GALLERIE STRETTE NEL BUIO: USA IL SONAR' },
  { id: 'wreck', name: 'RELITTO', hint: 'STANZE CHIUSE E PORTE STRETTE: VAI PIANO' },
  { id: 'trench', name: 'CORRENTE', hint: 'CORRENTI FORTI E TANTO LIMO SUL FONDO' },
];

function levelSpec(levelNumber) {
  const scenario = (levelNumber - 1) % SCENARIOS.length, loop = Math.floor((levelNumber - 1) / SCENARIOS.length);
  return { n: levelNumber, scenario, loop, seed: levelNumber * 4271 + 90001 };
}
function dailySpec(date) {
  const dateHash = hashString('abisso-' + date);
  return { n: 0, daily: date, scenario: dateHash % SCENARIOS.length, loop: 1, seed: dateHash };
}
const tutorialSpec = () => ({ n: 0, tutorial: true, scenario: 0, loop: 0, seed: 515 });

const MATERIAL = CONFIG.material;

// A spot on the pocket floor where the diver's body fits: the first offset from the centre with free space around the body.
function standingSpot(terrain, x, y) {
  for (const offset of [0, -6, 6, -12, 12, -18, 18]) {
    const left = x + offset - 4, floor = Terrain.surfaceY(terrain, x + offset, y);
    if (!Terrain.hitsRect(terrain, left, floor - 8, 8, 7)) return { x: left, floor };
  }
  return { x: x - 4, floor: Terrain.surfaceY(terrain, x, y) };
}

// A pocket for a diver: carved, with a little silt where the diver stands (never a slab across a tunnel that goes on below).
function chamber(terrain, x, y, radius, divers) {
  Terrain.carveCircle(terrain, x, y, radius);
  const spot = standingSpot(terrain, x, y);
  Terrain.fillRect(terrain, spot.x - 2, spot.floor - 1, 12, 1, MATERIAL.silt);
  divers.push({ x: spot.x, y: spot.floor - 7 });
}

// The cave: one tunnel that wanders down from the entrance under the ship, with pockets along it (a diver in each).
function buildCave(random, width, height, diverCount) {
  const terrain = Terrain.make(width, height), surface = CONFIG.world.surface, spots = [];
  Terrain.fillRect(terrain, 0, surface + 24, width, height, MATERIAL.rock);
  let x = 110, y = surface + 10, angle = Math.PI / 2;
  const steps = 160 + Math.floor(height / 8), pocketEvery = Math.floor(steps / (diverCount + 1));
  for (let step = 0; step < steps; step++) {
    const radius = 15 + Math.floor(random() * 6);
    Terrain.carveCircle(terrain, x, y, radius);
    angle += (random() - 0.5) * 0.7;
    const depthShare = y / height;
    if (depthShare < 0.8) angle += (Math.PI / 2 - angle) * 0.08;
    x = clamp(x + Math.cos(angle) * 6, 30, width - 30);
    y = clamp(y + Math.sin(angle) * 6, surface + 10, height - 30);
    if (x <= 30 || x >= width - 30) angle = Math.PI - angle;
    if (step > 0 && step % pocketEvery === 0 && spots.length < diverCount) spots.push([x + (random() < 0.5 ? -1 : 1) * 26, y + 8]);
  }
  while (spots.length < diverCount) spots.push([x, y]);
  const divers = [];
  for (const [spotX, spotY] of spots) chamber(terrain, clamp(Math.round(spotX), 30, width - 30), Math.round(spotY), 18, divers);
  return { terrain, divers, currents: [] };
}

// The wreck: a hull of rooms on the sea floor, doors between them along a random spanning tree, one hatch on the deck.
function buildWreck(random, width, height, diverCount) {
  const terrain = Terrain.make(width, height), surface = CONFIG.world.surface;
  const floorY = height - 50;
  Terrain.fillRect(terrain, 0, floorY, width, height - floorY, MATERIAL.rock);
  const columns = 4, rows = Math.max(3, Math.floor((floorY - surface - 140) / 110)), left = 120, top = floorY - rows * 110 - 8;
  const roomWidth = Math.floor((width - left - 60) / columns), roomHeight = 110, wall = 6;
  Terrain.fillRect(terrain, left - wall, top - wall, columns * roomWidth + 2 * wall, rows * roomHeight + 2 * wall, MATERIAL.hull);
  const roomCenter = (column, row) => [left + column * roomWidth + roomWidth / 2, top + row * roomHeight + roomHeight / 2];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) Terrain.fillRect(terrain, left + column * roomWidth + wall / 2, top + row * roomHeight + wall / 2, roomWidth - wall, roomHeight - wall, 0);
  }
  // Doors: a spanning tree over the rooms (random order of the walls), so every room can be reached.
  const parent = Array.from({ length: rows * columns }, (_, i) => i);
  const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const walls = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    if (column + 1 < columns) walls.push([row, column, 'right']);
    if (row + 1 < rows) walls.push([row, column, 'down']);
  }
  for (let i = walls.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [walls[i], walls[j]] = [walls[j], walls[i]]; }
  const doorSize = 32;
  for (const [row, column, side] of walls) {
    const here = row * columns + column, there = side === 'right' ? here + 1 : here + columns;
    if (find(here) === find(there)) continue;
    parent[find(here)] = find(there);
    const [centerX, centerY] = roomCenter(column, row);
    if (side === 'right') Terrain.fillRect(terrain, left + (column + 1) * roomWidth - wall, Math.round(centerY - doorSize / 2 + (random() - 0.5) * 40), wall * 2, doorSize, 0);
    else Terrain.fillRect(terrain, Math.round(centerX - doorSize / 2 + (random() - 0.5) * 60), top + (row + 1) * roomHeight - wall, doorSize, wall * 2, 0);
  }
  const [hatchX] = roomCenter(0, 0);
  Terrain.fillRect(terrain, Math.round(hatchX - doorSize / 2), top - wall - 2, doorSize, wall + 6, 0);
  const rooms = [];
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) if (row + column > 0) rooms.push(roomCenter(column, row));
  for (let i = rooms.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [rooms[i], rooms[j]] = [rooms[j], rooms[i]]; }
  const divers = [];
  for (const [centerX, centerY] of rooms.slice(0, diverCount)) {
    const spot = standingSpot(terrain, Math.round(centerX + (random() - 0.5) * 40), Math.round(centerY));
    Terrain.fillRect(terrain, spot.x - 2, spot.floor - 1, 12, 1, MATERIAL.silt);
    divers.push({ x: spot.x, y: spot.floor - 7 });
  }
  return { terrain, divers, currents: [] };
}

// The trench: open water between two rough walls, ledges with divers on them, bands of current and a silty floor.
function buildTrench(random, width, height, diverCount) {
  const terrain = Terrain.make(width, height), surface = CONFIG.world.surface, floorY = height - 40;
  const phases = [random() * 6, random() * 6, random() * 6, random() * 6];
  for (let y = surface + 30; y < height; y++) {
    const leftEdge = Math.round(40 + 18 * Math.sin(y * 0.02 + phases[0]) + 8 * Math.sin(y * 0.07 + phases[1]));
    const rightEdge = Math.round(width - 40 - 18 * Math.sin(y * 0.017 + phases[2]) - 8 * Math.sin(y * 0.06 + phases[3]));
    Terrain.fillRect(terrain, 0, y, leftEdge, 1, MATERIAL.rock);
    Terrain.fillRect(terrain, rightEdge, y, width - rightEdge, 1, MATERIAL.rock);
  }
  Terrain.fillRect(terrain, 0, floorY, width, height - floorY, MATERIAL.rock);
  Terrain.fillRect(terrain, 0, floorY - 4, width, 4, MATERIAL.silt);
  const divers = [];
  for (let i = 0; i < diverCount; i++) {
    const y = Math.round(surface + 120 + (i + 0.5) * (floorY - surface - 160) / diverCount), onLeft = i % 2 === 0;
    const wallX = findWallEdge(terrain, y, onLeft ? 1 : -1);
    const ledgeLength = 34 + Math.floor(random() * 20);
    const ledgeX = onLeft ? wallX : wallX - ledgeLength;
    Terrain.fillRect(terrain, ledgeX, y, ledgeLength, 8, MATERIAL.rock);
    Terrain.fillRect(terrain, ledgeX, y - 2, ledgeLength, 2, MATERIAL.silt);
    divers.push({ x: onLeft ? ledgeX + ledgeLength - 14 : ledgeX + 6, y: y - 8 });
  }
  const currents = [];
  const bands = 4, strength = CONFIG.current.strongStrength;
  for (let band = 0; band < bands; band++) {
    const top = surface + 80 + band * (floorY - surface - 80) / bands;
    currents.push({ x: 0, y: Math.round(top), w: width, h: Math.round((floorY - surface - 80) / bands / 2), ax: (band % 2 ? -1 : 1) * strength, ay: strength * 0.3 });
  }
  return { terrain, divers, currents };
}

// The x of the first empty pixel in row y, searching from the left wall (direction 1) or from the right wall (direction -1).
function findWallEdge(terrain, y, direction) {
  if (direction > 0) { for (let x = 0; x < terrain.width; x++) if (!Terrain.isSolid(terrain, x, y)) return x; return terrain.width / 2; }
  for (let x = terrain.width - 1; x >= 0; x--) if (!Terrain.isSolid(terrain, x, y)) return x + 1;
  return terrain.width / 2;
}

function buildTutorial(width, height) {
  const terrain = Terrain.make(width, height), surface = CONFIG.world.surface;
  Terrain.fillRect(terrain, 0, surface + 24, width, height, MATERIAL.rock);
  Terrain.carveCircle(terrain, 110, surface + 30, 22);
  for (let y = surface + 30; y < 230; y += 6) Terrain.carveCircle(terrain, 110 + (y - surface) * 0.6, y, 20);
  const divers = [];
  chamber(terrain, 240, 236, 22, divers);
  return { terrain, divers, currents: [] };
}

function genLevel(spec) {
  const random = mulberry32(spec.seed), scenario = SCENARIOS[spec.scenario], tutorial = !!spec.tutorial, loop = spec.loop, world = CONFIG.world;
  const width = tutorial ? world.tutorialWidth : world.width, height = tutorial ? world.tutorialHeight : loop >= 2 ? world.deepHeight : world.height;
  const diverConfig = CONFIG.diver, diverCount = tutorial ? 1 : Math.min(diverConfig.max, diverConfig.base + loop * diverConfig.perLoop);
  const built = tutorial ? buildTutorial(width, height)
    : scenario.id === 'cave' ? buildCave(random, width, height, diverCount)
    : scenario.id === 'wreck' ? buildWreck(random, width, height, diverCount)
    : buildTrench(random, width, height, diverCount);
  const airFor = diver => (tutorial ? Infinity : Math.round((diverConfig.airBase + (diver.y - world.surface) * diverConfig.airPerDepth)
    * (1 + (random() - 0.5) * 2 * diverConfig.airSpread) * Math.pow(diverConfig.airLoopFactor, loop)));
  const cell = CONFIG.cell, seenWidth = Math.ceil(width / cell), seenHeight = Math.ceil(height / cell);
  return {
    spec, n: spec.n, sc: scenario, tutorial, loop, width, height,
    terrain: built.terrain, currents: built.currents,
    divers: built.divers.map(diver => { const air = airFor(diver); return { x: diver.x, y: diver.y, state: 'waiting', air, maxAir: air, found: false }; }),
    total: built.divers.length, saved: 0, lost: 0,
    battery: tutorial ? Infinity : Math.max(CONFIG.battery.min, CONFIG.battery.max - loop * CONFIG.battery.perLoop),
    seen: new Uint8Array(seenWidth * seenHeight), seenWidth, seenHeight,
    water: Water.make(world.surface, [1.2, 0.6, 0.3], [0.8, 1.3, 2.1], null, width),
    stars: Array.from({ length: 30 }, () => ({ x: Math.floor(random() * CONFIG.W), y: 2 + Math.floor(random() * (world.surface - 14)), tw: random() < 0.3, ph: Math.floor(random() * 120) })),
  };
}
