// games/valanga/src/config.js
'use strict';
// Units: pixels and frames (60 frames = 1 second); 10 px = 1 metre on the ARTVA display. The slope scrolls both ways: it goes down
// from the top left (where the rescuer starts) to the bottom right; the avalanche deposit lies in the middle.
const CONFIG = {
  W: 384, H: 216,
  input: { deadzone: 0.18, stickRadius: 46 },
  maxParticles: 800,
  touchGutter: 84,
  world: { width: 1152, wideWidth: 1536, tutorialWidth: 640, height: 432 },
  material: { snow: 1, rock: 2 },
  slope: { top: 110, bottomMargin: 70, bumps: [[14, 0.013], [7, 0.037], [3, 0.09]] },
  snow: { base: 5, depositStart: 230, depositEndGap: 110, depositDepth: 20, lumps: [[8, 0.05], [5, 0.11]], taper: 70 },
  boulders: { count: 2, perLoop: 1, max: 5, minRadius: 6, radiusRange: 4, clearance: 26 },
  rescuer: {
    w: 5, h: 10, startX: 40,
    walk: 1.0, accel: 0.25, slopeBoost: 0.5, minFactor: 0.45, maxFactor: 1.6,   // speed factor from the slope ahead (downhill = faster)
    gravity: 0.2, maxFall: 4, stepUp: 2, snapDown: 3, climb: 0.5,
  },
  dig: { every: 6, radius: 4, reach: 6, downReach: 3 },
  probe: { frames: 40, resultAt: 20, depth: 60, width: 16, maxMarks: 12 },
  victim: { w: 8, h: 4, depthMin: 8, depthRange: 12, depthPerLoop: 3, spacing: 90, crush: 14, crushDecay: 0.5, collapseSound: 20, survival: 5400, survivalPerLoop: 500, minSurvival: 3600, max: 5 },
  artva: { range: 90, slowBeep: 44, fastBeep: 6, digits: 25, near: 0.66, mid: 0.33 },
  avalanche: { warning: 150, speed: 2.2, back: 130, ahead: 110, thickness: 5, hitDistance: 5, stun: 120, firstAt: 1500, gap: 1800, gapPerLoop: 200, minGap: 1000, deadlyFromLoop: 2 },
  weather: { stormSnow: 160, nightSnow: 40, stormWind: 1.2, push: 0.03, fall: 0.6, fallSpread: 0.4, drift: 0.2 },
  night: { lamp: 24, coneLength: 90, coneHalf: 0.35, conePitch: 0.45 },
  score: { saved: 100, perSecond: 5, starBonus: [0, 0, 100, 250], twoStars: 0.75 },
};
