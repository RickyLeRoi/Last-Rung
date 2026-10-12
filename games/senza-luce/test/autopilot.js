// games/senza-luce/test/autopilot.js
'use strict';
// Scripted smuggler shared by levels.js (solvability) and the golden scenarios. It reads the state (it knows where every beam will be:
// the lighthouses turn on a fixed schedule) and, every few frames, tries a handful of plans (throttle x lane) over the next seconds,
// keeping the one that stays out of the light and gets closest to the cove; it slows down near patrols, picks up the crates on its way
// and throws a smoke screen when it is about to raise the alarm. It drives with the keyboard only, like a player.
const { boot } = require('./helpers');

const HORIZON = 110;            // frames looked ahead
const DECIDE_EVERY = 4;
const THROTTLES = [-1, -0.45, 0, 0.45];
const QUIET_NEAR = 130;         // px: closer than this to a patrol the smuggler only uses the quiet throttle
const CRATE_RANGE = 220;        // px ahead within which a crate attracts the boat to its lane
const SMOKE_ALERT = 55;

// Patrol position k frames ahead (patrolling patrols bounce between their ends; the others are assumed to keep their heading).
function predictPatrol(hook, patrol, frames) {
  const config = hook.CONFIG.patrol;
  let x = patrol.x, dir = patrol.dir;
  if (patrol.mode === 'patrol') {
    for (let k = 0; k < frames; k++) { if (x <= patrol.x0) dir = 1; else if (x >= patrol.x1) dir = -1; x += dir * config.speed; }
  } else {
    const speed = patrol.mode === 'chase' ? config.chaseSpeed : config.suspectSpeed;
    x += dir * speed * frames;
  }
  return { x, dir, laneF: patrol.laneF };
}

function isSeenAt(hook, x, laneF, clock, frames) {
  const game = hook.game, CONFIG = hook.CONFIG, y = hook.laneWaterlineY(x, laneF) - CONFIG.boat.sightHeight;
  const hidden = distance => hook.isInFogBank(x) && distance > CONFIG.fog.seeDistance;
  for (const tower of game.L.towers) {
    const cone = hook.towerCone(tower, clock);
    if (cone && hook.coneContains(cone, x, y) && !hidden(Math.hypot(x - cone.x, y - cone.y))) return 'light';
  }
  for (const patrol of game.L.patrols) {
    const future = predictPatrol(hook, patrol, frames), centerX = future.x + hook.SPRITES.patrol.w / 2;
    if (Math.abs(centerX - x) < CONFIG.catch.distance + 4 && Math.abs(future.laneF - laneF) < CONFIG.catch.lanes + 0.2) return 'catch';
    const cone = hook.patrolCone(future);
    if (hook.coneContains(cone, x, y) && !hidden(Math.hypot(x - cone.x, y - cone.y))) return 'light';
  }
  return null;
}

function nextCrate(hook) {
  const game = hook.game, x = hook.boatSightX();
  let best = null;
  for (const crate of game.L.crates) if (!crate.taken && crate.x + 2 < x + 4 && x - crate.x < CRATE_RANGE && (!best || crate.x > best.x)) best = crate;
  return best;
}

// Simulates the boat for HORIZON frames with a throttle target and a lane; returns a score (higher is better).
function scorePlan(hook, throttleTarget, lane) {
  const game = hook.game, CONFIG = hook.CONFIG, config = CONFIG.boat, boat = game.boat, halfWidth = hook.SPRITES.boat.w / 2;
  let x = boat.x, vx = boat.vx, throttle = boat.throttle, laneF = boat.laneF, score = 0;
  for (let k = 1; k <= HORIZON; k++) {
    throttle += Math.max(-config.throttleRamp, Math.min(config.throttleRamp, throttleTarget - throttle));
    vx = Math.max(-config.maxSpeed, Math.min(config.maxSpeed, (vx + throttle * config.accel) * config.drag));
    x = Math.max(0, x + vx);
    laneF += Math.max(-config.laneSpeed, Math.min(config.laneSpeed, lane - laneF));
    if (x <= CONFIG.cove.x) break;
    const seen = isSeenAt(hook, x + halfWidth, laneF, game.clock + k, k);
    if (seen === 'catch') score -= 4000 / k;
    else if (seen === 'light') score -= 400 / (1 + k * 0.05);
  }
  score -= x;
  const crate = nextCrate(hook);
  if (crate && lane === crate.lane) score += 60;
  return score - Math.abs(lane - boat.lane) * 5;
}

function nearestPatrolDistance(hook) {
  let nearest = Infinity;
  for (const patrol of hook.game.L.patrols) nearest = Math.min(nearest, Math.abs(hook.patrolCenterX(patrol) - hook.boatSightX()));
  return nearest;
}

function choosePlan(hook) {
  const game = hook.game, quiet = nearestPatrolDistance(hook) < QUIET_NEAR;
  let best = null;
  for (const throttle of THROTTLES) {
    if (quiet && throttle === -1) continue;
    for (let lane = 0; lane < hook.CONFIG.sea.laneOffsets.length; lane++) {
      const score = scorePlan(hook, throttle, lane);
      if (!best || score > best.score) best = { throttle, lane, score };
    }
  }
  return best;
}

function applyPlan(driver, plan) {
  const game = driver.game, keys = [];
  if (plan.throttle < 0) keys.push('ArrowLeft'); else if (plan.throttle > 0) keys.push('ArrowRight');
  if (plan.lane < game.boat.lane && game.boat.laneLatch === 0) keys.push('ArrowUp');
  if (plan.lane > game.boat.lane && game.boat.laneLatch === 0) keys.push('ArrowDown');
  driver.set(keys);
  if (Math.abs(plan.throttle) < 1 && plan.throttle !== 0) driver.keyDown('ShiftLeft'); else driver.keyUp('ShiftLeft');
}

// Plays one level to its end; returns { state, crates, total, alarms, frames, driver }.
function playLevel(spec, limit = 12000) {
  const driver = boot({ seededMath: 1 });
  const hook = driver.hook, game = hook.game;
  driver.play(spec);
  let plan = null;
  for (let i = 0; i < limit && game.state === 'play'; i++) {
    if (!game.boat.engineOn) { driver.tap('KeyX'); continue; }
    if (i % DECIDE_EVERY === 0) plan = choosePlan(hook);
    applyPlan(driver, plan);
    if (game.seen && game.alert > SMOKE_ALERT && game.boat.smokes > 0 && !game.smokes.some(smoke => smoke.t < 200)) driver.tap('Space'); else driver.tick();
  }
  driver.set([]); driver.keyUp('ShiftLeft');
  for (let i = 0; i < 200 && game.state === 'play'; i++) driver.tick();
  return { state: game.state, result: game.result, stars: game.stars, crates: game.L.cratesTaken, total: game.L.crates.length, alarms: game.alarms, frames: game.frame, reason: game.overReason, driver };
}

module.exports = { playLevel, choosePlan, applyPlan };
