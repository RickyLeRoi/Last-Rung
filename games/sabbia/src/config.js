// games/sabbia/src/config.js
'use strict';
// Units: cells of 2 x 2 px, frames (60 frames = 1 second), temperatures in degrees. The world is a grid of cells between the HUD bars:
// every cell holds a material and a temperature; outside the grid there are walls and a floor, the top is open to the sky.
const CONFIG = {
  W: 384, H: 216,
  input: { deadzone: 0.18, stickRadius: 46 },
  maxParticles: 0,
  touchGutter: 84,
  grid: { columns: 192, rows: 96, cell: 2, top: 12 },
  cursor: { speed: 1.4 },                       // cells per frame
  brush: { sizes: [0, 1, 2], start: 1 },          // radius in cells
  heat: {
    ambient: 20,
    exchange: 0.5,                              // share of the difference two touching cells exchange per pass (times the conductivity)
    passes: 2,                                  // heat exchange passes per frame (heat travels faster through iron)
    flow: 4,                                    // cells a liquid may run sideways in one frame
    airRelax: 0.03,                             // empty air drifts back to the ambient temperature
    fire: 700,                                  // a burning cell stays this hot
    escape: 0.03,                               // a light gas on the top row leaves the world (open sky)
  },
  // kind: empty | static (never moves) | powder (falls and piles) | liquid (falls and spreads) | gas (rises if lighter than air, sinks if heavier)
  // density: air is 1; conduct: heat conductivity 0..1; acid: chance per frame that acid eats this material;
  // ignite: temperature at which it catches fire; catch: chance per frame that a touching flame lights it; burn: frames it burns;
  // capacity: heat needed per degree (1 when missing): wood and water warm up slowly, iron quickly
  materials: {
    empty:   { name: 'ARIA', kind: 'empty', density: 1, conduct: 0.02 },
    iron:    { name: 'FERRO', kind: 'static', conduct: 0.45, acid: 0.0008 },
    wood:    { name: 'LEGNO', kind: 'static', conduct: 0.04, acid: 0.05, ignite: 260, catch: 0.02, burn: [200, 320], capacity: 6 },
    grass:   { name: 'ERBA', kind: 'static', conduct: 0.08, acid: 0.12, ignite: 140, catch: 0.4, burn: [25, 45] },
    sand:    { name: 'SABBIA', kind: 'powder', density: 20, conduct: 0.06, acid: 0.02, capacity: 2 },
    fire:    { name: 'FUOCO', kind: 'gas', density: 0.3, conduct: 0.3, life: [90, 160], rise: 0.6, smoke: 0.08, flameChance: 0.15, flame: [8, 20] },
    water:   { name: 'ACQUA', kind: 'liquid', density: 10, conduct: 0.15, boil: 100, capacity: 3 },
    steam:   { name: 'VAPORE', kind: 'gas', density: 0.4, conduct: 0.05, start: 110, condense: 90, condenseChance: 0.01 },
    acid:    { name: 'ACIDO', kind: 'liquid', density: 11, conduct: 0.15, spent: 0.5, dilute: 0.005, capacity: 3 },
    hotAir:  { name: 'ARIA CALDA', kind: 'gas', density: 0.2, conduct: 0.05, start: 260, fade: 60 },
    coldAir: { name: 'ARIA FREDDA', kind: 'gas', density: 1.6, conduct: 0.05, start: -80, fade: 0 },
  },
  palette: ['sand', 'water', 'fire', 'wood', 'grass', 'iron', 'acid', 'steam', 'hotAir', 'coldAir'],   // laboratory order, then the eraser
  challenge: { budgetPerLoop: 0.85, timePerLoop: 0.85, threeStars: 0.5, twoStars: 0.2 },
  score: { win: 100, perBudgetLeft: 1, starBonus: [0, 0, 100, 250] },
};
