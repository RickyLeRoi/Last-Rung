// games/formicaio/src/level.js
'use strict';
const SCENARIOS = [
  { id: 'meadow', name: 'PRATO', hint: 'TRACCIA LE PISTE: SOTTO TERRA SCAVANO, SOPRA TROVANO IL CIBO' },
  { id: 'rain', name: 'PIOGGIA', hint: "ARRIVANO I TEMPORALI: RICHIAMA LE FORMICHE E TAPPA L'INGRESSO" },
  { id: 'drought', name: 'SICCITA', hint: 'CIBO RARO E LONTANO, PISTE CHE SVANISCONO, SABBIA CHE FRANA' },
];

function levelSpec(levelNumber) {
  const scenario = (levelNumber - 1) % SCENARIOS.length, loop = Math.floor((levelNumber - 1) / SCENARIOS.length);
  return { n: levelNumber, scenario, loop, seed: levelNumber * 7919 + 10007 };
}
function dailySpec(date) {
  const dateHash = hashString('formicaio-' + date);
  return { n: 0, daily: date, scenario: dateHash % SCENARIOS.length, loop: 1, seed: dateHash };
}
const tutorialSpec = () => ({ n: 0, tutorial: true, scenario: 0, loop: 0, seed: 4242 });

const FOOD_KINDS = ['seed', 'seed', 'seed', 'crumb', 'crumb', 'insect'];

function buildSoil(random, width, height, nest, drought) {
  const config = CONFIG.soil, materials = CONFIG.material, groundY = CONFIG.world.groundY;
  const terrain = Terrain.make(width, height);
  const phases = CONFIG.world.bumps.map(() => random() * Math.PI * 2);
  for (let x = 0; x < width; x++) {
    const top = groundY + Math.round(CONFIG.world.bumps.reduce((sum, [amplitude, frequency], i) => sum + amplitude * Math.sin(x * frequency + phases[i]), 0));
    Terrain.fillRect(terrain, x, top, 1, height - top, materials.soil);
  }
  const nearNest = (x, y, margin) => Math.abs(x - nest.x) < config.nestClearance + margin && y < nest.y + config.nestClearance + margin;
  for (let i = 0; i < config.stones; i++) {
    const radius = config.stoneMinRadius + Math.floor(random() * config.stoneRadiusRange);
    const x = 8 + Math.floor(random() * (width - 16)), y = groundY + config.stoneDepth + Math.floor(random() * (height - groundY - config.stoneDepth - 8));
    if (!nearNest(x, y, radius)) Terrain.fillCircle(terrain, x, y, radius, materials.stone, false);
  }
  for (let i = 0; i < config.roots; i++) {
    let x = 12 + Math.floor(random() * (width - 24)), y = groundY;
    const length = config.rootLength[0] + Math.floor(random() * (config.rootLength[1] - config.rootLength[0]));
    if (nearNest(x, y, 6)) continue;
    for (let step = 0; step < length; step++) {
      Terrain.fillRect(terrain, x, y, 1, 1, materials.root);
      y++;
      if (random() < 0.3) x += random() < 0.5 ? -1 : 1;
    }
  }
  const pockets = drought ? config.droughtSandPockets : config.sandPockets;
  for (let i = 0; i < pockets; i++) {
    const radius = config.sandRadius[0] + Math.floor(random() * (config.sandRadius[1] - config.sandRadius[0]));
    const x = 12 + Math.floor(random() * (width - 24)), y = groundY + radius + 4 + Math.floor(random() * 60);
    if (!nearNest(x, y, radius)) Terrain.fillCircle(terrain, x, y, radius, materials.sand, false);
  }
  // The founding queen dug a short shaft and one small chamber.
  for (let y = groundY - 4; y <= nest.y; y += 2) Terrain.carveCircle(terrain, nest.x, y, CONFIG.nest.shaftRadius);
  Terrain.carveCircle(terrain, nest.x, nest.y, nest.radius);
  return terrain;
}

function placeFood(random, width, entranceX, distanceLimit) {
  const config = CONFIG.food;
  for (let attempt = 0; attempt < 50; attempt++) {
    const x = distanceLimit
      ? entranceX + (random() < 0.5 ? -1 : 1) * (config.minDistance + Math.floor(random() * (distanceLimit - config.minDistance)))
      : 16 + Math.floor(random() * (width - 32));
    if (x >= 16 && x < width - 16 && Math.abs(x - entranceX) >= config.minDistance) return x;
  }
  return Math.min(width - 16, entranceX + config.minDistance);
}

function genLevel(spec) {
  const random = mulberry32(spec.seed), scenario = SCENARIOS[spec.scenario], tutorial = !!spec.tutorial, loop = spec.loop;
  const world = CONFIG.world, width = tutorial ? world.tutorialWidth : world.width, height = world.height, cell = CONFIG.cell;
  const drought = !tutorial && scenario.id === 'drought', rainy = !tutorial && scenario.id === 'rain';
  const entranceX = tutorial ? CONFIG.nest.tutorialEntranceX : CONFIG.nest.entranceX;
  const queenChamber = { x: entranceX, y: world.groundY + CONFIG.nest.queenDepth, r: CONFIG.nest.queenRadius, type: 'queen', complete: true };
  const terrain = buildSoil(random, width, height, { x: queenChamber.x, y: queenChamber.y, radius: queenChamber.r }, drought);
  const foodConfig = CONFIG.food, season = tutorial ? Infinity : Math.max(CONFIG.season.min, CONFIG.season.frames - loop * CONFIG.season.perLoop);

  const foods = [], foodSchedule = [];
  const newFood = (x, kind) => ({ x, kind, amount: foodConfig[kind] });
  if (tutorial) foods.push(newFood(entranceX + 70, 'crumb'), newFood(entranceX - 60, 'seed'));
  else {
    const firstCount = drought ? foodConfig.droughtFirstCount : foodConfig.firstCount;
    for (let i = 0; i < firstCount; i++) foods.push(newFood(placeFood(random, width, entranceX, foodConfig.nearDistance), FOOD_KINDS[Math.floor(random() * FOOD_KINDS.length)]));
    const every = drought ? foodConfig.droughtEvery : foodConfig.every;
    for (let at = every; at < season; at += every) foodSchedule.push({ at, x: placeFood(random, width, entranceX, 0), kind: FOOD_KINDS[Math.floor(random() * FOOD_KINDS.length)] });
  }

  const spiders = [];
  if (!tutorial) {
    const spiderConfig = CONFIG.spider, count = Math.min(3, 1 + Math.floor(loop / 3));
    for (let i = 0; i < count; i++) {
      const x = placeFood(random, width, entranceX, 0);
      spiders.push({ x: Math.abs(x - entranceX) < 120 ? width - 40 - i * 60 : x, dir: random() < 0.5 ? -1 : 1, speed: spiderConfig.speed + loop * spiderConfig.perLoop, scaredT: 0, eatT: 0 });
    }
  }

  const showers = [];
  if (rainy) {
    const rain = CONFIG.rain;
    for (let start = rain.firstAt; start + rain.duration < season; start += rain.duration + Math.max(rain.minGap, rain.gap - loop * rain.gapPerLoop)) showers.push({ start, end: start + rain.duration });
  }

  const gridWidth = Math.ceil(width / cell), gridHeight = Math.ceil(height / cell), cells = gridWidth * gridHeight;
  const surface = new Int16Array(width);
  for (let x = 0; x < width; x++) surface[x] = Terrain.surfaceY(terrain, x, 0);
  return {
    spec, n: spec.n, sc: scenario, tutorial, loop, width, height, groundY: world.groundY, entranceX,
    terrain, surface, looseSand: new Uint8Array(width), looseWater: new Uint8Array(width),
    gridWidth, gridHeight, pheromone: new Float32Array(cells), digOrder: new Uint8Array(cells),
    plugs: [], chambers: [queenChamber], queenChamber,
    foods, foodSchedule, spiders, showers, drought, rainy,
    trailDecay: drought ? CONFIG.trail.droughtDecay : CONFIG.trail.decay,
    season, target: tutorial ? CONFIG.target.tutorial : Math.min(CONFIG.target.max, CONFIG.target.base + loop * CONFIG.target.perLoop),
    broodSpeed: tutorial ? CONFIG.brood.tutorialSpeed : 1,
    fields: null, knownFood: [],
    lostBrood: 0, lostAnts: 0, born: 0, delivered: 0, dug: 0, moundCells: 0,
    backdrop: makeBackdrop(spec),
  };
}
