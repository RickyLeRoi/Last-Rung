// engine/audio/synth.js
'use strict';
const Synth = (() => {
  const AudioContextClass = typeof AudioContext !== 'undefined' ? AudioContext
    : typeof webkitAudioContext !== 'undefined' ? webkitAudioContext : null;

  // 20261012 ++ RG #engine_synth
  function create({ volume, effects, loops }) {
    let audioContext = null, masterGain = null, noiseBuffer = null, loopNodes = null, muted = false, playListener = null;
    const lastPlay = {};

    function unlock() {
      if (!AudioContextClass) return;
      if (audioContext) { if (audioContext.state === 'suspended') audioContext.resume(); return; }
      try { audioContext = new AudioContextClass(); } catch (error) { audioContext = null; return; }
      masterGain = audioContext.createGain();
      masterGain.gain.value = muted ? 0 : volume;
      masterGain.connect(audioContext.destination);
      noiseBuffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
      const samples = noiseBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;   // audio only: never touches the simulation RNG
      loopNodes = loops.build({ context: audioContext, master: masterGain, noiseSource, filter, gain });
    }

    function noiseSource() { const source = audioContext.createBufferSource(); source.buffer = noiseBuffer; source.loop = true; return source; }
    function filter(type, frequency, qualityFactor) { const biquad = audioContext.createBiquadFilter(); biquad.type = type; biquad.frequency.value = frequency; if (qualityFactor) biquad.Q.value = qualityFactor; return biquad; }
    function gain(value) { const gainNode = audioContext.createGain(); gainNode.gain.value = value; return gainNode; }

    function update(levels) {
      if (!audioContext || !loopNodes) return;
      loops.update(loopNodes, levels, audioContext.currentTime);
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

    const effectMap = effects({ tone, noise });

    function play(name) {
      if (playListener) playListener(name);   // haptics, also when muted
      if (!audioContext || muted || !effectMap[name]) return;
      const now = audioContext.currentTime;
      if (lastPlay[name] && now - lastPlay[name] < 0.05) return;
      lastPlay[name] = now;
      try { effectMap[name](); } catch (error) { /* audio is not essential */ }
    }

    function toggleMute() {
      muted = !muted;
      if (masterGain) masterGain.gain.setTargetAtTime(muted ? 0 : volume, audioContext.currentTime, 0.02);
      return muted;
    }

    return { unlock, update, play, toggleMute, onPlay(listener) { playListener = listener; }, get muted() { return muted; } };
  }

  return { create };
})();
