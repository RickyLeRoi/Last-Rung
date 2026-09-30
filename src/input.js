'use strict';
// Per frame: { hx, up, down, winch } in [-1,1]/[0,1] plus the edge events pressed that frame.
// winch > 0 lowers the ladder, < 0 winds it in.
const Input = (() => {
  const keys = {};
  const edges = new Set();
  let device = 'kb';
  let mode = 'menu';

  const KEY_EDGES = {
    Enter: 'confirm', NumpadEnter: 'confirm', Space: 'drop', KeyX: 'stab',
    KeyP: 'pause', Escape: 'pause', KeyR: 'restart', KeyM: 'mute', KeyV: 'replay', KeyG: 'daily',
    KeyN: 'skip', KeyL: 'flash', KeyZ: 'buoy', KeyC: 'bucket',
  };
  const BLOCK = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);
  window.addEventListener('keydown', event => {
    if (BLOCK.has(event.code) && event.preventDefault) event.preventDefault();
    Sfx.unlock();
    if (!keys[event.code] && KEY_EDGES[event.code]) edges.add(KEY_EDGES[event.code]);
    keys[event.code] = true;
    device = 'kb';
  });
  window.addEventListener('keyup', event => { keys[event.code] = false; });
  window.addEventListener('blur', () => { for (const code in keys) keys[code] = false; });

  const gamepadState = { hx: 0, up: 0, down: 0, winch: 0, prev: {} };
  // A confirm, B drop, X / RB stabilizer, Y replay (daily challenge in menu; skips the tutorial), Start pause, Back restart.
  // In play A throws the buoy and Y uses the bucket (outside play they mean confirm / replay).
  const PAD_EDGES = { 0: ['confirm', 'buoy'], 1: ['drop'], 2: ['stab'], 5: ['stab'], 3: ['replay', 'bucket'], 9: ['pause'], 8: ['restart'] };
  function pollPad() {
    gamepadState.hx = gamepadState.up = gamepadState.down = gamepadState.winch = 0;
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return;
    let gamepads;
    try { gamepads = navigator.getGamepads(); } catch (error) { return; }
    for (const gamepad of gamepads || []) {
      if (!gamepad || gamepad.connected === false) continue;
      gamepadState.gp = gamepad;
      const pressed = buttonIndex => !!(gamepad.buttons[buttonIndex] && gamepad.buttons[buttonIndex].pressed);
      for (const i in PAD_EDGES) {
        const isPressed = pressed(+i);
        if (isPressed && !gamepadState.prev[i]) { for (const edge of PAD_EDGES[i]) edges.add(edge); device = 'pad'; }
        gamepadState.prev[i] = isPressed;
      }
      const deadzone = CONFIG.input.deadzone;
      const axis = value => (Math.abs(value) < deadzone ? 0 : (value - Math.sign(value) * deadzone) / (1 - deadzone));
      let x = axis(gamepad.axes[0] || 0), y = axis(gamepad.axes[1] || 0);
      if (pressed(14)) x = -1; if (pressed(15)) x = 1;
      if (pressed(12)) y = -1; if (pressed(13)) y = 1;
      const rightTrigger = gamepad.buttons[7] ? gamepad.buttons[7].value || 0 : 0;
      if (x || y || rightTrigger > 0.05) device = 'pad';
      gamepadState.hx = x; gamepadState.up = Math.max(0, -y, rightTrigger); gamepadState.down = Math.max(0, y);
      const leftTrigger = gamepad.buttons[6] ? gamepad.buttons[6].value || 0 : 0;
      const rightStickY = axis(gamepad.axes[3] || 0);
      gamepadState.winch = Math.abs(rightStickY) > 0.05 ? rightStickY : leftTrigger > 0.05 ? leftTrigger : pressed(4) ? -1 : 0;
      if (gamepadState.winch) device = 'pad';
      break;
    }
  }

  const touch = { hx: 0, up: 0, down: 0, winch: 0, id: null, ox: 0, oy: 0 };
  let touchUi = null;
  function setupTouch() {
    const root = document.getElementById('touch');
    if (!root || !root.querySelector) return;
    const zone = root.querySelector('#stickZone');
    const base = root.querySelector('#stickBase');
    const knob = root.querySelector('#stickKnob');
    const stickRadius = CONFIG.input.stickRadius;
    touchUi = { root, stab: root.querySelector('#bStab'), key: '' };

    const showTouchUI = () => {
      if (root.classList.contains('on')) { device = 'touch'; return; }
      device = 'touch';
      root.classList.add('on');
      Gfx.fit();
      if (mode !== 'play') edges.add('confirm');
      try {
        const docElement = document.documentElement;
        if (docElement.requestFullscreen && !document.fullscreenElement) docElement.requestFullscreen().catch(() => {});
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
      } catch (error) { /* fullscreen and orientation lock are optional */ }
    };
    window.addEventListener('pointerdown', event => {
      Sfx.unlock();
      if (event.pointerType === 'touch') showTouchUI();
    }, true);

    const setKnob = (offsetX, offsetY) => { knob.style.transform = 'translate(' + offsetX + 'px,' + offsetY + 'px)'; };
    zone.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (mode !== 'play') { edges.add('confirm'); return; }
      if (touch.id !== null) return;
      touch.id = event.pointerId; touch.ox = event.clientX; touch.oy = event.clientY;
      if (zone.setPointerCapture) zone.setPointerCapture(event.pointerId);
      base.style.left = event.clientX + 'px'; base.style.top = event.clientY + 'px';
      base.classList.add('on'); setKnob(0, 0);
    });
    zone.addEventListener('pointermove', event => {
      if (event.pointerId !== touch.id) return;
      let deltaX = (event.clientX - touch.ox) / stickRadius, deltaY = (event.clientY - touch.oy) / stickRadius;
      const magnitude = Math.hypot(deltaX, deltaY);
      if (magnitude > 1) { deltaX /= magnitude; deltaY /= magnitude; }
      setKnob(deltaX * stickRadius, deltaY * stickRadius);
      const deadzone = 0.15;
      const touchAxis = value => (Math.abs(value) < deadzone ? 0 : (value - Math.sign(value) * deadzone) / (1 - deadzone));
      touch.hx = touchAxis(deltaX); touch.up = Math.max(0, -touchAxis(deltaY)); touch.down = Math.max(0, touchAxis(deltaY));
    });
    const endDrag = event => {
      if (event.pointerId !== touch.id) return;
      touch.id = null; touch.hx = touch.up = touch.down = 0;
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', endDrag);
    zone.addEventListener('pointercancel', endDrag);
    root.querySelectorAll('[data-edge]').forEach(button => button.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      edges.add(button.dataset.edge);
    }));
    // held buttons (winch): data-winch = +1 lowers, -1 winds in
    root.querySelectorAll('[data-winch]').forEach(button => {
      const direction = +button.dataset.winch;
      const releaseButton = event => { event.preventDefault(); if (touch.winch === direction) touch.winch = 0; button.classList.remove('act'); };
      button.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); touch.winch = direction; button.classList.add('act'); });
      button.addEventListener('pointerup', releaseButton); button.addEventListener('pointercancel', releaseButton); button.addEventListener('pointerleave', releaseButton);
    });
  }
  setupTouch();

  function syncUI(state, stabOn, tutorialActive, fireLevel) {
    mode = state === 'play' ? 'play' : 'menu';
    if (!touchUi) return;
    const key = state + '|' + mode + '|' + stabOn + '|' + tutorialActive + '|' + fireLevel;
    if (key === touchUi.key) return;
    touchUi.key = key;
    touchUi.root.dataset.mode = mode;
    touchUi.root.dataset.state = state;
    touchUi.root.dataset.tut = tutorialActive ? '1' : '0';
    touchUi.root.dataset.fire = fireLevel ? '1' : '0';
    if (touchUi.stab) touchUi.stab.classList.toggle('act', !!stabOn);
  }

  // Values are quantized to 0.01 so replays reproduce them exactly.
  function sample() {
    pollPad();
    const keyboardX = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
    const keyboardUp = keys.ArrowUp || keys.KeyW ? 1 : 0;
    const keyboardDown = keys.ArrowDown || keys.KeyS ? 1 : 0;
    const keyboardWinch = (keys.KeyE ? 1 : 0) - (keys.KeyQ ? 1 : 0);
    const strongest = (...values) => values.reduce((strongest, candidate) => (Math.abs(candidate) > Math.abs(strongest) ? candidate : strongest), 0);
    const quantize = value => Math.round(clamp(value, -1, 1) * 100) / 100;
    const frameInput = {
      hx: quantize(strongest(keyboardX, gamepadState.hx, touch.hx)),
      up: quantize(Math.max(keyboardUp, gamepadState.up, touch.up)),
      down: quantize(Math.max(keyboardDown, gamepadState.down, touch.down)),
      winch: quantize(strongest(keyboardWinch, gamepadState.winch, touch.winch)),
      edges: new Set(edges),
    };
    edges.clear();
    return frameInput;
  }

  const RUMBLE = {
    explode: [320, 1], damage: [110, 0.8], death: [60, 0.4], hook: [35, 0.3], land: [45, 0.35],
    contact: [30, 0.3], slip: [70, 0.5], snag: [90, 0.7], dump: [80, 0.4], engineDie: [200, 0.6],
  };
  function rumble(name) {
    const pattern = RUMBLE[name];
    if (!pattern) return;
    try {
      if (device === 'touch' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern[0]);
      else if (device === 'pad' && gamepadState.gp && gamepadState.gp.vibrationActuator) {
        gamepadState.gp.vibrationActuator.playEffect('dual-rumble', { duration: pattern[0], strongMagnitude: pattern[1], weakMagnitude: pattern[1] * 0.6 }).catch(() => {});
      }
    } catch (error) { /* haptics are optional */ }
  }
  Sfx.onPlay(rumble);

  return { sample, syncUI, rumble, get device() { return device; } };
})();
