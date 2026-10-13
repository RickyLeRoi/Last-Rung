// engine/gfx/parallax.js
'use strict';
/*
 * Backdrop layers that scroll at a fraction of the camera, drawn behind the scene (screen coordinates, identity transform).
 * Depth in one bit: farther layers use sparser dither and dotted edges, nearer ones denser dither or plain black.
 * A layer is { factor, factorY, offsetX, wrap, baseY, profile, fill, edge, details }:
 *   factor / factorY: share of the camera movement on x / y (0 = still like the sky, 1 = moves with the scene; factorY default 0)
 *   profile: Int16Array of silhouette tops in layer coordinates, one per column; a top >= baseY means an empty column
 *   offsetX: layer x of profile[0] (default 0); wrap: repeat the profile forever (default true), otherwise empty outside it
 *   baseY: bottom of the silhouette (usually the horizon: water or ground hide what is below)
 *   fill: a Gfx pattern (white lit through the pattern) or a colour string such as '#000' (plain silhouette)
 *   edge: 'solid', 'dotted' or null (top outline, with vertical joins where the profile steps)
 *   details: flat [x, y, ...] white pixels in layer coordinates (lit windows, far lights), drawn only inside the silhouette
 * Generators take the game's own generator (mulberry32), never the simulation Rng: a backdrop is render data.
 */
const Parallax = (() => {
  const { canvasContext, SCREEN_WIDTH } = Gfx;
  const EMPTY = 32767;

  function topAt(layer, layerX) {
    const profile = layer.profile, length = profile.length;
    let index = layerX - (layer.offsetX || 0);
    if (layer.wrap === false) { if (index < 0 || index >= length) return EMPTY; } else index = ((index % length) + length) % length;
    const top = profile[index];
    return top >= layer.baseY ? EMPTY : top;
  }

  const shiftX = (layer, cameraX) => round(cameraX * layer.factor);
  const shiftY = (layer, cameraY) => round((cameraY || 0) * (layer.factorY || 0));

  function fillRun(layer, column, width, top, bottom) {
    if (typeof layer.fill === 'string') { canvasContext.fillStyle = layer.fill; canvasContext.fillRect(column, top, width, bottom - top); return; }
    canvasContext.fillStyle = '#fff'; canvasContext.fillRect(column, top, width, bottom - top);
    canvasContext.fillStyle = layer.fill; canvasContext.fillRect(column, top, width, bottom - top);
  }

  // Top outline plus the vertical joins where the profile steps (down to the base next to an empty column).
  function drawEdges(layer, tops, offsetX, offsetY, bottom) {
    const isDotted = layer.edge === 'dotted';
    const screenTop = column => tops[column + 1] === EMPTY ? bottom : tops[column + 1] - offsetY;
    let runStart = 0;
    for (let column = 0; column <= SCREEN_WIDTH; column++) {
      const top = column < SCREEN_WIDTH ? screenTop(column) : -1, previousTop = screenTop(column - 1);
      // solid edges: one rectangle per run of equal tops
      if (!isDotted && column > 0 && top !== previousTop) {
        if (previousTop < bottom) canvasContext.fillRect(runStart, previousTop, column - runStart, 1);
        runStart = column;
      }
      if (column === SCREEN_WIDTH) break;
      if (isDotted && top < bottom && ((column + offsetX) & 1) === 0) canvasContext.fillRect(column, top, 1, 1);
      if (previousTop === top) continue;
      const joinColumn = previousTop < top ? column - 1 : column, joinTop = Math.min(top, previousTop) + 1, joinBottom = Math.max(top, previousTop);
      if (!isDotted) { if (joinBottom > joinTop) canvasContext.fillRect(joinColumn, joinTop, 1, joinBottom - joinTop); continue; }
      for (let y = joinTop; y < joinBottom; y++) if ((y & 1) === 0) canvasContext.fillRect(joinColumn, y, 1, 1);
    }
  }

  function drawDetails(layer, tops, offsetX, offsetY) {
    const details = layer.details || [], period = layer.wrap === false ? 0 : layer.profile.length;
    for (let i = 0; i < details.length; i += 2) {
      const firstColumn = details[i] + (layer.offsetX || 0) - offsetX, y = details[i + 1];
      for (let column = period ? ((firstColumn % period) + period) % period : firstColumn; column < SCREEN_WIDTH; column += period || Infinity) {
        if (column >= 0 && y > tops[column + 1] && y < layer.baseY) canvasContext.fillRect(column, y - offsetY, 1, 1);
      }
    }
  }

  function drawLayer(layer, cameraX, cameraY) {
    const offsetX = shiftX(layer, cameraX), offsetY = shiftY(layer, cameraY), bottom = layer.baseY - offsetY;
    const tops = new Int16Array(SCREEN_WIDTH + 1);
    for (let column = -1; column < SCREEN_WIDTH; column++) tops[column + 1] = topAt(layer, column + offsetX);
    if (layer.fill) {
      for (let column = 0; column < SCREEN_WIDTH;) {
        const top = tops[column + 1];
        let runEnd = column + 1;
        while (runEnd < SCREEN_WIDTH && tops[runEnd + 1] === top) runEnd++;
        if (top !== EMPTY) fillRun(layer, column, runEnd - column, top - offsetY, bottom);
        column = runEnd;
      }
    }
    canvasContext.fillStyle = '#fff';
    if (layer.edge) drawEdges(layer, tops, offsetX, offsetY, bottom);
    drawDetails(layer, tops, offsetX, offsetY);
  }

  // Farthest first. Leaves fillStyle at '#fff'.
  function draw(layers, cameraX, cameraY) {
    for (const layer of layers) drawLayer(layer, cameraX, cameraY);
    canvasContext.fillStyle = '#fff';
  }

  // Screen columns hidden by the layers, in the format of Sky.drawNight covers: flat [fromX, toX, y, ...].
  function covers(layers, cameraX, cameraY) {
    const result = [];
    for (const layer of layers) {
      const offsetX = shiftX(layer, cameraX), offsetY = shiftY(layer, cameraY);
      for (let column = 0; column < SCREEN_WIDTH;) {
        const top = topAt(layer, column + offsetX);
        let runEnd = column + 1;
        while (runEnd < SCREEN_WIDTH && topAt(layer, runEnd + offsetX) === top) runEnd++;
        if (top !== EMPTY) result.push(column, runEnd, top - offsetY - 1);
        column = runEnd;
      }
    }
    return result;
  }

  /*
   * Periodic ridge (hills, mountains): control points every `step` px, smoothly interpolated, plus a finer octave
   * (`roughness` 0..1 of the amplitude). Tops lie between baseY - lowest - amplitude and baseY - lowest. period must be a multiple of step.
   */
  function ridge(random, { period, step, baseY, lowest, amplitude, roughness = 0 }) {
    const coarse = Array.from({ length: period / step }, () => random());
    const fineStep = Math.max(2, step >> 2);
    const fine = Array.from({ length: period / fineStep }, () => random());
    const smooth = (points, pointStep, x) => {
      const index = Math.floor(x / pointStep), fraction = (x - index * pointStep) / pointStep, eased = fraction * fraction * (3 - 2 * fraction);
      const from = points[index % points.length], to = points[(index + 1) % points.length];
      return from + (to - from) * eased;
    };
    const profile = new Int16Array(period);
    for (let x = 0; x < period; x++) {
      const height = smooth(coarse, step, x) * (1 - roughness) + smooth(fine, fineStep, x) * roughness;
      profile[x] = round(baseY - lowest - height * amplitude);
    }
    return profile;
  }

  // Rectangles { x, y, w } (x from offsetX) into a profile: the highest top wins where they overlap.
  function blocks(rectangles, offsetX, length) {
    const profile = new Int16Array(length).fill(EMPTY);
    for (const rectangle of rectangles) {
      for (let x = Math.max(0, rectangle.x - offsetX); x < Math.min(length, rectangle.x - offsetX + rectangle.w); x++) if (rectangle.y < profile[x]) profile[x] = rectangle.y;
    }
    return profile;
  }

  return { draw, covers, ridge, blocks };
})();
