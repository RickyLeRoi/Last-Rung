'use strict';
// Flames squashed by the rotor get lower and wider (clamped to the rooftop edges).
function fireRect(fire) {
  const fireWash = CONFIG.fireWash, press = fire.press || 0, spread = fireWash.spread * press;
  const flameHeight = fire.h * (1 - fireWash.flatten * press) * 0.8 * (0.3 + 0.7 * (fire.hp === undefined ? 1 : Math.max(0, fire.hp)));
  const minX = Math.max(fire.bx0 === undefined ? -1e9 : fire.bx0, fire.x - spread);
  const maxX = Math.min(fire.bx1 === undefined ? 1e9 : fire.bx1, fire.x + fire.w + spread);
  return { x: minX, y: fire.y - flameHeight, w: maxX - minX, h: flameHeight };
}

function makeBolt() {
  const segments = [];
  let x = game.camX + randomRange(30, CONFIG.W - 30), y = 12, branch = null;
  for (;;) {
    const nextX = x + randomRange(-7, 7);
    let nextY = y + randomRange(5, 11), reachedEnd = false;
    const surfaceY = waterSurfaceY(nextX);
    if (surfaceY !== Infinity && nextY >= surfaceY) { nextY = surfaceY; reachedEnd = true; }
    if (nextY >= CONFIG.H) { nextY = CONFIG.H; reachedEnd = true; }
    segments.push([x, y, nextX, nextY]);
    if (!branch && y > 40 && chance(0.5)) branch = [x, y];
    x = nextX; y = nextY;
    if (reachedEnd) break;
  }
  if (branch) {
    let [branchX, branchY] = branch;
    for (let i = 0; i < 4; i++) {
      const nextX = branchX + randomRange(2, 9) * (chance(0.5) ? -1 : 1), nextY = branchY + randomRange(4, 9);
      segments.push([branchX, branchY, nextX, nextY]);
      branchX = nextX; branchY = nextY;
    }
  }
  return { segs: segments, end: [x, y] };
}

function initRain() {
  game.rain = [];
  const dropCount = Math.floor(game.L.rain * 170);
  for (let i = 0; i < dropCount; i++) game.rain.push({ x: randomRange(0, CONFIG.W), y: randomRange(0, CONFIG.H), s: randomRange(0, 2) });
}

function updateEnv() {
  const level = game.L, time = game.time, screenWidth = CONFIG.W, screenHeight = CONFIG.H;
  game.wind = level.wind ? level.wind * (0.55 * Math.sin(time * 0.35) + 0.3 * Math.sin(time * 1.37 + 2) + 0.15 * Math.sin(time * 3.1)) : 0;
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
  for (const raindrop of game.rain) {
    raindrop.y += 4 + raindrop.s;
    raindrop.x += game.wind * 1.5 + 0.5;
    const waterY = waterSurfaceY(raindrop.x + game.camX);
    if (raindrop.y > waterY || raindrop.y > screenHeight) {
      if (waterY !== Infinity && raindrop.y > waterY && chance(0.15)) addParticle({ t: 'px', x: raindrop.x + game.camX, y: waterY - 1, vx: randomRange(-0.4, 0.4), vy: -randomRange(0.3, 0.8), g: 0.08, life: 10 });
      raindrop.y = randomRange(-10, 10); raindrop.x = randomRange(-30, screenWidth + 30);
    }
    if (raindrop.x > screenWidth + 30) raindrop.x -= screenWidth + 60;
    if (raindrop.x < -30) raindrop.x += screenWidth + 60;
  }
  if (level.lightning) {
    if (game.boltT > 0) game.boltT--;
    if (game.flashT > 0) game.flashT--;
    if (--game.lightningT <= 0) {
      game.lightningT = Math.floor(randomRange(260, 600));
      game.bolt = makeBolt();
      game.boltT = 10; game.flashT = 3;
      splash(game.bolt.end[0], 3);
      Sfx.play('thunder');
    }
  }
}

function updateCamera() {
  const heli = game.heli;
  const target = clamp(heli.x + 16 - CONFIG.W / 2 + heli.vx * 28, 0, game.L.worldW - CONFIG.W);
  game.camX += (target - game.camX) * 0.08;
  game.shake *= 0.88;
  if (game.shake < 0.3) game.shake = 0;
}
