// games/formicaio/src/bindings.js
'use strict';
// Arrows / WASD move the cursor, Space (held) lays a trail, X marks a chamber, Z recalls the colony, C plugs a gallery.
// Gamepad: stick / d-pad cursor, A (held) trail, X chamber, B recall, RB plug, Y replay (daily challenge in menu; skips the tutorial),
// Start pause, Back restart. Continuous axes per frame: { hx, up, down, trail } in [-1,1]/[0,1].
function composeAxes({ keys, pad, touch }) {
  const keyboardX = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  const keyboardUp = keys.ArrowUp || keys.KeyW ? 1 : 0;
  const keyboardDown = keys.ArrowDown || keys.KeyS ? 1 : 0;
  const keyboardTrail = keys.Space ? 1 : 0;
  let padX = 0, padUp = 0, padDown = 0, padTrail = 0, padActive = false;
  if (pad) {
    let x = pad.axis(pad.axes[0] || 0), y = pad.axis(pad.axes[1] || 0);
    if (pad.pressed(14)) x = -1; if (pad.pressed(15)) x = 1;
    if (pad.pressed(12)) y = -1; if (pad.pressed(13)) y = 1;
    padTrail = pad.pressed(0) ? 1 : 0;
    if (x || y || padTrail) padActive = true;
    padX = x; padUp = Math.max(0, -y); padDown = Math.max(0, y);
  }
  const strongest = (...values) => values.reduce((strongest, candidate) => (Math.abs(candidate) > Math.abs(strongest) ? candidate : strongest), 0);
  return {
    hx: strongest(keyboardX, padX, touch.stickX),
    up: Math.max(keyboardUp, padUp, Math.max(0, -touch.stickY)),
    down: Math.max(keyboardDown, padDown, Math.max(0, touch.stickY)),
    trail: Math.max(keyboardTrail, padTrail, touch.held.trail || 0),
    padActive,
  };
}

Input.configure({
  keyEdges: {
    Enter: 'confirm', NumpadEnter: 'confirm', KeyX: 'chamber', KeyZ: 'recall', KeyC: 'plug',
    KeyP: 'pause', Escape: 'pause', KeyR: 'restart', KeyM: 'mute', KeyV: 'replay', KeyG: 'daily', KeyN: 'skip',
  },
  padEdges: { 0: ['confirm'], 1: ['recall'], 2: ['chamber'], 3: ['replay'], 5: ['plug'], 9: ['pause'], 8: ['restart'] },
  blockKeys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'],
  rumble: { eaten: [120, 0.6], thunder: [400, 0.8], drowned: [200, 0.7], collapse: [150, 0.5] },
  unlock: () => Sfx.unlock(),
  axes: composeAxes,
});
Sfx.onPlay(Input.rumble);
