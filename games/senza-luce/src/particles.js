// games/senza-luce/src/particles.js
'use strict';
const addParticle = particle => Particles.add(game.parts, particle, CONFIG.maxParticles);

const PARTICLE_HOOKS = { splash: (x, strength) => splash(x, strength) };

function updateParticles() {
  Particles.update(game.parts, { wind: game.wind, gravity: 0.1, screenHeight: CONFIG.H, max: CONFIG.maxParticles, waterY: waterSurfaceY, solids: [], hooks: PARTICLE_HOOKS });
}
