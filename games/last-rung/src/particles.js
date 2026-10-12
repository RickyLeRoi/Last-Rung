'use strict';
const addParticle = particle => Particles.add(game.parts, particle, CONFIG.maxParticles);

function pixelHook(particle) {
  if (particle.wt) {   // bucket water: douses flames, vanishes on solids and in water
    if (douse(particle) || particle.y > waterSurfaceY(particle.x) || game.L.solids.some(solid => particle.x >= solid.x && particle.x < solid.x + solid.w && particle.y >= solid.y && particle.y < solid.y + (solid.h || 1))) particle.life = 0;
    return true;
  }
  if (particle.bl) {
    if (particle.y > waterSurfaceY(particle.x)) { particle.life = 0; return true; }
    for (const solid of game.L.solids) {
      if (particle.x >= solid.x && particle.x < solid.x + solid.w && particle.y >= solid.y && particle.y < solid.y + (solid.h || 1)) { stainSolid(solid, particle.x, particle.y); particle.life = 0; break; }
    }
    return true;
  }
  return false;
}

function chunkTrailHook(chunk) {
  if (chunk.fire && chunk.life > 380 && chance(0.25)) {
    addParticle(chance(0.3)
      ? { t: 'smoke', x: chunk.x + 2, y: chunk.y, r: 1, life: 30 }
      : { t: 'px', x: chunk.x + 2, y: chunk.y, vx: randomRange(-0.2, 0.2), vy: -randomRange(0.2, 0.6), g: 0, life: 20 });
  }
}

const PARTICLE_HOOKS = { pixel: pixelHook, push: washParticle, chunkTrail: chunkTrailHook, splash: (x, strength) => splash(x, strength) };

function updateParticles() {
  Particles.update(game.parts, { wind: game.wind, gravity: CONFIG.phys.personGravity, screenHeight: CONFIG.H, max: CONFIG.maxParticles, waterY: waterSurfaceY, solids: game.L.solids, hooks: PARTICLE_HOOKS });
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
