// engine/core/replay.js
'use strict';
// Compact per-frame input recording. A frame is [axis0 * 100, axis1 * 100, ..., flagBits]; axes are already quantized to 0.01 by Input.
const Replay = {
  // schema = { axes: ['hx', ...], flags: ['stab', ...] } (at most 31 flags)
  codec({ axes, flags }) {
    return {
      encode(stepInput) {
        const frame = axes.map(name => round(stepInput[name] * 100));
        let bits = 0;
        flags.forEach((name, i) => { if (stepInput[name]) bits |= 1 << i; });
        frame.push(bits);
        return frame;
      },
      decode(frame) {
        const stepInput = {};
        axes.forEach((name, i) => { stepInput[name] = frame[i] / 100; });
        const bits = frame[axes.length];
        flags.forEach((name, i) => { stepInput[name] = !!(bits & (1 << i)); });
        return stepInput;
      },
    };
  },
};
