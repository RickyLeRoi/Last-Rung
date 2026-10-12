// games/faro/src/main.js
'use strict';
// Determinism: each attempt reseeds the simulation RNG and records every frame input;
// a replay feeds the same inputs to the same seed and gets the identical game.
const NO_INPUT = Object.freeze({ hx: 0, up: 0, down: 0, drop: false, stab: false });

function stepSimulation(input, frozen) {
  game.frame++;
  game.time = game.frame / 60;
  updateWater();
  updateEnv();
  updateLamp(frozen ? NO_INPUT : input);
  updateShips(frozen);
  if (game.L.tutorial) updateTutorial();
  updateParticles();
  checkLost();
  if (game.msgT > 0) game.msgT--;
}

function newRun(spec, score) {
  game.spec = spec;
  game.L = genLevel(spec);
  game.parts = [];
  game.score = score;
  game.levelStartScore = score;
  game.frame = 0; game.time = 0; game.clock = 0;
  game.endT = 0; game.msgT = 0; game.bonus = 0; game.stars = 0; game.result = '';
  game.bolt = null; game.boltT = 0; game.flashT = 0; game.lightningT = 240;
  game.beam = { pitch: CONFIG.beam.start.pitch, spread: CONFIG.beam.start.spread, on: true };
  game.oil = CONFIG.oil.max; game.sirenT = 0; game.sirenCool = 0; game.lampFlashT = 0;
  game.used = { move: false, spread: false, siren: false, flash: false };
  Rng.seed(spec.seed ^ 0x5bd1e995);
  initRain();
  game.tut = spec.tutorial ? { step: 0 } : null;
}

function skipTutorial() {
  game.tutDone = true;
  startLevel(levelSpec(1), 0);
}

function checkEnd() {
  const level = game.L;
  if (level.ships.some(ship => ship.state === 'wait' || ship.state === 'sail')) { game.endT = 0; return; }
  if (++game.endT <= 80) return;
  game.state = 'done';
  const win = level.docked * 2 > level.total;
  game.result = win ? 'win' : 'fail';
  game.stars = !win ? 0 : level.sunk === 0 ? 3 : level.docked >= level.total * CONFIG.score.twoStars ? 2 : 1;
  game.bonus = CONFIG.score.starBonus[game.stars];
  game.score += game.bonus;
  Sfx.play(win ? 'win' : 'fail');
}

const urlParams = new URLSearchParams(location.search);
const startLevelNumber = Math.max(1, parseInt(urlParams.get('livello'), 10) || 1);
game.noTutorial = urlParams.has('livello');

const replayCodec = Replay.codec({ axes: ['hx', 'up', 'down'], flags: ['drop', 'stab'] });
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
  stepInput: (input, edges) => ({ hx: input.hx, up: input.up, down: input.down, drop: edges.has('drop'), stab: edges.has('stab') }),
  beforeState(edges) {
    if (!(game.L.tutorial && game.state !== 'title' && (edges.has('skip') || (edges.has('replay') && game.state !== 'done' && game.state !== 'over' && game.state !== 'replay')))) return false;
    skipTutorial();
    return true;
  },
  afterStep() {
    Input.syncUI(game.state, { tut: !!(game.L.tutorial && game.state !== 'title') }, {});
    Sfx.update({ sea: game.L.rain, storm: game.L.rain });
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
  introFrames: 210,
  debug: { name: '__faro', expose: { game, CONFIG, Sfx } },
  testHook: { game, CONFIG, startLevel, levelSpec, dailySpec, tutorialSpec, startReplay, waterSurfaceY, beamContains, beamFollows, steerLane, shipWaterlineY, SHIP_LIGHT_HEIGHT, Rng },
});

startLevel(levelSpec(startLevelNumber), 0);
game.state = 'title';
Loop.start(flow.step, render);
