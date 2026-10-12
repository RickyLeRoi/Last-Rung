// games/valanga/src/artva.js
'use strict';
// The ARTVA (avalanche transceiver) points at the nearest person still buried within range; its beeps get faster and higher on the way.
// Each buried person has air for a limited time; a person is free as soon as the shovel reaches the body from above. Snow that
// collapses onto a buried person (dug from the side, or from below) kills them.

const victimCenterX = victim => victim.x + CONFIG.victim.w / 2;
const victimCenterY = victim => victim.y + CONFIG.victim.h / 2;

// { victim, distance (px), strength 0..1 } of the nearest buried person within range, or null.
function readSignal() {
  const range = CONFIG.artva.range, x = rescuerCenterX(), y = game.rescuer.y + game.rescuer.h / 2;
  let best = null;
  for (const victim of game.L.victims) {
    if (victim.state !== 'buried') continue;
    const distance = Math.hypot(victimCenterX(victim) - x, victimCenterY(victim) - y);
    if (distance < range && (!best || distance < best.distance)) best = { victim, distance, strength: 1 - distance / range };
  }
  return best;
}

function beep(strength) {
  const config = CONFIG.artva;
  Sfx.play(strength > config.near ? 'beepNear' : strength > config.mid ? 'beepMid' : 'beepFar');
}

function updateSignal(frozen) {
  game.signal = frozen ? null : readSignal();
  if (!game.signal || !isLive()) { game.beepT = 0; return; }
  const config = CONFIG.artva, period = Math.round(config.slowBeep + (config.fastBeep - config.slowBeep) * game.signal.strength);
  if (++game.beepT >= period) { game.beepT = 0; beep(game.signal.strength); }
}

function freeVictim(victim) {
  const config = CONFIG.score, secondsLeft = victim.air === Infinity ? 0 : Math.floor(victim.air / 60), points = config.saved + secondsLeft * config.perSecond;
  victim.state = 'saved';
  game.L.saved++;
  game.score += points;
  Sfx.play('saved');
  showMessage('LIBERATO! +' + points, 100);
}

// The shovel stroke is a disc: it reaches a body when the disc, coming from above, touches the person's box.
function freeTouchedVictims(x, y, radius) {
  const config = CONFIG.victim;
  for (const victim of game.L.victims) {
    if (victim.state !== 'buried' || y >= victim.y) continue;
    const nearestX = clamp(x, victim.x, victim.x + config.w), nearestY = clamp(y, victim.y, victim.y + config.h);
    if (Math.hypot(nearestX - x, nearestY - y) <= radius) freeVictim(victim);
  }
}

// A falling cell landing in (or just over) a buried person's box adds to their crush count.
function crushUnder(x, y) {
  const config = CONFIG.victim;
  for (const victim of game.L.victims) {
    if (victim.state === 'buried' && x >= victim.x && x < victim.x + config.w && y >= victim.y - 3 && y < victim.y + config.h) victim.crush++;
  }
}

function loseVictim(victim, message) {
  victim.state = 'lost';
  game.L.lost++;
  Sfx.play('lost');
  showMessage(message, 120);
}

// A few grains from the walls of a shaft are harmless; a real collapse (many cells in a short time) is not.
function updateAir(frozen) {
  if (frozen || !isLive()) return;
  const config = CONFIG.victim;
  for (const victim of game.L.victims) {
    if (victim.state !== 'buried') continue;
    if (victim.crush > config.crush) { loseVictim(victim, "LA NEVE E' CROLLATA SUL SEPOLTO"); continue; }
    victim.crush = Math.max(0, victim.crush - config.crushDecay);
    if (victim.air !== Infinity && --victim.air <= 0) loseVictim(victim, "UN SEPOLTO NON CE L'HA FATTA");
  }
}

function gameOver(reason) {
  game.state = 'over';
  game.overT = 110;
  game.overReason = reason;
  Sfx.play('fail');
}

// The level is lost as soon as the people still buried cannot bring the saved ones above half.
function checkLost() {
  const level = game.L;
  if (level.tutorial || !isLive()) return;
  const buried = level.victims.filter(victim => victim.state === 'buried').length;
  if ((level.saved + buried) * 2 <= level.total) gameOver('TROPPI SEPOLTI PERSI');
}
