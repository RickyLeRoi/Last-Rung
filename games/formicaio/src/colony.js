// games/formicaio/src/colony.js
'use strict';
// The queen, the brood and the food stock. Growth: food -> egg -> larva (eats) -> pupa -> worker.
// The queen lays only with food in stock and room in a nursery (her own chamber holds a few).

const completeChambers = type => game.L.chambers.filter(chamber => chamber.complete && chamber.type === type);
const stockCapacity = () => CONFIG.chamber.baseStock + completeChambers('pantry').length * CONFIG.chamber.pantryCap;
const nurseries = () => [game.L.queenChamber, ...completeChambers('nursery')];
const nurseryRoom = chamber => (chamber.type === 'queen' ? CONFIG.chamber.queenCap : CONFIG.chamber.nurseryCap);
const population = () => game.ants.length;

function addFood(amount) {
  const room = stockCapacity() - game.stock;
  game.stock += Math.min(room, amount);
  return Math.min(room, amount);
}

const isUnderWater = (x, y) => Terrain.get(game.L.terrain, x, y) === CONFIG.material.water;

function updateQueen() {
  const level = game.L, chamber = level.queenChamber, broodConfig = CONFIG.brood;
  if (isUnderWater(chamber.x, chamber.y + chamber.r - 4)) {
    if (++game.queenWetT > CONFIG.rain.queenDrown) { gameOver("LA REGINA E' ANNEGATA"); return; }
  } else game.queenWetT = 0;
  game.layT += level.broodSpeed;
  if (game.layT < broodConfig.layEvery) return;
  // Food is kept for the larvae already there: a new egg only when the stock covers it and half of what they still need.
  const stillHungry = game.brood.reduce((sum, item) => sum + (item.stage === 'pupa' ? 0 : broodConfig.larvaMeals - item.fed), 0);
  if (game.stock < 1 + Math.ceil(stillHungry / 2) || population() + game.brood.length >= CONFIG.ants.max) return;
  const home = nurseries().find(nursery => game.brood.filter(item => item.chamber === nursery).length < nurseryRoom(nursery));
  if (!home) return;
  game.layT = 0;
  game.stock--;
  const slot = game.brood.filter(item => item.chamber === home).length;
  game.brood.push({ stage: 'egg', t: 0, fed: 0, chamber: home, slot });
}

// A larva eats larvaMeals times, evenly spread from its hatching; without food it waits.
function updateBrood() {
  const level = game.L, broodConfig = CONFIG.brood, speed = level.broodSpeed;
  for (const item of game.brood) {
    if (isUnderWater(item.chamber.x, item.chamber.y + item.chamber.r - 3)) { item.drowned = true; continue; }
    if (item.stage === 'larva' && item.fed < broodConfig.larvaMeals && item.t >= item.fed * broodConfig.larva / broodConfig.larvaMeals) {
      if (game.stock < 1) continue;
      game.stock--; item.fed++;
    }
    item.t += speed;
    if (item.stage === 'egg' && item.t >= broodConfig.egg) { item.stage = 'larva'; item.t = 0; }
    else if (item.stage === 'larva' && item.t >= broodConfig.larva) { item.stage = 'pupa'; item.t = 0; }
    else if (item.stage === 'pupa' && item.t >= broodConfig.pupa) item.hatched = true;
  }
  const drowned = game.brood.filter(item => item.drowned).length;
  if (drowned) { level.lostBrood += drowned; showMessage("ACQUA NELLA NURSERY: COVATA PERSA", 120); Sfx.play('drowned'); }
  for (const item of game.brood) if (item.hatched) { spawnAnt(item.chamber.x, item.chamber.y); level.born++; game.score += CONFIG.score.worker; Sfx.play('born'); }
  if (drowned || game.brood.some(item => item.hatched)) {
    game.brood = game.brood.filter(item => !item.drowned && !item.hatched);
    for (const chamber of nurseries()) game.brood.filter(item => item.chamber === chamber).forEach((item, i) => { item.slot = i; });
  }
}

// New food appears on the grass on a fixed schedule.
function updateFoodSchedule() {
  const level = game.L;
  while (level.foodSchedule.length && level.foodSchedule[0].at <= game.clock) {
    const next = level.foodSchedule.shift();
    level.foods.push({ x: next.x, kind: next.kind, amount: CONFIG.food[next.kind] });
  }
}
