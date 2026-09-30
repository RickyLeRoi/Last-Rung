'use strict';
const Sfx = (() => {
  const AudioContextClass = typeof AudioContext !== 'undefined' ? AudioContext
    : typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null;
  const MASTER_VOLUME = 0.5;
  let audioContext = null, masterGain = null, noiseBuffer = null, loops = null, muted = false, playListener = null;
  const lastPlay = {};

  function unlock() {
    if (!AudioContextClass) return;
    if (audioContext) { if (audioContext.state === 'suspended') audioContext.resume(); return; }
    try { audioContext = new AudioContextClass(); } catch (error) { audioContext = null; return; }
    masterGain = audioContext.createGain();
    masterGain.gain.value = muted ? 0 : MASTER_VOLUME;
    masterGain.connect(audioContext.destination);
    noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;   // audio only: never touches the simulation RNG
    buildLoops();
  }

  function noiseSource() { const source = audioContext.createBufferSource(); source.buffer = noiseBuffer; source.loop = true; return source; }
  function filter(type, frequency, qualityFactor) { const biquad = audioContext.createBiquadFilter(); biquad.type = type; biquad.frequency.value = frequency; if (qualityFactor) biquad.Q.value = qualityFactor; return biquad; }
  function gain(value) { const gainNode = audioContext.createGain(); gainNode.gain.value = value; return gainNode; }

  function buildLoops() {
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
    loops = { chop, lfo: bladeOscillator, lfoAmt: bladeOscillatorDepth, rf: rotorFilter, eo: engineOscillator, eg: engineGain, sg: windGain, wg: winchGain, wo: winchOscillator };
  }

  // Called every frame; levels = { rotor, thrust, storm, water, winch }, each 0..1.
  function update(levels) {
    if (!audioContext || !loops) return;
    const now = audioContext.currentTime, smoothing = 0.08;
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

  function tone(startFrequency, endFrequency, duration, type, volume, delay) {
    const startTime = audioContext.currentTime + (delay || 0);
    const oscillator = audioContext.createOscillator(), gainNode = gain(0);
    oscillator.type = type || 'square';
    oscillator.frequency.setValueAtTime(startFrequency, startTime);
    if (endFrequency !== startFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startTime + duration);
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    oscillator.connect(gainNode); gainNode.connect(masterGain);
    oscillator.start(startTime); oscillator.stop(startTime + duration + 0.02);
  }
  function noise(duration, type, startFrequency, endFrequency, volume, delay) {
    const startTime = audioContext.currentTime + (delay || 0);
    const source = audioContext.createBufferSource(); source.buffer = noiseBuffer;
    const filterNode = filter(type, startFrequency, 1), gainNode = gain(0);
    filterNode.frequency.setValueAtTime(startFrequency, startTime);
    filterNode.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), startTime + duration);
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    source.connect(filterNode); filterNode.connect(gainNode); gainNode.connect(masterGain);
    source.start(startTime, Math.random() * 1.5); source.stop(startTime + duration + 0.02);
  }

  const EFFECTS = {
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
  };

  function play(name) {
    if (playListener) playListener(name);   // haptics, also when muted
    if (!audioContext || muted || !EFFECTS[name]) return;
    const now = audioContext.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < 0.05) return;
    lastPlay[name] = now;
    try { EFFECTS[name](); } catch (error) { /* audio is not essential */ }
  }

  function toggleMute() {
    muted = !muted;
    if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, audioContext.currentTime, 0.02);
    return muted;
  }

  return { unlock, update, play, toggleMute, onPlay(listener) { playListener = listener; }, get muted() { return muted; } };
})();
