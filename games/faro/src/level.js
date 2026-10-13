// games/faro/src/level.js
'use strict';
const SCENARIOS = [
  { id: 'calm', name: 'NOTTE CALMA', hint: 'ILLUMINA LA ROTTA: LE NAVI SEGUONO LA LUCE' },
  { id: 'storm', name: 'TEMPESTA', hint: 'VENTO E FULMINI: GLI SCOGLI SI VEDONO AL LAMPO' },
  { id: 'fog', name: 'NEBBIA', hint: 'CON LA NEBBIA LA LUCE ARRIVA MENO LONTANO' },
];

function levelSpec(levelNumber) {
  const scenario = (levelNumber - 1) % SCENARIOS.length, loop = Math.floor((levelNumber - 1) / SCENARIOS.length);
  return { n: levelNumber, scenario, loop, seed: levelNumber * 7919 + 104729 };
}
function dailySpec(date) {
  const dateHash = hashString('faro-' + date);
  return { n: 0, daily: date, scenario: dateHash % SCENARIOS.length, loop: 1, seed: dateHash };
}
const tutorialSpec = () => ({ n: 0, tutorial: true, scenario: 0, loop: 0, seed: 555 });

// Rocks are spaced so that at most one of them blocks the sea at any x: there is always a free lane.
function makeRocks(random, count, lastX) {
  const rocks = [];
  const firstX = CONFIG.rocks.firstX, step = count > 1 ? (lastX - firstX) / (count - 1) : 0;
  for (let i = 0; i < count; i++) rocks.push({ x: Math.round(firstX + i * step + (random() - 0.5) * 8), lane: Math.floor(random() * 3), seen: false });
  return rocks;
}

function makeShips(random, count) {
  const ships = [];
  for (let i = 0; i < count; i++) {
    const wave = Math.floor(i / CONFIG.waves.size), indexInWave = i % CONFIG.waves.size;
    ships.push({
      id: i, t: CONFIG.waves.first + wave * CONFIG.waves.between + indexInWave * CONFIG.waves.gap,
      speed: CONFIG.ship.speedMin + random() * (CONFIG.ship.speedMax - CONFIG.ship.speedMin),
      lane: Math.floor(random() * 3), laneF: 0, x: CONFIG.ship.spawnX, state: 'wait', lit: 0, following: false, stateT: 0,
    });
    ships[i].laneF = ships[i].lane;
  }
  return ships;
}

function makeStars(random) {
  const stars = [];
  for (let i = 0; i < 80; i++) stars.push({ x: Math.floor(random() * CONFIG.W * 1.2), y: 12 + Math.floor(random() * 108), tw: random() < 0.3, ph: Math.floor(random() * 120) });
  return stars;
}

function genLevel(spec) {
  const random = mulberry32(spec.seed), scenario = SCENARIOS[spec.scenario];
  const shipCount = spec.tutorial ? 2 : Math.min(CONFIG.waves.maxShips, 4 + spec.loop * 2 + (scenario.id === 'storm' ? 1 : 0));
  const fog = scenario.id === 'fog', storm = scenario.id === 'storm';
  const rockCount = spec.tutorial ? 1 : Math.min(fog ? CONFIG.rocks.fogMax : CONFIG.rocks.max, 2 + spec.loop);
  const amplitude = storm ? 2.2 : 1;
  const level = {
    spec, n: spec.n, sc: scenario, tutorial: !!spec.tutorial, worldW: CONFIG.W,
    rocks: makeRocks(random, rockCount, fog ? CONFIG.rocks.fogLastX : CONFIG.rocks.lastX), ships: makeShips(random, shipCount), stars: makeStars(random),
    rain: storm ? 0.8 : 0, wind: storm ? 1.3 : scenario.id === 'fog' ? 0.3 : 0.2, lightning: storm, fog,
    total: shipCount, docked: 0, sunk: 0,
    water: makeWater(CONFIG.sea.base, [3 * amplitude, 1.6 * amplitude, 0.8], [1.0, 1.6, 2.7], null, CONFIG.W),
    backdrop: makeBackdrop(spec),
  };
  return level;
}
