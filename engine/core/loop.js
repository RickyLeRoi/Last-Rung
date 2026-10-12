// engine/core/loop.js
'use strict';
// Fixed 60 Hz simulation step, decoupled from the display refresh rate. A stall longer than 250 ms is not caught up.
const Loop = {
  start(step, render) {
    const STEP_MS = 1000 / 60;
    let lastFrameTime = performance.now(), accumulatedTime = 0;
    function frame(now) {
      accumulatedTime += Math.min(250, now - lastFrameTime);
      lastFrameTime = now;
      while (accumulatedTime >= STEP_MS) { step(); accumulatedTime -= STEP_MS; }
      render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  },
};
