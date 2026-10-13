// games/sabbia/src/sim.js
'use strict';
/*
 * The cellular automaton. One step: a pass of reactions over the world as the last frame left it, then a pass of movement, both from
 * the bottom row up (each row left to right on even frames, right to left on odd ones), then heat exchange between touching cells.
 * A cell changed by a reaction or already moved this frame is skipped. (Reactions first: a water cell must not slide away from the
 * fire above it before the fire has seen it.)
 * Randomness only through the simulation Rng, always in this order: replays are identical.
 * Walls and floor bound the grid; the top is open: light gases on the top row may leave.
 */
const COLUMNS = CONFIG.grid.columns, ROWS = CONFIG.grid.rows, CELLS = COLUMNS * ROWS;
const NEIGHBOURS_4 = [[0, 1], [0, -1], [1, 0], [-1, 0]];

function makeWorld() {
  return {
    material: new Uint8Array(CELLS),
    temperature: new Float32Array(CELLS).fill(CONFIG.heat.ambient),
    life: new Uint16Array(CELLS),         // fire: frames left; liquids: the side they last ran to (1 right, 2 left)
    anchored: new Uint8Array(CELLS),      // a burning grass or wood cell: the fire stays where the fuel was
    locked: new Uint8Array(CELLS),        // scene cells the eraser cannot remove (reactions still can)
    movedAt: new Int32Array(CELLS).fill(-1),
    counts: new Int32Array(MATERIAL_KEYS.length),
    events: { steam: 0, ignite: 0, dissolve: 0 },
    frame: 0,
  };
}

function countMaterials(world) {
  world.counts.fill(0);
  for (let index = 0; index < CELLS; index++) world.counts[world.material[index]]++;
}

const cellIndex = (x, y) => y * COLUMNS + x;
const inside = (x, y) => x >= 0 && x < COLUMNS && y >= 0 && y < ROWS;
const randomBetween = (range) => range[0] + Math.floor(Rng.next() * (range[1] - range[0] + 1));

function setCell(world, index, id, temperature) {
  world.material[index] = id;
  world.temperature[index] = temperature === undefined ? startTemperature(id) : temperature;
  world.life[index] = id === MATERIAL.fire ? randomBetween(CONFIG.materials.fire.life) : 0;
  world.anchored[index] = 0;
  world.locked[index] = 0;
}

function swap(world, from, to) {
  const { material, temperature, life, locked, movedAt } = world;
  const id = material[from], heat = temperature[from], left = life[from], lock = locked[from];
  material[from] = material[to]; temperature[from] = temperature[to]; life[from] = life[to]; locked[from] = locked[to];
  material[to] = id; temperature[to] = heat; life[to] = left; locked[to] = lock;   // anchored cells never move, so their flag stays
  movedAt[from] = movedAt[to] = world.frame;
}

// A cell moves into a neighbour by swapping places with something it can push aside: lighter stuff below a falling cell,
// heavier stuff above a rising one. Static cells never give way.
function tryMove(world, from, toX, toY, rising) {
  if (!inside(toX, toY)) return false;
  const to = cellIndex(toX, toY), mine = world.material[from], theirs = world.material[to];
  if (theirs === mine || KIND_OF[theirs] === KIND.static || world.anchored[to]) return false;
  if (rising ? DENSITY[theirs] <= DENSITY[mine] : DENSITY[theirs] >= DENSITY[mine]) return false;
  swap(world, from, to);
  return true;
}

function sidewaysFirst() { return Rng.next() < 0.5 ? 1 : -1; }

function moveCell(world, index, x, y) {
  const id = world.material[index], kind = KIND_OF[id];
  if (kind === KIND.static || kind === KIND.empty || world.anchored[index]) return;
  const rising = DENSITY[id] < 1, vertical = rising ? -1 : 1;
  if (id === MATERIAL.fire && Rng.next() >= CONFIG.materials.fire.rise) {
    const side = sidewaysFirst();
    if (tryMove(world, index, x + side, y, true)) return;
  }
  if (tryMove(world, index, x, y + vertical, rising)) return;
  if (rising && y === 0 && kind === KIND.gas) {
    if (Rng.next() < CONFIG.heat.escape) setCell(world, index, MATERIAL.empty, CONFIG.heat.ambient);
    return;
  }
  const side = sidewaysFirst();
  if (tryMove(world, index, x + side, y + vertical, rising) || tryMove(world, index, x - side, y + vertical, rising)) return;
  if (kind === KIND.powder) return;
  if (kind === KIND.liquid) {
    const remembered = world.life[index] === 1 ? 1 : world.life[index] === 2 ? -1 : side;
    if (flowSideways(world, index, x, y, remembered) < 0) flowSideways(world, index, x, y, -remembered);
    return;
  }
  if (tryMove(world, index, x + side, y, rising)) return;
  tryMove(world, index, x - side, y, rising);
}

// A liquid that cannot go down runs sideways up to `flow` cells in one frame and remembers the side, so it keeps running that way
// until something stops it (it spreads instead of oozing back and forth). Returns the cell it reached, or -1 if it could not move.
function flowSideways(world, index, x, y, side) {
  let column = x;
  for (let steps = 0; steps < CONFIG.heat.flow; steps++, column += side) {
    if (!tryMove(world, cellIndex(column, y), column + side, y, false)) break;
  }
  if (column === x) return -1;
  world.life[cellIndex(column, y)] = side > 0 ? 1 : 2;
  return cellIndex(column, y);
}

function neighbourWith(world, x, y, id) {
  for (const [deltaX, deltaY] of NEIGHBOURS_4) {
    if (inside(x + deltaX, y + deltaY) && world.material[cellIndex(x + deltaX, y + deltaY)] === id) return cellIndex(x + deltaX, y + deltaY);
  }
  return -1;
}

function igniteCell(world, index, spec) {
  setCell(world, index, MATERIAL.fire);
  world.life[index] = randomBetween(spec.burn);
  world.anchored[index] = 1;
  world.movedAt[index] = world.frame;
  world.events.ignite++;
}

// Returns true when the cell is gone or changed into something that must not move this frame.
function react(world, index, x, y) {
  const id = world.material[index], heat = world.temperature[index], materials = CONFIG.materials;
  switch (id) {
    case MATERIAL.water:
      if (heat >= materials.water.boil) { setCell(world, index, MATERIAL.steam, heat); world.events.steam++; }
      return false;
    case MATERIAL.steam:
      if (neighbourWith(world, x, y, MATERIAL.coldAir) >= 0 || (heat < materials.steam.condense && Rng.next() < materials.steam.condenseChance)) {
        setCell(world, index, MATERIAL.water, Math.min(heat, materials.steam.condense - 1));
      }
      return false;
    case MATERIAL.grass:
    case MATERIAL.wood: {
      const spec = materialSpec(id);
      if (heat < spec.ignite) return false;
      igniteCell(world, index, spec);
      return true;
    }
    case MATERIAL.fire: {
      world.temperature[index] = CONFIG.heat.fire;
      // Flames lick what they touch: a flammable neighbour may catch fire at once (grass easily, wood rarely), whatever its temperature.
      for (const [deltaX, deltaY] of NEIGHBOURS_4) {
        if (!inside(x + deltaX, y + deltaY)) continue;
        const neighbour = cellIndex(x + deltaX, y + deltaY), spec = materialSpec(world.material[neighbour]);
        if (spec.catch && Rng.next() < spec.catch) igniteCell(world, neighbour, spec);
      }
      const water = neighbourWith(world, x, y, MATERIAL.water);
      if (water >= 0) {
        setCell(world, water, MATERIAL.steam, materials.steam.start);
        setCell(world, index, MATERIAL.empty, materials.steam.start);
        world.events.steam++;
        return true;
      }
      if (neighbourWith(world, x, y, MATERIAL.coldAir) >= 0) { setCell(world, index, MATERIAL.empty, CONFIG.heat.ambient); return true; }
      if (--world.life[index] === 0) {
        if (Rng.next() < 0.5) setCell(world, index, MATERIAL.hotAir); else setCell(world, index, MATERIAL.empty, materials.hotAir.start);
        return true;
      }
      if (y > 0 && world.material[cellIndex(x, y - 1)] === MATERIAL.empty) {
        // Burning fuel throws short free flames up; any flame leaves some hot air behind.
        if (world.anchored[index] && Rng.next() < materials.fire.flameChance) { setCell(world, cellIndex(x, y - 1), MATERIAL.fire); world.life[cellIndex(x, y - 1)] = randomBetween(materials.fire.flame); }
        else if (Rng.next() < materials.fire.smoke) setCell(world, cellIndex(x, y - 1), MATERIAL.hotAir);
      }
      return false;
    }
    case MATERIAL.acid: {
      const [deltaX, deltaY] = NEIGHBOURS_4[Math.floor(Rng.next() * 4)];
      if (!inside(x + deltaX, y + deltaY)) return false;
      const target = cellIndex(x + deltaX, y + deltaY), victim = world.material[target];
      if (ACID_RATE[victim] > 0 && Rng.next() < ACID_RATE[victim]) {
        setCell(world, target, MATERIAL.empty, world.temperature[target]);
        world.events.dissolve++;
        if (Rng.next() < materials.acid.spent) { setCell(world, index, MATERIAL.empty, heat); return true; }
      } else if (victim === MATERIAL.water && Rng.next() < materials.acid.dilute) setCell(world, index, MATERIAL.water, heat);
      return false;
    }
    case MATERIAL.hotAir:
      if (heat < materials.hotAir.fade) { world.material[index] = MATERIAL.empty; return true; }
      return false;
    case MATERIAL.coldAir:
      if (heat > materials.coldAir.fade) { world.material[index] = MATERIAL.empty; return true; }
      return false;
    default:
      return false;
  }
}

// Each touching pair (right and below) evens out by the smaller conductivity; empty air drifts to the ambient temperature.
function conductHeat(world) {
  for (let pass = 0; pass < CONFIG.heat.passes; pass++) exchangeHeat(world);
  const { material, temperature } = world, heat = CONFIG.heat;
  for (let index = 0; index < CELLS; index++) {
    if (material[index] === MATERIAL.empty) temperature[index] += (heat.ambient - temperature[index]) * heat.airRelax;
    else if (material[index] === MATERIAL.fire) temperature[index] = heat.fire;
  }
}

function exchangeHeat(world) {
  const { material, temperature } = world, exchange = CONFIG.heat.exchange;
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLUMNS; x++) {
      const index = y * COLUMNS + x, conductivity = CONDUCT[material[index]];
      // The heat that flows is shared by capacity: a cell with a large capacity changes temperature less for the same heat.
      if (x + 1 < COLUMNS) {
        const right = index + 1, flow = (temperature[right] - temperature[index]) * Math.min(conductivity, CONDUCT[material[right]]) * exchange;
        temperature[index] += flow * HEAT_SHARE[material[index]]; temperature[right] -= flow * HEAT_SHARE[material[right]];
      }
      if (y + 1 < ROWS) {
        const below = index + COLUMNS, flow = (temperature[below] - temperature[index]) * Math.min(conductivity, CONDUCT[material[below]]) * exchange;
        temperature[index] += flow * HEAT_SHARE[material[index]]; temperature[below] -= flow * HEAT_SHARE[material[below]];
      }
    }
  }
}

function stepWorld(world) {
  world.frame++;
  world.events = { steam: 0, ignite: 0, dissolve: 0 };
  const leftToRight = (world.frame & 1) === 0, movedAt = world.movedAt;
  for (const pass of [react, moveCell]) {
    for (let y = ROWS - 1; y >= 0; y--) {
      for (let step = 0; step < COLUMNS; step++) {
        const x = leftToRight ? step : COLUMNS - 1 - step, index = y * COLUMNS + x;
        if (movedAt[index] === world.frame || world.material[index] === MATERIAL.empty) continue;
        if (pass(world, index, x, y) === true) movedAt[index] = world.frame;
      }
    }
  }
  conductHeat(world);
  countMaterials(world);
}
