// src/bindings.js
'use strict';
// A confirm, B drop, X / RB stabilizer, Y replay (daily challenge in menu; skips the tutorial), Start pause, Back restart.
// In play A throws the buoy and Y uses the bucket (outside play they mean confirm / replay).
// Continuous axes per frame: { hx, up, down, winch } in [-1,1]/[0,1]; winch > 0 lowers the ladder, < 0 winds it in.
function composeAxes({ keys, pad, touch }) {
  const keyboardX = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const keyboardUp = keys.ArrowUp || keys.KeyW ? 1 : 0;
  const keyboardDown = keys.ArrowDown || keys.KeyS ? 1 : 0;
  const keyboardWinch = (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0);
  let padX = 0, padUp = 0, padDown = 0, padWinch = 0, padActive = false;
  if (pad) {
    let x = pad.axis(pad.axes[0] || 0), y = pad.axis(pad.axes[1] || 0);
    if (pad.pressed(14)) x = -1; if (pad.pressed(15)) x = 1;
    if (pad.pressed(12)) y = -1; if (pad.pressed(13)) y = 1;
    const rightTrigger = pad.buttons[7] ? pad.buttons[7].value || 0 : 0;
    if (x || y || rightTrigger > 0.05) padActive = true;
    padX = x; padUp = Math.max(0, -y, rightTrigger); padDown = Math.max(0, y);
    const leftTrigger = pad.buttons[6] ? pad.buttons[6].value || 0 : 0;
    const rightStickY = pad.axis(pad.axes[3] || 0);
    padWinch = Math.abs(rightStickY) > 0.05 ? rightStickY : leftTrigger > 0.05 ? leftTrigger : pad.pressed(4) ? -1 : 0;
    if (padWinch) padActive = true;
  }
  const touchWinch = touch.held.winch || 0;
  const strongest = (...values) => values.reduce((strongest, candidate) => (Math.abs(candidate) > Math.abs(strongest) ? candidate : strongest), 0);
  return {
    hx: strongest(keyboardX, padX, touch.stickX),
    up: Math.max(keyboardUp, padUp, Math.max(0, -touch.stickY)),
    down: Math.max(keyboardDown, padDown, Math.max(0, touch.stickY)),
    winch: strongest(keyboardWinch, padWinch, touchWinch),
    padActive,
  };
}

Input.configure({
  keyEdges: {
    Enter: 'confirm', NumpadEnter: 'confirm', Space: 'drop', KeyX: 'stab',
    KeyP: 'pause', Escape: 'pause', KeyR: 'restart', KeyM: 'mute', KeyV: 'replay', KeyG: 'daily',
    KeyN: 'skip', KeyL: 'flash', KeyZ: 'buoy', KeyC: 'bucket',
  },
  padEdges: { 0: ['confirm', 'buoy'], 1: ['drop'], 2: ['stab'], 5: ['stab'], 3: ['replay', 'bucket'], 9: ['pause'], 8: ['restart'] },
  blockKeys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'],
  rumble: {
    explode: [320, 1], damage: [110, 0.8], death: [60, 0.4], hook: [35, 0.3], land: [45, 0.35],
    contact: [30, 0.3], slip: [70, 0.5], snag: [90, 0.7], dump: [80, 0.4], engineDie: [200, 0.6],
  },
  unlock: () => Sfx.unlock(),
  axes: composeAxes,
});
Sfx.onPlay(Input.rumble);
