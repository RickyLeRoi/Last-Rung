// games/abisso/src/config.js
'use strict';
// Units: pixels and frames (60 frames = 1 second); 10 px = 1 metre of depth. The world is a vertical section of the sea: the support ship
// floats on the surface at the top left, the cave or the wreck goes down below it. Walls and floors are a terrain mask.
const CONFIG = {
  W: 384, H: 216,
  input: { deadzone: 0.18, stickRadius: 46 },
  maxParticles: 500,
  touchGutter: 84,
  world: { width: 768, height: 720, deepHeight: 864, tutorialWidth: 480, tutorialHeight: 360, surface: 40 },
  material: { rock: 1, hull: 2, silt: 3 },
  ship: { x: 60, width: 72, unloadDepth: 18 },   // unloading: within the ship's span and this close under the surface
  sub: {
    w: 14, h: 8, startX: 96, startY: 56,
    thrust: 0.045, drag: 0.965, maxSpeed: 1.5,  // px per frame per frame, share of speed kept per frame, px per frame
    rise: 0.012,                                 // drift up when the battery is flat (positive buoyancy of the empty tanks)
    damageSpeed: 0.9, damagePerSpeed: 22,        // impacts above this speed hurt the hull: (speed - threshold) * damagePerSpeed
    bounce: 0.25, seats: 2, boardRadius: 16, boardSpeed: 0.8,
  },
  battery: { max: 100, thrust: 0.006, lamp: 0.003, sonar: 6, perLoop: 8, min: 70 },
  lamp: { length: 110, half: 0.32, halo: 22 },
  sonar: { cooldown: 180, speed: 4, range: 200, band: 8, show: 40 },   // the ring grows `speed` px per frame up to `range`
  // air (frames): base + per px of depth (the deeper ones have more margin), +-spread at random, times loopFactor per loop
  diver: { airBase: 2400, airPerDepth: 6, airSpread: 0.2, airLoopFactor: 0.92, light: 12, base: 3, perLoop: 1, max: 6 },
  silt: { radius: 26, life: 300, max: 6, speed: 0.5 },   // a cloud rises from the floor when the sub touches silt faster than `speed`
  current: { strength: 0.012, strongStrength: 0.03 },
  cell: 4,                                        // the memory of the lit walls is kept on cells of this size
  score: { saved: 100, starBonus: [0, 0, 100, 250], twoStars: 0.75, threeStarsHull: 0.5 },
};
