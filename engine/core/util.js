// engine/core/util.js
'use strict';
const round = Math.round;
const clamp = (value, min, max) => (value < min ? min : value > max ? max : value);
const overlap = (rectA, rectB) => rectA.x < rectB.x + rectB.w && rectA.x + rectA.w > rectB.x && rectA.y < rectB.y + rectB.h && rectA.y + rectA.h > rectB.y;

function mulberry32(state) {
  return function () {
    state |= 0; state = (state + 0x6D2B79F5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}

// Every simulation random goes through here, never Math.random(): same seed + same inputs = same game (replays).
const Rng = {
  _f: mulberry32(1),
  seed(seedValue) { this._f = mulberry32(seedValue >>> 0); },
  next() { return this._f(); },
};
const randomRange = (min, max) => min + Rng.next() * (max - min);
const chance = probability => Rng.next() < probability;

function todayString() {
  const now = new Date();
  const twoDigits = value => String(value).padStart(2, '0');
  return now.getFullYear() + '-' + twoDigits(now.getMonth() + 1) + '-' + twoDigits(now.getDate());
}
