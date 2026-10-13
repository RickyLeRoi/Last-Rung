// engine/core/loop.js
'use strict';
// Fixed 60 Hz simulation step, decoupled from the display refresh rate. A stall longer than 250 ms is not caught up.
// 20261013 ++ RG #skip_render: the test harness may define __SKIP_RENDER__() for long scripted runs (the simulation never reads the render).
const Loop = {
  start(step, render) {
    const STEP_MS = 1000 / 60;
    const skipRender = typeof __SKIP_RENDER__ === 'function' ? __SKIP_RENDER__ : () => false;
    let lastFrameTime = performance.now(), accumulatedTime = 0;
    function frame(now) {
      accumulatedTime += Math.min(250, now - lastFrameTime);
      lastFrameTime = now;
      while (accumulatedTime >= STEP_MS) { step(); accumulatedTime -= STEP_MS; }
      if (!skipRender()) render();
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  },
};
