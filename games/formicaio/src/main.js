// games/formicaio/src/main.js
'use strict';
// Determinism: each attempt reseeds the simulation RNG and records every frame input;
// a replay feeds the same inputs to the same seed and gets the identical game.
const NO_INPUT = Object.freeze({ hx: 0, up: 0, down: 0, trail: 0, chamber: false, recall: false, plug: false });

function updateCamera() {
  const level = game.L, cursor = game.cursor;
  game.camX = Camera.follow(game.camX, cursor.x - CONFIG.W / 2, level.width, CONFIG.W, 0.15);
  game.camY = Camera.follow(game.camY, cursor.y - CONFIG.H / 2, level.height, CONFIG.H, 0.15);
}

function stepSimulation(input, frozen) {
  game.frame++;
  game.time = game.frame / 60;
  if (!frozen) game.clock++;
  game.wind = Weather.wind(game.L.rainy ? 0.8 : 0.2, game.time);
  if (!frozen) updateCursor(input);
  updatePheromone();
  if (!frozen) {
    updateFoodSchedule();
    updateRain();
    if (settleSand() > 0 && game.frame % 20 === 0) Sfx.play('collapse');
    flowWater();
    updateChambers();
    updateAnts();
    updateSpiders();
    updateQueen();
    if (game.state !== 'over') updateBrood();
  }
  updateCamera();
  if (game.L.tutorial) updateTutorial();
  updateParticles();
  if (game.msgT > 0) game.msgT--;
}

function newRun(spec, score) {
  game.spec = spec;
  game.L = genLevel(spec);
  game.parts = []; game.rain = [];
  game.score = score;
  game.levelStartScore = score;
  game.frame = 0; game.time = 0; game.clock = 0;
  game.endT = 0; game.msgT = 0; game.bonus = 0; game.stars = 0; game.result = ''; game.goalSaid = false;
  game.ants = []; game.brood = []; game.nextAntId = 0;
  game.stock = CONFIG.chamber.baseStock / 2; game.layT = 0; game.queenWetT = 0; game.recall = false;
  game.used = { move: false, trail: false, chamber: false };
  game.cursor = newCursor();
  const chamber = game.L.queenChamber;
  for (let i = 0; i < CONFIG.ants.start; i++) spawnAnt(chamber.x + (i % 2 ? 3 : -3), chamber.y + 2);
  updateFields();
  game.camX = clamp(game.cursor.x - CONFIG.W / 2, 0, game.L.width - CONFIG.W);
  game.camY = clamp(game.cursor.y - CONFIG.H / 2, 0, game.L.height - CONFIG.H);
  Rng.seed(spec.seed ^ 0x5bd1e995);
  game.tut = spec.tutorial ? { step: 0 } : null;
}

function skipTutorial() {
  game.tutDone = true;
  startLevel(levelSpec(1), 0);
}

// The season decides: enough workers when winter comes. Reaching one and a half times the target ends the level early.
function checkEnd() {
  const level = game.L, workers = game.ants.length, target = level.target;
  if (!game.ants.length && !game.brood.length && game.stock < 1) { gameOver("LA COLONIA SI E' ESTINTA"); return; }
  if (workers >= target && !game.goalSaid) { game.goalSaid = true; showMessage(level.tutorial ? 'COLONIA AVVIATA!' : 'OBIETTIVO RAGGIUNTO: CONTINUA PER LE 3 STELLE', 150); Sfx.play('chamber'); }
  const tutorialOver = level.tutorial && game.tut && game.tut.step >= TUTORIAL.length;
  const seasonOver = game.clock >= level.season, bigEnough = level.tutorial ? tutorialOver : workers >= Math.ceil(target * CONFIG.target.threeStars);
  if (!seasonOver && !bigEnough) { game.endT = 0; return; }
  if (++game.endT <= 60) return;
  game.state = 'done';
  const win = workers >= target;
  game.result = win ? 'win' : 'fail';
  game.stars = !win ? 0 : workers >= Math.ceil(target * CONFIG.target.threeStars) ? 3 : level.lostBrood === 0 ? 2 : 1;
  game.bonus = CONFIG.score.starBonus[game.stars];
  game.score += game.bonus;
  Sfx.play(win ? 'win' : 'fail');
}

const urlParams = new URLSearchParams(location.search);
const startLevelNumber = Math.max(1, parseInt(urlParams.get('livello'), 10) || 1);
game.noTutorial = urlParams.has('livello');

const replayCodec = Replay.codec({ axes: ['hx', 'up', 'down', 'trail'], flags: ['chamber', 'recall', 'plug'] });
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
  stepInput: (input, edges) => ({ hx: input.hx, up: input.up, down: input.down, trail: input.trail, chamber: edges.has('chamber'), recall: edges.has('recall'), plug: edges.has('plug') }),
  beforeState(edges) {
    if (!(game.L.tutorial && game.state !== 'title' && (edges.has('skip') || (edges.has('replay') && game.state !== 'done' && game.state !== 'over' && game.state !== 'replay')))) return false;
    skipTutorial();
    return true;
  },
  afterStep() {
    Input.syncUI(game.state, { tut: !!(game.L.tutorial && game.state !== 'title'), rain: game.L.rainy }, { '#recallButton': game.recall });
    Sfx.update({ rain: game.rain.length ? 1 : 0 });
  },
  specs: {
    first: () => (!game.tutDone && startLevelNumber === 1 && !game.noTutorial ? tutorialSpec() : levelSpec(startLevelNumber)),
    daily: date => dailySpec(date),
    next(finished) {
      if (finished.spec.tutorial) { game.tutDone = true; return { spec: levelSpec(1), score: 0 }; }
      if (finished.spec.daily) return { spec: levelSpec(startLevelNumber), score: 0, title: true };
      return { spec: levelSpec(finished.spec.n + 1), score: finished.score };
    },
  },
  introFrames: 240,
  debug: { name: '__formicaio', expose: { game, CONFIG, Sfx } },
  testHook: {
    game, CONFIG, startLevel, levelSpec, dailySpec, tutorialSpec, startReplay, Rng, Terrain, SPRITES,
    cellOf, cellCenter, gridIndex, isWalkable, cellMaterial, fieldAt, updateFields, surfaceAt, foodY, antPosition, spawnAnt, stockCapacity, population,
  },
});

startLevel(levelSpec(startLevelNumber), 0);
game.state = 'title';
Loop.start(flow.step, render);
