// games/faro/src/sfx.js
'use strict';
const Sfx = (() => {
  // Sea and wind: low-passed noise, louder in storms.
  function buildLoops({ master: masterGain, noiseSource, filter, gain }) {
    const seaNoise = noiseSource(), seaFilter = filter('lowpass', 420), seaGain = gain(0);
    seaNoise.connect(seaFilter); seaFilter.connect(seaGain); seaGain.connect(masterGain);
    const windNoise = noiseSource(), windFilter = filter('bandpass', 900, 0.7), windGain = gain(0);
    windNoise.connect(windFilter); windFilter.connect(windGain); windGain.connect(masterGain);
    seaNoise.start(); windNoise.start();
    return { seaGain, seaFilter, windGain };
  }

  // Called every frame; levels = { sea, storm }, each 0..1.
  function updateLoops(loops, levels, now) {
    loops.seaGain.gain.setTargetAtTime(0.03 + 0.05 * levels.sea, now, 0.3);
    loops.seaFilter.frequency.setTargetAtTime(300 + 500 * levels.storm, now, 0.3);
    loops.windGain.gain.setTargetAtTime(0.06 * levels.storm, now, 0.4);
  }

  const effects = ({ tone, noise }) => ({
    ui()      { tone(660, 990, 0.06, 'square', 0.08); },
    siren()   { tone(300, 520, 0.5, 'sawtooth', 0.09); tone(520, 300, 0.5, 'sawtooth', 0.09, 0.5); },
    flash()   { noise(0.25, 'highpass', 6000, 2000, 0.25); tone(1500, 600, 0.2, 'square', 0.06); },
    dock()    { [523, 659, 784].forEach((frequency, i) => tone(frequency, frequency, 0.12, 'triangle', 0.1, i * 0.1)); },
    sink()    { noise(0.9, 'lowpass', 1800, 80, 0.5); tone(110, 40, 0.7, 'sine', 0.35); },
    horn()    { tone(150, 150, 0.45, 'sawtooth', 0.07); },
    thunder() { noise(1.6, 'lowpass', 400, 40, 0.45, 0.25); },
    splash()  { noise(0.4, 'bandpass', 1800, 400, 0.22); },
    lampOut() { tone(520, 90, 0.7, 'sawtooth', 0.1); },
    lampOn()  { tone(240, 700, 0.3, 'triangle', 0.08); },
    win()     { [523, 659, 784, 1047].forEach((frequency, i) => tone(frequency, frequency, 0.14, 'square', 0.1, i * 0.12)); },
    fail()    { [392, 330, 262].forEach((frequency, i) => tone(frequency, frequency * 0.98, 0.2, 'triangle', 0.14, i * 0.18)); },
  });

  return Synth.create({ volume: 0.5, effects, loops: { build: buildLoops, update: updateLoops } });
})();
