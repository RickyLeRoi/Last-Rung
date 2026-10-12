// games/senza-luce/src/watch.js
'use strict';
// The watchers: rotating lighthouses and patrol boats. They see the boat when its sight point is inside one of their cones (the same
// cones drawn on screen), unless a smoke screen is in between or the boat hides in a fog bank; under a full moon the patrols see farther.
// Being seen fills the alert; a full alert raises the alarm and the patrols chase the last place the boat was seen.

const PATROL_MAST = 7;   // column of the searchlight in the patrol sprite (bow on the left)

const towerLampY = () => CONFIG.sea.base - CONFIG.tower.lampHeight;
const lengthFactor = () => (game.L.fog ? CONFIG.fog.lengthFactor : 1);

// A rotating beam seen from the side: it lights one side of the tower, gets steeper and shorter while it turns toward the viewer, goes
// dark, then lights the other side. Returns null while the beam points toward or away from the viewer.
function towerCone(tower, clock) {
  const config = CONFIG.tower, facing = Math.cos((clock / tower.period) * Math.PI * 2 + tower.phase);
  if (Math.abs(facing) < config.minFacing) return null;
  return { x: tower.x, y: towerLampY(), pitch: Math.atan2(Math.tan(config.pitch), Math.abs(facing)), half: config.half, length: config.length * lengthFactor(), facing: Math.sign(facing) };
}

const patrolCenterX = patrol => patrol.x + SPRITES.patrol.w / 2;
const patrolWaterlineY = patrol => laneWaterlineY(patrolCenterX(patrol), patrol.laneF);
function patrolCone(patrol) {
  const config = CONFIG.patrol, lightX = patrol.x + (patrol.dir < 0 ? PATROL_MAST : SPRITES.patrol.w - 1 - PATROL_MAST), moonFactor = game.L.moon ? CONFIG.moon.factor : 1;
  return { x: lightX, y: patrolWaterlineY(patrol) - config.lightHeight, pitch: config.pitch, half: config.half, length: config.length * lengthFactor() * moonFactor, facing: patrol.dir };
}

const boatSightX = () => game.boat.x + SPRITES.boat.w / 2;
const boatSightY = () => laneWaterlineY(boatSightX(), game.boat.laneF) - CONFIG.boat.sightHeight;
const smokeRadius = smoke => { const config = CONFIG.smoke; return config.startRadius + (config.maxRadius - config.startRadius) * Math.min(1, smoke.t / config.growFrames); };

function segmentHitsCircle(startX, startY, endX, endY, centerX, centerY, radius) {
  const segmentX = endX - startX, segmentY = endY - startY, lengthSquared = segmentX * segmentX + segmentY * segmentY;
  const along = lengthSquared ? clamp(((centerX - startX) * segmentX + (centerY - startY) * segmentY) / lengthSquared, 0, 1) : 0;
  return Math.hypot(startX + segmentX * along - centerX, startY + segmentY * along - centerY) < radius;
}
const isScreenedBySmoke = (fromX, fromY, toX, toY) => game.smokes.some(smoke => segmentHitsCircle(fromX, fromY, toX, toY, smoke.x, smoke.y, smokeRadius(smoke)));
const isInFogBank = x => game.L.fogBanks.some(bank => x >= bank.x && x <= bank.x + bank.w);

// How close the watcher is (0 = at the end of its reach, 1 = right there), or -1 when it cannot see the point.
function sightFromCone(cone, x, y) {
  if (!cone || !coneContains(cone, x, y)) return -1;
  const distance = Math.hypot(x - cone.x, y - cone.y);
  if (isInFogBank(x) && distance > CONFIG.fog.seeDistance) return -1;
  if (isScreenedBySmoke(cone.x, cone.y, x, y)) return -1;
  return 1 - distance / cone.length;
}

// The best sight of the boat this frame (-1 = nobody sees it).
function watchersSight() {
  if (game.L.arrived) return -1;
  const x = boatSightX(), y = boatSightY();
  let best = -1;
  for (const tower of game.L.towers) best = Math.max(best, sightFromCone(towerCone(tower, game.clock), x, y));
  for (const patrol of game.L.patrols) best = Math.max(best, sightFromCone(patrolCone(patrol), x, y));
  return best;
}

function raiseAlarm() {
  game.alarmT = CONFIG.alert.alarmFrames;
  game.alarms++;
  for (const patrol of game.L.patrols) patrol.mode = 'chase';
  Sfx.play('alarm');
  showMessage('ALLARME! LE MOTOVEDETTE TI CERCANO', 120);
}

function endChase() {
  for (const patrol of game.L.patrols) { patrol.mode = 'patrol'; patrol.targetLane = patrol.homeLane; }
  game.alert = CONFIG.alert.afterAlarm;
  showMessage('TI HANNO PERSO DI VISTA', 90);
}

function updateAlert(frozen) {
  const config = CONFIG.alert;
  game.seen = false;
  if (frozen || !isLive()) return;
  const sight = watchersSight();
  game.seen = sight >= 0;
  if (game.seen) {
    game.alert = Math.min(config.max, game.alert + config.rise * (1 + config.nearBonus * sight));
    game.lastSeen = { x: boatSightX(), lane: game.boat.lane };
    if (game.seenT++ % config.seenSound === 0) Sfx.play('seen');
  } else game.seenT = 0;
  if (game.alarmT > 0) {
    if (game.seen) game.alarmT = config.alarmFrames;
    else if (--game.alarmT === 0) endChase();
  } else if (game.alert >= config.max) raiseAlarm();
  else if (!game.seen) game.alert = Math.max(0, game.alert - config.fall);
}

// A lightning flash shows the boat to every patrol close enough, unless it hides in the fog or in a smoke screen.
function revealByLightning() {
  if (!isLive() || game.L.arrived) return;
  const x = boatSightX(), y = boatSightY();
  if (isInFogBank(x) || game.smokes.some(smoke => Math.hypot(smoke.x - x, smoke.y - y) < smokeRadius(smoke))) return;
  if (!game.L.patrols.some(patrol => Math.abs(patrolCenterX(patrol) - x) < CONFIG.storm.sight)) return;
  game.alert = Math.min(CONFIG.alert.max, game.alert + CONFIG.storm.alert);
  game.lastSeen = { x, lane: game.boat.lane };
  showMessage('IL LAMPO TI HA SCOPERTO!', 80);
}

// Noise of the engine: every patrol within the radius turns toward it (suspicion, not an alarm). The ring ends at that radius.
function emitNoise(radius) {
  const x = boatSightX();
  addParticle({ t: 'ring', x, y: boatSightY(), r: 3, life: Math.round((radius - 3) / 1.6) });
  for (const patrol of game.L.patrols) {
    if (patrol.mode === 'chase' || Math.abs(patrolCenterX(patrol) - x) > radius) continue;
    if (patrol.mode !== 'suspect') Sfx.play('suspect');
    patrol.mode = 'suspect'; patrol.modeT = CONFIG.patrol.suspectFrames; patrol.targetX = x; patrol.targetLane = patrol.homeLane;
  }
}

function steerPatrol(patrol, targetX, speed) {
  const deltaX = targetX - patrolCenterX(patrol);
  if (Math.abs(deltaX) <= speed) return;
  patrol.dir = Math.sign(deltaX);
  patrol.x += patrol.dir * speed;
}

function updatePatrols(frozen) {
  if (frozen) return;
  const config = CONFIG.patrol;
  for (const patrol of game.L.patrols) {
    if (patrol.mode === 'chase' && game.lastSeen) {
      steerPatrol(patrol, game.lastSeen.x, config.chaseSpeed);
      patrol.targetLane = game.lastSeen.lane;
    } else if (patrol.mode === 'suspect') {
      steerPatrol(patrol, patrol.targetX, config.suspectSpeed);
      if (--patrol.modeT <= 0) patrol.mode = 'patrol';
    } else if (patrol.mode === 'patrol') {
      if (patrol.x <= patrol.x0) patrol.dir = 1; else if (patrol.x >= patrol.x1) patrol.dir = -1;
      patrol.x += patrol.dir * config.speed;
    }
    patrol.x = clamp(patrol.x, config.minX, game.L.worldW - SPRITES.patrol.w);
    patrol.laneF += clamp(patrol.targetLane - patrol.laneF, -config.laneSpeed, config.laneSpeed);
    if (chance(CONFIG.boat.wakeChance)) {
      const sternX = patrol.dir < 0 ? patrol.x + SPRITES.patrol.w : patrol.x;
      addParticle({ t: 'px', x: sternX, y: patrolWaterlineY(patrol), vx: -patrol.dir * randomRange(0.1, 0.5), vy: -randomRange(0.1, 0.5), g: 0.04, life: 25, drop: true });
    }
  }
}

function gameOver(reason) {
  game.state = 'over';
  game.overT = 110;
  game.overReason = reason;
  Sfx.play('fail');
}

// Touching a patrol in the same lane means capture; dawn lights the whole bay. The tutorial never ends this way.
function checkCaught() {
  const level = game.L;
  if (!isLive() || level.tutorial || level.arrived) return;
  const boat = game.boat, x = boatSightX();
  for (const patrol of level.patrols) {
    if (Math.abs(patrolCenterX(patrol) - x) < CONFIG.catch.distance && Math.abs(patrol.laneF - boat.laneF) < CONFIG.catch.lanes) {
      Sfx.play('caught');
      gameOver('CATTURATO DALLA MOTOVEDETTA');
      return;
    }
  }
  if (level.dawnAt && game.clock >= level.dawnAt) gameOver("E' SORTO IL SOLE: LA BAIA E' ILLUMINATA");
}
