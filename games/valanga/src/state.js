// games/valanga/src/state.js
'use strict';
const game = {
  state: 'title',        // title | intro | play | pause | over | done | replay
  spec: null,
  L: null,
  parts: [],
  camX: 0, camY: 0, shake: 0,
  frame: 0, time: 0,     // simulation time (frozen while paused)
  clock: 0,              // frames of real play: drives the air of the buried and the avalanches
  wind: 0,
  rescuer: null,
  signal: null, beepT: 0,
  avalanche: null,
  probeMarks: [],
  used: { move: false, dig: false, probe: false },
  score: 0, levelStartScore: 0, bonus: 0, stars: 0, result: '',
  msg: '', msgT: 0,
  overReason: '', overT: 0, endT: 0, introT: 0,
  rain: [],
  rec: null,
  replay: null,
  tut: null,
  tutDone: false, noTutorial: false, softFlash: false,
};

function showMessage(message, duration) { game.msg = message; game.msgT = duration || 110; }

// Outcomes are decided while playing and while replaying the same inputs, never in the menus.
const isLive = () => game.state === 'play' || game.state === 'replay';
