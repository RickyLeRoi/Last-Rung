// engine/gfx/lighting.js
'use strict';
/*
 * Per-column darkness and fog over the already drawn scene. The game builds the light sources, the engine paints the dark parts.
 * Both functions leave fillStyle at '#fff'. Randomness (flickering radii) belongs to the caller, never to this module.
 */
const Lighting = (() => {
  const { canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT } = Gfx;

  // circles: flat [x, y, radius, ...]; cones: [{ x, y, angle, halfAngle, length }]; pattern: fill for the dark parts.
  // Dashed edges are drawn along each cone.
  function darkness({ circles, cones, pattern }) {
    const lit = cones.map(cone => ({ x: cone.x, y: cone.y, a: cone.angle, dx: Math.sin(cone.angle), dy: Math.cos(cone.angle), c: Math.cos(cone.halfAngle), half: cone.halfAngle, len: cone.length }));
    const litSpans = [];
    canvasContext.fillStyle = pattern;
    for (let column = 0; column < SCREEN_WIDTH; column++) {
      litSpans.length = 0;
      const columnCenterX = column + 0.5;
      for (let i = 0; i < circles.length; i += 3) {
        const deltaX = columnCenterX - circles[i], radius = circles[i + 2];
        if (deltaX > -radius && deltaX < radius) { const halfChord = Math.sqrt(radius * radius - deltaX * deltaX); litSpans.push(circles[i + 1] - halfChord, circles[i + 1] + halfChord); }
      }
      for (const cone of lit) {
        const coneDeltaX = columnCenterX - cone.x;
        if (coneDeltaX < -cone.len || coneDeltaX > cone.len) continue;
        let litTop = 1e9, litBottom = -1e9;
        const scanStart = Math.max(0, Math.floor(cone.y - cone.len)), scanEnd = Math.min(SCREEN_HEIGHT, Math.ceil(cone.y + cone.len));
        for (let y = scanStart; y < scanEnd; y++) {
          const coneDeltaY = y + 0.5 - cone.y, distance = Math.sqrt(coneDeltaX * coneDeltaX + coneDeltaY * coneDeltaY);
          if (distance <= cone.len && coneDeltaX * cone.dx + coneDeltaY * cone.dy >= cone.c * distance) { if (y < litTop) litTop = y; litBottom = y + 1; }
        }
        if (litBottom > litTop) litSpans.push(litTop, litBottom);
      }
      const order = [];
      for (let i = 0; i < litSpans.length; i += 2) order.push(i);
      order.sort((first, second) => litSpans[first] - litSpans[second]);
      let darkFromY = 0;
      for (const i of order) {
        const spanTop = Math.max(0, Math.floor(litSpans[i])), spanBottom = Math.min(SCREEN_HEIGHT, Math.ceil(litSpans[i + 1]));
        if (spanTop > darkFromY) canvasContext.fillRect(column, darkFromY, 1, spanTop - darkFromY);
        if (spanBottom > darkFromY) darkFromY = spanBottom;
      }
      if (darkFromY < SCREEN_HEIGHT) canvasContext.fillRect(column, darkFromY, 1, SCREEN_HEIGHT - darkFromY);
    }
    canvasContext.fillStyle = '#fff';
    for (const cone of lit) {
      for (const sign of [-1, 1]) {
        const edgeAngle = cone.a + sign * cone.half;
        Gfx.drawLine(cone.x, cone.y, cone.x + Math.sin(edgeAngle) * cone.len * 0.8, cone.y + Math.cos(edgeAngle) * cone.len * 0.8, true);
      }
    }
  }

  // clear and thin: [x, y, radius] circles around the viewer (clear = no fog, thin = dithered fog); lights: flat [x, y, radius, ...] holes
  // punched through the fog; dark and dither: fill patterns.
  function fog({ clear, lights, thin, dark, dither }) {
    const circleSpan = (circle, column) => { const deltaX = column + 0.5 - circle[0]; if (deltaX <= -circle[2] || deltaX >= circle[2]) return null; const halfChord = Math.sqrt(circle[2] * circle[2] - deltaX * deltaX); return [circle[1] - halfChord, circle[1] + halfChord]; };
    for (let column = 0; column < SCREEN_WIDTH; column++) {
      const litSpans = [];
      const clearSpan = circleSpan(clear, column); if (clearSpan) litSpans.push(clearSpan);
      for (let i = 0; i < lights.length; i += 3) { const lightSpan = circleSpan([lights[i], lights[i + 1], lights[i + 2]], column); if (lightSpan) litSpans.push(lightSpan); }
      const thinSpan = circleSpan(thin, column);
      let y = 0;
      litSpans.sort((first, second) => first[0] - second[0]);
      const fill = (fromY, toY) => {
        if (toY <= fromY) return;
        if (!thinSpan) { canvasContext.fillStyle = dark; canvasContext.fillRect(column, fromY, 1, toY - fromY); return; }
        const thinTop = Math.max(0, Math.floor(thinSpan[0])), thinBottom = Math.min(SCREEN_HEIGHT, Math.ceil(thinSpan[1]));
        const segment = (segTop, segBottom, pattern) => { segTop = Math.max(segTop, fromY); segBottom = Math.min(segBottom, toY); if (segBottom > segTop) { canvasContext.fillStyle = pattern; canvasContext.fillRect(column, segTop, 1, segBottom - segTop); } };
        segment(0, thinTop, dark); segment(thinTop, thinBottom, dither); segment(thinBottom, SCREEN_HEIGHT, dark);
      };
      for (const litSpan of litSpans) {
        const litTop = Math.max(0, Math.floor(litSpan[0])), litBottom = Math.min(SCREEN_HEIGHT, Math.ceil(litSpan[1]));
        fill(y, litTop);
        if (litBottom > y) y = litBottom;
      }
      fill(y, SCREEN_HEIGHT);
    }
    canvasContext.fillStyle = '#fff';
  }

  return { darkness, fog };
})();
