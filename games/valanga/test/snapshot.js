// games/valanga/test/snapshot.js
'use strict';
const crypto = require('crypto');
// Simulation state used by the harness stateHash(): everything that must be identical for two runs to count as the same game.
// The terrain mask is hashed as a whole, so every carved or deposited cell counts.
module.exports = (hook, encodeStable) => {
  const game = hook.game, level = game.L, noObjects = new Map();
  const fixed = value => encodeStable(value, noObjects);
  const body = game.rescuer;
  return {
    rescuer: fixed({ x: body.x, y: body.y, vx: body.vx, vy: body.vy, face: body.face, onGround: body.onGround, digT: body.digT, probeT: body.probeT, stunT: body.stunT }),
    victims: level.victims.map(victim => fixed({ state: victim.state, air: victim.air, found: victim.found, y: victim.y })),
    terrain: crypto.createHash('sha1').update(level.terrain.cells).digest('hex'),
    avalanche: fixed(game.avalanche), avalancheAt: level.avalancheAt, marks: fixed(game.probeMarks),
    saved: level.saved, lost: level.lost, score: game.score, particles: game.parts.length,
    camera: fixed([game.camX, game.camY]), wind: fixed(game.wind), clock: game.clock, frame: game.frame,
  };
};
