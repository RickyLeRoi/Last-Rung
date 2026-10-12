// games/valanga/src/rescuer.js
'use strict';
// The rescuer: walks on the snow (faster downhill), climbs out of holes, digs snow (never rock) and probes for buried people.
// Digging sideways undercuts the snow above, which collapses into the hole.
const NO_INPUT = Object.freeze({ hx: 0, up: 0, down: 0, dig: 0, probe: false });

function newRescuer() {
  const config = CONFIG.rescuer, x = config.startX;
  let groundY = Infinity;
  for (let column = x; column < x + config.w; column++) groundY = Math.min(groundY, surfaceAt(column));
  return { x, y: groundY - config.h, w: config.w, h: config.h, vx: 0, vy: 0, face: 1, onGround: true, digT: 0, digging: false, probeT: 0, stunT: 0, climbing: false, walk: 0 };
}

const rescuerCenterX = () => game.rescuer.x + game.rescuer.w / 2;
const rescuerFeetY = () => game.rescuer.y + game.rescuer.h;

// Speed factor from the ground a few pixels ahead: downhill is faster, uphill slower.
function slopeFactor(direction) {
  const config = CONFIG.rescuer, body = game.rescuer, centerX = rescuerCenterX();
  const drop = groundBelow(centerX + direction * 4, body.y) - groundBelow(centerX, body.y);
  return clamp(1 + drop / 4 * config.slopeBoost, config.minFactor, config.maxFactor);
}

const isWallAhead = () => hitsGround(game.rescuer.x + game.rescuer.face, game.rescuer.y, game.rescuer.w, game.rescuer.h);

function dig(downward) {
  const config = CONFIG.dig, body = game.rescuer, centerX = rescuerCenterX();
  const x = downward ? centerX + body.face : centerX + body.face * config.reach, y = downward ? rescuerFeetY() + config.downReach - 2 : rescuerFeetY() - 3;
  game.used.dig = true;
  if (!carveSnow(x, y, config.radius)) {
    if (Terrain.get(game.L.terrain, x, y) === ROCK) Sfx.play('rock');
    return;
  }
  Sfx.play('dig');
  snowBurst(x, y, 2, -body.face);
  freeTouchedVictims(x, y, config.radius);
}

function startProbe() {
  if (game.rescuer.probeT > 0) return;
  game.rescuer.probeT = CONFIG.probe.frames;
  game.used.probe = true;
}

// The probe goes straight down under the rescuer's feet: it finds a buried person within reach, or leaves a mark of an empty try.
function finishProbe() {
  const config = CONFIG.probe, victimConfig = CONFIG.victim, centerX = rescuerCenterX(), feetY = rescuerFeetY();
  let hit = false;
  for (const victim of game.L.victims) {
    if (victim.state !== 'buried' || Math.abs(victim.x + victimConfig.w / 2 - centerX) > config.width + victimConfig.w / 2) continue;
    if (victim.y + victimConfig.h < feetY - 2 || victim.y > feetY + config.depth) continue;
    victim.found = true;
    hit = true;
  }
  game.probeMarks.push({ x: Math.round(centerX), y: Math.round(feetY), hit });
  if (game.probeMarks.length > config.maxMarks) game.probeMarks.shift();
  Sfx.play(hit ? 'probeHit' : 'probeMiss');
  showMessage(hit ? "SONDA: C'E' QUALCUNO QUI SOTTO! SCAVA" : 'SONDA: NIENTE QUI SOTTO', hit ? 100 : 60);
}

function moveRescuer(input) {
  const config = CONFIG.rescuer, body = game.rescuer, wasOnGround = body.onGround;
  const direction = Math.sign(input.hx);
  if (direction) { body.face = direction; game.used.move = true; }
  const target = input.hx * config.walk * (direction ? slopeFactor(direction) : 1);
  body.vx += (target - body.vx) * config.accel + game.wind * CONFIG.weather.push * (game.L.storm ? 1 : 0);
  body.climbing = input.up > 0.5 && isWallAhead() && !hitsGround(body.x, body.y - 1, body.w, body.h);
  if (body.climbing) { body.y -= config.climb; body.vy = 0; } else body.vy = Math.min(config.maxFall, body.vy + config.gravity);
  const result = Terrain.moveRect(game.L.terrain, body, body.vx, body.climbing ? 0 : body.vy, wasOnGround || body.climbing ? config.stepUp : 0);
  if (result.hitX) body.vx = 0;
  body.onGround = result.hitY && body.vy >= 0;
  if (result.hitY) body.vy = 0;
  // Walking downhill: stay on the ground instead of hopping off every step.
  if (wasOnGround && !body.onGround && !body.climbing) {
    for (let drop = 1; drop <= config.snapDown; drop++) {
      if (!hitsGround(body.x, body.y + drop, body.w, body.h)) continue;
      body.y += drop - 1; body.vy = 0; body.onGround = true;
      break;
    }
  }
  if (Math.abs(body.vx) > 0.1 && body.onGround) body.walk++;
}

// Snow dropped on top of the rescuer (avalanche) lifts them back to the surface.
function liftOutOfSnow() {
  const body = game.rescuer;
  for (let i = 0; i < 40 && hitsGround(body.x, body.y, body.w, body.h); i++) body.y -= 1;
}

function updateRescuer(input) {
  const body = game.rescuer;
  if (body.stunT > 0) { body.stunT--; input = NO_INPUT; }
  if (body.probeT > 0) {
    if (--body.probeT === CONFIG.probe.resultAt) finishProbe();
    input = NO_INPUT;
  }
  if (input.probe && body.onGround) startProbe();
  moveRescuer(input);
  body.digging = input.dig > 0.5 && body.onGround && body.probeT === 0;
  // Straight down by default; with a direction held the shovel works sideways (and the snow above comes down).
  if (body.digging) { if (body.digT++ % CONFIG.dig.every === 0) dig(Math.abs(input.hx) <= 0.5); } else body.digT = 0;
}

function updateCamera() {
  const body = game.rescuer, level = game.L;
  game.camX = Camera.follow(game.camX, rescuerCenterX() - CONFIG.W / 2 + body.face * 30, level.width, CONFIG.W, 0.1);
  game.camY = Camera.follow(game.camY, body.y - CONFIG.H / 2 + 10, level.height, CONFIG.H, 0.1);
  game.shake = Camera.decayShake(game.shake);
}
