// games/sabbia/src/challenges.js
'use strict';
/*
 * Levels. The laboratory is free (every material, no budget, no clock, no end). The challenges rotate: a prepared scene (locked cells
 * the eraser cannot touch), a few materials with a budget, a zone where the brush may paint, a clock and a goal read from the world.
 * Later loops shrink budgets and clocks. Coordinates in cells (192 x 96, y down).
 */
const CHALLENGES = [
  { id: 'fill', name: 'RIEMPI LA VASCA', hint: 'VERSA LA SABBIA DALLA ZONA IN ALTO: DEVE FINIRE NELLA VASCA', palette: ['sand'] },
  { id: 'boil', name: 'BOLLITURA', hint: "SCALDA LA PENTOLA DI FERRO FINCHE' NON E' VUOTA", palette: ['fire', 'wood'] },
  { id: 'meadow', name: 'PRATO', hint: 'BRUCIA TUTTO IL PRATO MA SALVA LA CASA DI LEGNO', palette: ['fire', 'water', 'coldAir'] },
  { id: 'acid', name: 'ACIDO', hint: "APRI IL SERBATOIO DI LEGNO CON L'ACIDO E RIEMPI LA VASCA", palette: ['acid'] },
  { id: 'blaze', name: 'INCENDIO', hint: 'SPEGNI IL FUOCO PRIMA CHE BRUCI LA CASSA', palette: ['water', 'coldAir', 'sand'] },
  { id: 'cloud', name: 'NUVOLA', hint: 'FAI SALIRE IL VAPORE FINO IN CIMA AL CIELO', palette: ['water', 'fire', 'iron', 'wood'] },
];

function levelSpec(levelNumber) {
  const challenge = (levelNumber - 1) % CHALLENGES.length, loop = Math.floor((levelNumber - 1) / CHALLENGES.length);
  return { n: levelNumber, challenge, loop, seed: levelNumber * 6007 + 31337 };
}
function dailySpec(date) {
  const dateHash = hashString('sabbia-' + date);
  return { n: 0, daily: date, challenge: dateHash % CHALLENGES.length, loop: 1, seed: dateHash };
}
const tutorialSpec = () => ({ n: 0, tutorial: true, challenge: 0, loop: 0, seed: 77 });
const labSpec = () => ({ n: 0, lab: true, challenge: 0, loop: 0, seed: 1 });

// Scene painting helpers (scene cells are locked).
function fillCells(world, x, y, width, height, id, locked = true) {
  for (let row = y; row < y + height; row++) {
    for (let column = x; column < x + width; column++) {
      if (!inside(column, row)) continue;
      const index = cellIndex(column, row);
      world.material[index] = id; world.temperature[index] = startTemperature(id); world.locked[index] = locked && KIND_OF[id] === KIND.static ? 1 : 0;
    }
  }
}
// An open box: floor and two walls, inner area [x, x + width) x [y, y + height).
function basin(world, x, y, width, height, wall = 2) {
  fillCells(world, x - wall, y + height, width + 2 * wall, wall, MATERIAL.iron);
  fillCells(world, x - wall, y, wall, height, MATERIAL.iron);
  fillCells(world, x + width, y, wall, height, MATERIAL.iron);
  return { x, y, width, height };
}
// A 45 degree iron slope (sand rests at 45 degrees: on a gentler slope it would stop).
function ramp(world, fromX, fromY, toX, thickness = 2) {
  const direction = Math.sign(toX - fromX);
  for (let step = 0; step <= Math.abs(toX - fromX); step++) fillCells(world, fromX + step * direction, fromY + step, 1, thickness, MATERIAL.iron);
}
function countIn(world, id, area) {
  let count = 0;
  for (let y = area.y; y < area.y + area.height; y++) for (let x = area.x; x < area.x + area.width; x++) if (world.material[cellIndex(x, y)] === id) count++;
  return count;
}

const scale = (value, loop, factor) => Math.max(1, Math.round(value * Math.pow(factor, loop)));

const BUILDERS = {
  fill(world, loop) {
    const vessel = basin(world, 110, 64, 40, 26);
    ramp(world, 62, 16, 114);
    const target = 360;
    return {
      budget: { [MATERIAL.sand]: scale(target * 1.7, loop, CONFIG.challenge.budgetPerLoop) }, time: 2400, zone: { x: 40, y: 2, width: 40, height: 12 },
      progress: () => countIn(world, MATERIAL.sand, vessel) / target,
    };
  },
  boil(world, loop) {
    const pot = basin(world, 80, 56, 32, 22);
    fillCells(world, 78, 80, 2, 12, MATERIAL.iron); fillCells(world, 112, 80, 2, 12, MATERIAL.iron);
    fillCells(world, pot.x, pot.y + 10, pot.width, pot.height - 10, MATERIAL.water);
    const initial = pot.width * (pot.height - 10);
    return {
      budget: { [MATERIAL.fire]: scale(500, loop, CONFIG.challenge.budgetPerLoop), [MATERIAL.wood]: scale(160, loop, CONFIG.challenge.budgetPerLoop) },
      time: 5400, zone: { x: 70, y: 80, width: 52, height: 16 },
      // the pot must be empty: steam that condenses and rains down outside does not count
      progress: () => 1 - Math.max(0, countIn(world, MATERIAL.water, pot) - initial * 0.03) / (initial * 0.97),
    };
  },
  meadow(world, loop) {
    fillCells(world, 0, 88, COLUMNS, 8, MATERIAL.iron);
    const patches = [[2, 44], [52, 96], [104, 150]];
    for (const [from, to] of patches) fillCells(world, from, 85, to - from, 3, MATERIAL.grass);
    const grassCells = patches.reduce((sum, [from, to]) => sum + (to - from) * 3, 0);
    const house = { x: 154, y: 64, width: 24, height: 24 };
    fillCells(world, house.x, house.y, house.width, house.height, MATERIAL.wood);
    const houseCells = house.width * house.height;
    return {
      budget: { [MATERIAL.fire]: scale(40, loop, CONFIG.challenge.budgetPerLoop), [MATERIAL.water]: scale(500, loop, CONFIG.challenge.budgetPerLoop), [MATERIAL.coldAir]: scale(400, loop, CONFIG.challenge.budgetPerLoop) },
      time: 4800, zone: null, settle: 60,
      progress: () => (world.counts[MATERIAL.grass] === 0 && world.counts[MATERIAL.fire] === 0 ? 1 : Math.min(0.99, 1 - world.counts[MATERIAL.grass] / grassCells)),
      lost: () => countIn(world, MATERIAL.wood, house) < houseCells * 0.7,
      lostReason: 'LA CASA DI LEGNO E BRUCIATA',
    };
  },
  acid(world, loop) {
    fillCells(world, 14, 38, 60, 2, MATERIAL.iron);
    fillCells(world, 12, 30, 2, 10, MATERIAL.iron);
    const tank = basin(world, 22, 8, 34, 20);   // raised above the shelf: a hole in its floor drains onto it
    for (let y = tank.y; y <= tank.y + tank.height + 1; y++) for (let x = tank.x - 2; x < tank.x + tank.width + 2; x++) if (world.material[cellIndex(x, y)] === MATERIAL.iron) world.material[cellIndex(x, y)] = MATERIAL.wood;
    fillCells(world, tank.x, tank.y + 4, tank.width, tank.height - 4, MATERIAL.water);
    ramp(world, 74, 38, 120);
    const vessel = basin(world, 116, 84, 56, 10);
    const initial = tank.width * (tank.height - 4);
    return {
      budget: { [MATERIAL.acid]: scale(90, loop, CONFIG.challenge.budgetPerLoop) }, time: 4800, zone: { x: 16, y: 0, width: 46, height: 8 },
      progress: () => countIn(world, MATERIAL.water, vessel) / (initial * 0.6),
    };
  },
  blaze(world, loop) {
    fillCells(world, 0, 92, COLUMNS, 4, MATERIAL.sand, false);
    fillCells(world, 30, 40, 16, 52, MATERIAL.wood);
    fillCells(world, 46, 60, 90, 3, MATERIAL.wood);
    const crate = { x: 140, y: 70, width: 20, height: 22 };
    fillCells(world, crate.x, crate.y, crate.width, crate.height, MATERIAL.wood);
    fillCells(world, 136, 60, 4, 32, MATERIAL.wood);
    // The fire already burning: lifetimes from the position, so the scene needs no random numbers (the Rng is seeded after it).
    for (let y = 86; y < 92; y++) {
      for (let x = 28; x < 48; x++) {
        const index = cellIndex(x, y);
        if (world.material[index] !== MATERIAL.empty) continue;
        world.material[index] = MATERIAL.fire; world.temperature[index] = CONFIG.heat.fire; world.life[index] = 150 + (x * 7 + y * 13) % 60;
      }
    }
    const crateCells = crate.width * crate.height;
    return {
      budget: { [MATERIAL.water]: scale(500, loop, CONFIG.challenge.budgetPerLoop), [MATERIAL.coldAir]: scale(300, loop, CONFIG.challenge.budgetPerLoop), [MATERIAL.sand]: scale(400, loop, CONFIG.challenge.budgetPerLoop) },
      time: 4800, zone: null, settle: 120,
      progress: () => (world.counts[MATERIAL.fire] === 0 ? 1 : 0.5),
      lost: () => countIn(world, MATERIAL.wood, crate) < crateCells * 0.8,
      lostReason: 'LA CASSA HA PRESO FUOCO',
    };
  },
  cloud(world, loop) {
    const sky = { x: 0, y: 0, width: COLUMNS, height: 12 }, target = 60;
    return {
      budget: { [MATERIAL.water]: scale(700, loop, CONFIG.challenge.budgetPerLoop), [MATERIAL.fire]: scale(400, loop, CONFIG.challenge.budgetPerLoop), [MATERIAL.iron]: scale(260, loop, CONFIG.challenge.budgetPerLoop), [MATERIAL.wood]: scale(200, loop, CONFIG.challenge.budgetPerLoop) },
      time: 5400, zone: { x: 0, y: 40, width: COLUMNS, height: 56 },
      progress: () => countIn(world, MATERIAL.steam, sky) / target,
    };
  },
};

function genLevel(spec) {
  const world = makeWorld();
  if (spec.lab) {
    return { spec, n: 0, lab: true, name: 'LABORATORIO', hint: 'TUTTI I MATERIALI, NESSUN LIMITE', world, palette: [...CONFIG.palette.map(key => MATERIAL[key]), ERASER], budget: null, time: Infinity, zone: null, cursorStart: [96, 30], goal: null };
  }
  if (spec.tutorial) {
    const pot = basin(world, 100, 60, 24, 18);
    fillCells(world, 98, 80, 2, 12, MATERIAL.iron); fillCells(world, 124, 80, 2, 12, MATERIAL.iron);
    fillCells(world, pot.x, pot.y + 8, pot.width, pot.height - 8, MATERIAL.water);
    countMaterials(world);
    return { spec, n: 0, tutorial: true, name: 'ADDESTRAMENTO', hint: '', world, palette: [MATERIAL.sand, MATERIAL.water, MATERIAL.fire], budget: null, time: Infinity, zone: null, cursorStart: [40, 30], goal: null };
  }
  const challenge = CHALLENGES[spec.challenge], built = BUILDERS[challenge.id](world, spec.loop);
  countMaterials(world);
  return {
    spec, n: spec.n, challenge, name: challenge.name, hint: challenge.hint, world,
    palette: challenge.palette.map(key => MATERIAL[key]), budget: built.budget, startBudget: { ...built.budget },
    time: Math.round(built.time * Math.pow(CONFIG.challenge.timePerLoop, spec.loop)), zone: built.zone,
    cursorStart: built.zone ? [built.zone.x + (built.zone.width >> 1), built.zone.y + (built.zone.height >> 1)] : [96, 30],
    goal: built, settledT: 0,
  };
}

// Share of the budget still unused (all materials together): the stars of a won challenge.
function budgetLeftShare() {
  const level = game.L;
  if (!level.budget) return 1;
  let left = 0, total = 0;
  for (const id in level.startBudget) { left += level.budget[id]; total += level.startBudget[id]; }
  return total ? left / total : 1;
}
