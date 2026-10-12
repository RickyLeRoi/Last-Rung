// engine/core/steps.js
'use strict';
// Guided tutorial made of steps. A step is { text } or { kb, touch, pad } (text per input device) plus done(): the step completes by
// itself as soon as its condition holds, so doing things in a different order never blocks progress.
const Steps = {
  // state = { step }; calls onAdvance() once per completed step.
  update(state, steps, onAdvance) {
    while (state.step < steps.length && steps[state.step].done()) { state.step++; onAdvance(); }
  },
  text(step) {
    return step.text || UI.hint(step.kb, step.touch, step.pad);
  },
};
