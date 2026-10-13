// games/abisso/src/sfx.js
'use strict';
const Sfx = (() => {
  // The hum of the thrusters (louder with thrust) over a deep, filtered water noise.
  function buildLoops({ context, master: masterGain, noiseSource, filter, gain }) {
    const waterNoise = noiseSource(), waterFilter = filter('lowpass', 260, 0.7), waterGain = gain(0.05);
    waterNoise.connect(waterFilter); waterFilter.connect(waterGain); waterGain.connect(masterGain);
    const motor = context.createOscillator(), motorGain = gain(0);
    motor.type = 'sawtooth'; motor.frequency.value = 55;
    const motorFilter = filter('lowpass', 300, 1);
    motor.connect(motorFilter); motorFilter.connect(motorGain); motorGain.connect(masterGain);
    waterNoise.start(); motor.start();
    return { motorGain, motor };
  }

  // levels = { thrust } 0..1.
  function updateLoops(loops, levels, now) {
    loops.motorGain.gain.setTargetAtTime(0.05 * levels.thrust, now, 0.1);
    loops.motor.frequency.setTargetAtTime(50 + 40 * levels.thrust, now, 0.1);
  }

  const effects = ({ tone, noise }) => ({
    ui()      { tone(660, 990, 0.06, 'square', 0.08); },
    sonar()   { tone(1500, 1450, 0.6, 'sine', 0.12); },
    echo()    { tone(1450, 1400, 0.3, 'sine', 0.05); },
    lamp()    { tone(900, 600, 0.05, 'square', 0.05); },
    hit()     { noise(0.3, 'lowpass', 600, 120, 0.3); tone(90, 50, 0.3, 'sawtooth', 0.12); },
    scrape()  { noise(0.15, 'bandpass', 1200, 500, 0.08); },
    board()   { [523, 784].forEach((frequency, i) => tone(frequency, frequency, 0.1, 'triangle', 0.08, i * 0.09)); },
    saved()   { [523, 659, 784].forEach((frequency, i) => tone(frequency, frequency, 0.12, 'triangle', 0.1, i * 0.1)); },
    lost()    { [330, 262, 196].forEach((frequency, i) => tone(frequency, frequency, 0.18, 'triangle', 0.1, i * 0.16)); },
    flat()    { tone(400, 120, 0.6, 'square', 0.08); },
    win()     { [523, 659, 784, 1047].forEach((frequency, i) => tone(frequency, frequency, 0.14, 'square', 0.1, i * 0.12)); },
    fail()    { [392, 330, 262].forEach((frequency, i) => tone(frequency, frequency * 0.98, 0.2, 'triangle', 0.14, i * 0.18)); },
  });

  return Synth.create({ volume: 0.5, effects, loops: { build: buildLoops, update: updateLoops } });
})();
