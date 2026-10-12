// games/senza-luce/src/level.js
'use strict';
const SCENARIOS = [
  { id: 'moon', name: 'LUNA PIENA', hint: "CON LA LUNA I PROIETTORI DELLE MOTOVEDETTE ARRIVANO PIU' LONTANO" },
  { id: 'storm', name: 'TEMPESTA', hint: 'LA PIOGGIA COPRE IL MOTORE, I LAMPI TI SCOPRONO' },
  { id: 'fog', name: 'NEBBIA', hint: 'DENTRO UN BANCO DI NEBBIA LA LUCE NON TI TROVA' },
];

function levelSpec(levelNumber) {
  const scenario = (levelNumber - 1) % SCENARIOS.length, loop = Math.floor((levelNumber - 1) / SCENARIOS.length);
  return { n: levelNumber, scenario, loop, seed: levelNumber * 6211 + 92821 };
}
function dailySpec(date) {
  const dateHash = hashString('senza-luce-' + date);
  return { n: 0, daily: date, scenario: dateHash % SCENARIOS.length, loop: 1, seed: dateHash };
}
const tutorialSpec = () => ({ n: 0, tutorial: true, scenario: 0, loop: 0, seed: 777 });

// A fixed spacing from the cove on, never next to the start: the boat always begins out of reach of every beam.
function makeTowers(random, worldW, period, maxCount) {
  const config = CONFIG.tower, towers = [];
  const count = Math.min(maxCount, 1 + Math.floor((worldW - config.lastGap - config.firstX) / config.spacing));
  for (let i = 0; i < count; i++) {
    towers.push({ x: Math.round(config.firstX + i * config.spacing + (random() - 0.5) * 2 * config.jitter), period, phase: random() * Math.PI * 2 });
  }
  return towers;
}

function makePatrols(random, count, worldW) {
  const config = CONFIG.patrol, patrols = [];
  const lowCenter = config.minX + config.segment / 2, highCenter = worldW - config.startClear - config.segment / 2;
  for (let i = 0; i < count; i++) {
    const center = lowCenter + (count > 1 ? i / (count - 1) : 0.5) * (highCenter - lowCenter) + (random() - 0.5) * 60;
    const x0 = Math.round(center - config.segment / 2), x1 = Math.round(center + config.segment / 2), lane = Math.floor(random() * 3);
    patrols.push({ x: Math.round(x0 + random() * (x1 - x0)), x0, x1, dir: random() < 0.5 ? -1 : 1, lane, laneF: lane, homeLane: lane, targetLane: lane, mode: 'patrol', modeT: 0, targetX: 0 });
  }
  return patrols;
}

function makeCrates(random, count, worldW) {
  const config = CONFIG.crates, span = worldW - config.lastGap - config.firstX, crates = [];
  for (let i = 0; i < count; i++) crates.push({ x: Math.round(config.firstX + (i + 0.5) * span / count + (random() - 0.5) * 40), lane: Math.floor(random() * 3), taken: false });
  return crates;
}

function makeFogBanks(random, worldW) {
  const banks = [], count = CONFIG.fog.banks;
  for (let i = 0; i < count; i++) banks.push({ x: Math.round((i + random() * 0.6) * worldW / count), w: 60 + Math.floor(random() * 50), speed: 0.06 + random() * 0.1 });
  return banks;
}

function makeStars(random) {
  const stars = [];
  for (let i = 0; i < 80; i++) stars.push({ x: Math.floor(random() * (CONFIG.W + 130)), y: 12 + Math.floor(random() * 50), tw: random() < 0.3, ph: Math.floor(random() * 120) });
  return stars;
}

function genLevel(spec) {
  const random = mulberry32(spec.seed), scenario = SCENARIOS[spec.scenario], tutorial = !!spec.tutorial;
  const screens = tutorial ? CONFIG.world.tutorialScreens : Math.min(CONFIG.world.maxScreens, CONFIG.world.screens + Math.floor(spec.loop / 2));
  const worldW = screens * CONFIG.W;
  const storm = !tutorial && scenario.id === 'storm', fog = !tutorial && scenario.id === 'fog', moon = !tutorial && scenario.id === 'moon';
  const towerConfig = CONFIG.tower, period = Math.max(towerConfig.minPeriod, towerConfig.period - spec.loop * towerConfig.periodPerLoop);
  const amplitude = storm ? 2.2 : 1;
  return {
    spec, n: spec.n, sc: scenario, tutorial, worldW,
    towers: makeTowers(random, worldW, period, tutorial ? 1 : Infinity),
    patrols: makePatrols(random, tutorial ? 1 : Math.min(CONFIG.patrol.max, 1 + spec.loop), worldW),
    crates: makeCrates(random, tutorial ? 1 : CONFIG.crates.count, worldW),
    fogBanks: fog ? makeFogBanks(random, worldW) : [],
    stars: makeStars(random),
    moon, fog, storm,
    rain: storm ? 0.8 : 0, wind: storm ? 1.3 : fog ? 0.3 : 0.2, lightning: storm,
    dawnAt: tutorial ? 0 : worldW * CONFIG.dawn.framesPerPixel,
    cratesTaken: 0, arrived: false,
    water: makeWater(CONFIG.sea.base, [3 * amplitude, 1.6 * amplitude, 0.8], [1.0, 1.6, 2.7], null, worldW),
  };
}
