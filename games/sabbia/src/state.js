// games/sabbia/src/state.js
'use strict';
const game = {
  state: 'title',        // title | intro | play | pause | over | done | replay
  spec: null,
  L: null,               // the level: the world grid, the goal, the budgets
  parts: [],
  frame: 0, time: 0, clock: 0,
  cursor: null,          // { x, y } in cells
  selected: 0,           // index into the level palette
  brushSize: 1,
  painted: 0,
  used: { move: false, paint: false, select: false },
  score: 0, levelStartScore: 0, bonus: 0, stars: 0, result: '',
  msg: '', msgT: 0,
  overReason: '', overT: 0, endT: 0, introT: 0,
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
