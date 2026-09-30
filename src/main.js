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

function startLevel(spec, score) {
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
  game.state = 'intro';
  game.introT = 210;
  game.rec = { spec, score, introFrames: 0, frames: [] };
  game.replay = null;
  game.tut = spec.tutorial ? { step: 0 } : null;
}

const restartLevel = () => startLevel(game.spec, game.levelStartScore);
const startGame = () => startLevel(!game.tutDone && startLevelNumber === 1 && !game.noTutorial ? tutorialSpec() : levelSpec(startLevelNumber), 0);
function skipTutorial() {
  game.tutDone = true;
  startLevel(levelSpec(1), 0);
}
const startDaily = () => startLevel(dailySpec(todayString()), 0);

function encodeInput(stepInput) {
  return [round(stepInput.hx * 100), round(stepInput.up * 100), round(stepInput.down * 100), (stepInput.stab ? 1 : 0) | (stepInput.drop ? 2 : 0) | (stepInput.buoy ? 4 : 0) | (stepInput.bucket ? 8 : 0), round(stepInput.winch * 100)];
}
function decodeInput(frame) {
  return { hx: frame[0] / 100, up: frame[1] / 100, down: frame[2] / 100, stab: !!(frame[3] & 1), drop: !!(frame[3] & 2), buoy: !!(frame[3] & 4), bucket: !!(frame[3] & 8), winch: (frame[4] || 0) / 100 };
}

function startReplay() {
  const recording = game.rec;
  if (!recording || !recording.frames.length) return;
  startLevel(recording.spec, recording.score);
  game.rec = recording;                    // keep the original recording
  game.replay = { rec: recording, i: 0, introLeft: recording.introFrames };
  game.state = 'replay';
}

function replayStep() {
  const replayState = game.replay;
  if (replayState.introLeft > 0) { replayState.introLeft--; stepSimulation(NO_INPUT, true); return; }
  const frame = replayState.rec.frames[replayState.i++];
  if (!frame) { game.state = 'over'; game.overT = 0; game.overReason = 'REPLAY TERMINATO'; return; }
  stepSimulation(decodeInput(frame), false);
  if (game.state === 'replay') checkEnd();
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

let startLevelNumber = 1;

function stepGameState() {
  const input = Input.sample();
  const edges = input.edges;
  if (edges.has('mute')) showMessage(Sfx.toggleMute() ? 'AUDIO DISATTIVATO' : 'AUDIO ATTIVO', 60);
  if (edges.has('confirm')) Sfx.play('ui');
  if (edges.has('flash')) { game.softFlash = !game.softFlash; showMessage('LAMPI DEI FULMINI: ' + (game.softFlash ? 'RIDOTTI' : 'PIENI'), 80); }
  if (game.L.tutorial && game.state !== 'title' && (edges.has('skip') || (edges.has('replay') && game.state !== 'done' && game.state !== 'over' && game.state !== 'replay'))) {
    skipTutorial();
    return;
  }

  switch (game.state) {
    case 'title':
      stepSimulation(NO_INPUT, true);
      if (edges.has('confirm') || edges.has('drop')) startGame();
      else if (edges.has('daily') || edges.has('replay')) startDaily();
      break;

    case 'intro':
      stepSimulation(NO_INPUT, true);
      game.rec.introFrames++;
      if (--game.introT <= 0 || edges.has('confirm')) game.state = 'play';
      break;

    case 'play': {
      if (edges.has('pause')) { game.state = 'pause'; break; }
      if (edges.has('restart')) { restartLevel(); break; }
      const stepInput = { hx: input.hx, up: input.up, down: input.down, winch: input.winch, stab: edges.has('stab'), drop: edges.has('drop'), buoy: edges.has('buoy'), bucket: edges.has('bucket') };
      game.rec.frames.push(encodeInput(stepInput));
      stepSimulation(stepInput, false);
      if (game.state === 'play') checkEnd();
      break;
    }

    case 'pause':
      if (edges.has('pause') || edges.has('confirm')) game.state = 'play';
      else if (edges.has('restart')) restartLevel();
      break;

    case 'replay':
      if (edges.has('confirm') || edges.has('replay')) {
        for (let i = 0; i < 200000 && game.state === 'replay'; i++) replayStep();
      } else replayStep();
      break;

    case 'over':
      stepSimulation(NO_INPUT, false);
      if (game.overT > 0) game.overT--;
      else if (edges.has('replay')) startReplay();
      else if (edges.has('confirm') || edges.has('restart')) restartLevel();
      break;

    case 'done':
      stepSimulation(NO_INPUT, true);
      if (edges.has('replay')) startReplay();
      else if (edges.has('restart')) restartLevel();
      else if (edges.has('confirm')) {
        if (game.result !== 'win') restartLevel();
        else if (game.spec.tutorial) skipTutorial();
        else if (game.spec.daily) { startLevel(levelSpec(startLevelNumber), 0); game.state = 'title'; }
        else startLevel(levelSpec(game.spec.n + 1), game.score);
      }
      break;
  }

  const heli = game.heli;
  Input.syncUI(game.state, heli.stab && heli.state === 'fly', !!(game.L.tutorial && game.state !== 'title'), game.L.sc.id === 'fire');
  const rotor = heli.state === 'dead' ? 0 : game.state === 'title' ? 0.35 : heli.spin;
  Sfx.update({ rotor, thrust: heli.engineOff ? 0 : heli.up || 0, storm: game.L.rain, water: heli.wf || 0, winch: game.state === 'play' && heli.winchMoving ? 1 : 0 });
}

const urlParams = new URLSearchParams(location.search);
startLevelNumber = Math.max(1, parseInt(urlParams.get('livello'), 10) || 1);
game.noTutorial = urlParams.has('livello');
game.forceNight = urlParams.has('notte');
game.forceFog = urlParams.has('nebbia');
let prefersReducedMotion = false;
try { prefersReducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (error) { /* matchMedia may be unavailable */ }
game.softFlash = urlParams.get('lampi') === '0' || prefersReducedMotion;
if (urlParams.has('debug')) window.__eli = { game, CONFIG, Sfx };
startLevel(levelSpec(startLevelNumber), 0);
game.state = 'title';

let lastFrameTime = performance.now(), accumulatedTime = 0;
const STEP_MS = 1000 / 60;
function mainLoop(now) {
  accumulatedTime += Math.min(250, now - lastFrameTime);
  lastFrameTime = now;
  while (accumulatedTime >= STEP_MS) { stepGameState(); accumulatedTime -= STEP_MS; }
  render();
  requestAnimationFrame(mainLoop);
}
requestAnimationFrame(mainLoop);

// hook for automated tests (absent in the browser)
if (typeof __TEST_HOOK__ === 'function') {
  __TEST_HOOK__({ game, CONFIG, startLevel, levelSpec, dailySpec, tutorialSpec, startReplay, loadCount, maxSpeed, heliRects, ladderRects, addParticle, Rng });
}
