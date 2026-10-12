'use strict';
// Determinism: each attempt reseeds the simulation RNG and records every frame input;
// a replay feeds the same inputs to the same seed and gets the identical game.

function stepSimulation(input, frozen) {
  game.frame++;
  game.time = game.frame / 60;
  updateWater();
  updateEnv();
  updateHeli(input, frozen);
  updatePeople();
  updateBuoys();
  updateBucket();
  if (game.L.tutorial) updateTutorial();
  updateParticles();
  updateCamera();
  if (game.msgT > 0) game.msgT--;
}

function newRun(spec, score) {
  game.spec = spec;
  game.L = genLevel(spec);
  game.parts = [];
  game.score = score;
  game.levelStartScore = score;
  game.frame = 0; game.time = 0;
  game.endT = 0; game.msgT = 0; game.bonus = 0; game.stars = 0; game.result = '';
  game.bolt = null; game.boltT = 0; game.flashT = 0; game.lightningT = 240; game.shake = 0;
  Rng.seed(spec.seed ^ 0x5bd1e995);
  game.heli = newHeli();
  game.camX = clamp(game.heli.x + 16 - CONFIG.W / 2, 0, game.L.worldW - CONFIG.W);
  initRain();
  game.tut = spec.tutorial ? { step: 0 } : null;
}

function skipTutorial() {
  game.tutDone = true;
  startLevel(levelSpec(1), 0);
}

function checkEnd() {
  const level = game.L;
  if (game.heli.state !== 'fly') return;
  if (level.people.some(isActive)) { game.endT = 0; return; }
  if (++game.endT <= 80) return;
  game.state = 'done';
  const win = level.saved * 2 > level.total;
  game.result = win ? 'win' : 'fail';
  game.stars = !win ? 0 : level.dead === 0 ? 3 : level.saved >= level.total * CONFIG.score.twoStars ? 2 : 1;
  game.bonus = CONFIG.score.starBonus[game.stars];
  game.score += game.bonus;
  Sfx.play(win ? 'win' : 'fail');
}

const urlParams = new URLSearchParams(location.search);
const startLevelNumber = Math.max(1, parseInt(urlParams.get('livello'), 10) || 1);
game.noTutorial = urlParams.has('livello');
game.forceNight = urlParams.has('notte');
game.forceFog = urlParams.has('nebbia');
let prefersReducedMotion = false;
try { prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (error) { /* matchMedia may be unavailable */ }
game.softFlash = urlParams.get('lampi') === '0' || prefersReducedMotion;

const replayCodec = Replay.codec({ axes: ['hx', 'up', 'down', 'winch'], flags: ['stab', 'drop', 'buoy', 'bucket'] });
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
  stepInput: (input, edges) => ({ hx: input.hx, up: input.up, down: input.down, winch: input.winch, stab: edges.has('stab'), drop: edges.has('drop'), buoy: edges.has('buoy'), bucket: edges.has('bucket') }),
  beforeState(edges) {
    if (!(game.L.tutorial && game.state !== 'title' && (edges.has('skip') || (edges.has('replay') && game.state !== 'done' && game.state !== 'over' && game.state !== 'replay')))) return false;
    skipTutorial();
    return true;
  },
  afterStep() {
    const heli = game.heli;
    Input.syncUI(game.state, { tut: !!(game.L.tutorial && game.state !== 'title'), fire: game.L.sc.id === 'fire' }, { '#bStab': heli.stab && heli.state === 'fly' });
    const rotor = heli.state === 'dead' ? 0 : game.state === 'title' ? 0.35 : heli.spin;
    Sfx.update({ rotor, thrust: heli.engineOff ? 0 : heli.up || 0, storm: game.L.rain, water: heli.wf || 0, winch: game.state === 'play' && heli.winchMoving ? 1 : 0 });
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
  debug: { name: '__eli', expose: { game, CONFIG, Sfx } },
  testHook: { game, CONFIG, startLevel, levelSpec, dailySpec, tutorialSpec, startReplay, loadCount, maxSpeed, heliRects, ladderRects, addParticle, Rng },
});

startLevel(levelSpec(startLevelNumber), 0);
game.state = 'title';
Loop.start(flow.step, render);
