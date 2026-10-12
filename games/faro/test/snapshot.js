// games/faro/test/snapshot.js
'use strict';
// Simulation state used by the harness stateHash(): everything that must be identical for two runs to count as the same game.
module.exports = (hook, encodeStable) => {
  const game = hook.game, level = game.L, noObjects = new Map();
  const fixed = value => encodeStable(value, noObjects);
  return {
    ships: level.ships.map(ship => fixed({ state: ship.state, x: ship.x, laneF: ship.laneF, lane: ship.lane, lit: ship.lit, stateT: ship.stateT })),
    rocks: level.rocks.map(rock => ({ x: rock.x, lane: rock.lane, seen: rock.seen })),
    beam: fixed({ pitch: game.beam.pitch, spread: game.beam.spread, on: game.beam.on }),
    oil: fixed(game.oil), sirenT: game.sirenT, sirenCool: game.sirenCool, lampFlashT: game.lampFlashT,
    docked: level.docked, sunk: level.sunk, score: game.score, particles: game.parts.length,
    wind: fixed(game.wind), clock: game.clock, frame: game.frame,
  };
};
