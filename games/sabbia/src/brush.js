// games/sabbia/src/brush.js
'use strict';
// The brush: a cursor on the grid that paints the selected material into the free cells under it (empty or gas), or erases.
// In a challenge every painted cell costs one unit of that material's budget; the eraser never removes the cells of the scene.

const NO_INPUT = Object.freeze({ hx: 0, up: 0, down: 0, paint: 0, next: false, previous: false, size: false });

const selectedMaterial = () => game.L.palette[game.selected];

function newCursor() {
  const start = game.L.cursorStart;
  return { x: start[0], y: start[1] };
}

function budgetLeft(id) {
  const budget = game.L.budget;
  return !budget || budget[id] === undefined ? Infinity : budget[id];
}

const isFree = id => id === MATERIAL.empty || (KIND_OF[id] === KIND.gas && id !== MATERIAL.fire);

const inZone = (x, y) => { const zone = game.L.zone; return !zone || (x >= zone.x && x < zone.x + zone.width && y >= zone.y && y < zone.y + zone.height); };

function paintAt(centerX, centerY) {
  const world = game.L.world, id = selectedMaterial(), radius = CONFIG.brush.sizes[game.brushSize];
  let painted = 0;
  for (let y = centerY - radius; y <= centerY + radius; y++) {
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      if (!inside(x, y) || !inZone(x, y) || (x - centerX) ** 2 + (y - centerY) ** 2 > radius * radius + radius) continue;
      const index = cellIndex(x, y), current = world.material[index];
      if (id === ERASER) {
        if (current !== MATERIAL.empty && !world.locked[index]) { setCell(world, index, MATERIAL.empty, CONFIG.heat.ambient); painted++; }
        continue;
      }
      if (current === id || !isFree(current) || budgetLeft(id) <= 0) continue;
      setCell(world, index, id);
      if (game.L.budget && game.L.budget[id] !== undefined) game.L.budget[id]--;
      painted++;
    }
  }
  return painted;
}

function updateBrush(input) {
  const level = game.L, cursor = game.cursor, speed = CONFIG.cursor.speed;
  if (input.hx || input.up || input.down) game.used.move = true;
  cursor.x = clamp(cursor.x + input.hx * speed, 0, COLUMNS - 1);
  cursor.y = clamp(cursor.y + (input.down - input.up) * speed, 0, ROWS - 1);
  if (input.next || input.previous) {
    game.selected = (game.selected + (input.next ? 1 : level.palette.length - 1)) % level.palette.length;
    game.used.select = true;
    showMessage(materialName(selectedMaterial()) + (level.budget && level.budget[selectedMaterial()] !== undefined ? ': ' + level.budget[selectedMaterial()] : ''), 60);
    Sfx.play('select');
  }
  if (input.size) { game.brushSize = (game.brushSize + 1) % CONFIG.brush.sizes.length; Sfx.play('select'); }
  if (input.paint > 0.5) {
    const painted = paintAt(Math.round(cursor.x), Math.round(cursor.y));
    if (painted) { game.used.paint = true; game.painted += painted; if (game.frame % 8 === 0) Sfx.play('paint'); }
    else if (budgetLeft(selectedMaterial()) <= 0 && game.msgT === 0) { showMessage(materialName(selectedMaterial()) + ' FINITO', 60); Sfx.play('empty'); }
  }
}
