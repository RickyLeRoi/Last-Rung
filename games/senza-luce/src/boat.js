// games/senza-luce/src/boat.js
'use strict';
// The smugglers' boat: throttle, lanes, engine on/off, engine noise, smoke screens, crates and the cove.
const NO_INPUT = Object.freeze({ hx: 0, up: 0, down: 0, engine: false, smoke: false });

function newBoat(worldW) {
  const lane = 1;
  return { x: worldW - CONFIG.boat.startOffset - SPRITES.boat.w, vx: 0, throttle: 0, lane, laneF: lane, laneLatch: 0, engineOn: true, smokes: CONFIG.smoke.count, noiseT: 0 };
}

function toggleEngine() {
  const boat = game.boat;
  boat.engineOn = !boat.engineOn;
  game.used.engine = true;
  if (boat.engineOn) {
    Sfx.play('engineOn');
    emitNoise(CONFIG.noise.restartRadius);
    showMessage('MOTORE ACCESO', 50);
  } else {
    Sfx.play('engineOff');
    showMessage('MOTORE SPENTO: SILENZIO, MA LA CORRENTE TI PORTA AL LARGO', 120);
  }
}

function dropSmoke() {
  const boat = game.boat;
  if (boat.smokes <= 0) { showMessage('FUMOGENI FINITI', 60); return; }
  boat.smokes--;
  game.used.smoke = true;
  const x = boatSightX(), y = boatSightY() - 3;
  game.smokes.push({ x, y, t: 0 });
  for (let i = 0; i < 8; i++) addParticle({ t: 'smoke', x: x + randomRange(-6, 6), y: y + randomRange(-3, 3), r: randomRange(1, 3), life: Math.floor(randomRange(90, 160)) });
  Sfx.play('smoke');
  showMessage('FUMOGENO: LA LUCE NON LO ATTRAVERSA', 80);
}

function updateSmokes() {
  for (const smoke of game.smokes) {
    smoke.t++;
    smoke.x += game.wind * 0.05;
    if (chance(0.12)) { const radius = smokeRadius(smoke); addParticle({ t: 'smoke', x: smoke.x + randomRange(-radius, radius) * 0.6, y: smoke.y + randomRange(-radius, radius) * 0.4, r: 1, life: 80 }); }
  }
  if (game.smokes.some(smoke => smoke.t >= CONFIG.smoke.frames)) game.smokes = game.smokes.filter(smoke => smoke.t < CONFIG.smoke.frames);
}

// One lane per push of the stick (or key), with some hysteresis so a stick held halfway does not flicker.
function steerLane(input) {
  const boat = game.boat, vertical = input.down - input.up;
  if (Math.abs(vertical) < 0.3) { boat.laneLatch = 0; return; }
  const direction = Math.sign(vertical);
  if (Math.abs(vertical) < 0.5 || boat.laneLatch === direction) return;
  boat.laneLatch = direction;
  const lane = clamp(boat.lane + direction, 0, CONFIG.sea.laneOffsets.length - 1);
  if (lane !== boat.lane) { boat.lane = lane; game.used.lane = true; }
}

// A loud engine makes a noise every so often; going slower lets the counter run down.
function updateNoise() {
  const boat = game.boat, config = CONFIG.noise;
  if (!boat.engineOn || Math.abs(boat.throttle) <= config.throttle) { boat.noiseT = Math.max(0, boat.noiseT - 1); return; }
  if (++boat.noiseT < config.every) return;
  boat.noiseT = 0;
  emitNoise(config.radius * (game.L.rain ? config.rainFactor : 1));
}

function pickCrates() {
  const boat = game.boat, x = boatSightX();
  for (const crate of game.L.crates) {
    if (crate.taken || Math.abs(x - (crate.x + 2)) >= CONFIG.crates.pickDistance || Math.abs(boat.laneF - crate.lane) >= 0.5) continue;
    crate.taken = true;
    game.L.cratesTaken++;
    game.score += CONFIG.score.crate;
    Sfx.play('crate');
    showMessage('CASSA RECUPERATA! +' + CONFIG.score.crate, 70);
  }
}

function arrive() {
  game.L.arrived = true;
  game.score += CONFIG.score.arrive;
  Sfx.play('cove');
  showMessage('SEI NELLA GROTTA! +' + CONFIG.score.arrive, 90);
}

function updateBoat(input) {
  const boat = game.boat, config = CONFIG.boat, level = game.L;
  if (level.arrived) input = NO_INPUT;
  if (input.engine) toggleEngine();
  if (input.smoke) dropSmoke();
  if (input.hx) game.used.move = true;
  const wantedThrottle = !boat.engineOn ? 0 : level.arrived ? -0.5 : input.hx;
  boat.throttle += clamp(wantedThrottle - boat.throttle, -config.throttleRamp, config.throttleRamp);
  if (boat.engineOn) {
    boat.vx = (boat.vx + boat.throttle * config.accel) * config.drag;
    steerLane(input);
  } else {
    boat.vx += (config.current + game.wind * config.windDrift - boat.vx) * config.driftResponse;
  }
  boat.vx = clamp(boat.vx, -config.maxSpeed, config.maxSpeed);
  boat.x = clamp(boat.x + boat.vx, 0, level.worldW - SPRITES.boat.w);
  boat.laneF += clamp(boat.lane - boat.laneF, -config.laneSpeed, config.laneSpeed);
  updateNoise();
  if (Math.abs(boat.vx) > 0.2 && chance(config.wakeChance)) {
    const sternX = boat.vx < 0 ? boat.x + SPRITES.boat.w : boat.x;
    addParticle({ t: 'px', x: sternX, y: laneWaterlineY(sternX, boat.laneF), vx: -Math.sign(boat.vx) * randomRange(0.1, 0.5), vy: -randomRange(0.1, 0.5), g: 0.04, life: 25, drop: true });
  }
  if (!isLive()) return;
  pickCrates();
  if (!level.arrived && boat.x <= CONFIG.cove.x) arrive();
}

function updateCamera() {
  const boat = game.boat;
  game.camX = Camera.follow(game.camX, boat.x + SPRITES.boat.w / 2 - CONFIG.W / 2 + boat.vx * 60, game.L.worldW, CONFIG.W, 0.08);
}
