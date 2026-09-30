'use strict';
const game = {
  state: 'title',        // title | intro | play | pause | over | done | replay
  spec: null,
  L: null,
  heli: null,
  parts: [],
  camX: 0, shake: 0,
  frame: 0, time: 0,     // simulation time (frozen while paused)
  wind: 0,
  score: 0, levelStartScore: 0, bonus: 0, stars: 0, result: '',
  msg: '', msgT: 0,
  overReason: '', overT: 0, endT: 0, introT: 0,
  rain: [], bolt: null, boltT: 0, flashT: 0, lightningT: 300,
  rec: null,
  replay: null,
  lastInput: null,
  tut: null,
  tutDone: false, noTutorial: false, forceNight: false, forceFog: false, softFlash: false,
};

function showMessage(message, duration) { game.msg = message; game.msgT = duration || 110; }
