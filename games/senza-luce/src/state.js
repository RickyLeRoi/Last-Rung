// games/senza-luce/src/state.js
'use strict';
const game = {
  state: 'title',        // title | intro | play | pause | over | done | replay
  spec: null,
  L: null,
  parts: [],
  camX: 0,
  frame: 0, time: 0,     // simulation time (frozen while paused)
  clock: 0,              // frames of real play: drives the towers and the dawn
  wind: 0,
  boat: null,
  smokes: [],
  alert: 0, alarmT: 0, alarms: 0, seen: false, seenT: 0, lastSeen: null,
  used: { move: false, lane: false, engine: false, smoke: false },
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

// Outcomes are decided while playing and while replaying the same inputs, never in the menus.
const isLive = () => game.state === 'play' || game.state === 'replay';
