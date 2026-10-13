// games/sabbia/src/main.js
'use strict';
// Determinism: each attempt reseeds the simulation RNG and records every frame input;
// a replay feeds the same inputs to the same seed and gets the identical game.

function stepSimulation(input, frozen) {
  game.frame++;
  game.time = game.frame / 60;
  if (!frozen) { game.clock++; updateBrush(input); }
  const world = game.L.world;
  stepWorld(world);
  if (world.events.steam && game.frame % 6 === 0) Sfx.play('sizzle');
  if (world.events.ignite && game.frame % 10 === 0) Sfx.play('ignite');
  if (world.events.dissolve && game.frame % 12 === 0) Sfx.play('dissolve');
  if (game.L.tutorial) updateTutorial();
  if (game.msgT > 0) game.msgT--;
}

function newRun(spec, score) {
  game.spec = spec;
  game.L = genLevel(spec);
  game.score = score;
  game.levelStartScore = score;
  game.frame = 0; game.time = 0; game.clock = 0;
  game.endT = 0; game.msgT = 0; game.bonus = 0; game.stars = 0; game.result = '';
  game.cursor = newCursor();
  game.selected = 0; game.brushSize = CONFIG.brush.start; game.painted = 0;
  game.used = { move: false, paint: false, select: false };
  Rng.seed(spec.seed ^ 0x5bd1e995);
  game.tut = spec.tutorial ? { step: 0 } : null;
}

function skipTutorial() {
  game.tutDone = true;
  startLevel(levelSpec(1), 0);
}

function finish(win) {
  game.state = 'done';
  game.result = win ? 'win' : 'fail';
  const share = budgetLeftShare(), challenge = CONFIG.challenge;
  game.stars = !win ? 0 : share >= challenge.threeStars ? 3 : share >= challenge.twoStars ? 2 : 1;
  game.bonus = win ? CONFIG.score.win + Math.round(share * 100) * CONFIG.score.perBudgetLeft + CONFIG.score.starBonus[game.stars] : 0;
  game.score += game.bonus;
  Sfx.play(win ? 'win' : 'fail');
}

// The laboratory never ends; the tutorial ends with its steps; a challenge is won when its goal holds (for `settle` frames when the
// challenge asks for it), lost when its clock runs out or its own loss condition happens.
function checkEnd() {
  const level = game.L;
  if (level.lab) return;
  if (level.tutorial) { if (game.tut.step >= TUTORIAL.length && ++game.endT > 60) finish(true); return; }
  const goal = level.goal;
  if (goal.lost && goal.lost()) { gameOver(goal.lostReason); return; }
  if (goal.progress() >= 1) {
    if (++level.settledT >= (goal.settle || 30)) finish(true);
    return;
  }
  level.settledT = 0;
  if (game.clock >= level.time) finish(false);
}

const urlParams = new URLSearchParams(location.search);
const startLevelNumber = Math.max(1, parseInt(urlParams.get('livello'), 10) || 1);
game.noTutorial = urlParams.has('livello') || urlParams.has('laboratorio');

const replayCodec = Replay.codec({ axes: ['hx', 'up', 'down', 'paint'], flags: ['next', 'previous', 'size'] });
const startLevel = (spec, score) => flow.startRun(spec, score);
const startReplay = () => flow.startReplay();

const flow = Flow.create({
  run: game,
  audio: Sfx,
  idleInput: NO_INPUT,
  codec: replayCodec,
  message: showMessage,
  newRun,
  step: stepSimulation,
  checkEnd,
  stepInput: (input, edges) => ({ hx: input.hx, up: input.up, down: input.down, paint: input.paint, next: edges.has('next'), previous: edges.has('previous'), size: edges.has('size') }),
  beforeState(edges) {
    if (game.state === 'title' && edges.has('lab')) { startLevel(labSpec(), 0); return true; }
    if (!(game.L.tutorial && game.state !== 'title' && (edges.has('skip') || (edges.has('replay') && game.state !== 'done' && game.state !== 'over' && game.state !== 'replay')))) return false;
    skipTutorial();
    return true;
  },
  afterStep() {
    Input.syncUI(game.state, { tut: !!(game.L.tutorial && game.state !== 'title') }, {});
    const counts = game.L.world.counts;
    Sfx.update({ fire: Math.min(1, counts[MATERIAL.fire] / 150), steam: Math.min(1, counts[MATERIAL.steam] / 300) });
  },
  specs: {
    first: () => (urlParams.has('laboratorio') ? labSpec() : !game.tutDone && startLevelNumber === 1 && !game.noTutorial ? tutorialSpec() : levelSpec(startLevelNumber)),
    daily: date => dailySpec(date),
    next(finished) {
      if (finished.spec.tutorial) { game.tutDone = true; return { spec: levelSpec(1), score: 0 }; }
      if (finished.spec.daily) return { spec: levelSpec(startLevelNumber), score: 0, title: true };
      return { spec: levelSpec(finished.spec.n + 1), score: finished.score };
    },
  },
  introFrames: 240,
  debug: { name: '__sabbia', expose: { game, CONFIG, Sfx, MATERIAL } },
  testHook: {
    game, CONFIG, startLevel, levelSpec, dailySpec, tutorialSpec, labSpec, startReplay, Rng, MATERIAL, CHALLENGES,
    makeWorld, setCell, stepWorld, countMaterials, cellIndex, budgetLeftShare, materialName,
  },
});

startLevel(urlParams.has('laboratorio') ? labSpec() : levelSpec(startLevelNumber), 0);
game.state = 'title';
Loop.start(flow.step, render);
