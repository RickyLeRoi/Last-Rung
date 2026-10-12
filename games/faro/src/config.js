// games/faro/src/config.js
'use strict';
// Units: pixels and frames (60 frames = 1 second). The whole sea fits one screen: there is no scrolling.
const CONFIG = {
  W: 384, H: 216, WORLD_W: 384,
  input: { deadzone: 0.18, stickRadius: 46 },
  maxParticles: 700,
  touchGutter: 84,
  lamp: { x: 31, y: 74 },
  // Ships sail on one of three lanes; a lane is a vertical offset from the water surface (pseudo depth).
  sea: { base: 128, laneOffsets: [8, 22, 36] },
  port: { dockX: 88, lightX: 82, lightY: 134, lightRadius: 34 },
  beam: {
    start: { pitch: 0.42, spread: 0.45 },    // pitch: radians below the horizontal; spread 0 = narrow and long, 1 = wide and short
    pitchMin: 0.12, pitchMax: 1.0, pitchSpeed: 0.011, spreadSpeed: 0.012,
    halfMin: 0.05, halfMax: 0.17,            // half opening angle (rad)
    lenLong: 340, lenShort: 120,              // reach (px)
    fogFactor: 0.8,
    minHalfWidth: 7,                          // px: the beam never gets thinner than this, even next to the lamp
    followWidth: 22,                          // px: a ship this close to the beam centre line follows it, lit or not
    laneHysteresis: 3,                        // px: how much closer to another lane the beam centre must be before a ship changes lane
  },
  oil: { max: 100, beam: 0.03, narrowExtra: 0.02, flash: 18, recharge: 0.14, trickle: 0.02, restart: 15 },
  flash: { frames: 14 },
  siren: { frames: 150, cooldown: 360, slow: 0.35 },
  ship: { speedMin: 0.22, speedMax: 0.32, laneSpeed: 0.045, hitDistance: 12, spawnX: 400, wakeChance: 0.12 },
  rocks: { firstX: 130, lastX: 290, fogLastX: 230, fogMax: 3, max: 5 },
  waves: { first: 60, gap: 170, between: 460, size: 2, maxShips: 6 },    // frames of play time
  night: { halo: 16, lantern: 4, tower: { y: 116, radius: 40 } },
  score: { dock: 100, starBonus: [0, 0, 100, 250], twoStars: 0.75 },
};
