// games/formicaio/src/threats.js
'use strict';
// Spiders hunt on the grass: an isolated ant (no other one nearby) is eaten, a group chases the spider away. Showers flood open holes.

// Above the local grass (the meadow is not flat), and never deeper than the mouth of a hole.
const isOnGrass = ant => cellCenter(ant.cellY) < Math.min(surfaceAt(cellCenter(ant.cellX)), game.L.groundY + 4);
const spiderY = spider => surfaceAt(spider.x) - 3;

function updateSpiders() {
  const level = game.L, config = CONFIG.spider;
  for (const spider of level.spiders) {
    if (spider.eatT > 0) spider.eatT--;
    if (spider.scaredT > 0) spider.scaredT--;
    spider.x += spider.dir * spider.speed * (spider.scaredT > 0 ? 2.5 : 1);
    if (spider.x < config.margin) { spider.x = config.margin; spider.dir = 1; }
    if (spider.x > level.width - config.margin) { spider.x = level.width - config.margin; spider.dir = -1; }
    if (spider.scaredT > 0) continue;
    const y = spiderY(spider);
    const near = game.ants.filter(ant => isOnGrass(ant) && Math.hypot(cellCenter(ant.cellX) - spider.x, cellCenter(ant.cellY) - y) <= config.groupRange);
    const prey = near.find(ant => Math.hypot(cellCenter(ant.cellX) - spider.x, cellCenter(ant.cellY) - y) <= config.catchRadius);
    if (!prey) continue;
    if (near.length >= config.group) {
      const meanX = near.reduce((sum, ant) => sum + cellCenter(ant.cellX), 0) / near.length;
      spider.dir = spider.x >= meanX ? 1 : -1;
      spider.scaredT = config.scared;
      showMessage('IL GRUPPO HA SCACCIATO IL RAGNO', 80);
      Sfx.play('scared');
    } else if (spider.eatT === 0 && near.length === 1) {
      spider.eatT = config.eatEvery;
      removeAnt(prey, 'IL RAGNO HA PRESO UNA FORMICA ISOLATA', 'eaten');
    }
  }
}

function updateRain() {
  const level = game.L, rain = CONFIG.rain;
  const next = level.showers.find(shower => game.clock < shower.end);
  if (next && game.clock === next.start - rain.warning) {
    showMessage(UI.hint("TEMPORALE IN ARRIVO: RICHIAMA (Z) E TAPPA L'INGRESSO (C)", "TEMPORALE IN ARRIVO: RICHIAMA E TAPPA L'INGRESSO", "TEMPORALE IN ARRIVO: RICHIAMA (B) E TAPPA L'INGRESSO (RB)"), 240);
    Sfx.play('thunder');
  }
  const raining = isRaining();
  if (raining && !game.rain.length) game.rain = Weather.initRain(140, CONFIG.W, CONFIG.H);
  if (!raining && game.rain.length) game.rain = [];
  if (raining && game.clock % 240 === 0) Sfx.play('thunder');
  if (game.rain.length) {
    Weather.updateRain(game.rain, {
      wind: game.wind, camX: game.camX, width: CONFIG.W, height: CONFIG.H,
      waterY: x => surfaceAt(x) - game.camY, onHitWater: () => {},
    });
  }
  pourRain();
}
