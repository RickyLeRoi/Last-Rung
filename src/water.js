'use strict';
function makeWater(base, amplitudes, angularSpeeds, ranges, worldWidth, waveNumbers) {
  const springCount = Math.ceil(worldWidth / 3) + 2;   // one spring every 3 px
  return {
    base, A: amplitudes, W: angularSpeeds, K: waveNumbers || [0.021, 0.053, 0.11], ranges, n: springCount,
    h: new Float32Array(springCount), v: new Float32Array(springCount), lD: new Float32Array(springCount), rD: new Float32Array(springCount),
  };
}

// Infinity where there is no water.
function waterSurfaceY(x) {
  const water = game.L && game.L.water;
  if (!water) return Infinity;
  if (water.ranges && !water.ranges.some(range => x >= range[0] && x <= range[1])) return Infinity;
  const time = game.time;
  let y = water.base
    + water.A[0] * Math.sin(x * water.K[0] + time * water.W[0])
    + water.A[1] * Math.sin(x * water.K[1] - time * water.W[1])
    + water.A[2] * Math.sin(x * water.K[2] + time * water.W[2]);
  const springPosition = x / 3, i = Math.floor(springPosition);
  if (i >= 0 && i < water.n - 1) { const fraction = springPosition - i; y += water.h[i] * (1 - fraction) + water.h[i + 1] * fraction; }
  return y;
}

function pushWater(x, amount, radius) {
  const water = game.L.water;
  if (!water) return;
  const centerIndex = round(x / 3);
  radius = radius || 3;
  for (let i = centerIndex - radius; i <= centerIndex + radius; i++) {
    if (i < 0 || i >= water.n) continue;
    water.v[i] += amount * (1 - Math.abs(i - centerIndex) / (radius + 1));
  }
}

function updateWater() {
  const water = game.L.water;
  if (!water) return;
  const { n: springCount, h: heights, v: velocities, lD: leftDeltas, rD: rightDeltas } = water;
  for (let i = 0; i < springCount; i++) {
    velocities[i] += -0.025 * heights[i] - 0.03 * velocities[i];
    heights[i] = clamp(heights[i] + velocities[i], -18, 18);
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 0; i < springCount; i++) {
      if (i > 0) { leftDeltas[i] = 0.2 * (heights[i] - heights[i - 1]); velocities[i - 1] += leftDeltas[i]; }
      if (i < springCount - 1) { rightDeltas[i] = 0.2 * (heights[i] - heights[i + 1]); velocities[i + 1] += rightDeltas[i]; }
    }
    for (let i = 0; i < springCount; i++) {
      if (i > 0) heights[i - 1] += leftDeltas[i];
      if (i < springCount - 1) heights[i + 1] += rightDeltas[i];
    }
  }
}

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
