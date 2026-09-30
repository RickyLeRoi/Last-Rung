#!/usr/bin/env node
'use strict';
/*
 * Solvability check: for every person in levels 1-16 and 20 daily challenges, an autopilot restarts
 * from scratch and tries to rescue them (ladder hook, landing, or winch rescuer), then compares the
 * rescue frame against the person's time limit.
 *   node test/levels.js      (everything)
 *   node test/levels.js 7    (level 7 only)
 */
const { boot, flyTo, goTo } = require('./harness');

const CRUISE = 26;
const placeHeli = (driver, x, y) => { const heli = driver.game.heli; heli.ground = null; heli.x = x; heli.y = y; heli.px = x; heli.py = y; heli.vx = heli.vy = 0; };

function landingSpot(game, rooftop, nearX) {
  const obstacleRanges = [];
  for (const hazard of game.L.haz) if (hazard.x1 >= rooftop.x - 2 && hazard.x0 <= rooftop.x + rooftop.w + 2 && hazard.y0 < rooftop.y) obstacleRanges.push([hazard.x0 - 2, hazard.x1 + 2]);
  for (const person of game.L.people) if (person.state === 'stand' && person.on === rooftop) obstacleRanges.push([person.x, person.x + 7]);
  for (const fire of game.L.fires) if (fire.x < rooftop.x + rooftop.w + 8 && fire.x + fire.w > rooftop.x - 8 && Math.abs(fire.y - rooftop.y) < 3) obstacleRanges.push([fire.x - 9, fire.x + fire.w + 9]);
  let bestCenterX = null, bestScore = -1e9;
  for (let centerX = rooftop.x + 17; centerX <= rooftop.x + rooftop.w - 17; centerX++) {
    let clearance = 1e9;
    for (const range of obstacleRanges) clearance = Math.min(clearance, Math.max(range[0] - (centerX + 16), (centerX - 16) - range[1]));
    if (clearance < 2) continue;
    const candidateScore = Math.min(clearance, 10) - Math.abs(centerX - nearX) * 0.05;
    if (candidateScore > bestScore) { bestScore = candidateScore; bestCenterX = centerX; }
  }
  return bestCenterX;
}

function deliver(driver) {
  const game = driver.game, safeZone = game.L.safe, heli = game.heli;
  if (heli.stab) driver.tap('KeyX');
  driver.keyDown('KeyQ');
  goTo(driver, () => heli.x + 16, () => CRUISE, 2, 600);
  driver.keyUp('KeyQ');
  goTo(driver, () => safeZone.x + safeZone.w / 2, () => CRUISE, 1.6, 3000);
  for (let i = 0; i < 1500 && heli.state === 'fly' && game.state === 'play' && driver.hook.loadCount() > 0; i++) flyTo(driver, safeZone.x + safeZone.w / 2, safeZone.y - 6, 0.5);
}

function hookFromAbove(driver, person, isDone) {
  const game = driver.game, heli = game.heli;
  goTo(driver, () => person.x + 3.5, () => CRUISE, 2, 3000);
  if (!heli.stab) driver.tap('KeyX');
  let lowered = false;
  for (let i = 0; i < 3000 && !isDone() && heli.state === 'fly' && game.state === 'play'; i++) {
    const hookRect = driver.hook.ladderRects(heli).hook;
    const deltaX = (person.x + 3.5) - (hookRect.x + 2), heliBottomY = heli.y + 16;
    const clearBelow = !game.L.solids.some(solid => solid.x < heli.x + 32 && solid.x + solid.w > heli.x && solid.y > heliBottomY - 1 && solid.y < heliBottomY + 4)
      && !game.L.haz.some(hazard => hazard.x1 >= heli.x && hazard.x0 <= heli.x + 32 && hazard.y0 > heliBottomY - 1 && hazard.y0 < heliBottomY + 6);
    const targetBottomY = person.y - 22;
    const keys = [deltaX > 1 ? 'ArrowRight' : deltaX < -1 ? 'ArrowLeft' : ''];
    if (heliBottomY < targetBottomY - 2 && clearBelow) keys.push('ArrowDown'); else if (heliBottomY > targetBottomY + 2) keys.push('ArrowUp');
    else if (!lowered) { driver.keyDown('KeyE'); lowered = true; }
    driver.set(keys); driver.tick();
  }
  driver.keyUp('KeyE');
}

function landOn(driver, rooftop, landingX, person, isDone) {
  const game = driver.game, heli = game.heli;
  if (heli.stab) driver.tap('KeyX');
  goTo(driver, () => landingX, () => CRUISE, 1.5, 3000);
  goTo(driver, () => landingX, () => rooftop.y - 14, 0.8, 3000);
  for (let i = 0; i < 900 && !heli.ground && heli.state === 'fly'; i++) flyTo(driver, landingX, rooftop.y + 2, 0.45);
  if (!heli.ground) return;
  const direction = person.x + 3.5 > heli.x + 16 ? 1 : -1;
  if (heli.face !== direction) driver.hold([direction > 0 ? 'ArrowRight' : 'ArrowLeft'], 2);
  for (let i = 0; i < 1500 && !isDone(); i++) { driver.set([]); driver.tick(); }
}

function rescueOne(spec, personIndex) {
  const driver = boot(); const game = driver.play(spec);
  const level = game.L, person = level.people[personIndex];
  const limit = person.tmax > 0 ? person.tmax : Infinity;
  for (const otherPerson of level.people) { otherPerson.timer = 1e9; otherPerson.tmax = 0; }   // only reachability counts here; timing is compared afterwards
  const taken = () => person.state === 'hang' || person.state === 'aboard' || person.state === 'saved';   // not 'carried': the rescuer has not climbed back up yet
  goTo(driver, () => game.heli.x + 16, () => CRUISE, 2, 600);
  let method;
  if (person.state === 'float') { method = 'aggancio'; hookFromAbove(driver, person, taken); }
  else if (person.state === 'stand') {
    const rooftop = person.on, landingX = landingSpot(game, rooftop, person.x + 3.5);
    if (landingX !== null) { method = 'atterraggio'; landOn(driver, rooftop, landingX, person, taken); }
    if (!taken()) {
      method = (method ? method + '+' : '') + (person.injured ? 'soccorritore' : 'scaletta');
      if (game.heli.ground) { driver.hold(['ArrowUp'], 30); }
      hookFromAbove(driver, person, taken);
    }
  }
  const rescueFrame = game.frame;
  if (taken()) deliver(driver);
  const isRescued = person.state === 'saved';
  return { ok: isRescued, how: method, frames: rescueFrame, late: isRescued && rescueFrame > limit, limit, reason: isRescued ? '' : person.state + ' ' + game.heli.state + ' ' + (game.overReason || game.msg) };
}

const onlyLevel = process.argv[2] ? +process.argv[2] : 0;
const specs = [];
const testHook = boot().hook;
for (let levelNumber = 1; levelNumber <= 16; levelNumber++) if (!onlyLevel || onlyLevel === levelNumber) specs.push(['livello ' + levelNumber, testHook.levelSpec(levelNumber)]);
if (!onlyLevel) for (let dayIndex = 0; dayIndex < 20; dayIndex++) { const date = '2026-10-' + String(dayIndex + 1).padStart(2, '0'); specs.push(['sfida ' + date, testHook.dailySpec(date)]); }

let fails = 0, persons = 0;
const startTimeMs = Date.now();
for (const [name, spec] of specs) {
  const personCount = boot().play(spec).L.people.length, failureMessages = [];
  let lateCount = 0, savedCount = 0;
  for (let i = 0; i < personCount; i++) {
    const result = rescueOne(spec, i);
    persons++;
    if (result.ok) savedCount++;
    if (!result.ok) failureMessages.push('#' + i + ' ' + result.how + ': ' + result.reason);
    if (result.late) lateCount++;
  }
  const game = boot().play(spec), total = game.L.total;
  const need = Math.floor(total / 2) + 1;
  const okLevel = failureMessages.length === 0;
  if (!okLevel) fails++;
  console.log((okLevel ? '  OK   ' : '  FAIL ') + name + ': ' + savedCount + '/' + personCount + ' raggiungibili' + (lateCount ? ', ' + lateCount + ' fuori tempo per il pilota automatico' : '') + ' (servono ' + need + ' su ' + total + ')' + (failureMessages.length ? '\n         ' + failureMessages.join('\n         ') : ''));
}
console.log('\n' + persons + ' persone in ' + ((Date.now() - startTimeMs) / 1000).toFixed(0) + ' s: ' + (fails ? fails + ' livelli con persone irraggiungibili' : 'tutti i livelli risolvibili'));
process.exit(fails ? 1 : 0);
