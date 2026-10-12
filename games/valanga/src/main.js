// games/valanga/src/main.js
'use strict';
// Determinism: each attempt reseeds the simulation RNG and records every frame input;
// a replay feeds the same inputs to the same seed and gets the identical game.

function stepSimulation(input, frozen) {
  game.frame++;
  game.time = game.frame / 60;
  if (!frozen) game.clock++;
  updateEnv();
  if (!frozen) updateRescuer(input);
  updateAvalanche(frozen);
  if (settleSnow(crushUnder) > CONFIG.victim.collapseSound) Sfx.play('collapse');
  if (hitsGround(game.rescuer.x, game.rescuer.y, game.rescuer.w, game.rescuer.h)) liftOutOfSnow();
  updateAir(frozen);
  updateSignal(frozen);
  checkLost();
  updateCamera();
  if (game.L.tutorial) updateTutorial();
  updateParticles();
  if (game.msgT > 0) game.msgT--;
}

function newRun(spec, score) {
  game.spec = spec;
  game.L = genLevel(spec);
  game.parts = []; game.probeMarks = [];
  game.score = score;
  game.levelStartScore = score;
  game.frame = 0; game.time = 0; game.clock = 0;
  game.endT = 0; game.msgT = 0; game.bonus = 0; game.stars = 0; game.result = '';
  game.rescuer = newRescuer();
  game.signal = null; game.beepT = 0; game.avalanche = null; game.shake = 0;
  game.camX = clamp(rescuerCenterX() - CONFIG.W / 2, 0, game.L.width - CONFIG.W);
  game.camY = clamp(game.rescuer.y - CONFIG.H / 2, 0, game.L.height - CONFIG.H);
  game.used = { move: false, dig: false, probe: false };
  Rng.seed(spec.seed ^ 0x5bd1e995);
  initSnowfall();
  game.tut = spec.tutorial ? { step: 0 } : null;
}

function skipTutorial() {
  game.tutDone = true;
  startLevel(levelSpec(1), 0);
}

// The level ends a moment after nobody is buried any more: won with more than half saved.
function checkEnd() {
  const level = game.L;
  if (level.victims.some(victim => victim.state === 'buried')) { game.endT = 0; return; }
  if (++game.endT <= 80) return;
  game.state = 'done';
  const win = level.saved * 2 > level.total;
  game.result = win ? 'win' : 'fail';
  game.stars = !win ? 0 : level.saved === level.total ? 3 : level.saved >= level.total * CONFIG.score.twoStars ? 2 : 1;
  game.bonus = CONFIG.score.starBonus[game.stars];
  game.score += game.bonus;
  Sfx.play(win ? 'win' : 'fail');
}

const urlParams = new URLSearchParams(location.search);
const startLevelNumber = Math.max(1, parseInt(urlParams.get('livello'), 10) || 1);
game.noTutorial = urlParams.has('livello');

const replayCodec = Replay.codec({ axes: ['hx', 'up', 'down', 'dig'], flags: ['probe'] });
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
  stepInput: (input, edges) => ({ hx: input.hx, up: input.up, down: input.down, dig: input.dig, probe: edges.has('probe') }),
  beforeState(edges) {
    if (!(game.L.tutorial && game.state !== 'title' && (edges.has('skip') || (edges.has('replay') && game.state !== 'done' && game.state !== 'over' && game.state !== 'replay')))) return false;
    skipTutorial();
    return true;
  },
  afterStep() {
    Input.syncUI(game.state, { tut: !!(game.L.tutorial && game.state !== 'title') }, {});
    Sfx.update({ wind: game.L.storm ? 1 : 0.2, rumble: game.avalanche && game.avalanche.phase === 'run' ? 1 : 0 });
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
  debug: { name: '__valanga', expose: { game, CONFIG, Sfx } },
  testHook: {
    game, CONFIG, startLevel, levelSpec, dailySpec, tutorialSpec, startReplay, Rng, Terrain, SPRITES,
    readSignal, surfaceAt, rescuerCenterX, victimCenterX, victimCenterY, crushUnder,
  },
});

startLevel(levelSpec(startLevelNumber), 0);
game.state = 'title';
Loop.start(flow.step, render);
