// games/senza-luce/src/env.js
'use strict';
function initRain() {
  game.rain = Weather.initRain(Math.floor(game.L.rain * 170), CONFIG.W, CONFIG.H);
}

// Wind, fog banks, rain and lightning, in this order (the order of Rng calls is part of the replay contract).
function updateEnv() {
  const level = game.L;
  game.wind = Weather.wind(level.wind, game.time);
  for (const bank of level.fogBanks) {
    bank.x += bank.speed + game.wind * 0.05;
    if (bank.x > level.worldW) bank.x -= level.worldW + bank.w;
  }
  Weather.updateRain(game.rain, {
    wind: game.wind, camX: game.camX, width: CONFIG.W, height: CONFIG.H, waterY: waterSurfaceY,
    onHitWater: (x, waterY) => addParticle({ t: 'px', x, y: waterY - 1, vx: randomRange(-0.4, 0.4), vy: -randomRange(0.3, 0.8), g: 0.08, life: 10 }),
  });
  if (level.lightning) {
    Weather.tickLightning(game, {
      camX: game.camX, width: CONFIG.W, height: CONFIG.H, waterY: waterSurfaceY,
      onStrike: bolt => { splash(bolt.end[0], 3); Sfx.play('thunder'); revealByLightning(); },
    });
  }
}
