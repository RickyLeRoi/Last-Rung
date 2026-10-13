// games/abisso/src/sub.js
'use strict';
// The minisub: thrusters with inertia and neutral buoyancy, currents, collisions on the terrain mask (impacts above a speed hurt the hull),
// battery for thrusters, bow lamp and sonar. When the battery is flat the sub only drifts slowly up.

const NO_INPUT = Object.freeze({ hx: 0, up: 0, down: 0, sonar: false, lamp: false });

function newSub() {
  const config = CONFIG.sub;
  return { x: config.startX, y: config.startY, w: config.w, h: config.h, vx: 0, vy: 0, face: 1, hull: 1, minHull: 1, battery: game.L.battery, lamp: true, sonarT: 0, aboard: [], thrust: 0 };
}

const subCenterX = () => game.sub.x + game.sub.w / 2;
const subCenterY = () => game.sub.y + game.sub.h / 2;
const surfaceAtX = x => Water.surfaceY(game.L.water, x, game.time);

function currentAt(x, y) {
  for (const current of game.L.currents) if (x >= current.x && x < current.x + current.w && y >= current.y && y < current.y + current.h) return current;
  return null;
}

function hurtHull(speed) {
  const config = CONFIG.sub, damage = (speed - config.damageSpeed) * config.damagePerSpeed / 100;
  game.sub.hull = Math.max(0, game.sub.hull - damage);
  game.sub.minHull = Math.min(game.sub.minHull, game.sub.hull);
  game.shake = Math.max(game.shake, 4);
  for (let i = 0; i < 6; i++) addParticle({ t: 'chunk', x: subCenterX() + randomRange(-4, 4), y: subCenterY() + randomRange(-3, 3), w: 2, h: 2, vx: randomRange(-1, 1), vy: randomRange(-1, 0.5), life: 120 });
  Sfx.play('hit');
}

function updateSub(input) {
  const sub = game.sub, level = game.L, config = CONFIG.sub, battery = CONFIG.battery;
  const verticalInput = input.down - input.up, thrusting = sub.battery > 0 && (input.hx !== 0 || verticalInput !== 0);
  if (input.hx || input.up || input.down) game.used.move = true;
  sub.thrust = thrusting ? Math.min(1, Math.abs(input.hx) + Math.abs(verticalInput)) : 0;
  if (thrusting) {
    sub.vx += input.hx * config.thrust;
    sub.vy += verticalInput * config.thrust;
    if (input.hx) sub.face = Math.sign(input.hx);
    sub.battery = Math.max(0, sub.battery - battery.thrust * sub.thrust);
  }
  if (sub.battery <= 0) sub.vy -= config.rise;
  if (input.lamp) { sub.lamp = !sub.lamp; game.used.lamp = true; Sfx.play('lamp'); }
  if (sub.lamp && sub.battery > 0) sub.battery = Math.max(0, sub.battery - battery.lamp);
  if (sub.battery <= 0 && sub.lamp) { sub.lamp = false; showMessage('BATTERIA SCARICA: SI RISALE PIANO', 160); Sfx.play('flat'); }
  if (sub.sonarT > 0) sub.sonarT--;
  if (input.sonar) firePulse();
  const current = currentAt(subCenterX(), subCenterY());
  if (current) { sub.vx += current.ax; sub.vy += current.ay; }
  sub.vx *= config.drag; sub.vy *= config.drag;
  const speed = Math.hypot(sub.vx, sub.vy);
  if (speed > config.maxSpeed) { sub.vx *= config.maxSpeed / speed; sub.vy *= config.maxSpeed / speed; }
  moveSub();
}

function moveSub() {
  const sub = game.sub, config = CONFIG.sub, level = game.L, beforeX = sub.vx, beforeY = sub.vy;
  const hit = Terrain.moveRect(level.terrain, sub, sub.vx, sub.vy, 0);
  const ceiling = surfaceAtX(subCenterX()) - 2;
  if (sub.y < ceiling) { sub.y = ceiling; if (sub.vy < 0) sub.vy = 0; }
  sub.x = clamp(sub.x, 0, level.width - sub.w);
  if (!hit.hitX && !hit.hitY) return;
  const impact = Math.hypot(hit.hitX ? beforeX : 0, hit.hitY ? beforeY : 0);
  if (hit.hitX) sub.vx = -beforeX * config.bounce;
  if (hit.hitY) sub.vy = -beforeY * config.bounce;
  if (impact > config.damageSpeed) hurtHull(impact);
  else if (impact > 0.3 && game.frame % 8 === 0) Sfx.play('scrape');
  if (impact > CONFIG.silt.speed && touchesSilt()) raiseSilt();
}

function touchesSilt() {
  const sub = game.sub, terrain = game.L.terrain;
  for (let x = Math.floor(sub.x) - 1; x <= Math.ceil(sub.x + sub.w); x += 2) {
    for (const y of [Math.floor(sub.y) - 1, Math.ceil(sub.y + sub.h)]) if (Terrain.get(terrain, x, y) === CONFIG.material.silt) return true;
  }
  return false;
}

function raiseSilt() {
  const config = CONFIG.silt;
  if (game.silt.length >= config.max) game.silt.shift();
  game.silt.push({ x: subCenterX(), y: subCenterY() + 4, r: 6, life: config.life });
}

function firePulse() {
  const sub = game.sub, battery = CONFIG.battery;
  if (sub.sonarT > 0 || sub.battery < battery.sonar) return;
  sub.sonarT = CONFIG.sonar.cooldown;
  sub.battery -= battery.sonar;
  game.pulses.push({ x: subCenterX(), y: subCenterY(), r: 0 });
  game.used.sonar = true;
  Sfx.play('sonar');
}

// The memory of the walls: cells seen in the lamp cone, in the halo around the sub, around a diver's light or on a sonar ring stay
// drawn (dimmed) on the map.
const cellOfPixel = pixel => Math.floor(pixel / CONFIG.cell);
function markSeen(x, y) {
  const level = game.L, cellX = cellOfPixel(x), cellY = cellOfPixel(y);
  if (cellX >= 0 && cellY >= 0 && cellX < level.seenWidth && cellY < level.seenHeight) level.seen[cellY * level.seenWidth + cellX] = 1;
}
function markDisc(centerX, centerY, radius) {
  const cell = CONFIG.cell;
  for (let y = centerY - radius; y <= centerY + radius; y += cell) for (let x = centerX - radius; x <= centerX + radius; x += cell) {
    if ((x - centerX) ** 2 + (y - centerY) ** 2 <= radius * radius) markSeen(x, y);
  }
}
function markCone(originX, originY, angle, half, length) {
  const cell = CONFIG.cell, directionX = Math.sin(angle), directionY = Math.cos(angle), cosine = Math.cos(half);
  for (let y = originY - length; y <= originY + length; y += cell) for (let x = originX - length; x <= originX + length; x += cell) {
    const deltaX = x - originX, deltaY = y - originY, distance = Math.hypot(deltaX, deltaY);
    if (distance <= length && deltaX * directionX + deltaY * directionY >= cosine * distance) markSeen(x, y);
  }
}

// The lamp points where the sub is going (or where it faces when still).
function lampAngle() {
  const sub = game.sub, speed = Math.hypot(sub.vx, sub.vy);
  if (speed < 0.2) return sub.face > 0 ? Math.PI / 2 : -Math.PI / 2;
  return Math.atan2(sub.vx, sub.vy);
}

function updateSight() {
  const sub = game.sub, lamp = CONFIG.lamp, sonar = CONFIG.sonar;
  markDisc(subCenterX(), subCenterY(), lamp.halo);
  if (sub.lamp) markCone(subCenterX(), subCenterY(), lampAngle(), lamp.half, lamp.length);
  // A diver is found when the light or the sonar reaches it; from then on its chemical light shows where it is.
  const seesDiver = diver => {
    const deltaX = diver.x + 4 - subCenterX(), deltaY = diver.y + 3 - subCenterY(), distance = Math.hypot(deltaX, deltaY);
    if (distance <= lamp.halo + 4) return true;
    if (!sub.lamp || distance > lamp.length) return false;
    const angle = lampAngle();
    return deltaX * Math.sin(angle) + deltaY * Math.cos(angle) >= Math.cos(lamp.half) * distance;
  };
  for (const diver of game.L.divers) {
    if (diver.state !== 'waiting') continue;
    if (!diver.found && seesDiver(diver)) diver.found = true;
    if (diver.found) markDisc(diver.x + 4, diver.y + 3, CONFIG.diver.light);
  }
  for (const pulse of game.pulses) {
    pulse.r += sonar.speed;
    for (let angle = 0; angle < Math.PI * 2; angle += 2 / pulse.r) markSeen(pulse.x + Math.cos(angle) * pulse.r, pulse.y + Math.sin(angle) * pulse.r);
    for (const diver of game.L.divers) {
      if (diver.found || diver.state !== 'waiting') continue;
      if (Math.abs(Math.hypot(diver.x + 4 - pulse.x, diver.y + 3 - pulse.y) - pulse.r) <= sonar.band) { diver.found = true; Sfx.play('echo'); }
    }
  }
  game.pulses = game.pulses.filter(pulse => pulse.r < sonar.range + sonar.show);
}
