// games/abisso/src/bindings.js
'use strict';
// Arrows / WASD fire the thrusters (eight directions), Space = sonar, X = bow lamp on/off.
// Gamepad: stick / d-pad thrusters, A sonar, X lamp, Y replay (daily challenge in menu; skips the tutorial), Start pause, Back restart.
// Continuous axes per frame: { hx, up, down } in [-1,1]/[0,1].
function composeAxes({ keys, pad, touch }) {
  const keyboardX = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const keyboardUp = keys.ArrowUp || keys.KeyW ? 1 : 0;
  const keyboardDown = keys.ArrowDown || keys.KeyS ? 1 : 0;
  let padX = 0, padUp = 0, padDown = 0, padActive = false;
  if (pad) {
    let x = pad.axis(pad.axes[0] || 0), y = pad.axis(pad.axes[1] || 0);
    if (pad.pressed(14)) x = -1; if (pad.pressed(15)) x = 1;
    if (pad.pressed(12)) y = -1; if (pad.pressed(13)) y = 1;
    if (x || y) padActive = true;
    padX = x; padUp = Math.max(0, -y); padDown = Math.max(0, y);
  }
  const strongest = (...values) => values.reduce((strongest, candidate) => (Math.abs(candidate) > Math.abs(strongest) ? candidate : strongest), 0);
  return {
    hx: strongest(keyboardX, padX, touch.stickX),
    up: Math.max(keyboardUp, padUp, Math.max(0, -touch.stickY)),
    down: Math.max(keyboardDown, padDown, Math.max(0, touch.stickY)),
    padActive,
  };
}

Input.configure({
  keyEdges: {
    Enter: 'confirm', NumpadEnter: 'confirm', Space: 'sonar', KeyX: 'lamp',
    KeyP: 'pause', Escape: 'pause', KeyR: 'restart', KeyM: 'mute', KeyV: 'replay', KeyG: 'daily', KeyN: 'skip',
  },
  padEdges: { 0: ['confirm', 'sonar'], 2: ['lamp'], 3: ['replay'], 9: ['pause'], 8: ['restart'] },
  blockKeys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'],
  rumble: { hit: [250, 1], scrape: [60, 0.3], board: [80, 0.4], flat: [300, 0.6] },
  unlock: () => Sfx.unlock(),
  axes: composeAxes,
});
Sfx.onPlay(Input.rumble);
