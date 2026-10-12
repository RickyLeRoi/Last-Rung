// games/valanga/src/bindings.js
'use strict';
// Left/right walk, up climbs out of a hole, Space (held) digs straight down (sideways with a direction held), X = probe.
// Gamepad: A (held) digs, X / B probe, Y replay (daily challenge in menu; skips the tutorial), Start pause, Back restart.
// Continuous axes per frame: { hx, up, down, dig } in [-1,1]/[0,1].
function composeAxes({ keys, pad, touch }) {
  const keyboardX = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const keyboardUp = keys.ArrowUp || keys.KeyW ? 1 : 0;
  const keyboardDown = keys.ArrowDown || keys.KeyS ? 1 : 0;
  const keyboardDig = keys.Space || keys.KeyZ ? 1 : 0;
  let padX = 0, padUp = 0, padDown = 0, padDig = 0, padActive = false;
  if (pad) {
    let x = pad.axis(pad.axes[0] || 0), y = pad.axis(pad.axes[1] || 0);
    if (pad.pressed(14)) x = -1; if (pad.pressed(15)) x = 1;
    if (pad.pressed(12)) y = -1; if (pad.pressed(13)) y = 1;
    padDig = pad.pressed(0) ? 1 : 0;
    if (x || y || padDig) padActive = true;
    padX = x; padUp = Math.max(0, -y); padDown = Math.max(0, y);
  }
  const strongest = (...values) => values.reduce((strongest, candidate) => (Math.abs(candidate) > Math.abs(strongest) ? candidate : strongest), 0);
  return {
    hx: strongest(keyboardX, padX, touch.stickX),
    up: Math.max(keyboardUp, padUp, Math.max(0, -touch.stickY)),
    down: Math.max(keyboardDown, padDown, Math.max(0, touch.stickY)),
    dig: Math.max(keyboardDig, padDig, touch.held.dig || 0),
    padActive,
  };
}

Input.configure({
  keyEdges: {
    Enter: 'confirm', NumpadEnter: 'confirm', KeyX: 'probe',
    KeyP: 'pause', Escape: 'pause', KeyR: 'restart', KeyM: 'mute', KeyV: 'replay', KeyG: 'daily', KeyN: 'skip',
  },
  padEdges: { 0: ['confirm'], 1: ['probe'], 2: ['probe'], 3: ['replay'], 9: ['pause'], 8: ['restart'] },
  blockKeys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'],
  rumble: {
    beepFar: [25, 0.15], beepMid: [40, 0.45], beepNear: [60, 0.9], probeHit: [90, 0.6],
    crack: [250, 0.8], collapse: [200, 0.6], avalanche: [600, 1], stunned: [300, 1], saved: [80, 0.4],
  },
  unlock: () => Sfx.unlock(),
  axes: composeAxes,
});
Sfx.onPlay(Input.rumble);
