// games/sabbia/test/autopilot.js
'use strict';
// Scripted player shared by levels.js (solvability): one script per challenge, played with the keyboard like a player.
// A script is a list of actions: { select: material key }, { size: radius index }, { go: [x, y] } (brush up), { paint: [[x, y], ...] }
// (brush down along the points), { hold: frames } (paint in place), { wait: frames }, { until: 'goal', max: frames },
// { fireBeyond: column, max: frames } (wait until a fire cell burns at or right of that column).
const { boot } = require('./helpers');

const SCRIPTS = {
  fill: [{ select: 'sand' }, { size: 2 }, { go: [70, 7] }, { hold: 70 }, { until: 'goal', max: 2200 }],
  boil: [
    { select: 'wood' }, { size: 2 }, { paint: [[82, 82], [110, 82]] },
    { select: 'fire' }, { paint: [[110, 86], [82, 86]] }, { wait: 400 }, { paint: [[82, 86], [110, 86]] }, { until: 'goal', max: 7000 },
  ],
  meadow: [
    { select: 'fire' }, { size: 1 }, { go: [4, 83] }, { hold: 1 }, { go: [54, 83] }, { hold: 1 }, { go: [106, 83] }, { hold: 1 },
    { select: 'coldAir' }, { size: 2 }, { go: [160, 56] }, { hold: 30 }, { until: 'goal', max: 4500 },
  ],
  acid: [{ select: 'acid' }, { size: 0 }, { go: [38, 3] }, { hold: 30 }, { wait: 500 }, { go: [30, 3] }, { hold: 25 }, { until: 'goal', max: 4500 }],
  blaze: [
    { select: 'water' }, { size: 2 }, { go: [37, 76] }, { hold: 60 }, { paint: [[26, 76], [48, 76]] },
    { go: [138, 54] }, { fireBeyond: 120, max: 4000 }, { hold: 40 }, { paint: [[138, 54], [150, 62]] }, { hold: 30 },
    { fireBeyond: 126, max: 1500 }, { go: [138, 54] }, { hold: 40 }, { until: 'goal', max: 4500 },
  ],
  cloud: [
    { select: 'iron' }, { size: 1 }, { paint: [[80, 66], [80, 86], [112, 86], [112, 66]] },
    { select: 'water' }, { size: 2 }, { go: [96, 70] }, { hold: 60 },
    { select: 'wood' }, { paint: [[84, 93], [108, 93]] },
    { select: 'fire' }, { paint: [[84, 89], [108, 89]] }, { wait: 300 }, { paint: [[108, 89], [84, 89]] }, { until: 'goal', max: 5000 },
  ],
};

const REACHED = 0.8;

function playLevel(spec, limit = 8000) {
  const driver = boot({ seededMath: 1, skipRender: true });
  const hook = driver.hook, game = hook.game;
  driver.play(spec);
  const script = SCRIPTS[game.L.challenge.id];
  const press = code => driver.tap(code);
  const moveTowards = ([x, y]) => {
    const keys = [];
    if (x - game.cursor.x > REACHED) keys.push('ArrowRight'); else if (game.cursor.x - x > REACHED) keys.push('ArrowLeft');
    if (y - game.cursor.y > REACHED) keys.push('ArrowDown'); else if (game.cursor.y - y > REACHED) keys.push('ArrowUp');
    return keys;
  };
  const live = () => game.state === 'play' && game.frame < limit;
  for (const action of script) {
    if (!live()) break;
    if (action.select) { for (let i = 0; i < 12 && game.L.palette[game.selected] !== hook.MATERIAL[action.select]; i++) press('KeyX'); continue; }
    if (action.size !== undefined) { for (let i = 0; i < 4 && game.brushSize !== action.size; i++) press('KeyC'); continue; }
    if (action.go || action.paint) {
      const points = action.go ? [action.go] : action.paint;
      if (action.paint) { for (let keys = moveTowards(points[0]); keys.length && live(); keys = moveTowards(points[0])) { driver.set(keys); driver.tick(); } driver.keyDown('Space'); }
      for (const point of points) for (let keys = moveTowards(point); keys.length && live(); keys = moveTowards(point)) { driver.set(keys); driver.tick(); }
      driver.set([]); driver.keyUp('Space');
      continue;
    }
    if (action.hold) { driver.keyDown('Space'); for (let i = 0; i < action.hold && live(); i++) driver.tick(); driver.keyUp('Space'); continue; }
    if (action.wait) { for (let i = 0; i < action.wait && live(); i++) driver.tick(); continue; }
    if (action.fireBeyond) {
      const burning = () => { const material = game.L.world.material; for (let index = 0; index < material.length; index++) if (material[index] === hook.MATERIAL.fire && index % 192 >= action.fireBeyond) return true; return false; };
      for (let i = 0; i < action.max && live() && !burning(); i++) driver.tick();
      continue;
    }
    if (action.until) for (let i = 0; i < action.max && live(); i++) driver.tick();
  }
  for (let i = 0; i < 300 && game.state === 'play'; i++) driver.tick();
  return { state: game.state, result: game.result, stars: game.stars, progress: game.L.goal ? game.L.goal.progress() : 0, budgetLeft: hook.budgetLeftShare(), frames: game.frame, reason: game.overReason, driver };
}

module.exports = { playLevel, SCRIPTS };
