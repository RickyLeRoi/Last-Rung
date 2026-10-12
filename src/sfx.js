// src/sfx.js
'use strict';
const Sfx = (() => {
  function buildLoops({ context: audioContext, master: masterGain, noiseSource, filter, gain }) {
    // Rotor: band-passed noise, volume modulated by a square wave at blade-pass frequency
    const rotorNoise = noiseSource(), rotorFilter = filter('bandpass', 380, 0.8), chop = gain(0);
    const bladeOscillator = audioContext.createOscillator(); bladeOscillator.type = 'square'; bladeOscillator.frequency.value = 18;
    const bladeOscillatorDepth = gain(0);
    bladeOscillator.connect(bladeOscillatorDepth); bladeOscillatorDepth.connect(chop.gain);
    rotorNoise.connect(rotorFilter); rotorFilter.connect(chop); chop.connect(masterGain);
    const engineOscillator = audioContext.createOscillator(); engineOscillator.type = 'sawtooth'; engineOscillator.frequency.value = 60;
    const engineFilter = filter('lowpass', 260), engineGain = gain(0);
    engineOscillator.connect(engineFilter); engineFilter.connect(engineGain); engineGain.connect(masterGain);
    const windNoise = noiseSource(), windFilter = filter('lowpass', 900), windGain = gain(0);
    windNoise.connect(windFilter); windFilter.connect(windGain); windGain.connect(masterGain);
    const winchOscillator = audioContext.createOscillator(); winchOscillator.type = 'sawtooth'; winchOscillator.frequency.value = 95;
    const winchFilter = filter('bandpass', 700, 2), winchGain = gain(0);
    winchOscillator.connect(winchFilter); winchFilter.connect(winchGain); winchGain.connect(masterGain);
    rotorNoise.start(); bladeOscillator.start(); engineOscillator.start(); windNoise.start(); winchOscillator.start();
    return { chop, lfo: bladeOscillator, lfoAmt: bladeOscillatorDepth, rf: rotorFilter, eo: engineOscillator, eg: engineGain, sg: windGain, wg: winchGain, wo: winchOscillator };
  }

  // Called every frame; levels = { rotor, thrust, storm, water, winch }, each 0..1.
  function updateLoops(loops, levels, now) {
    const smoothing = 0.08;
    loops.lfo.frequency.setTargetAtTime(9 + 13 * levels.rotor + 5 * levels.thrust, now, smoothing);
    loops.chop.gain.setTargetAtTime(0.1 * levels.rotor, now, smoothing);
    loops.lfoAmt.gain.setTargetAtTime(0.09 * levels.rotor, now, smoothing);
    loops.rf.frequency.setTargetAtTime(280 + 220 * levels.thrust - 150 * levels.water, now, smoothing);
    loops.eg.gain.setTargetAtTime(0.045 * levels.rotor, now, smoothing);
    loops.eo.frequency.setTargetAtTime(48 + 26 * levels.rotor + 20 * levels.thrust, now, smoothing);
    loops.sg.gain.setTargetAtTime(0.05 * levels.storm, now, 0.3);
    loops.wg.gain.setTargetAtTime(0.05 * (levels.winch || 0), now, 0.03);
    loops.wo.frequency.setTargetAtTime(95 + 20 * Math.sin(now * 9), now, 0.05);
  }

  const effects = ({ tone, noise }) => ({
    ui()       { tone(660, 990, 0.06, 'square', 0.08); },
    hook()     { tone(880, 1320, 0.09, 'square', 0.1); },
    board()    { tone(660, 880, 0.06, 'triangle', 0.1); },
    save()     { [660, 880, 1320].forEach((frequency, i) => tone(frequency, frequency, 0.09, 'square', 0.09, i * 0.08)); },
    death()    { tone(330, 110, 0.35, 'triangle', 0.18); },
    explode()  { noise(1.1, 'lowpass', 1400, 60, 0.6); tone(90, 30, 0.6, 'sine', 0.5); },
    damage()   { noise(0.18, 'bandpass', 2500, 800, 0.35); tone(160, 90, 0.15, 'square', 0.12); },
    contact()  { tone(140, 100, 0.07, 'square', 0.06); },
    splash()   { noise(0.4, 'bandpass', 1800, 400, 0.22); },
    land()     { tone(110, 70, 0.12, 'sine', 0.25); },
    lowFuel()  { tone(1040, 1040, 0.07, 'square', 0.06); },
    engineDie(){ tone(120, 30, 1.2, 'sawtooth', 0.12); },
    refuel()   { tone(520, 780, 0.25, 'triangle', 0.08); },
    stabOn()   { tone(800, 1200, 0.05, 'square', 0.07); },
    stabOff()  { tone(1200, 800, 0.05, 'square', 0.07); },
    thunder()  { noise(1.6, 'lowpass', 400, 40, 0.45, 0.25); },
    win()      { [523, 659, 784, 1047].forEach((frequency, i) => tone(frequency, frequency, 0.14, 'square', 0.1, i * 0.12)); },
    scream()   { tone(720, 1250, 0.28, 'sawtooth', 0.07); tone(1250, 820, 0.4, 'sawtooth', 0.06, 0.26); },
    slip()     { noise(0.35, 'bandpass', 1400, 300, 0.25); tone(520, 180, 0.25, 'triangle', 0.1); },
    snag()     { tone(260, 160, 0.12, 'square', 0.1); noise(0.12, 'highpass', 3000, 1500, 0.15, 0.02); },
    throw()    { tone(400, 900, 0.1, 'triangle', 0.08); },
    dump()     { noise(0.9, 'lowpass', 2500, 300, 0.3); },
    hiss()     { noise(1.2, 'highpass', 5000, 2000, 0.18); },
    fail()     { [392, 330, 262].forEach((frequency, i) => tone(frequency, frequency * 0.98, 0.2, 'triangle', 0.14, i * 0.18)); },
  });

  return Synth.create({ volume: 0.5, effects, loops: { build: buildLoops, update: updateLoops } });
})();
