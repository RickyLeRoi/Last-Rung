// games/senza-luce/test/snapshot.js
'use strict';
// Simulation state used by the harness stateHash(): everything that must be identical for two runs to count as the same game.
module.exports = (hook, encodeStable) => {
  const game = hook.game, level = game.L, noObjects = new Map();
  const fixed = value => encodeStable(value, noObjects);
  const boat = game.boat;
  return {
    boat: fixed({ x: boat.x, vx: boat.vx, throttle: boat.throttle, lane: boat.lane, laneF: boat.laneF, engineOn: boat.engineOn, smokes: boat.smokes, noiseT: boat.noiseT }),
    patrols: level.patrols.map(patrol => fixed({ x: patrol.x, dir: patrol.dir, laneF: patrol.laneF, mode: patrol.mode, modeT: patrol.modeT, targetX: patrol.targetX })),
    crates: level.crates.map(crate => crate.taken),
    smokes: game.smokes.map(smoke => fixed(smoke)),
    fogBanks: level.fogBanks.map(bank => fixed(bank.x)),
    alert: fixed(game.alert), alarmT: game.alarmT, alarms: game.alarms, lastSeen: fixed(game.lastSeen),
    arrived: level.arrived, score: game.score, particles: game.parts.length,
    camX: fixed(game.camX), wind: fixed(game.wind), clock: game.clock, frame: game.frame,
  };
};
