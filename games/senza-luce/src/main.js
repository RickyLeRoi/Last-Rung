// games/senza-luce/src/main.js
'use strict';
// Determinism: each attempt reseeds the simulation RNG and records every frame input;
// a replay feeds the same inputs to the same seed and gets the identical game.

function stepSimulation(input, frozen) {
  game.frame++;
  game.time = game.frame / 60;
  if (!frozen) game.clock++;
  updateWater();
  updateEnv();
  if (!frozen) updateBoat(input);
  updateSmokes();
  updatePatrols(frozen);
  updateAlert(frozen);
  checkCaught();
  updateCamera();
  if (game.L.tutorial) updateTutorial();
  updateParticles();
  if (game.msgT > 0) game.msgT--;
}

function newRun(spec, score) {
  game.spec = spec;
  game.L = genLevel(spec);
  game.parts = []; game.smokes = [];
  game.score = score;
  game.levelStartScore = score;
  game.frame = 0; game.time = 0; game.clock = 0;
  game.endT = 0; game.msgT = 0; game.bonus = 0; game.stars = 0; game.result = '';
  game.bolt = null; game.boltT = 0; game.flashT = 0; game.lightningT = 240;
  game.boat = newBoat(game.L.worldW);
  game.alert = 0; game.alarmT = 0; game.alarms = 0; game.seen = false; game.seenT = 0; game.lastSeen = null;
  game.camX = clamp(boatSightX() - CONFIG.W / 2, 0, game.L.worldW - CONFIG.W);
  game.used = { move: false, lane: false, engine: false, smoke: false };
  Rng.seed(spec.seed ^ 0x5bd1e995);
  initRain();
  game.tut = spec.tutorial ? { step: 0 } : null;
}

function skipTutorial() {
  game.tutDone = true;
  startLevel(levelSpec(1), 0);
}

// The run is won a moment after the boat enters the cove: one star for arriving, one for all the crates, one more if no alarm went off.
function checkEnd() {
  const level = game.L;
  if (!level.arrived) { game.endT = 0; return; }
  if (++game.endT <= 60) return;
  game.state = 'done';
  game.result = 'win';
  const allCrates = level.cratesTaken === level.crates.length;
  game.stars = 1 + (allCrates ? 1 : 0) + (allCrates && game.alarms === 0 ? 1 : 0);
  game.bonus = CONFIG.score.starBonus[game.stars];
  game.score += game.bonus;
  Sfx.play('win');
}

const urlParams = new URLSearchParams(location.search);
const startLevelNumber = Math.max(1, parseInt(urlParams.get('livello'), 10) || 1);
game.noTutorial = urlParams.has('livello');

const replayCodec = Replay.codec({ axes: ['hx', 'up', 'down'], flags: ['engine', 'smoke'] });
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
  stepInput: (input, edges) => ({ hx: input.hx, up: input.up, down: input.down, engine: edges.has('engine'), smoke: edges.has('smoke') }),
  beforeState(edges) {
    if (!(game.L.tutorial && game.state !== 'title' && (edges.has('skip') || (edges.has('replay') && game.state !== 'done' && game.state !== 'over' && game.state !== 'replay')))) return false;
    skipTutorial();
    return true;
  },
  afterStep() {
    Input.syncUI(game.state, { tut: !!(game.L.tutorial && game.state !== 'title') }, { '#bEngine': game.state === 'play' && !game.boat.engineOn });
    const engineRunning = isLive() && game.boat.engineOn;
    Sfx.update({ sea: game.L.rain, storm: game.L.rain, engine: engineRunning ? 1 : 0, throttle: Math.abs(game.boat.throttle) });
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
  debug: { name: '__senzaluce', expose: { game, CONFIG, Sfx } },
  testHook: {
    game, CONFIG, startLevel, levelSpec, dailySpec, tutorialSpec, startReplay, Rng, SPRITES,
    towerCone, patrolCone, coneContains, watchersSight, boatSightX, boatSightY, laneWaterlineY, patrolCenterX, smokeRadius, isInFogBank,
  },
});

startLevel(levelSpec(startLevelNumber), 0);
game.state = 'title';
Loop.start(flow.step, render);
