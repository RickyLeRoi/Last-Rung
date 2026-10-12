// games/valanga/src/sfx.js
'use strict';
const Sfx = (() => {
  // Wind on the slope: band-passed noise, loud in the blizzard.
  function buildLoops({ master: masterGain, noiseSource, filter, gain }) {
    const windNoise = noiseSource(), windFilter = filter('bandpass', 700, 0.6), windGain = gain(0);
    windNoise.connect(windFilter); windFilter.connect(windGain); windGain.connect(masterGain);
    windNoise.start();
    return { windGain, windFilter };
  }

  // Called every frame; levels = { wind, rumble }, each 0..1.
  function updateLoops(loops, levels, now) {
    loops.windGain.gain.setTargetAtTime(0.015 + 0.06 * levels.wind + 0.08 * levels.rumble, now, 0.3);
    loops.windFilter.frequency.setTargetAtTime(700 - 450 * levels.rumble, now, 0.3);
  }

  // The ARTVA beeps get higher as the signal grows; the three names are also the three vibration strengths (bindings.js).
  const effects = ({ tone, noise }) => ({
    ui()        { tone(660, 990, 0.06, 'square', 0.08); },
    beepFar()   { tone(1700, 1700, 0.05, 'square', 0.05); },
    beepMid()   { tone(2100, 2100, 0.05, 'square', 0.06); },
    beepNear()  { tone(2600, 2600, 0.06, 'square', 0.07); },
    dig()       { noise(0.12, 'lowpass', 1200, 300, 0.16); },
    rock()      { tone(180, 120, 0.08, 'square', 0.08); },
    collapse()  { noise(0.5, 'lowpass', 700, 120, 0.3); },
    probeHit()  { tone(300, 520, 0.18, 'triangle', 0.12); },
    probeMiss() { tone(220, 160, 0.12, 'triangle', 0.07); },
    crack()     { noise(0.5, 'highpass', 2500, 700, 0.35); tone(90, 40, 0.6, 'sawtooth', 0.12); },
    avalanche() { noise(2.6, 'lowpass', 600, 60, 0.5); },
    stunned()   { noise(0.4, 'lowpass', 900, 100, 0.3); },
    saved()     { [523, 659, 784].forEach((frequency, i) => tone(frequency, frequency, 0.12, 'triangle', 0.1, i * 0.1)); },
    lost()      { [330, 262, 196].forEach((frequency, i) => tone(frequency, frequency, 0.18, 'triangle', 0.1, i * 0.16)); },
    win()       { [523, 659, 784, 1047].forEach((frequency, i) => tone(frequency, frequency, 0.14, 'square', 0.1, i * 0.12)); },
    fail()      { [392, 330, 262].forEach((frequency, i) => tone(frequency, frequency * 0.98, 0.2, 'triangle', 0.14, i * 0.18)); },
  });

  return Synth.create({ volume: 0.5, effects, loops: { build: buildLoops, update: updateLoops } });
})();
