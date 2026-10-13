// games/formicaio/src/state.js
'use strict';
const game = {
  state: 'title',        // title | intro | play | pause | over | done | replay
  spec: null,
  L: null,
  parts: [],
  camX: 0, camY: 0, shake: 0,
  frame: 0, time: 0,     // simulation time (frozen while paused)
  clock: 0,              // frames of real play: drives the season, the brood, the food and the rain
  wind: 0,
  cursor: null,          // { x, y, lastCellX, lastCellY, painting }
  ants: [], brood: [], nextAntId: 0,
  stock: 0, layT: 0, queenWetT: 0,
  recall: false,
  used: { move: false, trail: false, chamber: false },
  score: 0, levelStartScore: 0, bonus: 0, stars: 0, result: '',
  msg: '', msgT: 0, goalSaid: false, rainSaid: -1,
  overReason: '', overT: 0, endT: 0, introT: 0,
  rain: [],
  rec: null,
  replay: null,
  tut: null,
  tutDone: false, noTutorial: false, softFlash: false,
};

function showMessage(message, duration) { game.msg = message; game.msgT = duration || 110; }

function gameOver(reason) {
  game.state = 'over';
  game.overT = 110;
  game.overReason = reason;
  Sfx.play('fail');
}
