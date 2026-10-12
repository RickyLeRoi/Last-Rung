// engine/world/particles.js
'use strict';
/*
 * Particle list shared by effects and debris. Types: px (pixel), bub (bubble), smoke, ring, chunk (physical debris).
 * world = { wind, gravity, screenHeight, waterY(x), solids, hooks }, hooks (all optional):
 *   pixel(particle)      -> true when the game fully handled a px particle (bucket water, blood)
 *   push(particle, k)    -> external push (rotor downwash)
 *   chunkTrail(chunk)    -> burning-debris trail
 *   splash(x, strength)  -> debris entering the water
 *   solidAt(x, y, w, h)  -> true when the rectangle touches the game's own terrain (debris lands on it like on solids)
 * The order of Rng calls is part of the replay contract: do not reorder them.
 */
const Particles = (() => {
  function add(list, particle, max) {
    if (list.length < max) list.push(particle);
  }

  function update(list, world) {
    const hooks = world.hooks || {};
    for (let i = list.length - 1; i >= 0; i--) {
      const particle = list[i];
      particle.life--;
      switch (particle.t) {
        case 'px':
          particle.vy += particle.g || 0;
          particle.x += particle.vx + world.wind * (particle.wf || 0);
          particle.y += particle.vy;
          if (particle.drop && particle.vy > 0 && particle.y > world.waterY(particle.x)) particle.life = 0;
          if (hooks.pixel && hooks.pixel(particle)) break;
          if (!particle.drop && hooks.push) hooks.push(particle, 0.25);
          break;
        case 'bub':
          particle.y -= 0.45;
          particle.x += Math.sin((particle.life + particle.x) * 0.3) * 0.25;
          if (particle.y < world.waterY(particle.x) + 1) particle.life = 0;
          break;
        case 'smoke':
          particle.y -= 0.28; particle.x += 0.08 + world.wind * 0.35 + (particle.vx || 0); particle.r += 0.07;
          if (hooks.push) hooks.push(particle, 0.5);
          break;
        case 'ring':
          particle.r += 1.6;
          break;
        case 'chunk':
          updateChunk(particle, list, world);
          break;
      }
      if (particle.life <= 0 || particle.y > world.screenHeight + 30) list.splice(i, 1);
    }
  }

  // Moved in sub-steps of at most 1 px so debris cannot tunnel through thin hazards.
  function updateChunk(chunk, list, world) {
    const hooks = world.hooks || {};
    const centerX = chunk.x + chunk.w / 2;
    const inWater = chunk.y + chunk.h / 2 > world.waterY(centerX);
    if (inWater) {
      if (!chunk.wet) { chunk.wet = true; if (hooks.splash) hooks.splash(centerX, Math.min(3, Math.abs(chunk.vy) + 0.8)); }
      chunk.vx *= 0.9;
      chunk.vy = Math.min(0.5, chunk.vy * 0.9 + 0.02);
    } else {
      chunk.vy += world.gravity;
      chunk.vx *= 0.995;
    }
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(chunk.vx), Math.abs(chunk.vy))));
    for (let i = 0; i < steps; i++) {
      let nextX = chunk.x + chunk.vx / steps, nextY = chunk.y + chunk.vy / steps, hit = false;
      for (const solid of world.solids) {
        if (!(nextX < solid.x + solid.w && nextX + chunk.w > solid.x && nextY < solid.y + solid.h && nextY + chunk.h > solid.y)) continue;
        if (chunk.y + chunk.h <= solid.y + 1) {
          nextY = solid.y - chunk.h; chunk.vy *= -0.3; chunk.vx *= 0.6;
          if (Math.abs(chunk.vy) < 0.35) chunk.vy = 0;
        } else {
          nextX = chunk.x; chunk.vx *= -0.4;
        }
        hit = true;
      }
      // 20261012 ++ RG #terrain_debris
      if (hooks.solidAt && hooks.solidAt(nextX, nextY, chunk.w, chunk.h)) {
        if (hooks.solidAt(chunk.x, nextY, chunk.w, chunk.h)) {
          nextY = chunk.y; chunk.vy *= -0.3; chunk.vx *= 0.6;
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
    if (hooks.chunkTrail) hooks.chunkTrail(chunk);
    if (inWater && chance(0.03)) add(list, { t: 'bub', x: chunk.x + 1, y: chunk.y, life: 100 }, world.max);
  }

  return { add, update };
})();
