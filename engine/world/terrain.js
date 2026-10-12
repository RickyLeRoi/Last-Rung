// engine/world/terrain.js
'use strict';
/*
 * Terrain as a mask of materials, one cell per pixel: 0 is empty, any other number is a solid material chosen by the game
 * (snow, rock, rubble...). Plain data, no reference to the game; generation belongs to the game, with its own generator.
 * Outside the mask, left and right and below are solid, above is empty: bodies cannot leave the world sideways.
 */
const Terrain = (() => {
  function make(width, height) {
    return { width, height, cells: new Uint8Array(width * height) };
  }

  function get(terrain, x, y) {
    x = Math.floor(x); y = Math.floor(y);
    if (y < 0) return 0;
    if (x < 0 || x >= terrain.width || y >= terrain.height) return 255;
    return terrain.cells[y * terrain.width + x];
  }
  const isSolid = (terrain, x, y) => get(terrain, x, y) !== 0;

  function set(terrain, x, y, material) {
    if (x >= 0 && x < terrain.width && y >= 0 && y < terrain.height) terrain.cells[y * terrain.width + x] = material;
  }

  function fillRect(terrain, x, y, width, height, material) {
    for (let row = Math.floor(y); row < Math.floor(y) + height; row++) for (let column = Math.floor(x); column < Math.floor(x) + width; column++) set(terrain, column, row, material);
  }

  // Calls visit(x, y) for every cell of the disc.
  function eachInCircle(centerX, centerY, radius, visit) {
    const top = Math.floor(centerY - radius), bottom = Math.ceil(centerY + radius), left = Math.floor(centerX - radius), right = Math.ceil(centerX + radius);
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) {
      const deltaX = x + 0.5 - centerX, deltaY = y + 0.5 - centerY;
      if (deltaX * deltaX + deltaY * deltaY <= radius * radius) visit(x, y);
    }
  }

  // onlyEmpty: keeps the cells that are already solid (snow settling on rock does not replace it). Returns how many cells changed.
  function fillCircle(terrain, centerX, centerY, radius, material, onlyEmpty) {
    let changed = 0;
    eachInCircle(centerX, centerY, radius, (x, y) => {
      if (x < 0 || x >= terrain.width || y < 0 || y >= terrain.height) return;
      const current = terrain.cells[y * terrain.width + x];
      if (current === material || (onlyEmpty && current !== 0)) return;
      terrain.cells[y * terrain.width + x] = material;
      changed++;
    });
    return changed;
  }

  // Empties the cells of the disc made of `material` (any solid material when it is undefined). Returns how many cells it removed.
  function carveCircle(terrain, centerX, centerY, radius, material) {
    let removed = 0;
    eachInCircle(centerX, centerY, radius, (x, y) => {
      if (x < 0 || x >= terrain.width || y < 0 || y >= terrain.height) return;
      const current = terrain.cells[y * terrain.width + x];
      if (current === 0 || (material !== undefined && current !== material)) return;
      terrain.cells[y * terrain.width + x] = 0;
      removed++;
    });
    return removed;
  }

  // 20261012 ++ RG #loose_material
  // Loose material (snow, rubble) falls: every cell of `material` in column x with an empty cell under it moves down one row (cells
  // stacked over a gap all move together). Other materials never move. Calls onMove(x, newY) per moved cell; returns how many moved.
  function settleColumn(terrain, x, material, onMove) {
    if (x < 0 || x >= terrain.width) return 0;
    const { cells, width } = terrain;
    let moved = 0;
    for (let y = terrain.height - 2; y >= 0; y--) {
      if (cells[y * width + x] !== material || cells[(y + 1) * width + x] !== 0) continue;
      cells[(y + 1) * width + x] = material;
      cells[y * width + x] = 0;
      moved++;
      if (onMove) onMove(x, y + 1);
    }
    return moved;
  }

  // First solid row at or below fromY in column x (the height of the mask when the column is empty down to the bottom).
  function surfaceY(terrain, x, fromY) {
    const column = Math.floor(x);
    if (column < 0 || column >= terrain.width) return Math.max(0, Math.floor(fromY || 0));
    for (let y = Math.max(0, Math.floor(fromY || 0)); y < terrain.height; y++) if (terrain.cells[y * terrain.width + column]) return y;
    return terrain.height;
  }

  // True when any cell under the rectangle [x, x + width) x [y, y + height) is solid.
  function hitsRect(terrain, x, y, width, height) {
    const left = Math.floor(x), right = Math.ceil(x + width) - 1, top = Math.floor(y), bottom = Math.ceil(y + height) - 1;
    for (let row = top; row <= bottom; row++) for (let column = left; column <= right; column++) if (isSolid(terrain, column, row)) return true;
    return false;
  }

  // Moves body { x, y, w, h } by (deltaX, deltaY) in steps of at most 1 px, first sideways then vertically, so it never tunnels through
  // a thin wall. A sideways step blocked by a ledge at most stepUp px high climbs it. Returns { hitX, hitY }.
  function moveRect(terrain, body, deltaX, deltaY, stepUp) {
    let hitX = false, hitY = false, remaining = deltaX;
    while (remaining !== 0 && !hitX) {
      const step = Math.abs(remaining) > 1 ? Math.sign(remaining) : remaining;
      remaining -= step;
      if (!hitsRect(terrain, body.x + step, body.y, body.w, body.h)) { body.x += step; continue; }
      let climbed = false;
      for (let rise = 1; rise <= (stepUp || 0) && !climbed; rise++) {
        if (!hitsRect(terrain, body.x + step, body.y - rise, body.w, body.h)) { body.x += step; body.y -= rise; climbed = true; }
      }
      if (!climbed) hitX = true;
    }
    remaining = deltaY;
    while (remaining !== 0 && !hitY) {
      const step = Math.abs(remaining) > 1 ? Math.sign(remaining) : remaining;
      remaining -= step;
      if (hitsRect(terrain, body.x, body.y + step, body.w, body.h)) hitY = true; else body.y += step;
    }
    return { hitX, hitY };
  }

  /*
   * Draws the cells of the window [left, left + width) x [top, top + height) at their world coordinates (the caller sets the camera
   * transform, so the patterns stay fixed to the ground while it scrolls). patterns = { material: fill pattern }: each material is a
   * white run darkened by its pattern, with a 1 px white edge where it borders empty cells. Leaves fillStyle at '#fff'.
   */
  function draw(terrain, left, top, width, height, patterns) {
    const { canvasContext } = Gfx;
    left = Math.floor(left); top = Math.floor(top);
    const edges = [];
    for (let y = top; y < top + height; y++) {
      let runStart = left, runMaterial = get(terrain, left, y);
      for (let x = left; x <= left + width; x++) {
        const material = x < left + width ? get(terrain, x, y) : -1;
        if (material > 0 && material !== 255 && (!isSolid(terrain, x, y - 1) || !isSolid(terrain, x, y + 1) || !isSolid(terrain, x - 1, y) || !isSolid(terrain, x + 1, y))) edges.push(x, y);
        if (material === runMaterial) continue;
        if (runMaterial > 0 && patterns[runMaterial]) {
          canvasContext.fillStyle = '#fff'; canvasContext.fillRect(runStart, y, x - runStart, 1);
          canvasContext.fillStyle = patterns[runMaterial]; canvasContext.fillRect(runStart, y, x - runStart, 1);
        }
        runStart = x; runMaterial = material;
      }
    }
    canvasContext.fillStyle = '#fff';
    for (let i = 0; i < edges.length; i += 2) canvasContext.fillRect(edges[i], edges[i + 1], 1, 1);
  }

  return { make, get, isSolid, fillRect, fillCircle, carveCircle, settleColumn, surfaceY, hitsRect, moveRect, draw };
})();
