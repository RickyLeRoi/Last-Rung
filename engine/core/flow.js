// engine/core/flow.js
'use strict';
/*
 * Game flow state machine: title -> intro -> play <-> pause -> over | done, plus replay.
 * Determinism: each run reseeds the simulation RNG (in the game's newRun) and records every played frame's input; a replay feeds the
 * same inputs to the same seed and gets the identical game.
 *
 * `run` is the game's state object. The engine reads and writes these fields on it: state, introT, overT, overReason, rec, replay,
 * spec, score, levelStartScore, result, softFlash.
 *
 * Flow.create({
 *   run, audio,              audio = { toggleMute(): muted, play(name) }
 *   idleInput,               simulation input when nobody plays
 *   codec,                   Replay.codec(...) of the simulation input
 *   message(text, frames),   on-screen toast
 *   newRun(spec, score),     builds the level and reseeds Rng; must set run.spec, run.score and run.levelStartScore
 *   step(input, frozen),     one simulation step (frozen: the world runs but the player cannot act)
 *   checkEnd(),              sets run.state = 'done' (and result/stars/score) when the level is over
 *   stepInput(input, edges), composes the simulation input from a sampled Input frame
 *   beforeState(edges),      optional; return true when the game consumed the frame (the state machine is skipped)
 *   afterStep(),             optional; after every handled frame (UI sync, sound levels)
 *   specs: { first(), daily(date), next(run) -> { spec, score, title } },
 *   introFrames,
 *   debug: { name, expose },   exposed as window[name] when the URL has ?debug
 *   testHook,                  handed to __TEST_HOOK__ when the test harness defines it
 * })
 * Returns { step, startRun, restart, startReplay }.
 */
const Flow = {
  create({ run, audio, idleInput, codec, message, newRun, step, checkEnd, stepInput, beforeState, afterStep, specs, introFrames, debug, testHook }) {
    function startRun(spec, score) {
      newRun(spec, score);
      run.state = 'intro';
      run.introT = introFrames;
      run.rec = { spec, score, introFrames: 0, frames: [] };
      run.replay = null;
    }

    const restart = () => startRun(run.spec, run.levelStartScore);

    function startReplay() {
      const recording = run.rec;
      if (!recording || !recording.frames.length) return;
      startRun(recording.spec, recording.score);
      run.rec = recording;                    // keep the original recording
      run.replay = { rec: recording, i: 0, introLeft: recording.introFrames };
      run.state = 'replay';
    }

    function replayStep() {
      const replayState = run.replay;
      if (replayState.introLeft > 0) { replayState.introLeft--; step(idleInput, true); return; }
      const frame = replayState.rec.frames[replayState.i++];
      if (!frame) { run.state = 'over'; run.overT = 0; run.overReason = STRINGS.replayEnded; return; }
      step(codec.decode(frame), false);
      if (run.state === 'replay') checkEnd();
    }

    function stepFrame() {
      const input = Input.sample();
      const edges = input.edges;
      if (edges.has('mute')) message(audio.toggleMute() ? STRINGS.audioOff : STRINGS.audioOn, 60);
      if (edges.has('confirm')) audio.play('ui');
      if (edges.has('flash')) { run.softFlash = !run.softFlash; message(STRINGS.lightningFlash + (run.softFlash ? STRINGS.flashReduced : STRINGS.flashFull), 80); }
      if (beforeState && beforeState(edges)) return;

      switch (run.state) {
        case 'title':
          step(idleInput, true);
          if (edges.has('confirm') || edges.has('drop')) startRun(specs.first(), 0);
          else if (edges.has('daily') || edges.has('replay')) startRun(specs.daily(todayString()), 0);
          break;

        case 'intro':
          step(idleInput, true);
          run.rec.introFrames++;
          if (--run.introT <= 0 || edges.has('confirm')) run.state = 'play';
          break;

        case 'play': {
          if (edges.has('pause')) { run.state = 'pause'; break; }
          if (edges.has('restart')) { restart(); break; }
          const simulationInput = stepInput(input, edges);
          run.rec.frames.push(codec.encode(simulationInput));
          step(simulationInput, false);
          if (run.state === 'play') checkEnd();
          break;
        }

        case 'pause':
          if (edges.has('pause') || edges.has('confirm')) run.state = 'play';
          else if (edges.has('restart')) restart();
          break;

        case 'replay':
          if (edges.has('confirm') || edges.has('replay')) {
            for (let i = 0; i < 200000 && run.state === 'replay'; i++) replayStep();
          } else replayStep();
          break;

        case 'over':
          step(idleInput, false);
          if (run.overT > 0) run.overT--;
          else if (edges.has('replay')) startReplay();
          else if (edges.has('confirm') || edges.has('restart')) restart();
          break;

        case 'done':
          step(idleInput, true);
          if (edges.has('replay')) startReplay();
          else if (edges.has('restart')) restart();
          else if (edges.has('confirm')) {
            if (run.result !== 'win') restart();
            else {
              const next = specs.next(run);
              startRun(next.spec, next.score);
              if (next.title) run.state = 'title';
            }
          }
          break;
      }
      if (afterStep) afterStep();
    }

    if (debug && new URLSearchParams(location.search).has('debug')) window[debug.name] = debug.expose;
    if (typeof __TEST_HOOK__ === 'function' && testHook) __TEST_HOOK__(testHook);
    return { step: stepFrame, startRun, restart, startReplay };
  },
};
