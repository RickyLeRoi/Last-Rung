// games/abisso/src/env.js
'use strict';
// The surface waves, bubbles from the thrusters, silt clouds, debris and the camera.

const addParticle = particle => Particles.add(game.parts, particle, CONFIG.maxParticles);

const PARTICLE_HOOKS = {
  solidAt: (x, y, width, height) => Terrain.hitsRect(game.L.terrain, x, y, width, height),
};

function updateEnv() {
  const level = game.L, sub = game.sub;
  Water.update(level.water);
  if (sub.thrust > 0 && game.frame % 4 === 0) addParticle({ t: 'bub', x: sub.face > 0 ? sub.x : sub.x + sub.w, y: subCenterY() + randomRange(-2, 2), life: 140 });
  if (subCenterY() < CONFIG.world.surface + 6 && Math.abs(sub.vx) > 0.4 && game.frame % 6 === 0) Water.push(level.water, subCenterX(), -0.6, 2);
  for (const cloud of game.silt) { cloud.life--; if (cloud.r < CONFIG.silt.radius) cloud.r += 0.5; }
  game.silt = game.silt.filter(cloud => cloud.life > 0);
  Particles.update(game.parts, { wind: 0, gravity: 0.05, screenHeight: level.height, max: CONFIG.maxParticles, waterY: x => surfaceAtX(x), solids: [], hooks: PARTICLE_HOOKS });
  game.shake = Camera.decayShake(game.shake);
}

function updateCamera() {
  const level = game.L;
  game.camX = Camera.follow(game.camX, subCenterX() - CONFIG.W / 2 + game.sub.face * 30, level.width, CONFIG.W, 0.1);
  game.camY = Camera.follow(game.camY, subCenterY() - CONFIG.H / 2, level.height, CONFIG.H, 0.12);
}
