// games/formicaio/test/autopilot.js
'use strict';
// Scripted player shared by levels.js (solvability) and the rules suite. Keyboard only, like a player; it reads the state to plan.
// It digs a nursery next to the queen, lays a trail on the grass to every food it does not know yet (nearest first), adds a pantry
// and a second nursery as the colony grows and, before a shower, recalls the ants and plugs the entrance (then reopens it).
const { boot } = require('./helpers');

const REACHED = 1.2;          // px: the cursor moves 2.2 px per frame per axis
const CHAMBER_SPOTS = [[30, 4], [-30, 4], [28, 28], [-28, 28], [0, 38], [56, 10], [-56, 10], [52, 36], [-52, 36]];

function spotIsClear(hook, x, y, radius) {
  const level = hook.game.L, chambers = level.chambers;
  if (x - radius < 4 || x + radius > level.width - 4 || y + radius > level.height - 4) return false;
  if (chambers.some(chamber => Math.hypot(chamber.x - x, chamber.y - y) < chamber.r + radius + 5)) return false;
  for (let deltaY = -radius; deltaY <= radius; deltaY += 2) {
    for (let deltaX = -radius; deltaX <= radius; deltaX += 2) {
      if (deltaX * deltaX + deltaY * deltaY > radius * radius) continue;
      const material = hook.Terrain.get(level.terrain, x + deltaX, y + deltaY);
      if (material === hook.CONFIG.material.stone || material === hook.CONFIG.material.root) return false;
    }
  }
  return true;
}

function chamberStroke(hook) {
  const queen = hook.game.L.queenChamber, radius = hook.CONFIG.chamber.radius;
  for (const [offsetX, offsetY] of CHAMBER_SPOTS) {
    const x = queen.x + offsetX, y = queen.y + offsetY;
    if (!spotIsClear(hook, x, y, radius)) continue;
    const startX = queen.x + Math.sign(offsetX) * (queen.r - 3), startY = queen.y + (offsetX === 0 ? queen.r - 3 : 0);
    return { points: [[startX, startY], [x, startY], [x, y]], trail: true, tap: 'KeyX' };
  }
  return null;
}

// Along the grass, starting beside the entrance hole (never down the hole, or the cursor would order a dig through the soil).
function surfaceStroke(hook, fromX, toX) {
  const groundY = hook.game.L.groundY, grassY = x => Math.min(hook.surfaceAt(x), groundY + 1) - 3;
  const points = [], direction = Math.sign(toX - fromX) || 1;
  for (let x = fromX + direction * 8; direction > 0 ? x < toX : x > toX; x += direction * 6) points.push([x, grassY(x)]);
  points.push([toX, grassY(toX)]);
  return { points, trail: true, tap: null };
}

function createPlanner(hook) {
  const plan = { queue: [], nurseries: 0, pantry: false, handledShower: -1, reopenShower: -1, tapNext: null };
  const level = () => hook.game.L;

  function rainStrokes(game) {
    const L = level(), rain = hook.CONFIG.rain;
    const index = L.showers.findIndex(shower => game.clock >= shower.start - rain.warning && game.clock < shower.end);
    if (index >= 0 && plan.handledShower < index) {
      plan.handledShower = index;
      plan.queue = [];
      if (!game.recall) plan.queue.push({ points: [[game.cursor.x, game.cursor.y]], trail: false, tap: 'KeyZ' });
      plan.queue.push({ points: [[L.entranceX, L.groundY + 6]], trail: false, tap: 'KeyC' });
      return true;
    }
    const finished = L.showers.findIndex((shower, i) => i === plan.handledShower && game.clock >= shower.end + 120);
    if (finished >= 0 && plan.reopenShower < finished) {
      plan.reopenShower = finished;
      plan.queue = [];
      for (const plug of L.plugs) plan.queue.push({ points: [[hook.cellCenter(plug.cellX), hook.cellCenter(plug.cellY)]], trail: false, tap: 'KeyC' });
      plan.queue.push({ points: [[L.entranceX, L.groundY - 3], [L.entranceX, L.queenChamber.y - L.queenChamber.r + 2]], trail: true, tap: null });
      if (game.recall) plan.queue.push({ points: [[L.entranceX, L.groundY - 3]], trail: false, tap: 'KeyZ' });
      return true;
    }
    return false;
  }

  function nextStrokes(game) {
    const L = level(), raining = L.showers.some(shower => game.clock >= shower.start - hook.CONFIG.rain.warning && game.clock < shower.end + 120);
    if (plan.nurseries === 0 || (plan.nurseries === 1 && game.ants.length >= 10)) {
      const stroke = chamberStroke(hook);
      plan.nurseries++;
      if (stroke) { plan.queue.push(stroke); return; }
    }
    if (!plan.pantry && game.stock >= hook.stockCapacity() - 1) {
      const stroke = chamberStroke(hook);
      plan.pantry = true;
      if (stroke) { plan.queue.push(stroke, { points: [stroke.points[stroke.points.length - 1]], trail: false, tap: 'KeyX' }); return; }
    }
    if (raining) return;
    // Nearest first, but food close to a spider costs as much as food far away: isolated foragers get eaten there.
    const cost = food => Math.abs(food.x - L.entranceX) + (L.spiders.some(spider => Math.abs(spider.x - food.x) < 100) ? 300 : 0);
    const unknown = L.foods.filter(food => !L.knownFood.includes(food)).sort((first, second) => cost(first) - cost(second));
    if (unknown.length) plan.queue.push(surfaceStroke(hook, L.entranceX, unknown[0].x));
  }

  // Keys for this frame: { keys, space, tap }.
  return function decide() {
    const game = hook.game, cursor = game.cursor;
    if (rainStrokes(game) && plan.current) { plan.current = null; }
    if (!plan.current) {
      if (!plan.queue.length) nextStrokes(game);
      plan.current = plan.queue.shift() || null;
      if (plan.current) plan.current.index = 0;
    }
    const stroke = plan.current;
    if (!stroke) return { keys: [], space: false, tap: null };
    const [targetX, targetY] = stroke.points[stroke.index];
    const deltaX = targetX - cursor.x, deltaY = targetY - cursor.y, keys = [];
    if (deltaX > REACHED) keys.push('ArrowRight'); else if (deltaX < -REACHED) keys.push('ArrowLeft');
    if (deltaY > REACHED) keys.push('ArrowDown'); else if (deltaY < -REACHED) keys.push('ArrowUp');
    const painting = stroke.trail && stroke.index > 0;
    if (keys.length) return { keys, space: painting, tap: null };
    if (stroke.index < stroke.points.length - 1) { stroke.index++; return { keys: [], space: stroke.trail, tap: null }; }
    plan.current = null;
    return { keys: [], space: false, tap: stroke.tap };
  };
}

// Plays one level to its end; returns { state, result, stars, workers, target, frames, driver }.
function playLevel(spec, limit = 30000) {
  const driver = boot({ seededMath: 1 });
  const hook = driver.hook, game = hook.game;
  driver.play(spec);
  const decide = createPlanner(hook);
  for (let i = 0; i < limit && game.state === 'play'; i++) {
    const move = decide();
    driver.set(move.keys);
    if (move.space) driver.keyDown('Space'); else driver.keyUp('Space');
    if (move.tap) driver.tap(move.tap); else driver.tick();
  }
  driver.set([]); driver.keyUp('Space');
  for (let i = 0; i < 200 && game.state === 'play'; i++) driver.tick();
  const level = game.L;
  return { state: game.state, result: game.result, stars: game.stars, workers: game.ants.length, target: level.target, born: level.born, lost: level.lostAnts + level.lostBrood, frames: game.frame, reason: game.overReason, driver };
}

module.exports = { playLevel, createPlanner };
