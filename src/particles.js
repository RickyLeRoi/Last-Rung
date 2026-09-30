'use strict';
function addParticle(particle) {
  if (game.parts.length < CONFIG.maxParticles) game.parts.push(particle);
}

function updateParticles() {
  const particles = game.parts;
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];
    particle.life--;
    switch (particle.t) {
      case 'px':
        particle.vy += particle.g || 0;
        particle.x += particle.vx + game.wind * (particle.wf || 0);
        particle.y += particle.vy;
        if (particle.drop && particle.vy > 0 && particle.y > waterSurfaceY(particle.x)) particle.life = 0;
        if (particle.wt) {   // bucket water: douses flames, vanishes on solids and in water
          if (douse(particle) || particle.y > waterSurfaceY(particle.x) || game.L.solids.some(solid => particle.x >= solid.x && particle.x < solid.x + solid.w && particle.y >= solid.y && particle.y < solid.y + (solid.h || 1))) particle.life = 0;
          break;
        }
        if (particle.bl) {
          if (particle.y > waterSurfaceY(particle.x)) { particle.life = 0; break; }
          for (const solid of game.L.solids) {
            if (particle.x >= solid.x && particle.x < solid.x + solid.w && particle.y >= solid.y && particle.y < solid.y + (solid.h || 1)) { stainSolid(solid, particle.x, particle.y); particle.life = 0; break; }
          }
        } else if (!particle.drop) washParticle(particle, 0.25);
        break;
      case 'bub':
        particle.y -= 0.45;
        particle.x += Math.sin((particle.life + particle.x) * 0.3) * 0.25;
        if (particle.y < waterSurfaceY(particle.x) + 1) particle.life = 0;
        break;
      case 'smoke':
        particle.y -= 0.28; particle.x += 0.08 + game.wind * 0.35 + (particle.vx || 0); particle.r += 0.07;
        washParticle(particle, 0.5);
        break;
      case 'ring':
        particle.r += 1.6;
        break;
      case 'chunk':
        updateChunk(particle);
        break;
    }
    if (particle.life <= 0 || particle.y > CONFIG.H + 30) particles.splice(i, 1);
  }
}

function washParticle(particle, strength) {
  const heli = game.heli;
  if (!heli || heli.state !== 'fly' || heli.engineOff) return;
  const deltaX = particle.x - (heli.x + 16), below = particle.y - heli.y;
  if (Math.abs(deltaX) < 34 && below > -4 && below < 50) {
    const push = strength * (1 - below / 50) * downwashShape(Math.abs(deltaX));
    particle.x += Math.sign(deltaX) * push;
    particle.y += push * 0.5;
  }
}

// Moved in sub-steps of at most 1 px so debris cannot tunnel through thin hazards.
function updateChunk(chunk) {
  const centerX = chunk.x + chunk.w / 2;
  const inWater = chunk.y + chunk.h / 2 > waterSurfaceY(centerX);
  if (inWater) {
    if (!chunk.wet) { chunk.wet = true; splash(centerX, Math.min(3, Math.abs(chunk.vy) + 0.8)); }
    chunk.vx *= 0.9;
    chunk.vy = Math.min(0.5, chunk.vy * 0.9 + 0.02);
  } else {
    chunk.vy += CONFIG.phys.personGravity;
    chunk.vx *= 0.995;
  }
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(chunk.vx), Math.abs(chunk.vy))));
  for (let i = 0; i < steps; i++) {
    let nextX = chunk.x + chunk.vx / steps, nextY = chunk.y + chunk.vy / steps, hit = false;
    for (const solid of game.L.solids) {
      if (!(nextX < solid.x + solid.w && nextX + chunk.w > solid.x && nextY < solid.y + solid.h && nextY + chunk.h > solid.y)) continue;
      if (chunk.y + chunk.h <= solid.y + 1) {
        nextY = solid.y - chunk.h; chunk.vy *= -0.3; chunk.vx *= 0.6;
        if (Math.abs(chunk.vy) < 0.35) chunk.vy = 0;
      } else {
        nextX = chunk.x; chunk.vx *= -0.4;
      }
      hit = true;
    }
    chunk.x = nextX; chunk.y = nextY;
    if (hit) break;
  }
  chunk.lethal = Math.hypot(chunk.vx, chunk.vy) > 0.45;
  if (chunk.fire && chunk.life > 380 && chance(0.25)) {
    addParticle(chance(0.3)
      ? { t: 'smoke', x: chunk.x + 2, y: chunk.y, r: 1, life: 30 }
      : { t: 'px', x: chunk.x + 2, y: chunk.y, vx: randomRange(-0.2, 0.2), vy: -randomRange(0.2, 0.6), g: 0, life: 20 });
  }
  if (inWater && chance(0.03)) addParticle({ t: 'bub', x: chunk.x + 1, y: chunk.y, life: 100 });
}
