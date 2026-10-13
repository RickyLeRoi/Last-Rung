// games/sabbia/src/bindings.js
'use strict';
// Arrows / WASD move the brush, Space (held) paints, X / Z next / previous material, C brush size, L laboratory (from the title).
// Gamepad: stick / d-pad brush, A (held) paints, X / B next / previous material, RB size, Y replay (daily challenge in menu), Start pause,
// Back restart. Continuous axes per frame: { hx, up, down, paint } in [-1,1]/[0,1].
function composeAxes({ keys, pad, touch }) {
  const keyboardX = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const keyboardUp = keys.ArrowUp || keys.KeyW ? 1 : 0;
  const keyboardDown = keys.ArrowDown || keys.KeyS ? 1 : 0;
  const keyboardPaint = keys.Space ? 1 : 0;
  let padX = 0, padUp = 0, padDown = 0, padPaint = 0, padActive = false;
  if (pad) {
    let x = pad.axis(pad.axes[0] || 0), y = pad.axis(pad.axes[1] || 0);
    if (pad.pressed(14)) x = -1; if (pad.pressed(15)) x = 1;
    if (pad.pressed(12)) y = -1; if (pad.pressed(13)) y = 1;
    padPaint = pad.pressed(0) ? 1 : 0;
    if (x || y || padPaint) padActive = true;
    padX = x; padUp = Math.max(0, -y); padDown = Math.max(0, y);
  }
  const strongest = (...values) => values.reduce((strongest, candidate) => (Math.abs(candidate) > Math.abs(strongest) ? candidate : strongest), 0);
  return {
    hx: strongest(keyboardX, padX, touch.stickX),
    up: Math.max(keyboardUp, padUp, Math.max(0, -touch.stickY)),
    down: Math.max(keyboardDown, padDown, Math.max(0, touch.stickY)),
    paint: Math.max(keyboardPaint, padPaint, touch.held.paint || 0),
    padActive,
  };
}

Input.configure({
  keyEdges: {
    Enter: 'confirm', NumpadEnter: 'confirm', KeyX: 'next', KeyZ: 'previous', KeyC: 'size', KeyL: 'lab',
    KeyP: 'pause', Escape: 'pause', KeyR: 'restart', KeyM: 'mute', KeyV: 'replay', KeyG: 'daily', KeyN: 'skip',
  },
  padEdges: { 0: ['confirm'], 1: ['previous'], 2: ['next', 'lab'], 3: ['replay'], 5: ['size'], 9: ['pause'], 8: ['restart'] },
  blockKeys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'],
  rumble: { ignite: [80, 0.4], sizzle: [60, 0.3] },
  unlock: () => Sfx.unlock(),
  axes: composeAxes,
});
Sfx.onPlay(Input.rumble);
