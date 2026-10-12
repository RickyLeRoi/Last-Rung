'use strict';
const SCENARIOS = [
  { id: 'sea', name: 'MARE AGITATO', hint: 'PORTA I NAUFRAGHI SULLA SCIALUPPA' },
  { id: 'storm', name: 'TEMPESTA', hint: "VENTO FORTE! LA SCIALUPPA E' LA ZONA SICURA" },
  { id: 'flood', name: "CITTA' ALLAGATA", hint: "PORTALI SUL TETTO CON L'ELIPORTO (H)" },
  { id: 'fire', name: 'PALAZZI IN FIAMME', hint: 'NON TOCCARE LE FIAMME. ELIPORTO (H) SICURO' },
];

// Night flying from the second loop on, only on calm sea and flooded city.
const nightFor = (scenario, loop) => loop >= 1 && (scenario === 0 || scenario === 2);

function levelSpec(levelNumber) {
  const scenario = (levelNumber - 1) % 4, loop = Math.floor((levelNumber - 1) / 4), night = nightFor(scenario, loop);
  return { n: levelNumber, scenario, loop, seed: levelNumber * 9301 + 49297, night, fog: !night && levelNumber >= CONFIG.fog.from };
}
function dailySpec(date) {
  const dateHash = hashString('last-rung-' + date);   // 20260930 ** RG #rename_last_rung: daily seeds differ from the old name
  return { n: 0, daily: date, scenario: dateHash % 4, loop: 1, seed: dateHash, night: nightFor(dateHash % 4, 1) && ((dateHash >> 3) & 1) === 1 };
}
const tutorialSpec = () => ({ n: 0, tutorial: true, scenario: 2, loop: 0, seed: 777 });

function lineHazard(startX, startY, endX, endY) {
  const points = [];
  bresenham(startX, startY, endX, endY, (x, y) => points.push(x, y));
  return withBounds({ pts: points });
}
function cableHazard(startX, startY, endX, endY, sag) {
  const points = [];
  const segmentCount = Math.ceil(Math.abs(endX - startX)) * 2;
  let lastKey = '';
  for (let i = 0; i <= segmentCount; i++) {
    const progress = i / segmentCount;
    const x = round(startX + (endX - startX) * progress), y = round(startY + (endY - startY) * progress + sag * 4 * progress * (1 - progress));
    const pointKey = x + ',' + y;
    if (pointKey !== lastKey) { points.push(x, y); lastKey = pointKey; }
  }
  return withBounds({ pts: points, cable: true });
}
function cloudShape(random, scale) {
  const circles = [];
  const circleCount = 3 + Math.floor(random() * 3);
  let x = 0;
  for (let i = 0; i < circleCount; i++) {
    const radius = (3 + random() * 5) * scale;
    circles.push({ x: x + radius, y: -(i === (circleCount >> 1) ? radius * 0.5 : random() * radius * 0.3), r: radius });
    x += radius * 1.3;
  }
  const seen = new Set(), points = [];
  for (const circle of circles) {
    const steps = Math.ceil(circle.r * 8);
    for (let i = 0; i < steps; i++) {
      const angle = i / steps * Math.PI * 2;
      const pointX = round(circle.x + Math.cos(angle) * circle.r), pointY = round(circle.y + Math.sin(angle) * circle.r);
      if (pointY > 0) continue;
      if (circles.some(otherCircle => otherCircle !== circle && (pointX - otherCircle.x) ** 2 + (pointY - otherCircle.y) ** 2 < (otherCircle.r - 0.7) ** 2)) continue;
      const key = pointX + ',' + pointY;
      if (!seen.has(key)) { seen.add(key); points.push(pointX, pointY); }
    }
  }
  const leftX = round(circles[0].x - circles[0].r), rightX = round(circles[circleCount - 1].x + circles[circleCount - 1].r);
  for (let i = leftX; i <= rightX; i += 2) points.push(i, 1);
  return { pts: points };
}

function genLevel(spec) {
  const { W: screenWidth, H: screenHeight } = CONFIG;
  const scenarioInfo = SCENARIOS[spec.scenario];
  const loop = spec.loop;
  const random = mulberry32(spec.seed);
  const randomBetween = (min, max) => min + random() * (max - min);
  const randomIntBetween = (min, max) => Math.floor(min + random() * (max - min + 1));
  const timers = CONFIG.timers, timeScale = Math.pow(timers.perLoop, loop);

  const level = {
    spec, n: spec.n, sc: scenarioInfo, loop, worldW: CONFIG.WORLD_W, night: !!spec.night || !!game.forceNight, fog: !game.forceNight && (!!spec.fog || !!game.forceFog), moonFull: false, buoys: [], dogsSaved: 0, tutorial: !!spec.tutorial,
    solids: [], haz: [], fires: [], people: [], decor: [],
    water: null, wind: 0, rain: 0, lightning: false,
    stars: [], clouds: [], skyline: [], moon: null,
    safe: null, saved: 0, dead: 0, killedByPlayer: 0, total: 0,
  };

  const addPerson = overrides => level.people.push(Object.assign({
    x: 0, y: 0, vx: 0, vy: 0, state: 'stand', on: null, rel: 0, timer: 0, tmax: 0,
    ph: randomIntBetween(0, 99), sw: 0, swv: 0, ht: 0, slot: -1, drift: 0, deadMode: null, gone: false, run: false, dropped: false,
    injured: false, panic: false, blocked: false, noHook: 0, dir: 0, kind: 'adult', buoy: null,
  }, overrides));
  const standOn = (solid, relativeX, countdown) => {
    relativeX = clamp(round(relativeX), 1, solid.w - 8);
    addPerson({ state: 'stand', on: solid, rel: relativeX, x: solid.x + relativeX, y: solid.y - 8, timer: countdown || 0, tmax: countdown || 0 });
  };
  const floatAt = (x, countdown) => addPerson({ state: 'float', x, y: 0, timer: countdown, tmax: countdown, drift: (random() - 0.5) * 0.1 });
  const floatTime = () => Math.floor(randomBetween(timers.float[0], timers.float[1]) * timeScale);
  const freeX = (x, width, margin) => level.solids.every(solid => x + width + margin < solid.x || x - margin > solid.x + solid.w);
  const placeFloaters = (count, minX, maxX) => {
    const floatXs = [];
    for (let tries = 0; floatXs.length < count && tries < 500; tries++) {
      const x = randomIntBetween(minX, maxX);
      if (!freeX(x, 7, 26) || floatXs.some(otherX => Math.abs(otherX - x) < 55)) continue;
      floatXs.push(x);
    }
    floatXs.forEach(floatX => floatAt(floatX, floatTime()));
  };
  const addStars = (count, yMax) => {
    for (let i = 0; i < count; i++) {
      level.stars.push({ x: randomIntBetween(0, Math.ceil((level.worldW - screenWidth) * 0.08) + screenWidth), y: randomIntBetween(13, yMax), ph: randomIntBetween(0, 119), tw: random() < 0.3 });
    }
  };
  const addClouds = (count, scale, minY, maxY, parallax, speed) => {
    for (let i = 0; i < count; i++) {
      const cloud = cloudShape(random, scale);
      cloud.x = randomIntBetween(0, screenWidth + 240); cloud.y = randomIntBetween(minY, maxY); cloud.par = parallax; cloud.sp = speed * (0.6 + random() * 0.8);
      level.clouds.push(cloud);
    }
  };
  const addSkyline = bottom => {
    const endX = (level.worldW - screenWidth) * 0.35 + screenWidth + 20;
    for (let x = -10; x < endX;) {
      const width = randomIntBetween(14, 34), height = randomIntBetween(22, 80);
      const building = { x, y: bottom - height, w: width, bot: bottom, lights: [] };
      const lightCount = randomIntBetween(2, 6);
      for (let i = 0; i < lightCount; i++) building.lights.push(randomIntBetween(2, width - 2), randomIntBetween(3, height - 3));
      level.skyline.push(building);
      x += width + randomIntBetween(2, 8);
    }
  };
  const addWindows = (building, bottom, skipTop) => {
    for (let windowY = building.y + 6 + (skipTop ? 10 : 0); windowY < bottom - 6; windowY += 10) {
      for (let windowX = building.x + 4; windowX + 4 <= building.x + building.w - 4; windowX += 8) building.win.push({ x: windowX, y: windowY, lit: random() < 0.2, fire: false });
    }
  };

  function buildSea(storm) {
    const base = storm ? 140 : 150, amplitude = 1 + loop * 0.12;
    level.water = storm
      ? makeWater(base, [6.2 * amplitude, 3 * amplitude, 1.4], [1.3, 1.9, 3.1], null, level.worldW)
      : makeWater(base, [3 * amplitude, 1.6, 0.8], [1.0, 1.6, 2.7], null, level.worldW);
    const boat = { kind: 'boat', x: randomIntBetween(80, 130), y: base - 2, w: 46, h: 10, safe: true, dyn: true };
    level.solids.push(boat);
    level.safe = boat;

    if (!storm) {
      const rock = { kind: 'rock', x: randomIntBetween(330, 450), y: base - 16, w: 36, h: 60 };
      level.solids.push(rock);
      const wreckX = randomIntBetween(640, 780), wreckWidth = randomIntBetween(96, 116);
      const hull = { kind: 'hull', x: wreckX, y: base - 10, w: wreckWidth, h: 60 };
      const tower = { kind: 'tower', x: wreckX + wreckWidth - 28, y: base - 32, w: 20, h: 22 };
      level.solids.push(hull, tower);
      const mastX = wreckX + 16;
      const mast = lineHazard(mastX, base - 11, mastX, base - 54);
      mast.blink = [mastX, base - 54];
      level.haz.push(mast, lineHazard(mastX - 7, base - 46, mastX + 7, base - 46), lineHazard(mastX - 5, base - 46, mastX - 12, base - 11));
      standOn(rock, 15);
      standOn(hull, randomIntBetween(32, wreckWidth - 50));
      standOn(tower, 7);
      placeFloaters(3 + loop, 200, level.worldW - 40);
      level.decor.push({ k: 'crate', x: randomIntBetween(250, 1000), dr: 0.05 }, { k: 'crate', x: randomIntBetween(250, 1000), dr: -0.04 }, { k: 'buoy', x: randomIntBetween(520, 600), dr: 0 });
      level.moon = { x: 330, y: 30 };
      addStars(60, 110);
      addClouds(4, 1, 18, 60, 0.2, 2);
    } else {
      level.wind = 1.3 + loop * 0.3; level.rain = 1; level.lightning = true;
      const rigX = randomIntBetween(640, 800), rigWidth = 112, deckY = base - 58;
      const deck = { kind: 'rig', x: rigX, y: deckY, w: rigWidth, h: 8 };
      level.solids.push(deck);
      for (const legX of [rigX + 6, rigX + 54, rigX + rigWidth - 10]) level.solids.push({ kind: 'leg', x: legX, y: deckY + 8, w: 4, h: screenHeight - deckY });
      const derrickLeftX = rigX + 78, derrickRightX = rigX + 102, derrickTopY = deckY - 44, derrickMidX = (derrickLeftX + derrickRightX) / 2;
      const derrick = lineHazard(derrickLeftX, deckY - 1, derrickMidX, derrickTopY);
      derrick.blink = [round(derrickMidX), derrickTopY];
      level.haz.push(derrick, lineHazard(derrickRightX, deckY - 1, derrickMidX, derrickTopY), lineHazard(derrickLeftX + 4, deckY - 14, derrickRightX - 4, deckY - 14),
        lineHazard(derrickLeftX + 8, deckY - 28, derrickRightX - 8, deckY - 28), lineHazard(derrickLeftX + 4, deckY - 14, derrickRightX - 8, deckY - 28));
      const lowRig = { kind: 'rig', x: rigX - 44, y: base - 24, w: 34, h: 6 };
      level.solids.push(lowRig, { kind: 'leg', x: rigX - 29, y: base - 18, w: 4, h: 60 });
      standOn(deck, randomIntBetween(14, 20));
      standOn(deck, randomIntBetween(40, 46));
      standOn(lowRig, 13);
      placeFloaters(3 + loop, 200, level.worldW - 40);
      level.decor.push({ k: 'buoy', x: randomIntBetween(300, 500), dr: 0 }, { k: 'crate', x: randomIntBetween(250, 1000), dr: 0.06 }, { k: 'buoy', x: randomIntBetween(900, 1050), dr: 0 });
      addClouds(12, 1.7, 12, 36, 0.15, 8);
    }
  }

  function buildFlood() {
    const base = 168;
    level.water = makeWater(base, [1.4, 0.8, 0.4], [0.8, 1.3, 2.1], null, level.worldW);
    level.rain = 0.35;
    const buildings = [];
    for (let x = randomIntBetween(24, 40); ;) {
      const width = randomIntBetween(40, 64);
      if (x + width > level.worldW - 16) break;
      const roofY = randomIntBetween(70, 138);
      const building = { kind: 'bld', x, y: roofY, w: width, h: screenHeight - roofY + 8, win: [] };
      buildings.push(building);
      building.wide = buildings.length > 1 && random() < 0.5;
      building.gap = building.wide ? randomIntBetween(62, 90) : randomIntBetween(14, 24);
      x += width + building.gap;
    }
    const helipad = buildings.find((building, i) => i >= 1 && building.w >= 44) || buildings[0];
    helipad.safe = true; helipad.y = randomIntBetween(108, 128); helipad.h = screenHeight - helipad.y + 8;
    level.safe = helipad;
    for (const building of buildings) { level.solids.push(building); addWindows(building, screenHeight, building.safe); }
    for (const building of buildings) {
      if (building.safe || building.w < 52 || random() > 0.45) continue;
      const antennaX = random() < 0.5 ? building.x + 5 : building.x + building.w - 6, antennaHeight = randomIntBetween(10, 18);
      building.ant = antennaX;
      const antenna = lineHazard(antennaX, building.y - 1, antennaX, building.y - antennaHeight);
      antenna.blink = [antennaX, building.y - antennaHeight];
      level.haz.push(antenna, lineHazard(antennaX - 2, building.y - antennaHeight + 4, antennaX + 2, building.y - antennaHeight + 4));
    }
    const candidates = buildings.filter(building => !building.safe);
    for (let i = candidates.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [candidates[i], candidates[j]] = [candidates[j], candidates[i]]; }
    const roofPersonCount = Math.min(candidates.length, 4 + loop);
    for (let i = 0; i < roofPersonCount; i++) {
      const building = candidates[i];
      let relativeX = building.w / 2 - 3.5;
      if (building.ant !== undefined) relativeX += building.ant < building.x + building.w / 2 ? 4 : -4; else relativeX += randomBetween(-5, 5);
      standOn(building, relativeX);
    }
    const wides = buildings.filter(building => building.wide && !building.safe);
    const floaterCount = Math.min(wides.length, 2 + Math.min(loop, 2));
    for (let i = 0; i < floaterCount; i++) {
      const building = wides[i];
      building.hasFloat = true;
      floatAt(building.x + building.w + Math.floor(building.gap / 2) - 3 + randomIntBetween(-8, 8), floatTime());
    }
    for (let i = 0; i < buildings.length - 1; i++) {
      const building = buildings[i], nextBuilding = buildings[i + 1];
      if (!building.wide || building.hasFloat || building.safe || nextBuilding.safe) continue;
      if (random() < 0.5) {
        const cableY = Math.max(building.y, nextBuilding.y) + 6;
        level.haz.push(cableHazard(building.x + building.w, cableY, nextBuilding.x - 1, cableY, randomIntBetween(8, 14)));
      } else {
        const debrisX = building.x + building.w + randomIntBetween(12, building.gap - 24);
        level.decor.push(random() < 0.5 ? { k: 'car', x: debrisX, dr: 0 } : { k: 'tree', x: debrisX, dr: 0 });
      }
    }
    addSkyline(base);
    addStars(25, 70);
    addClouds(5, 1.2, 16, 50, 0.2, 3);
    level.moon = { x: 60, y: 26 };
  }

  function buildFire() {
    const groundY = 190;
    level.water = makeWater(195, [1, 0.6, 0.3], [0.9, 1.5, 2.3], [[480, 620]], level.worldW, [0.05, 0.09, 0.15]);
    level.solids.push({ kind: 'ground', x: 0, y: groundY, w: 480, h: 40 }, { kind: 'ground', x: 620, y: groundY, w: level.worldW - 620, h: 40 });
    const buildings = [];
    const addBuildingRow = (startX, endX) => {
      for (let x = startX + randomIntBetween(0, 8); ;) {
        const width = randomIntBetween(44, 64);
        if (x + width > endX) break;
        const roofY = randomIntBetween(64, 140);
        buildings.push({ kind: 'bld', x, y: roofY, w: width, h: groundY - roofY, win: [], door: true });
        x += width + randomIntBetween(16, 40);
      }
    };
    addBuildingRow(20, 470);
    addBuildingRow(640, 1136);
    const helipad = buildings[0];
    helipad.safe = true; helipad.y = randomIntBetween(112, 130); helipad.h = groundY - helipad.y;
    level.safe = helipad;
    for (const building of buildings) { level.solids.push(building); addWindows(building, groundY, building.safe); }
    const others = buildings.filter(building => !building.safe);
    for (const building of others) building.burning = building.w >= 50 && random() < 0.7;
    for (const building of others) {
      if (others.filter(building => building.burning).length >= 3) break;
      if (!building.burning && building.w >= 50) building.burning = true;
    }
    let placed = 0;
    for (const building of others) {
      if (!building.burning) continue;
      const fireWidth = randomIntBetween(10, 15), fireHeight = randomIntBetween(12, 20), left = random() < 0.5;
      level.fires.push({ x: left ? building.x + 2 : building.x + building.w - 2 - fireWidth, y: building.y, w: fireWidth, h: fireHeight, seed: random() * 10, bx0: building.x + 1, bx1: building.x + building.w - 1, press: 0, hp: 1 });
      for (const buildingWindow of building.win) if (random() < 0.22) buildingWindow.fire = true;
      if (placed < 4 + loop) {
        standOn(building, left ? fireWidth + 24 : building.w - fireWidth - 31, Math.floor(randomBetween(timers.fire[0], timers.fire[1]) * timeScale));
        placed++;
      }
    }
    const calm = others.find(building => !building.burning && building.w >= 40);
    if (calm) standOn(calm, calm.w / 2 - 3.5);
    floatAt(randomIntBetween(505, 590), floatTime());
    addSkyline(groundY);
    addStars(20, 60);
  }

  function buildTutorial() {
    const base = 168;
    level.worldW = 480;
    level.sc = { id: 'flood', name: 'ADDESTRAMENTO', hint: '' };
    level.water = makeWater(base, [1, 0.6, 0.3], [0.8, 1.3, 2.1], null, level.worldW);
    const addBuilding = (x, width, y, safe) => { const building = { kind: 'bld', x, y, w: width, h: screenHeight - y + 8, win: [], safe }; level.solids.push(building); addWindows(building, screenHeight, safe); return building; };
    const helipad = addBuilding(30, 56, 120, true);
    level.safe = helipad;
    const roof = addBuilding(190, 64, 112);
    addBuilding(300, 56, 136);
    addBuilding(384, 60, 132);
    const endlessTimer = 1e9;
    addPerson({ state: 'float', x: 134, y: 0, timer: endlessTimer, tmax: 0, drift: 0.02, tut: 'float' });
    const relativeX = 44;
    addPerson({ state: 'stand', on: roof, rel: relativeX, x: roof.x + relativeX, y: roof.y - 8, tut: 'roof' });
    addPerson({ state: 'float', x: 366, y: 0, timer: endlessTimer, tmax: 0, drift: 0, tut: 'alley' });
    addSkyline(base);
    addStars(25, 70);
    addClouds(4, 1.2, 16, 50, 0.2, 3);
    level.moon = { x: 300, y: 28 };
  }

  if (spec.tutorial) buildTutorial();
  else if (scenarioInfo.id === 'sea' || scenarioInfo.id === 'storm') buildSea(scenarioInfo.id === 'storm');
  else if (scenarioInfo.id === 'flood') buildFlood();
  else buildFire();

  // From level 2: one injured person per level; cannot grab the ladder, must be loaded by landing.
  // Picked on a rooftop wide enough to land on, preferably without flames.
  if (!spec.tutorial && (spec.n >= 2 || spec.daily)) {
    const isInjuredCandidate = person => person.state === 'stand' && !person.on.safe && person.on.w >= 44 && ['bld', 'hull', 'rig'].includes(person.on.kind);
    const injuredCandidates = level.people.filter(isInjuredCandidate).sort((first, second) => (first.tmax > 0) - (second.tmax > 0) || second.on.w - first.on.w);
    for (let i = 0; i < Math.min(CONFIG.injured.share, injuredCandidates.length); i++) injuredCandidates[i].injured = true;
  }

  if (!level.people.length) {
    const solid = level.solids.find(candidate => !candidate.safe && candidate.w >= 20 && candidate.kind !== 'leg' && candidate.kind !== 'ground');
    if (solid) standOn(solid, solid.w / 2 - 3.5); else floatAt(level.worldW - 200, 4000);
  }

  // "Connected" surfaces (touching, step small enough): people can run between them.
  for (const solid of level.solids) solid.adj = [];
  const fixedSolids = level.solids.filter(solid => !solid.dyn);
  for (let i = 0; i < fixedSolids.length; i++) {
    for (let j = i + 1; j < fixedSolids.length; j++) {
      const solidA = fixedSolids[i], solidB = fixedSolids[j];
      const touch = solidA.x <= solidB.x + solidB.w + 1 && solidB.x <= solidA.x + solidA.w + 1 && solidA.y <= solidB.y + solidB.h + 1 && solidB.y <= solidA.y + solidA.h + 1;
      if (touch && Math.abs(solidA.y - solidB.y) <= CONFIG.rescue.stepUp) { solidA.adj.push(solidB); solidB.adj.push(solidA); }
    }
  }

  // Drawn last so the random sequence of the level layout stays unchanged.
  if (!spec.tutorial && (spec.n >= 2 || spec.daily)) {
    const adults = level.people.filter(person => !person.injured);
    const pickAdult = () => adults.splice(Math.floor(random() * adults.length), 1)[0];
    if (adults.length > 2) pickAdult().kind = 'kid';
    if (adults.length > 2 && (spec.n >= 3 || spec.daily)) pickAdult().kind = 'old';
    const host = level.people.find(person => person.state === 'stand' && !person.on.safe && person.tmax === 0 && person.on.w >= 30 && person.kind !== 'dog');
    if (host) {
      const hostSolid = host.on, relativeX = host.rel + 9 <= hostSolid.w - 8 ? host.rel + 9 : Math.max(1, host.rel - 9);
      addPerson({ state: 'stand', on: hostSolid, rel: relativeX, x: hostSolid.x + relativeX, y: hostSolid.y - 8, kind: 'dog' });
    } else if (level.water) {
      addPerson({ state: 'float', x: level.worldW - 150, y: 0, timer: floatTime(), tmax: 0, drift: 0.03, kind: 'dog' });
      const dog = level.people[level.people.length - 1]; dog.tmax = dog.timer;
    }
  }
  if (level.night) level.moonFull = random() < 0.5;

  level.total = level.people.filter(person => person.kind !== 'dog').length;
  return level;
}
