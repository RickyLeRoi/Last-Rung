// games/abisso/test/autopilot.js
'use strict';
// Scripted pilot shared by levels.js (solvability) and the golden scenarios. It reads the state (it is a test, not a player): breadth-first
// search on a grid of 4 px cells where the sub fits, then a speed controller on the thrusters along the path, slower near the target.
// Target: the waiting diver with the least air; back to the ship with full seats or nobody left to pick up.
const { boot } = require('./helpers');

const CELL = 4, MARGIN = 1, LOOKAHEAD = 2;

function clearanceGrid(hook) {
  const level = hook.game.L, sub = hook.game.sub, columns = Math.ceil(level.width / CELL), rows = Math.ceil(level.height / CELL);
  const free = new Uint8Array(columns * rows), surface = hook.CONFIG.world.surface;
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = column * CELL + CELL / 2 - sub.w / 2 - MARGIN, y = row * CELL + CELL / 2 - sub.h / 2 - MARGIN;
    if (y < surface) continue;
    free[row * columns + column] = hook.Terrain.hitsRect(level.terrain, x, y, sub.w + 2 * MARGIN, sub.h + 2 * MARGIN) ? 0 : 1;
  }
  return { free, columns, rows };
}

// Path of cells from the sub to the cell nearest the target point (8 neighbours), or null.
function findPath(grid, fromX, fromY, toX, toY) {
  const { free, columns, rows } = grid, cellAt = (x, y) => [clamp(Math.floor(x / CELL), 0, columns - 1), clamp(Math.floor(y / CELL), 0, rows - 1)];
  const [startX, startY] = cellAt(fromX, fromY), [goalX, goalY] = cellAt(toX, toY);
  const previous = new Int32Array(columns * rows).fill(-1), start = startY * columns + startX;
  previous[start] = start;
  const queue = [start];
  let best = start, bestDistance = Infinity;
  for (let head = 0; head < queue.length; head++) {
    const index = queue[head], x = index % columns, y = (index - x) / columns, distance = Math.hypot(x - goalX, y - goalY);
    if (distance < bestDistance) { bestDistance = distance; best = index; }
    if (distance === 0) break;
    for (let deltaY = -1; deltaY <= 1; deltaY++) for (let deltaX = -1; deltaX <= 1; deltaX++) {
      const nextX = x + deltaX, nextY = y + deltaY;
      if ((!deltaX && !deltaY) || nextX < 0 || nextY < 0 || nextX >= columns || nextY >= rows) continue;
      const next = nextY * columns + nextX;
      if (previous[next] >= 0 || !free[next]) continue;
      if (deltaX && deltaY && (!free[y * columns + nextX] || !free[nextY * columns + x])) continue;
      previous[next] = index;
      queue.push(next);
    }
  }
  if (bestDistance > 4) return null;
  const path = [];
  for (let index = best; index !== start; index = previous[index]) path.push([(index % columns) * CELL + CELL / 2, Math.floor(index / columns) * CELL + CELL / 2]);
  return path.reverse();
}

function createPilot(hook) {
  const grid = clearanceGrid(hook), CONFIG = hook.CONFIG;
  let path = null, pathFor = null, replanAt = 0, anchorX = 0, anchorY = 0, anchorFrame = 0, pushUntil = 0;
  function target() {
    const game = hook.game, sub = game.sub, waiting = hook.waitingDivers();
    if (sub.aboard.length >= CONFIG.sub.seats || (sub.aboard.length && !waiting.length)) return { id: 'ship', x: CONFIG.ship.x + CONFIG.ship.width / 2, y: CONFIG.world.surface + 8 };
    if (!waiting.length) return null;
    const diver = waiting.slice().sort((first, second) => first.air - second.air)[0], [x, y] = hook.diverCenter(diver);
    return { id: diver, x, y };
  }
  // Keys for this frame.
  return function decide() {
    const game = hook.game, sub = game.sub, goal = target();
    if (!goal) return [];
    const x = hook.subCenterX(), y = hook.subCenterY();
    if (game.frame - anchorFrame >= 60) {
      if (Math.hypot(x - anchorX, y - anchorY) < 3) pushUntil = game.frame + 60;
      anchorX = x; anchorY = y; anchorFrame = game.frame;
    }
    if (goal.id !== pathFor || game.frame >= replanAt || !path) { path = findPath(grid, x, y, goal.x, goal.y); pathFor = goal.id; replanAt = game.frame + 90; }
    if (!path || !path.length) {
      // No cell route (squeezed against a wall): thrust straight towards the goal, away from the wall, until a route exists again.
      const keys = [];
      if (goal.x - x > 8) keys.push('ArrowRight'); else if (x - goal.x > 8) keys.push('ArrowLeft');
      keys.push(goal.y < y ? 'ArrowUp' : 'ArrowDown');
      return keys;
    }
    while (path.length > 1 && Math.hypot(path[0][0] - x, path[0][1] - y) < CELL * 1.5) path.shift();
    if (game.frame < pushUntil) {
      // Caught on a corner: push the way a player would, full thrust sideways towards the goal and towards its height, for a while.
      const keys = [goal.x >= x ? 'ArrowRight' : 'ArrowLeft'];
      if (Math.abs(goal.y - y) > 6) keys.push(goal.y < y ? 'ArrowUp' : 'ArrowDown');
      return keys;
    }
    const [waypointX, waypointY] = path[Math.min(LOOKAHEAD, path.length - 1)];
    const remaining = Math.hypot(goal.x - x, goal.y - y);
    const cruise = remaining < 30 ? 0.35 : remaining < 70 ? 0.6 : 0.9;
    const deltaX = waypointX - x, deltaY = waypointY - y, length = Math.hypot(deltaX, deltaY) || 1;
    const wantX = remaining < 6 ? 0 : deltaX / length * cruise, wantY = remaining < 6 ? 0 : deltaY / length * cruise;
    const keys = [];
    if (wantX - sub.vx > 0.06) keys.push('ArrowRight'); else if (sub.vx - wantX > 0.06) keys.push('ArrowLeft');
    if (wantY - sub.vy > 0.06) keys.push('ArrowDown'); else if (sub.vy - wantY > 0.06) keys.push('ArrowUp');
    return keys;
  };
}

// Plays one level to its end; returns { state, result, stars, saved, lost, total, hull, battery, frames, driver }.
function playLevel(spec, limit = 20000) {
  const driver = boot({ seededMath: 1, skipRender: true });
  const hook = driver.hook, game = hook.game;
  driver.play(spec);
  const decide = createPilot(hook);
  for (let i = 0; i < limit && game.state === 'play'; i++) { driver.set(decide()); driver.tick(); }
  driver.set([]);
  for (let i = 0; i < 200 && game.state === 'play'; i++) driver.tick();
  const level = game.L;
  return { state: game.state, result: game.result, stars: game.stars, saved: level.saved, lost: level.lost, total: level.total, hull: game.sub.hull, battery: game.sub.battery, frames: game.frame, reason: game.overReason, driver };
}

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

module.exports = { playLevel, createPilot, findPath, clearanceGrid };
