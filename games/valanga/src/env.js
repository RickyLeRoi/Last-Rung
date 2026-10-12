// games/valanga/src/env.js
'use strict';
// Wind and falling snow (the engine rain, slowed down). Flakes stop on the snow surface.
function initSnowfall() {
  game.rain = Weather.initRain(game.L.snowCount, CONFIG.W, CONFIG.H);
}

function updateEnv() {
  const level = game.L, weather = CONFIG.weather;
  game.wind = Weather.wind(level.wind, game.time);
  Weather.updateRain(game.rain, {
    wind: game.wind * 0.5, camX: game.camX, width: CONFIG.W, height: CONFIG.H,
    waterY: x => (x >= 0 && x < level.width ? surfaceAt(x) - game.camY : Infinity),
    onHitWater: () => {},
    fall: weather.fall, fallSpread: weather.fallSpread, drift: weather.drift,
  });
}
