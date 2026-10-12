// games/faro/src/state.js
'use strict';
const game = {
  state: 'title',        // title | intro | play | pause | over | done | replay
  spec: null,
  L: null,
  parts: [],
  camX: 0,
  frame: 0, time: 0,     // simulation time (frozen while paused)
  clock: 0,              // frames of real play, drives the ship schedule
  wind: 0,
  beam: { pitch: 0, spread: 0, on: true },
  oil: 0, sirenT: 0, sirenCool: 0, lampFlashT: 0,
  used: { move: false, spread: false, siren: false, flash: false },
  score: 0, levelStartScore: 0, bonus: 0, stars: 0, result: '',
  msg: '', msgT: 0,
  overReason: '', overT: 0, endT: 0, introT: 0,
  rain: [], bolt: null, boltT: 0, flashT: 0, lightningT: 300,
  rec: null,
  replay: null,
  tut: null,
  tutDone: false, noTutorial: false, softFlash: false,
};

function showMessage(message, duration) { game.msg = message; game.msgT = duration || 110; }
