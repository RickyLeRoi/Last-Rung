// games/formicaio/src/orders.js
'use strict';
// The player's will: a cursor that lays trails (dig orders under ground, pheromone above), marks chambers and plugs galleries.

function newCursor() {
  const level = game.L;
  return { x: level.entranceX + 0.5, y: level.queenChamber.y - CONFIG.cursor.startDepth, lastCellX: -1, lastCellY: -1, painting: false };
}

function chamberAt(x, y) {
  return game.L.chambers.find(chamber => (x - chamber.x) ** 2 + (y - chamber.y) ** 2 <= chamber.r * chamber.r) || null;
}

// One cell of trail: solid soil under the grass becomes a dig order, open ground gets fresh pheromone.
function paintCell(cellX, cellY) {
  const level = game.L;
  if (!inGrid(cellX, cellY)) return;
  const index = gridIndex(cellX, cellY), material = cellMaterial(cellX, cellY);
  if (material !== 0) {
    if (isUnderground(cellY) && DIGGABLE.has(material) && !level.digOrder[index]) { level.digOrder[index] = 1; level.fieldsDirty = true; }
    return;
  }
  level.pheromone[index] = 1;
}

function paintTrail() {
  const cursor = game.cursor, cellX = cellOf(cursor.x), cellY = cellOf(cursor.y);
  if (!cursor.painting) { paintCell(cellX, cellY); cursor.painting = true; }
  else if (cellX !== cursor.lastCellX || cellY !== cursor.lastCellY) bresenham(cursor.lastCellX, cursor.lastCellY, cellX, cellY, (x, y) => paintCell(x, y));
  cursor.lastCellX = cellX; cursor.lastCellY = cellY;
}

function markChamber() {
  const level = game.L, cursor = game.cursor, config = CONFIG.chamber, existing = chamberAt(cursor.x, cursor.y);
  if (existing) {
    if (existing.type === 'queen') { showMessage('QUESTA E LA CAMERA DELLA REGINA', 80); return; }
    existing.type = existing.type === 'nursery' ? 'pantry' : 'nursery';
    showMessage(existing.type === 'nursery' ? 'CAMERA: NURSERY (UOVA E LARVE)' : 'CAMERA: DISPENSA (SCORTE DI CIBO)', 80);
    level.fieldsDirty = true;
    return;
  }
  if (cursor.y - config.radius < level.groundY + 4) { showMessage('LE CAMERE SI SCAVANO SOTTO TERRA', 80); return; }
  if (level.chambers.length - 1 >= config.max) { showMessage('TROPPE CAMERE', 80); return; }
  if (level.chambers.some(chamber => Math.hypot(chamber.x - cursor.x, chamber.y - cursor.y) < chamber.r + config.radius + 4)) { showMessage('TROPPO VICINA A UN ALTRA CAMERA', 80); return; }
  const chamber = { x: round(cursor.x), y: round(cursor.y), r: config.radius, type: 'nursery', complete: false };
  level.chambers.push(chamber);
  for (let cellY = cellOf(chamber.y - chamber.r); cellY <= cellOf(chamber.y + chamber.r); cellY++) {
    for (let cellX = cellOf(chamber.x - chamber.r); cellX <= cellOf(chamber.x + chamber.r); cellX++) {
      if (Math.hypot(cellCenter(cellX) - chamber.x, cellCenter(cellY) - chamber.y) <= chamber.r) paintCell(cellX, cellY);
    }
  }
  game.used.chamber = true;
  showMessage('NUOVA CAMERA: COLLEGALA A UNA GALLERIA CON UNA PISTA', 110);
  Sfx.play('ui');
}

function togglePlug() {
  const level = game.L, cellX = cellOf(game.cursor.x), cellY = cellOf(game.cursor.y);
  const existing = level.plugs.findIndex(plug => plug.cellX === cellX && plug.cellY === cellY);
  if (existing >= 0) { level.plugs.splice(existing, 1); level.fieldsDirty = true; return; }
  if (!isUnderground(cellY) || !isWalkable(cellX, cellY) || chamberAt(cellCenter(cellX), cellCenter(cellY))) { showMessage('SI TAPPA SOLO UNA GALLERIA', 80); return; }
  level.plugs.push({ cellX, cellY });
  level.fieldsDirty = true;
  showMessage('TAPPO: LE FORMICHE PORTANO TERRA DAL CUMULO', 90);
}

function updateCursor(input) {
  const level = game.L, cursor = game.cursor, speed = CONFIG.cursor.speed;
  if (input.hx || input.up || input.down) game.used.move = true;
  cursor.x = clamp(cursor.x + input.hx * speed, 0, level.width - 1);
  cursor.y = clamp(cursor.y + (input.down - input.up) * speed, 0, level.height - 1);
  if (input.trail > 0.5) { paintTrail(); game.used.trail = true; } else cursor.painting = false;
  if (input.chamber) markChamber();
  if (input.plug) togglePlug();
  if (input.recall) {
    game.recall = !game.recall;
    showMessage(game.recall ? 'RICHIAMO: TUTTE DENTRO, NIENTE RACCOLTA' : 'RACCOLTA RIPRESA', 90);
    Sfx.play('ui');
  }
}

// Surface trails fade unless foragers carrying food walk them again; food near a fresh trail is known to the colony.
function updatePheromone() {
  const level = game.L, pheromone = level.pheromone, decay = level.trailDecay;
  for (let i = 0; i < pheromone.length; i++) if (pheromone[i] > 0) pheromone[i] = Math.max(0, pheromone[i] - decay);
}

function updateKnownFood() {
  const level = game.L, range = CONFIG.trail.knownRange, threshold = CONFIG.trail.known;
  level.knownFood = level.foods.filter(food => {
    const foodCellX = cellOf(food.x), foodCellY = cellOf(foodY(food));
    for (let cellY = foodCellY - range; cellY <= foodCellY + range; cellY++) {
      for (let cellX = foodCellX - range; cellX <= foodCellX + range; cellX++) if (inGrid(cellX, cellY) && level.pheromone[gridIndex(cellX, cellY)] >= threshold) return true;
    }
    return false;
  });
}

function updateChambers() {
  const level = game.L, need = CONFIG.chamber.complete;
  for (const chamber of level.chambers) {
    if (chamber.complete) continue;
    let total = 0, open = 0;
    for (let cellY = cellOf(chamber.y - chamber.r); cellY <= cellOf(chamber.y + chamber.r); cellY++) {
      for (let cellX = cellOf(chamber.x - chamber.r); cellX <= cellOf(chamber.x + chamber.r); cellX++) {
        if (Math.hypot(cellCenter(cellX) - chamber.x, cellCenter(cellY) - chamber.y) > chamber.r) continue;
        const material = cellMaterial(cellX, cellY);
        if (material !== 0 && !DIGGABLE.has(material)) continue;
        total++;
        if (material === 0) open++;
      }
    }
    if (open < total * need) continue;
    chamber.complete = true;
    level.fieldsDirty = true;
    showMessage(chamber.type === 'nursery' ? 'NURSERY PRONTA: LA REGINA PUO DEPORRE DI PIU' : 'DISPENSA PRONTA: PIU SCORTE', 110);
    Sfx.play('chamber');
  }
}
