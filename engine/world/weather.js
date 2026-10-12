// engine/world/weather.js
'use strict';
// Wind, rain and lightning. Everything random goes through Rng (see engine/core/util.js): the order of calls is part of the replay contract.
const Weather = (() => {
  // base = level wind strength (0 = no wind), time in seconds.
  const wind = (base, time) => (base ? base * (0.55 * Math.sin(time * 0.35) + 0.3 * Math.sin(time * 1.37 + 2) + 0.15 * Math.sin(time * 3.1)) : 0);

  function initRain(count, width, height) {
    const drops = [];
    for (let i = 0; i < count; i++) drops.push({ x: randomRange(0, width), y: randomRange(0, height), s: randomRange(0, 2) });
    return drops;
  }

  // world = { wind, camX, width, height, waterY(x), onHitWater(x, surfaceY), fall, fallSpread, drift }; drop x is in screen space,
  // waterY wants world space. Optional: fall (px per frame, default 4), fallSpread (how much each drop's own speed adds, default 1) and
  // drift (sideways px per frame without wind, default 0.5): slow values turn the rain into snow.
  function updateRain(drops, world) {
    // 20261012 ++ RG #snow_fall
    const fall = world.fall === undefined ? 4 : world.fall, fallSpread = world.fallSpread === undefined ? 1 : world.fallSpread, drift = world.drift === undefined ? 0.5 : world.drift;
    for (const drop of drops) {
      drop.y += fall + drop.s * fallSpread;
      drop.x += world.wind * 1.5 + drift;
      const waterY = world.waterY(drop.x + world.camX);
      if (drop.y > waterY || drop.y > world.height) {
        if (waterY !== Infinity && drop.y > waterY && chance(0.15)) world.onHitWater(drop.x + world.camX, waterY);
        drop.y = randomRange(-10, 10); drop.x = randomRange(-30, world.width + 30);
      }
      if (drop.x > world.width + 30) drop.x -= world.width + 60;
      if (drop.x < -30) drop.x += world.width + 60;
    }
  }

  // world = { camX, width, height, waterY(x) }
  function makeBolt(world) {
    const segments = [];
    let x = world.camX + randomRange(30, world.width - 30), y = 12, branch = null;
    for (;;) {
      const nextX = x + randomRange(-7, 7);
      let nextY = y + randomRange(5, 11), reachedEnd = false;
      const surfaceY = world.waterY(nextX);
      if (surfaceY !== Infinity && nextY >= surfaceY) { nextY = surfaceY; reachedEnd = true; }
      if (nextY >= world.height) { nextY = world.height; reachedEnd = true; }
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

  // state = { bolt, boltT, flashT, lightningT } (the game state object works as is); world as in makeBolt plus onStrike(bolt).
  function tickLightning(state, world) {
    if (state.boltT > 0) state.boltT--;
    if (state.flashT > 0) state.flashT--;
    if (--state.lightningT <= 0) {
      state.lightningT = Math.floor(randomRange(260, 600));
      state.bolt = makeBolt(world);
      state.boltT = 10; state.flashT = 3;
      world.onStrike(state.bolt);
    }
  }

  return { wind, initRain, updateRain, makeBolt, tickLightning };
})();
