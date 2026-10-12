'use strict';
// Flames squashed by the rotor get lower and wider (clamped to the rooftop edges).
function fireRect(fire) {
  const fireWash = CONFIG.fireWash, press = fire.press || 0, spread = fireWash.spread * press;
  const flameHeight = fire.h * (1 - fireWash.flatten * press) * 0.8 * (0.3 + 0.7 * (fire.hp === undefined ? 1 : Math.max(0, fire.hp)));
  const minX = Math.max(fire.bx0 === undefined ? -1e9 : fire.bx0, fire.x - spread);
  const maxX = Math.min(fire.bx1 === undefined ? 1e9 : fire.bx1, fire.x + fire.w + spread);
  return { x: minX, y: fire.y - flameHeight, w: maxX - minX, h: flameHeight };
}

function initRain() {
  game.rain = Weather.initRain(Math.floor(game.L.rain * 170), CONFIG.W, CONFIG.H);
}

function updateEnv() {
  const level = game.L, time = game.time, screenWidth = CONFIG.W, screenHeight = CONFIG.H;
  game.wind = Weather.wind(level.wind, time);
  for (const solid of level.solids) if (solid.dyn) solid.y = waterSurfaceY(solid.x + solid.w / 2) - 2;
  for (const decorItem of level.decor) {
    if (!decorItem.dr) continue;
    decorItem.x += decorItem.dr + game.wind * 0.03;
    if (decorItem.x < 10) decorItem.dr = Math.abs(decorItem.dr);
    if (decorItem.x > level.worldW - 20) decorItem.dr = -Math.abs(decorItem.dr);
  }
  const heli = game.heli, fireWash = CONFIG.fireWash;
  for (const fire of level.fires) {
    let target = 0;
    const deltaX = heli.x + 16 - (fire.x + fire.w / 2);
    if (heli.state === 'fly' && !heli.engineOff && !heli.ground) {
      const above = fire.y - (heli.y + 16);
      if (Math.abs(deltaX) < fireWash.range && above > -10 && above < fireWash.height) {
        target = (1 - Math.abs(deltaX) / fireWash.range) * (1 - clamp(above - 10, 0, fireWash.height) / fireWash.height);
      }
    }
    fire.press += (target - fire.press) * 0.1;
    const flameRect = fireRect(fire), side = deltaX >= 0 ? -1 : 1;
    if (chance(0.35 + fire.press * 0.4)) {
      addParticle({ t: 'px', x: flameRect.x + randomRange(0, flameRect.w), y: fire.y - randomRange(0, flameRect.h * 0.9), vx: randomRange(-0.2, 0.2) + side * fire.press * randomRange(0.5, 1.5), vy: -randomRange(0.3, 0.9) * (1 - fire.press * 0.7), g: -0.004, wf: 0.3, life: Math.floor(randomRange(30, 80)) });
    }
    if (chance(0.05 + fire.press * 0.1)) addParticle({ t: 'smoke', x: fire.x + fire.w / 2, y: flameRect.y, r: 2, life: Math.floor(randomRange(80, 130)), vx: side * fire.press * 0.6 });
  }
  Weather.updateRain(game.rain, {
    wind: game.wind, camX: game.camX, width: screenWidth, height: screenHeight, waterY: waterSurfaceY,
    onHitWater: (x, waterY) => addParticle({ t: 'px', x, y: waterY - 1, vx: randomRange(-0.4, 0.4), vy: -randomRange(0.3, 0.8), g: 0.08, life: 10 }),
  });
  if (level.lightning) {
    Weather.tickLightning(game, {
      camX: game.camX, width: screenWidth, height: screenHeight, waterY: waterSurfaceY,
      onStrike: bolt => { splash(bolt.end[0], 3); Sfx.play('thunder'); },
    });
  }
}

function updateCamera() {
  const heli = game.heli;
  game.camX = Camera.follow(game.camX, heli.x + 16 - CONFIG.W / 2 + heli.vx * 28, game.L.worldW, CONFIG.W, 0.08);
  game.shake = Camera.decayShake(game.shake);
}
