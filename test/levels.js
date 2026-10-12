#!/usr/bin/env node
'use strict';
/*
 * Solvability check: for every person in levels 1-16 and 20 daily challenges, an autopilot restarts
 * from scratch and tries to rescue them (ladder hook, landing, or winch rescuer), then compares the
 * rescue frame against the person's time limit.
 *   node test/levels.js      (everything)
 *   node test/levels.js 7    (level 7 only)
 */
const { boot } = require('./harness');
const { rescueOne } = require('./autopilot');

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
