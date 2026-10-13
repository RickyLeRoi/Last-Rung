// games/sabbia/test/snapshot.js
'use strict';
const crypto = require('crypto');
// Simulation state used by the harness stateHash(): the whole grid (material, temperature, life, locks) plus the brush and the budgets.
module.exports = (hook, encodeStable) => {
  const game = hook.game, level = game.L, world = level.world, noObjects = new Map();
  const digest = typed => crypto.createHash('sha1').update(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)).digest('hex');
  return {
    material: digest(world.material), temperature: digest(world.temperature), life: digest(world.life), anchored: digest(world.anchored), locked: digest(world.locked),
    cursor: encodeStable([game.cursor.x, game.cursor.y], noObjects), selected: game.selected, brush: game.brushSize, budget: encodeStable(level.budget, noObjects),
    score: game.score, clock: game.clock, frame: game.frame,
  };
};
