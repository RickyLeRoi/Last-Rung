// games/formicaio/test/snapshot.js
'use strict';
const crypto = require('crypto');
// Simulation state used by the harness stateHash(): everything that must be identical for two runs to count as the same game.
// The terrain mask, the pheromone and the dig orders are hashed as a whole.
module.exports = (hook, encodeStable) => {
  const game = hook.game, level = game.L, noObjects = new Map();
  const fixed = value => encodeStable(value, noObjects);
  const digest = typed => crypto.createHash('sha1').update(Buffer.from(typed.buffer, typed.byteOffset, typed.byteLength)).digest('hex');
  return {
    ants: game.ants.map(ant => fixed({ id: ant.id, x: ant.cellX, y: ant.cellY, t: ant.t, job: ant.job, carry: ant.carry, digT: ant.digT, wetT: ant.wetT })),
    brood: game.brood.map(item => fixed({ stage: item.stage, t: item.t, fed: item.fed, chamber: level.chambers.indexOf(item.chamber), slot: item.slot })),
    terrain: digest(level.terrain.cells), pheromone: digest(level.pheromone), digOrder: digest(level.digOrder),
    chambers: level.chambers.map(chamber => fixed({ x: chamber.x, y: chamber.y, type: chamber.type, complete: chamber.complete })),
    plugs: fixed(level.plugs), foods: fixed(level.foods), spiders: fixed(level.spiders),
    stock: game.stock, layT: game.layT, recall: game.recall, cursor: fixed({ x: game.cursor.x, y: game.cursor.y }),
    counters: fixed({ born: level.born, delivered: level.delivered, dug: level.dug, lostAnts: level.lostAnts, lostBrood: level.lostBrood, mound: level.moundCells }),
    score: game.score, particles: game.parts.length, camera: fixed([game.camX, game.camY]), clock: game.clock, frame: game.frame,
  };
};
