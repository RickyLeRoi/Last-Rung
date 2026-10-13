// games/sabbia/src/sfx.js
'use strict';
const Sfx = (() => {
  // Two textures that follow the world: crackling fire and hissing steam.
  function buildLoops({ master: masterGain, noiseSource, filter, gain }) {
    const fireNoise = noiseSource(), fireFilter = filter('bandpass', 900, 1.2), fireGain = gain(0);
    fireNoise.connect(fireFilter); fireFilter.connect(fireGain); fireGain.connect(masterGain);
    const steamNoise = noiseSource(), steamFilter = filter('highpass', 4000, 0.7), steamGain = gain(0);
    steamNoise.connect(steamFilter); steamFilter.connect(steamGain); steamGain.connect(masterGain);
    fireNoise.start(); steamNoise.start();
    return { fireGain, steamGain };
  }

  // levels = { fire, steam } 0..1.
  function updateLoops(loops, levels, now) {
    loops.fireGain.gain.setTargetAtTime(0.08 * levels.fire, now, 0.2);
    loops.steamGain.gain.setTargetAtTime(0.05 * levels.steam, now, 0.2);
  }

  const effects = ({ tone, noise }) => ({
    ui()       { tone(660, 990, 0.06, 'square', 0.08); },
    select()   { tone(880, 880, 0.04, 'square', 0.05); },
    paint()    { noise(0.04, 'lowpass', 1800, 900, 0.03); },
    sizzle()   { noise(0.25, 'highpass', 3000, 6000, 0.08); },
    ignite()   { noise(0.3, 'bandpass', 600, 1400, 0.1); },
    dissolve() { tone(300, 200, 0.12, 'sawtooth', 0.04); },
    empty()    { tone(220, 180, 0.08, 'triangle', 0.06); },
    win()      { [523, 659, 784, 1047].forEach((frequency, i) => tone(frequency, frequency, 0.14, 'square', 0.1, i * 0.12)); },
    fail()     { [392, 330, 262].forEach((frequency, i) => tone(frequency, frequency * 0.98, 0.2, 'triangle', 0.14, i * 0.18)); },
  });

  return Synth.create({ volume: 0.5, effects, loops: { build: buildLoops, update: updateLoops } });
})();
