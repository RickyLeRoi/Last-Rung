// games/valanga/test/autopilot.js
'use strict';
// Scripted rescuer shared by levels.js (solvability) and the golden scenarios. It knows where the buried people are (it reads the state):
// it walks to the one with the least air left, probes once, digs straight down (never sideways onto a person) until the
// person is free, climbs out and goes on.
// When a crack warns of an avalanche it runs out of the marked zone, downhill if it can. Keyboard only, like a player.
const { boot } = require('./helpers');

const ARRIVED = 3;                  // px from the person's centre at which the rescuer stops walking and starts working
const ZONE_MARGIN = 12;

// Air left minus a rough walking time: the most urgent person first.
function chooseTarget(hook) {
  const game = hook.game, x = hook.rescuerCenterX();
  let best = null, bestScore = Infinity;
  for (const victim of game.L.victims) {
    if (victim.state !== 'buried') continue;
    const air = victim.air === Infinity ? 1e6 : victim.air, travel = Math.abs(hook.victimCenterX(victim) - x) * 1.4;
    const score = air - travel < 600 ? air : air + travel * 3;
    if (score < bestScore) { bestScore = score; best = victim; }
  }
  return best;
}

// Keys to hold this frame and whether to tap the probe.
function rescuerKeys(hook) {
  const game = hook.game, body = game.rescuer, x = hook.rescuerCenterX(), avalanche = game.avalanche;
  // The zone still ahead of the front is dangerous until the front stops (behind the front the snow has already come down).
  const dangerStart = avalanche ? (avalanche.phase === 'warning' ? avalanche.startX : avalanche.frontX) - ZONE_MARGIN : 0;
  if (avalanche && x > dangerStart && x < avalanche.endX + ZONE_MARGIN) {
    const toRight = avalanche.endX + ZONE_MARGIN - x, toLeft = x - dangerStart;
    const direction = toRight < toLeft * 2 ? 'ArrowRight' : 'ArrowLeft';
    return { keys: [direction, 'ArrowUp'], dig: false, probe: false };
  }
  const victim = chooseTarget(hook);
  if (!victim) return { keys: [], dig: false, probe: false };
  const deltaX = hook.victimCenterX(victim) - x;
  if (Math.abs(deltaX) > ARRIVED) {
    const direction = deltaX > 0 ? 'ArrowRight' : 'ArrowLeft', blocked = hook.Terrain.hitsRect(game.L.terrain, body.x + Math.sign(deltaX), body.y, body.w, body.h);
    // Out of a hole: climb; against a snow wall on the surface: dig through it.
    return { keys: [direction, 'ArrowUp'], dig: blocked && body.onGround && Math.abs(deltaX) > 10 && body.y + body.h < victim.y - 6, probe: false };
  }
  if (!victim.found && body.probeT === 0 && body.onGround) return { keys: [], dig: false, probe: true };
  return { keys: [], dig: true, probe: false };
}

// Plays one level to its end; returns { state, result, stars, saved, lost, total, frames, driver }.
function playLevel(spec, limit = 15000) {
  const driver = boot({ seededMath: 1 });
  const hook = driver.hook, game = hook.game;
  driver.play(spec);
  for (let i = 0; i < limit && game.state === 'play'; i++) {
    const plan = rescuerKeys(hook);
    driver.set(plan.keys);
    if (plan.dig) driver.keyDown('Space'); else driver.keyUp('Space');
    if (plan.probe) driver.tap('KeyX'); else driver.tick();
  }
  driver.set([]); driver.keyUp('Space');
  for (let i = 0; i < 200 && game.state === 'play'; i++) driver.tick();
  const level = game.L;
  return { state: game.state, result: game.result, stars: game.stars, saved: level.saved, lost: level.lost, total: level.total, frames: game.frame, reason: game.overReason, driver };
}

module.exports = { playLevel, rescuerKeys };
