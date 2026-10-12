#!/usr/bin/env node
// games/faro/test/levels.js
'use strict';
/*
 * Solvability: the scripted keeper (autopilot.js) wins levels 1-9 and at least 10 of the 12 fixed levels, and at least 15 of 20 daily
 * challenges. The keeper is a heuristic, not an oracle: it ignores part of the interplay between ships, so a few losses are allowed up to the
 * stated limits (they point at the hardest levels), losses on the first nine levels are not.
 *   node games/faro/test/levels.js        everything (~1 minute)
 *   node games/faro/test/levels.js 7      level 7 only
 */
const { playLevel } = require('./autopilot');
const { boot } = require('./helpers');

const FIXED_LEVELS = 12, MUST_WIN_LEVELS = 9, FIXED_MIN_WINS = 10;
const DAILY_DAYS = 20, DAILY_MIN_WINS = 15;

const only = process.argv[2] ? Number(process.argv[2]) : null;
const hook = boot({ seededMath: 1 }).hook;
const won = result => result.state === 'done' && result.driver.game.result === 'win';
let failures = 0, fixedWins = 0;
const startTime = Date.now();

for (let level = 1; level <= FIXED_LEVELS; level++) {
  if (only && only !== level) continue;
  const result = playLevel(hook.levelSpec(level));
  const isWon = won(result), mustWin = level <= MUST_WIN_LEVELS;
  console.log((isWon ? '  OK   ' : mustWin ? '  FAIL ' : '  --   ') + 'livello ' + level + ': ' + result.docked + '/' + result.total + ' al porto, ' + result.sunk + ' affondate, ' + result.frames + ' frame');
  if (isWon) fixedWins++;
  if (!isWon && mustWin) failures++;
}
if (!only && fixedWins < FIXED_MIN_WINS) { failures++; console.log('  FAIL livelli fissi vinti: ' + fixedWins + '/' + FIXED_LEVELS + ' (minimo ' + FIXED_MIN_WINS + ')'); }
if (!only) {
  let wins = 0;
  const losses = [];
  for (let day = 1; day <= DAILY_DAYS; day++) {
    const date = '2026-10-' + String(day).padStart(2, '0');
    const result = playLevel(hook.dailySpec(date));
    if (won(result)) wins++; else losses.push(date + ' (' + result.docked + '/' + result.total + ')');
  }
  const enough = wins >= DAILY_MIN_WINS;
  console.log((enough ? '  OK   ' : '  FAIL ') + 'sfide del giorno: ' + wins + '/' + DAILY_DAYS + ' vinte (minimo ' + DAILY_MIN_WINS + ')' + (losses.length ? ', perse: ' + losses.join(', ') : ''));
  if (!enough) failures++;
}
console.log('\n' + (failures ? failures + ' controlli falliti' : 'livelli risolvibili') + ' in ' + Math.round((Date.now() - startTime) / 1000) + ' s');
process.exit(failures ? 1 : 0);
