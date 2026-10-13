// games/formicaio/src/sfx.js
'use strict';
const Sfx = (() => {
  // Rain on the grass: high-passed noise, only during a shower.
  function buildLoops({ master: masterGain, noiseSource, filter, gain }) {
    const rainNoise = noiseSource(), rainFilter = filter('highpass', 1800, 0.5), rainGain = gain(0);
    rainNoise.connect(rainFilter); rainFilter.connect(rainGain); rainGain.connect(masterGain);
    rainNoise.start();
    return { rainGain };
  }

  // Called every frame; levels = { rain } 0..1.
  function updateLoops(loops, levels, now) {
    loops.rainGain.gain.setTargetAtTime(0.07 * levels.rain, now, 0.4);
  }

  const effects = ({ tone, noise }) => ({
    ui()       { tone(660, 990, 0.06, 'square', 0.08); },
    trail()    { tone(1400, 1700, 0.03, 'triangle', 0.03); },
    dig()      { noise(0.05, 'bandpass', 2400, 1600, 0.05); },
    food()     { tone(880, 1320, 0.05, 'triangle', 0.05); },
    found()    { [990, 1320, 1760].forEach((frequency, i) => tone(frequency, frequency, 0.06, 'triangle', 0.06, i * 0.06)); },
    born()     { tone(1200, 1800, 0.08, 'triangle', 0.07); tone(1800, 2400, 0.06, 'triangle', 0.05, 0.08); },
    chamber()  { [523, 784].forEach((frequency, i) => tone(frequency, frequency, 0.1, 'triangle', 0.08, i * 0.09)); },
    plug()     { noise(0.12, 'lowpass', 900, 300, 0.12); },
    eaten()    { tone(300, 120, 0.25, 'sawtooth', 0.1); },
    scared()   { tone(500, 900, 0.15, 'square', 0.06); },
    drowned()  { [330, 262].forEach((frequency, i) => tone(frequency, frequency, 0.16, 'triangle', 0.08, i * 0.14)); },
    thunder()  { noise(1.8, 'lowpass', 300, 40, 0.45); },
    collapse() { noise(0.3, 'lowpass', 700, 150, 0.2); },
    win()      { [523, 659, 784, 1047].forEach((frequency, i) => tone(frequency, frequency, 0.14, 'square', 0.1, i * 0.12)); },
    fail()     { [392, 330, 262].forEach((frequency, i) => tone(frequency, frequency * 0.98, 0.2, 'triangle', 0.14, i * 0.18)); },
  });

  return Synth.create({ volume: 0.5, effects, loops: { build: buildLoops, update: updateLoops } });
})();
