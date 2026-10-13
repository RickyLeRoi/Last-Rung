// games/formicaio/src/ants.js
'use strict';
/*
 * Two castes. Workers dig and plug (the player's orders); foragers look for food on their own: they leave the nest, scout the grass
 * (preferring fresh trails, so a trail drawn by the player sends them where it leads), smell food within a few cells and, once one has
 * been found, carry it home along the cheapest path, laying a trail for the others.
 * Every ant walks cell by cell down the distance field of its goal; ties are broken with the simulation Rng, in a fixed order
 * (ants by id, neighbours in NEIGHBOURS order), so a replay is identical.
 */

function nearestWalkable(x, y) {
  const centerX = cellOf(x), centerY = cellOf(y);
  for (let radius = 0; radius < 6; radius++) {
    for (let deltaY = -radius; deltaY <= radius; deltaY++) {
      for (let deltaX = -radius; deltaX <= radius; deltaX++) {
        if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) === radius && isWalkable(centerX + deltaX, centerY + deltaY)) return [centerX + deltaX, centerY + deltaY];
      }
    }
  }
  return null;
}

function spawnAnt(x, y) {
  const cell = nearestWalkable(x, y);
  if (!cell) return null;
  const foragers = game.ants.filter(other => other.caste === 'forager').length;
  const caste = foragers < Math.ceil((game.ants.length + 1) * CONFIG.ants.foragerShare) ? 'forager' : 'worker';
  const ant = { id: game.nextAntId++, caste, cellX: cell[0], cellY: cell[1], fromX: cell[0], fromY: cell[1], t: 0, stepTotal: 1, job: null, carry: null, heavy: false, digT: 0, wetT: 0, scoutT: 0, thinkAt: 0, face: 1 };
  game.ants.push(ant);
  return ant;
}

function goalOf(ant) {
  if (ant.carry === 'soil') return ant.job === 'plug' ? 'plug' : 'exit';
  if (ant.carry === 'food') return 'home';
  return { dig: 'dig', forage: 'food', plug: 'exit', home: 'home', scout: 'exit' }[ant.job];
}

// Foragers: carry known food, keep a few scouting for more; workers: plugs first, then the dig front.
function assignJob(ant, crews) {
  const level = game.L, reachable = goal => fieldAt(goal, ant.cellX, ant.cellY) < NO_PATH;
  let job = 'home';
  if (ant.caste === 'forager') {
    if (game.recall) job = 'home';
    else if (level.knownFood.length && reachable('food') && crews.scout >= CONFIG.scout.keep) job = 'forage';
    else if (reachable('exit')) job = 'scout';
  } else if (level.plugs.length && crews.plug < CONFIG.ants.pluggers && reachable('plug') && reachable('exit')) job = 'plug';
  else if (reachable('dig')) job = 'dig';
  if (ant.job) crews[ant.job]--;
  if (job === 'scout' && ant.job !== 'scout') { ant.scoutT = 0; ant.face = chance(0.5) ? 1 : -1; }
  ant.job = job;
  ant.thinkAt = game.frame + CONFIG.ants.rethink;
  crews[job]++;
}

function arrive(ant, goal) {
  const level = game.L;
  if (goal === 'dig') {
    const target = NEIGHBOURS.map(([deltaX, deltaY]) => [ant.cellX + deltaX, ant.cellY + deltaY]).find(([cellX, cellY]) => inGrid(cellX, cellY) && isDigTarget(cellX, cellY));
    if (!target) { ant.job = null; ant.digT = 0; return; }
    ant.face = Math.sign(target[0] - ant.cellX) || ant.face;
    if (++ant.digT < CONFIG.dig.frames) return;
    ant.digT = 0;
    digCell(target[0], target[1]);
    ant.carry = 'soil';
    if (ant.id % 3 === 0) Sfx.play('dig');
  } else if (goal === 'exit') {
    if (ant.carry === 'soil') { dumpSoil(); ant.carry = null; ant.job = null; }
    else { takeSoil(); ant.carry = 'soil'; }
  } else if (goal === 'plug') {
    const index = level.plugs.findIndex(plug => plug.cellX === ant.cellX && plug.cellY === ant.cellY);
    if (index >= 0) { const plug = level.plugs.splice(index, 1)[0]; plugCell(plug.cellX, plug.cellY); Sfx.play('plug'); }
    ant.carry = null; ant.job = null;
  } else if (goal === 'food') {
    const food = level.foods.find(candidate => Math.abs(candidate.x - cellCenter(ant.cellX)) <= CELL * 2 + 2 && Math.abs(foodY(candidate) - cellCenter(ant.cellY)) <= CELL * 2 + 2);
    if (!food) { ant.job = null; return; }
    food.amount--;
    ant.carry = 'food'; ant.heavy = food.kind === 'insect';
    if (food.amount <= 0) { level.foods.splice(level.foods.indexOf(food), 1); level.fieldsDirty = true; }
  } else if (goal === 'home') {
    if (ant.carry !== 'food') return;
    addFood(1);
    level.delivered++;
    game.score += CONFIG.score.food;
    ant.carry = null; ant.heavy = false; ant.job = null;
    Sfx.play('food');
  }
}

function step(ant, goal) {
  const distance = fieldAt(goal, ant.cellX, ant.cellY), options = [];
  for (const [deltaX, deltaY] of NEIGHBOURS) {
    const nextX = ant.cellX + deltaX, nextY = ant.cellY + deltaY;
    if (isWalkable(nextX, nextY) && fieldAt(goal, nextX, nextY) < distance) options.push([nextX, nextY]);
  }
  if (!options.length) return false;
  const [nextX, nextY] = options.length === 1 ? options[0] : options[Math.floor(Rng.next() * options.length)];
  moveTo(ant, nextX, nextY);
  return true;
}

function moveTo(ant, nextX, nextY) {
  const config = CONFIG.ants;
  ant.fromX = ant.cellX; ant.fromY = ant.cellY;
  ant.cellX = nextX; ant.cellY = nextY;
  if (nextX !== ant.fromX) ant.face = nextX - ant.fromX;
  ant.stepTotal = ant.t = ant.heavy ? config.heavyStepFrames : ant.carry ? config.carryStepFrames : config.stepFrames;
  if (ant.carry === 'food' && !isUnderground(nextY)) {
    const index = gridIndex(nextX, nextY);
    game.L.pheromone[index] = Math.max(game.L.pheromone[index], CONFIG.trail.reinforce);
  }
}

const isGrassCell = (cellX, cellY) => cellCenter(cellY) < Math.min(surfaceAt(cellCenter(cellX)), game.L.groundY + 4);

// A fresh trail a few cells to one side, leading farther from the entrance than the scout is: the side to turn to (0 when none).
function sideOfTrail(ant, away) {
  const reach = CONFIG.scout.trailReach;
  for (let distance = 1; distance <= reach; distance++) {
    for (const side of [ant.face, -ant.face]) {
      const cellX = ant.cellX + side * distance;
      if (away(cellX) <= away(ant.cellX)) continue;
      for (let deltaY = -1; deltaY <= 1; deltaY++) if (inGrid(cellX, ant.cellY + deltaY) && isFreshTrail(gridIndex(cellX, ant.cellY + deltaY))) return side;
    }
  }
  return 0;
}

// Out on the grass a scout walks on in its direction, along a fresh trail leading away from the entrance when there is one, turning now
// and then and when blocked; it climbs over bumps and never goes down a hole.
function scoutStep(ant) {
  const config = CONFIG.scout, level = game.L;
  if (++ant.scoutT > config.giveUp) { ant.job = null; return; }
  const options = NEIGHBOURS.map(([deltaX, deltaY]) => [ant.cellX + deltaX, ant.cellY + deltaY]).filter(([cellX, cellY]) => isWalkable(cellX, cellY) && isGrassCell(cellX, cellY));
  // Along a trail means farther from the entrance sideways (a trail painted down the shaft must not pull the scouts back in).
  const away = cellX => Math.abs(cellCenter(cellX) - level.entranceX), outward = away(ant.cellX);
  const along = options.filter(([cellX, cellY]) => isFreshTrail(gridIndex(cellX, cellY)) && away(cellX) > outward);
  let next = null;
  if (along.length) next = along.length === 1 ? along[0] : along[Math.floor(Rng.next() * along.length)];
  else {
    const trailSide = sideOfTrail(ant, away);
    if (trailSide) ant.face = trailSide;
    else if (chance(config.turnChance) || !inGrid(ant.cellX + ant.face, ant.cellY)) ant.face = -ant.face;
    next = options.find(([cellX]) => cellX === ant.cellX + ant.face) || options.find(([, cellY]) => cellY < ant.cellY) || options.find(([, cellY]) => cellY > ant.cellY);
    if (!next) { ant.face = -ant.face; return; }
  }
  moveTo(ant, next[0], next[1]);
  const x = cellCenter(next[0]), y = cellCenter(next[1]);
  const smelled = level.foods.find(food => !food.found && Math.hypot(food.x - x, foodY(food) - y) <= config.smell);
  if (!smelled) return;
  smelled.found = true;
  level.fieldsDirty = true;
  showMessage('UNA RACCOGLITRICE HA TROVATO DEL CIBO', 90);
  Sfx.play('found');
}

// Terrain may change under an ant (sand slides, a plug, rising water): pushed into a free neighbour, or lost.
function checkFooting(ant) {
  const material = cellMaterial(ant.cellX, ant.cellY);
  if (material === 0) { ant.wetT = 0; return true; }
  if (material === CONFIG.material.water) return ++ant.wetT <= CONFIG.ants.drown;
  for (const [deltaX, deltaY] of [[0, -1], ...NEIGHBOURS]) {
    if (isWalkable(ant.cellX + deltaX, ant.cellY + deltaY)) { ant.cellX += deltaX; ant.cellY += deltaY; ant.fromX = ant.cellX; ant.fromY = ant.cellY; ant.t = 0; return true; }
  }
  return false;
}

function removeAnt(ant, message, sound) {
  game.ants.splice(game.ants.indexOf(ant), 1);
  game.L.lostAnts++;
  if (message) showMessage(message, 90);
  if (sound) Sfx.play(sound);
}

function updateAnts() {
  const level = game.L, config = CONFIG.ants;
  if (game.frame % config.fieldEvery === 0) {
    const knownBefore = level.knownFood.length;
    updateKnownFood();
    if (level.fieldsDirty || level.knownFood.length !== knownBefore || game.frame % (config.fieldEvery * 3) === 0) { updateFields(); level.fieldsDirty = false; }
  }
  const crews = { dig: 0, forage: 0, plug: 0, home: 0, scout: 0 };
  for (const ant of game.ants) if (ant.job) crews[ant.job]++;
  for (const ant of game.ants.slice()) {
    if (!checkFooting(ant)) { removeAnt(ant, ant.wetT ? 'UNA FORMICA E ANNEGATA' : 'UNA FORMICA E RIMASTA SOTTO LA SABBIA', ant.wetT ? 'drowned' : 'collapse'); continue; }
    if (ant.t > 0) { ant.t--; continue; }
    const rethink = game.frame >= ant.thinkAt;
    if (!ant.job || (!ant.carry && rethink && (ant.job === 'home' || (ant.job === 'scout' && level.knownFood.length)))) assignJob(ant, crews);
    if (game.recall && (ant.job === 'forage' || ant.job === 'scout') && !ant.carry) assignJob(ant, crews);
    if (ant.job === 'scout' && isGrassCell(ant.cellX, ant.cellY)) { scoutStep(ant); if (!ant.job) crews.scout--; continue; }
    const goal = goalOf(ant), distance = fieldAt(goal, ant.cellX, ant.cellY);
    if (distance === 0) { if (ant.job === 'scout') { scoutStep(ant); if (!ant.job) crews.scout--; } else arrive(ant, goal); continue; }
    if (distance === NO_PATH || !step(ant, goal)) {
      if (ant.carry === 'soil' && goal === 'exit') { ant.carry = null; }
      if (ant.job !== 'home') { crews[ant.job]--; ant.job = null; }
    }
  }
}

// Drawing position: between the previous cell and the current one; on the grass the ant sits on the ground.
function antPosition(ant) {
  const progress = ant.stepTotal ? 1 - ant.t / ant.stepTotal : 1;
  const x = cellCenter(ant.fromX) + (cellCenter(ant.cellX) - cellCenter(ant.fromX)) * progress;
  const y = cellCenter(ant.fromY) + (cellCenter(ant.cellY) - cellCenter(ant.fromY)) * progress;
  return { x, y: isUnderground(ant.cellY) ? y : y + 1 };
}
