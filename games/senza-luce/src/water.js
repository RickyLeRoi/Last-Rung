// games/senza-luce/src/water.js
'use strict';
const makeWater = Water.make;
const waterSurfaceY = x => Water.surfaceY(game.L && game.L.water, x, game.time);
const pushWater = (x, amount, radius) => Water.push(game.L.water, x, amount, radius);
const updateWater = () => Water.update(game.L.water);

const laneOffset = laneF => interpolateTable(CONFIG.sea.laneOffsets, laneF);
const laneWaterlineY = (x, laneF) => waterSurfaceY(x) + laneOffset(laneF);

function splash(x, strength) {
  const surfaceY = waterSurfaceY(x);
  if (surfaceY === Infinity) return;
  pushWater(x, strength * 0.9, 3);
  if (strength > 1.5) Sfx.play('splash');
  const dropCount = Math.min(24, Math.floor(strength * 5));
  for (let i = 0; i < dropCount; i++) {
    addParticle({ t: 'px', x: x + randomRange(-4, 4), y: surfaceY - 1, vx: randomRange(-1.2, 1.2), vy: -randomRange(0.5, 1.5) * Math.min(2.2, strength * 0.6 + 0.4), g: 0.1, life: 60, drop: true });
  }
}
