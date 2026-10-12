// games/faro/test/autopilot.js
'use strict';
// Scripted lighthouse keeper shared by levels.js (solvability) and the golden scenarios. It knows where the rocks are. Every frame it tries
// every beam inclination and keeps the one that leaves the most ships (weighted by how close they are to a rock) on a lane that clears the
// next rock: a lit ship follows the lane nearest to the beam centre line at its own x, an unlit ship keeps its lane.
const { boot } = require('./helpers');

const PITCH_STEP = 0.01;
const PITCH_DEADBAND = 0.003;
const SIREN_DISTANCE = 30;      // px before a rock at which an endangered ship makes the keeper sound the siren

// Rocks a ship still has to pass (the hit window extends past the rock centre), the nearest first.
function rocksAhead(hook, ship) {
  const hitDistance = hook.CONFIG.ship.hitDistance;
  return hook.game.L.rocks.filter(rock => rock.x + 7 < ship.x + 9 + hitDistance && rock.x + 7 > hook.CONFIG.port.dockX).sort((first, second) => second.x - first.x);
}

// Score of a lane for a ship: every rock still ahead counts, the nearest one most.
function laneScore(hook, ship, lane) {
  const ahead = rocksAhead(hook, ship);
  if (!ahead.length) return 1;
  let score = 0;
  ahead.forEach((rock, index) => { score += (rock.lane === lane ? 0 : 1) / (1 + 0.6 * index); });
  return score;
}

function urgency(hook, ship) {
  const [next] = rocksAhead(hook, ship);
  return next ? 1 / (1 + Math.max(0, ship.x + 9 - (next.x + 7)) / 40) : 0.05;
}

// Sweeps the beam from the current pitch to the target one, one frame step at a time, and returns the score of the lanes the ships end up
// with: every ship lit on the way follows the beam, so a sweep across a ship it should not touch has a price.
function scoreForSweep(hook, sailing, targetPitch) {
  const game = hook.game, savedPitch = game.beam.pitch, direction = Math.sign(targetPitch - savedPitch);
  const lanes = sailing.map(ship => ship.lane);
  let pitch = savedPitch;
  for (let step = 0; step < 400; step++) {
    pitch = direction > 0 ? Math.min(targetPitch, pitch + hook.CONFIG.beam.pitchSpeed) : Math.max(targetPitch, pitch - hook.CONFIG.beam.pitchSpeed);
    game.beam.pitch = pitch;
    sailing.forEach((ship, i) => {
      if (hook.beamFollows(ship.x + 8, hook.shipWaterlineY(ship) - hook.SHIP_LIGHT_HEIGHT)) lanes[i] = hook.steerLane({ x: ship.x, lane: lanes[i] }, pitch);
    });
    if (pitch === targetPitch) break;
  }
  game.beam.pitch = savedPitch;
  let total = 0;
  sailing.forEach((ship, i) => { total += urgency(hook, ship) * laneScore(hook, ship, lanes[i]); });
  return total;
}

// Arrow keys to hold this frame (the beam is kept narrow and long: ships far away can only be lit that way).
function keeperKeys(hook) {
  const game = hook.game, config = hook.CONFIG.beam;
  if (game.beam.spread > 0) return ['ArrowUp'];
  const sailing = game.L.ships.filter(ship => ship.state === 'sail');
  if (!sailing.length) return [];
  let bestPitch = game.beam.pitch, bestScore = scoreForSweep(hook, sailing, game.beam.pitch) + 0.02;
  for (let pitch = config.pitchMin; pitch <= config.pitchMax; pitch += PITCH_STEP) {
    const score = scoreForSweep(hook, sailing, pitch);
    if (score > bestScore) { bestScore = score; bestPitch = pitch; }
  }
  const difference = bestPitch - game.beam.pitch;
  if (Math.abs(difference) < PITCH_DEADBAND) return [];
  return [difference > 0 ? 'ArrowRight' : 'ArrowLeft'];
}

// True when a ship is about to hit a rock in its own lane and the siren is ready: slowing everybody down buys time to steer it away.
function wantsSiren(hook) {
  const game = hook.game;
  if (game.sirenCool > 0 || game.sirenT > 0) return false;
  return game.L.ships.some(ship => {
    if (ship.state !== 'sail') return false;
    const [next] = rocksAhead(hook, ship);
    return !!next && Math.abs(ship.laneF - next.lane) < 0.8 && ship.x + 9 - (next.x + 7) < SIREN_DISTANCE;
  });
}

// Plays one level to its end; returns { state, docked, sunk, total, frames, driver }.
function playLevel(spec, limit = 9000) {
  const driver = boot({ seededMath: 1 });
  const hook = driver.hook, game = hook.game;
  driver.play(spec);
  for (let i = 0; i < limit && game.state === 'play'; i++) {
    driver.set(keeperKeys(hook));
    if (wantsSiren(hook)) driver.tap('Space'); else driver.tick();
  }
  driver.set([]);
  return { state: game.state, docked: game.L.docked, sunk: game.L.sunk, total: game.L.total, frames: game.frame, driver };
}

module.exports = { playLevel, keeperKeys, wantsSiren };
