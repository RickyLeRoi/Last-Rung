// games/valanga/src/level.js
'use strict';
const SCENARIOS = [
  { id: 'day', name: 'GIORNO SERENO', hint: "SEGUI L'ARTVA: PIU' BIP, PIU' VICINO" },
  { id: 'storm', name: 'BUFERA', hint: 'VENTO E NEVE FITTA: IL VENTO TI SPINGE' },
  { id: 'night', name: 'NOTTE', hint: 'AL BUIO VEDI SOLO CON LA LAMPADA FRONTALE' },
];

function levelSpec(levelNumber) {
  const scenario = (levelNumber - 1) % SCENARIOS.length, loop = Math.floor((levelNumber - 1) / SCENARIOS.length);
  return { n: levelNumber, scenario, loop, seed: levelNumber * 5303 + 77003 };
}
function dailySpec(date) {
  const dateHash = hashString('valanga-' + date);
  return { n: 0, daily: date, scenario: dateHash % SCENARIOS.length, loop: 1, seed: dateHash };
}
const tutorialSpec = () => ({ n: 0, tutorial: true, scenario: 0, loop: 0, seed: 909 });

const waveSum = (x, waves, phases) => waves.reduce((sum, [amplitude, frequency], i) => sum + amplitude * Math.sin(x * frequency + phases[i]), 0);

// Rock goes down from the top left to the bottom right; a thin snow cover everywhere, the avalanche deposit in the middle.
function buildSlope(random, width, height, tutorial) {
  const config = CONFIG.slope, snow = CONFIG.snow, materials = CONFIG.material;
  const rockPhases = config.bumps.map(() => random() * Math.PI * 2), lumpPhases = snow.lumps.map(() => random() * Math.PI * 2);
  const terrain = Terrain.make(width, height), rockTop = new Int16Array(width);
  const depositStart = tutorial ? 120 : snow.depositStart, depositEnd = width - snow.depositEndGap;
  const fall = (height - config.bottomMargin - config.top) / width;
  for (let x = 0; x < width; x++) {
    rockTop[x] = Math.round(config.top + x * fall + waveSum(x, config.bumps, rockPhases));
    const taper = clamp(Math.min(x - depositStart, depositEnd - x) / snow.taper, 0, 1);
    const depth = Math.round(snow.base + taper * (snow.depositDepth + waveSum(x, snow.lumps, lumpPhases)));
    Terrain.fillRect(terrain, x, rockTop[x], 1, height - rockTop[x], materials.rock);
    Terrain.fillRect(terrain, x, rockTop[x] - depth, 1, depth, materials.snow);
  }
  return { terrain, rockTop, depositStart, depositEnd };
}

const surfaceOf = (terrain, x) => Terrain.surfaceY(terrain, x, 0);

function placeBoulders(random, slope, count) {
  const config = CONFIG.boulders, boulders = [];
  for (let i = 0; i < count; i++) {
    const x = Math.round(slope.depositStart + (i + 0.5) * (slope.depositEnd - slope.depositStart) / count + (random() - 0.5) * 60);
    const radius = config.minRadius + Math.floor(random() * config.radiusRange);
    Terrain.fillCircle(slope.terrain, x, surfaceOf(slope.terrain, x) + radius * 0.3, radius, CONFIG.material.rock, false);
    boulders.push({ x, radius });
  }
  return boulders;
}

// Buried people: spread across the deposit (never under a boulder), deeper on later loops, always in snow above the rock.
function placeVictims(random, slope, boulders, count, loop, survival) {
  const config = CONFIG.victim, victims = [], low = slope.depositStart + CONFIG.snow.taper, high = slope.depositEnd - CONFIG.snow.taper - config.w;
  for (let attempt = 0; victims.length < count && attempt < 400; attempt++) {
    const x = Math.round(low + random() * (high - low)), spacing = attempt < 300 ? config.spacing : config.spacing / 2;
    if (victims.some(victim => Math.abs(victim.x - x) < spacing) || boulders.some(boulder => Math.abs(boulder.x - x - config.w / 2) < CONFIG.boulders.clearance)) continue;
    let rockLimit = Infinity;
    for (let column = x; column < x + config.w; column++) rockLimit = Math.min(rockLimit, slope.rockTop[column]);
    const surface = surfaceOf(slope.terrain, x + config.w / 2), depth = config.depthMin + Math.floor(random() * config.depthRange) + loop * config.depthPerLoop;
    const y = Math.max(surface + 4, Math.min(surface + depth, rockLimit - config.h - 2));
    victims.push({ x, y, state: 'buried', air: survival, maxAir: survival, found: false, crush: 0 });
  }
  return victims.sort((first, second) => first.x - second.x);
}

function makeStars(random) {
  const stars = [];
  for (let i = 0; i < 70; i++) stars.push({ x: Math.floor(random() * (CONFIG.W + 130)), y: 12 + Math.floor(random() * 120), tw: random() < 0.3, ph: Math.floor(random() * 120) });
  return stars;
}

function genLevel(spec) {
  const random = mulberry32(spec.seed), scenario = SCENARIOS[spec.scenario], tutorial = !!spec.tutorial;
  const world = CONFIG.world, width = tutorial ? world.tutorialWidth : spec.loop >= 2 ? world.wideWidth : world.width;
  const slope = buildSlope(random, width, world.height, tutorial);
  const boulders = tutorial ? [] : placeBoulders(random, slope, Math.min(CONFIG.boulders.max, CONFIG.boulders.count + spec.loop * CONFIG.boulders.perLoop));
  const victimConfig = CONFIG.victim, survival = tutorial ? Infinity : Math.max(victimConfig.minSurvival, victimConfig.survival - spec.loop * victimConfig.survivalPerLoop);
  const victims = placeVictims(random, slope, boulders, tutorial ? 1 : Math.min(victimConfig.max, 2 + spec.loop), spec.loop, survival);
  const storm = !tutorial && scenario.id === 'storm', night = !tutorial && scenario.id === 'night';
  const avalancheConfig = CONFIG.avalanche, avalanches = !tutorial && (spec.loop >= 1 || storm);
  const surface = new Int16Array(width);
  for (let x = 0; x < width; x++) surface[x] = surfaceOf(slope.terrain, x);
  return {
    spec, n: spec.n, sc: scenario, tutorial, width, height: world.height,
    terrain: slope.terrain, surface, loose: new Uint8Array(width), victims, boulders,
    total: victims.length, saved: 0, lost: 0,
    storm, night, wind: storm ? CONFIG.weather.stormWind : 0.2,
    snowCount: storm ? CONFIG.weather.stormSnow : night ? CONFIG.weather.nightSnow : 0,
    avalancheAt: avalanches ? avalancheConfig.firstAt : 0,
    avalancheGap: Math.max(avalancheConfig.minGap, avalancheConfig.gap - spec.loop * avalancheConfig.gapPerLoop),
    avalancheDeadly: spec.loop >= avalancheConfig.deadlyFromLoop,
    ridgePhase: random() * Math.PI * 2,
    stars: makeStars(random),
  };
}
