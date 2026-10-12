// games/last-rung/test/snapshot.js
'use strict';
// Simulation state used by the harness stateHash(): everything that must be identical for two runs to count as the same game.
module.exports = (hook, encodeStable) => {
  const game = hook.game, level = game.L, knownObjects = new Map();
  level.solids.forEach((solid, i) => knownObjects.set(solid, 'solid:' + i));
  level.people.forEach((person, i) => knownObjects.set(person, 'person:' + i));
  level.fires.forEach((fire, i) => knownObjects.set(fire, 'fire:' + i));
  const personFields = ['state', 'x', 'y', 'vx', 'vy', 'kind', 'injured', 't'];
  const snapshot = {
    heli: encodeStable(game.heli, knownObjects),
    people: level.people.map(person => encodeStable(Object.fromEntries(personFields.map(field => [field, person[field]])), knownObjects)),
    saved: level.saved, dead: level.dead, total: level.total, killedByPlayer: level.killedByPlayer,
    score: game.score, particles: game.parts.length, wind: encodeStable(game.wind, knownObjects), camX: encodeStable(game.camX, knownObjects),
    fires: level.fires.map(fire => encodeStable({ hp: fire.hp, press: fire.press }, knownObjects)),
    frame: game.frame,
  };
  return snapshot;
};
