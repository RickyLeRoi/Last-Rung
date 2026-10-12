// engine/input/input.js
'use strict';
/*
 * Keyboard, gamepad and touch input. The game describes itself once with Input.configure(bindings):
 *   keyEdges   { KeyCode: 'edgeName' }       one-shot events fired on key down
 *   padEdges   { buttonIndex: ['edgeName'] } one-shot events fired on button press
 *   blockKeys  [KeyCode]                     keys whose browser default (scrolling) is suppressed
 *   rumble     { effectName: [ms, strength] } haptics, played through Input.rumble(name)
 *   unlock()                                 called on the first user gesture (audio context)
 *   axes(raw)  -> { name: value, ... }       composes the continuous axes; may add padActive: true when the pad drives the game
 * raw = { keys, pad: { axes, buttons, pressed(i), axis(value) } | null, touch: { stickX, stickY, held } }
 * Touch markup contract: #touch (root), #stickZone, #stickBase, #stickKnob, [data-edge="name"] buttons, [data-hold="name:value"] held buttons.
 * Every axis returned by axes() is quantized to 0.01 so replays reproduce it exactly. The edge 'confirm' is used by the engine itself
 * (first touch, tap on the stick zone outside play).
 */
const Input = (() => {
  const keys = {};
  const edges = new Set();
  const gamepadState = { prev: {}, gp: null };
  const touch = { stickX: 0, stickY: 0, held: {}, id: null, ox: 0, oy: 0 };
  let device = 'kb';
  let mode = 'menu';
  let bindings = null;
  let touchUi = null;

  function configure(newBindings) {
    bindings = newBindings;
    const blocked = new Set(bindings.blockKeys || []);
    window.addEventListener('keydown', event => {
      if (blocked.has(event.code) && event.preventDefault) event.preventDefault();
      bindings.unlock();
      if (!keys[event.code] && bindings.keyEdges[event.code]) edges.add(bindings.keyEdges[event.code]);
      keys[event.code] = true;
      device = 'kb';
    });
    window.addEventListener('keyup', event => { keys[event.code] = false; });
    window.addEventListener('blur', () => { for (const code in keys) keys[code] = false; });
    setupTouch();
  }

  // Returns the pad context for the first connected gamepad, or null.
  function pollPad() {
    if (typeof navigator === 'undefined' || !navigator.getGamepads) return null;
    let gamepads;
    try { gamepads = navigator.getGamepads(); } catch (error) { return null; }
    for (const gamepad of gamepads || []) {
      if (!gamepad || gamepad.connected === false) continue;
      gamepadState.gp = gamepad;
      const pressed = buttonIndex => !!(gamepad.buttons[buttonIndex] && gamepad.buttons[buttonIndex].pressed);
      for (const i in bindings.padEdges) {
        const isPressed = pressed(+i);
        if (isPressed && !gamepadState.prev[i]) { for (const edge of bindings.padEdges[i]) edges.add(edge); device = 'pad'; }
        gamepadState.prev[i] = isPressed;
      }
      const deadzone = CONFIG.input.deadzone;
      const axis = value => (Math.abs(value) < deadzone ? 0 : (value - Math.sign(value) * deadzone) / (1 - deadzone));
      return { axes: gamepad.axes, buttons: gamepad.buttons, pressed, axis };
    }
    return null;
  }

  function setupTouch() {
    const root = document.getElementById('touch');
    if (!root || !root.querySelector) return;
    const zone = root.querySelector('#stickZone');
    const base = root.querySelector('#stickBase');
    const knob = root.querySelector('#stickKnob');
    const stickRadius = CONFIG.input.stickRadius;
    touchUi = { root, key: '' };

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
      bindings.unlock();
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
      touch.stickX = touchAxis(deltaX); touch.stickY = touchAxis(deltaY);
    });
    const endDrag = event => {
      if (event.pointerId !== touch.id) return;
      touch.id = null; touch.stickX = touch.stickY = 0;
      base.classList.remove('on');
    };
    zone.addEventListener('pointerup', endDrag);
    zone.addEventListener('pointercancel', endDrag);
    root.querySelectorAll('[data-edge]').forEach(button => button.addEventListener('pointerdown', event => {
      event.preventDefault(); event.stopPropagation();
      edges.add(button.dataset.edge);
    }));
    // held buttons: data-hold="name:value" keeps touch.held[name] = value while pressed
    root.querySelectorAll('[data-hold]').forEach(button => {
      const [name, rawValue] = button.dataset.hold.split(':'), value = +rawValue;
      const releaseButton = event => { event.preventDefault(); if (touch.held[name] === value) touch.held[name] = 0; button.classList.remove('act'); };
      button.addEventListener('pointerdown', event => { event.preventDefault(); event.stopPropagation(); touch.held[name] = value; button.classList.add('act'); });
      button.addEventListener('pointerup', releaseButton); button.addEventListener('pointercancel', releaseButton); button.addEventListener('pointerleave', releaseButton);
    });
  }

  // flags: { name: boolean } become data-<name>="1|0" on the touch root (CSS decides which buttons show);
  // activeButtons: { selector: boolean } toggle the 'act' class on toggle buttons.
  function syncUI(state, flags, activeButtons) {
    mode = state === 'play' ? 'play' : 'menu';
    if (!touchUi) return;
    const key = state + '|' + mode + '|' + JSON.stringify(flags) + '|' + JSON.stringify(activeButtons);
    if (key === touchUi.key) return;
    touchUi.key = key;
    touchUi.root.dataset.mode = mode;
    touchUi.root.dataset.state = state;
    for (const name in flags) touchUi.root.dataset[name] = flags[name] ? '1' : '0';
    for (const selector in activeButtons) {
      const button = touchUi.root.querySelector(selector);
      if (button) button.classList.toggle('act', !!activeButtons[selector]);
    }
  }

  function sample() {
    const pad = pollPad();
    const composed = bindings.axes({ keys, pad, touch: { stickX: touch.stickX, stickY: touch.stickY, held: touch.held } });
    if (composed.padActive) device = 'pad';
    const frameInput = {};
    for (const name in composed) {
      if (name !== 'padActive') frameInput[name] = Math.round(clamp(composed[name], -1, 1) * 100) / 100;
    }
    frameInput.edges = new Set(edges);
    edges.clear();
    return frameInput;
  }

  function rumble(name) {
    const pattern = bindings.rumble[name];
    if (!pattern) return;
    try {
      if (device === 'touch' && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(pattern[0]);
      else if (device === 'pad' && gamepadState.gp && gamepadState.gp.vibrationActuator) {
        gamepadState.gp.vibrationActuator.playEffect('dual-rumble', { duration: pattern[0], strongMagnitude: pattern[1], weakMagnitude: pattern[1] * 0.6 }).catch(() => {});
      }
    } catch (error) { /* haptics are optional */ }
  }

  return { configure, sample, syncUI, rumble, get device() { return device; }, get bindings() { return bindings; } };
})();
