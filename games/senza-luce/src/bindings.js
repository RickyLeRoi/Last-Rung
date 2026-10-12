// games/senza-luce/src/bindings.js
'use strict';
// Left/right = throttle (the cove is on the left), up/down = change lane, Shift = slow and quiet, X = engine on/off, Space = smoke screen.
// Gamepad: A confirm, B smoke, X / RB engine, Y replay (daily challenge in menu; skips the tutorial), Start pause, Back restart.
// Continuous axes per frame: { hx, up, down } in [-1,1]/[0,1].
function composeAxes({ keys, pad, touch }) {
  const quiet = keys.ShiftLeft || keys.ShiftRight ? CONFIG.boat.quietFactor : 1;
  const keyboardX = ((keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0)) * quiet;
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
    Enter: 'confirm', NumpadEnter: 'confirm', Space: 'smoke', KeyX: 'engine',
    KeyP: 'pause', Escape: 'pause', KeyR: 'restart', KeyM: 'mute', KeyV: 'replay', KeyG: 'daily', KeyN: 'skip',
  },
  padEdges: { 0: ['confirm'], 1: ['smoke'], 2: ['engine'], 5: ['engine'], 3: ['replay'], 9: ['pause'], 8: ['restart'] },
  blockKeys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'],
  rumble: { alarm: [300, 1], caught: [400, 1], thunder: [120, 0.5], crate: [50, 0.3], smoke: [80, 0.4], engineOn: [60, 0.4] },
  unlock: () => Sfx.unlock(),
  axes: composeAxes,
});
Sfx.onPlay(Input.rumble);
