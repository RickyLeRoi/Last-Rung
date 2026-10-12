// games/senza-luce/src/sfx.js
'use strict';
const Sfx = (() => {
  // Sea and wind (low-passed noise) plus the boat engine (a low sawtooth that rises with the throttle).
  function buildLoops({ context: audioContext, master: masterGain, noiseSource, filter, gain }) {
    const seaNoise = noiseSource(), seaFilter = filter('lowpass', 420), seaGain = gain(0);
    seaNoise.connect(seaFilter); seaFilter.connect(seaGain); seaGain.connect(masterGain);
    const windNoise = noiseSource(), windFilter = filter('bandpass', 900, 0.7), windGain = gain(0);
    windNoise.connect(windFilter); windFilter.connect(windGain); windGain.connect(masterGain);
    const engineOscillator = audioContext.createOscillator(); engineOscillator.type = 'sawtooth'; engineOscillator.frequency.value = 40;
    const engineFilter = filter('lowpass', 220), engineGain = gain(0);
    engineOscillator.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(masterGain);
    seaNoise.start(); windNoise.start(); engineOscillator.start();
    return { seaGain, seaFilter, windGain, engineOscillator, engineGain };
  }

  // Called every frame; levels = { sea, storm, engine, throttle }, each 0..1.
  function updateLoops(loops, levels, now) {
    loops.seaGain.gain.setTargetAtTime(0.03 + 0.05 * levels.sea, now, 0.3);
    loops.seaFilter.frequency.setTargetAtTime(300 + 500 * levels.storm, now, 0.3);
    loops.windGain.gain.setTargetAtTime(0.06 * levels.storm, now, 0.4);
    loops.engineGain.gain.setTargetAtTime(levels.engine * (0.02 + 0.05 * levels.throttle), now, 0.1);
    loops.engineOscillator.frequency.setTargetAtTime(38 + 34 * levels.throttle, now, 0.1);
  }

  const effects = ({ tone, noise }) => ({
    ui()        { tone(660, 990, 0.06, 'square', 0.08); },
    engineOn()  { noise(0.35, 'lowpass', 300, 900, 0.25); tone(45, 70, 0.4, 'sawtooth', 0.12); },
    engineOff() { tone(70, 30, 0.45, 'sawtooth', 0.1); },
    smoke()     { noise(0.8, 'bandpass', 1200, 300, 0.25); },
    crate()     { [523, 784].forEach((frequency, i) => tone(frequency, frequency, 0.1, 'triangle', 0.1, i * 0.09)); },
    seen()      { tone(1200, 1200, 0.04, 'square', 0.05); },
    suspect()   { tone(500, 700, 0.18, 'triangle', 0.08); },
    alarm()     { for (let i = 0; i < 3; i++) tone(880, 660, 0.18, 'sawtooth', 0.09, i * 0.22); },
    caught()    { noise(0.6, 'lowpass', 1500, 100, 0.4); tone(220, 80, 0.8, 'square', 0.12); },
    thunder()   { noise(1.6, 'lowpass', 400, 40, 0.45, 0.25); },
    splash()    { noise(0.4, 'bandpass', 1800, 400, 0.22); },
    cove()      { [392, 523, 659].forEach((frequency, i) => tone(frequency, frequency, 0.12, 'triangle', 0.1, i * 0.1)); },
    win()       { [523, 659, 784, 1047].forEach((frequency, i) => tone(frequency, frequency, 0.14, 'square', 0.1, i * 0.12)); },
    fail()      { [392, 330, 262].forEach((frequency, i) => tone(frequency, frequency * 0.98, 0.2, 'triangle', 0.14, i * 0.18)); },
  });

  return Synth.create({ volume: 0.5, effects, loops: { build: buildLoops, update: updateLoops } });
})();
