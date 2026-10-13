// games/formicaio/src/config.js
'use strict';
// Units: pixels and frames (60 frames = 1 second). The world is a vertical section of a meadow: sky and grass above groundY,
// soil below. Ants live on a coarse grid of `cell` px: a cell is free when the terrain pixel at its centre is empty.
const CONFIG = {
  W: 384, H: 216,
  input: { deadzone: 0.18, stickRadius: 46 },
  maxParticles: 600,
  touchGutter: 84,
  world: { width: 768, tutorialWidth: 512, height: 324, groundY: 108, bumps: [[2, 0.031], [1, 0.09]] },
  cell: 4,
  material: { soil: 1, sand: 2, stone: 3, root: 4, water: 5 },
  soil: {
    stones: 12, stoneMinRadius: 3, stoneRadiusRange: 5, stoneDepth: 14,
    roots: 5, rootLength: [30, 70],
    sandPockets: 2, droughtSandPockets: 7, sandRadius: [6, 11],
    nestClearance: 34,                         // px around the nest kept free of stones, roots and sand
  },
  nest: { entranceX: 162, tutorialEntranceX: 110, queenDepth: 30, queenRadius: 7, shaftRadius: 2 },   // entrances on a cell centre
  cursor: { speed: 2.2, startDepth: 16 },
  trail: {
    decay: 1 / 1800, droughtDecay: 1 / 900,   // pheromone lost per frame on the surface (1 = fresh)
    known: 0.2,                               // food within knownRange cells of a trail at least this fresh is known to the foragers
    knownRange: 3,
    reinforce: 1,                             // a forager carrying food refreshes the trail under it
  },
  dig: { frames: 22, radius: 2.6 },
  chamber: { radius: 10, max: 6, complete: 0.8, nurseryCap: 8, pantryCap: 30, queenCap: 3, baseStock: 12 },
  ants: {
    start: 4, max: 80,
    stepFrames: 4, carryStepFrames: 5, heavyStepFrames: 8,    // frames per cell
    diggerShare: 0.5, foragerShare: 0.6, pluggers: 3, minCrew: 2,
    rethink: 60, fieldEvery: 10, drown: 120,
  },
  brood: { layEvery: 240, egg: 360, larva: 600, pupa: 360, tutorialSpeed: 3 },
  food: { seed: 3, crumb: 5, insect: 12, firstCount: 3, droughtFirstCount: 2, every: 900, droughtEvery: 1100, minDistance: 40, nearDistance: 220 },
  season: { frames: 14400, perLoop: 600, min: 10800 },
  target: { base: 14, perLoop: 2, max: 40, tutorial: 8, threeStars: 1.5 },
  spider: { speed: 0.3, perLoop: 0.05, catchRadius: 6, group: 4, groupRange: 14, scared: 240, eatEvery: 1800, margin: 16 },   // eatEvery: full after a catch
  rain: { warning: 360, duration: 900, gap: 2100, gapPerLoop: 150, minGap: 1200, firstAt: 3000, dropEvery: 16, absorb: 0.004, queenDrown: 90 },
  score: { worker: 10, food: 1, starBonus: [0, 0, 100, 250] },
  // backdrop above the meadow (world px): tops between groundY - lowest - amplitude and groundY - lowest
  backdrop: {
    hills: { period: 768, step: 96, lowest: 22, amplitude: 34, roughness: 0.25 },
    bushes: { period: 512, step: 32, lowest: 0, amplitude: 14, roughness: 0.5 },
  },
};
