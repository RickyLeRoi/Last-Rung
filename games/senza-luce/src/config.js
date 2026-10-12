// games/senza-luce/src/config.js
'use strict';
// Units: pixels and frames (60 frames = 1 second). The bay scrolls horizontally: the cove is at x = 0, the open sea on the right.
const CONFIG = {
  W: 384, H: 216,
  input: { deadzone: 0.18, stickRadius: 46 },
  maxParticles: 700,
  touchGutter: 84,
  // Boats sail on one of three lanes; a lane is a vertical offset from the water surface (pseudo depth), as in Il Faro.
  sea: { base: 128, laneOffsets: [8, 22, 36] },
  world: { screens: 3, maxScreens: 4, tutorialScreens: 2 },
  cove: { x: 44, lightX: 22, lightRadius: 18 },   // the boat is safe once its bow passes cove.x
  boat: {
    startOffset: 70,             // px from the right edge of the world
    accel: 0.03, maxSpeed: 0.8, drag: 0.97,
    throttleRamp: 0.05,          // the engine reaches full throttle in 20 frames
    quietFactor: 0.45,           // Shift (keyboard) = slow and quiet
    laneSpeed: 0.05,
    current: 0.12, windDrift: 0.05, driftResponse: 0.02,   // engine off: the current carries the boat back to the open sea
    sightHeight: 3,              // the point watchers look at, above the waterline
    wakeChance: 0.15,
  },
  noise: { throttle: 0.6, every: 45, radius: 80, rainFactor: 0.5, restartRadius: 60 },
  alert: { rise: 1.0, nearBonus: 1.0, fall: 0.35, max: 100, alarmFrames: 300, afterAlarm: 50, seenSound: 12 },
  catch: { distance: 14, lanes: 0.6 },
  // Rotating lighthouses: the beam lights one side of the tower, then turns toward the viewer (dark), then lights the other side.
  // Towers stand `spacing` apart, more than twice the reach of a beam on the water, so two beams never light the same stretch of sea.
  tower: { lampHeight: 54, pitch: 0.25, half: 0.11, length: 200, minFacing: 0.35, period: 480, periodPerLoop: 30, minPeriod: 330, halo: 9, firstX: 230, lastGap: 260, spacing: 420, jitter: 20 },
  patrol: { speed: 0.35, suspectSpeed: 0.45, chaseSpeed: 0.7, laneSpeed: 0.03, suspectFrames: 240, lightHeight: 7, pitch: 0.05, half: 0.13, length: 105, segment: 230, minX: 90, startClear: 330, max: 4, lantern: 4 },
  smoke: { count: 2, startRadius: 6, maxRadius: 26, growFrames: 60, frames: 420 },
  crates: { count: 3, pickDistance: 9, firstX: 140, lastGap: 200 },
  moon: { factor: 1.3 },                           // full moon: patrol searchlights reach farther
  storm: { sight: 150, alert: 45 },
  fog: { seeDistance: 44, lengthFactor: 0.8, banks: 4 },
  dawn: { framesPerPixel: 6, warning: 0.85 },
  score: { crate: 100, arrive: 200, starBonus: [0, 0, 100, 250] },
};
