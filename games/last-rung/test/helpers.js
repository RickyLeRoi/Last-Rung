// games/last-rung/test/helpers.js
'use strict';
// Last Rung specific helpers on top of the engine harness: piloting the helicopter and placing it on the map.
const engine = require('../../../engine/test/harness');

const boot = (options = {}) => engine.boot({ game: 'last-rung', ...options });

function flyTo(driver, targetX, targetY, maxSpeed, tolerance = 2) {
  const heli = driver.game.heli, heliCenterX = heli.x + 16, heliBottomY = heli.y + 16;
  const desiredVelocityX = Math.max(-maxSpeed, Math.min(maxSpeed, (targetX - heliCenterX) * 0.04));
  const desiredVelocityY = Math.max(-maxSpeed * 0.8, Math.min(maxSpeed * 0.8, (targetY - heliBottomY) * 0.04));
  const pressedKeys = [];
  if (heli.vx < desiredVelocityX - 0.03) pressedKeys.push('ArrowRight'); else if (heli.vx > desiredVelocityX + 0.03) pressedKeys.push('ArrowLeft');
  if (heli.vy > desiredVelocityY - 0.02) pressedKeys.push('ArrowUp');
  driver.set(pressedKeys); driver.tick();
  return Math.abs(targetX - heliCenterX) < tolerance && Math.abs(targetY - heliBottomY) < 3;
}
function goTo(driver, getTargetX, getTargetY, maxSpeed, limit = 3000) {
  for (let i = 0; i < limit; i++) {
    if (driver.game.heli.state !== 'fly' || driver.game.state !== 'play') return false;
    if (flyTo(driver, getTargetX(), getTargetY(), maxSpeed)) return true;
  }
  return false;
}

function place(harness, x, y, velocityX = 0, velocityY = 0) {
  const heli = harness.game.heli;
  heli.ground = null; heli.x = x; heli.y = y; heli.px = x; heli.py = y; heli.vx = velocityX; heli.vy = velocityY;
}
function roofWithoutObstacles(game) {
  const level = game.L;
  return level.solids.find(solid => solid.kind === 'bld' && !solid.safe && solid.w >= 50 &&
    !level.fires.some(fire => fire.x < solid.x + solid.w && fire.x + fire.w > solid.x) &&
    !level.haz.some(hazard => hazard.x1 >= solid.x - 4 && hazard.x0 <= solid.x + solid.w + 4 && hazard.y1 < solid.y + 2 && hazard.y0 < solid.y));
}

module.exports = { boot, flyTo, goTo, place, roofWithoutObstacles, randomKeysPolicy: engine.randomKeysPolicy, W: engine.W, H: engine.H };
