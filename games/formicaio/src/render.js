// games/formicaio/src/render.js
'use strict';
// Drawing only: nothing here may change the simulation state.
const { canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT, DITHER, DARK, DUSK, horizontalLine, verticalLine, blackRect, drawLine, drawCircle, text, textBox, drawPanel, drawSprite } = Gfx;
const hint = UI.hint;
const bar = UI.bar;
const TERRAIN_PATTERNS = { [CONFIG.material.soil]: DARK, [CONFIG.material.sand]: DUSK, [CONFIG.material.stone]: '#fff', [CONFIG.material.root]: '#fff', [CONFIG.material.water]: DITHER };

const cameraLeft = () => round(game.camX);
const cameraTop = () => round(game.camY);
const toWorld = () => canvasContext.setTransform(1, 0, 0, 1, -cameraLeft(), -cameraTop());
const toScreen = () => canvasContext.setTransform(1, 0, 0, 1, 0, 0);
const isVisible = (x, y, margin) => x > game.camX - margin && x < game.camX + SCREEN_WIDTH + margin && y > game.camY - margin && y < game.camY + SCREEN_HEIGHT + margin;

function drawSky() {
  const sunX = 320 - round(game.camX * 0.05), sunY = 30 - cameraTop();
  if (sunY > -10) drawCircle(sunX, sunY, 8);
  Parallax.draw(game.L.backdrop, cameraLeft(), cameraTop());
}

// Visible cells only: trails as dots on the grass, dig orders as dark notches in the soil.
function drawOrders() {
  const level = game.L, frame = game.frame;
  const firstX = Math.max(0, cellOf(game.camX)), lastX = Math.min(level.gridWidth - 1, cellOf(game.camX + SCREEN_WIDTH));
  const firstY = Math.max(0, cellOf(game.camY)), lastY = Math.min(level.gridHeight - 1, cellOf(game.camY + SCREEN_HEIGHT));
  for (let cellY = firstY; cellY <= lastY; cellY++) {
    for (let cellX = firstX; cellX <= lastX; cellX++) {
      const index = gridIndex(cellX, cellY), x = cellX * CELL, y = cellY * CELL;
      if (level.digOrder[index] && cellMaterial(cellX, cellY) !== 0) {
        blackRect(x + 1, y + 1, 2, 2);
        if (((cellX + cellY + (frame >> 4)) & 3) === 0) canvasContext.fillRect(x + 1, y + 1, 1, 1);
      } else if (level.pheromone[index] >= CONFIG.trail.known && !isUnderground(cellY) && ((cellX + (frame >> 5)) & 1) === 0) {
        canvasContext.fillRect(x + 2, y + 3, 1, 1);
      }
    }
  }
  for (const plug of level.plugs) {
    const x = cellCenter(plug.cellX), y = cellCenter(plug.cellY);
    drawLine(x - 2, y - 2, x + 2, y + 2); drawLine(x - 2, y + 2, x + 2, y - 2);
  }
}

function drawChambers() {
  for (const chamber of game.L.chambers) {
    if (!isVisible(chamber.x, chamber.y, chamber.r + 4)) continue;
    if (!chamber.complete) { drawCircle(chamber.x, chamber.y, chamber.r, true); continue; }
    if (chamber.type !== 'queen') text(chamber.type === 'nursery' ? 'N' : 'D', chamber.x, chamber.y - chamber.r + 3, 1, 'c');
  }
  const queen = game.L.queenChamber;
  drawSprite(SPRITES.queen, queen.x - 3, queen.y + queen.r - 5);
  for (const item of game.brood) {
    const chamber = item.chamber, x = chamber.x - 6 + (item.slot % 6) * 2 + (chamber.type === 'queen' ? 8 : 0), y = chamber.y + chamber.r - 3 - Math.floor(item.slot / 6) * 3;
    if (item.stage === 'egg') canvasContext.fillRect(x, y + 1, 1, 1);
    else if (item.stage === 'larva') drawSprite(SPRITES.larva, x, y + 1);
    else drawSprite(SPRITES.pupa, x, y);
  }
}

function drawFood() {
  for (const food of game.L.foods) {
    const sprite = SPRITES[food.kind], y = foodY(food);
    if (isVisible(food.x, y, 10)) drawSprite(sprite, food.x - (sprite.w >> 1), y - sprite.h + 1);
  }
}

function drawSpiders() {
  for (const spider of game.L.spiders) {
    const y = spiderY(spider);
    if (isVisible(spider.x, y, 12)) drawSprite((game.frame >> 3) & 1 ? SPRITES.spiderStep : SPRITES.spider, round(spider.x) - 4, round(y) - 3);
  }
}

function drawAnts() {
  for (const ant of game.ants) {
    const position = antPosition(ant), x = round(position.x), y = round(position.y);
    if (!isVisible(x, y, 6)) continue;
    const moving = ant.t > 0 && ((ant.t >> 1) & 1);
    drawSprite(moving ? SPRITES.antStep : SPRITES.ant, x - 1, y - 1, ant.face < 0);
    if (ant.carry) canvasContext.fillRect(x + (ant.face < 0 ? -1 : 1), y - 2, ant.heavy ? 2 : 1, 1);
    else if (ant.digT > 0 && (ant.digT >> 2) & 1) canvasContext.fillRect(x + (ant.face < 0 ? -2 : 2), y, 1, 1);
  }
}

function drawCursor() {
  if (game.state === 'title') return;
  const x = round(game.cursor.x), y = round(game.cursor.y), arm = game.cursor.painting ? 4 : 3;
  blackRect(x - arm - 3, y - 1, arm + 3, 3); blackRect(x + 1, y - 1, arm + 3, 3);
  blackRect(x - 1, y - arm - 3, 3, arm + 3); blackRect(x - 1, y + 1, 3, arm + 3);
  horizontalLine(x - arm - 2, x - 2, y); horizontalLine(x + 2, x + arm + 2, y);
  verticalLine(x, y - arm - 2, y - 2); verticalLine(x, y + 2, y + arm + 2);
  if (game.cursor.painting && (game.frame >> 2) & 1) canvasContext.fillRect(x, y, 1, 1);
}

function drawParticles() {
  for (const particle of game.parts) canvasContext.fillRect(round(particle.x), round(particle.y), particle.w || 1, particle.h || 1);
}

function drawRain() {
  for (const drop of game.rain) drawLine(drop.x, drop.y, drop.x - game.wind * 1.5 - 0.5, drop.y - 3);
}

function drawHUD() {
  const level = game.L, frame = game.frame;
  blackRect(0, 0, SCREEN_WIDTH, 11); blackRect(0, SCREEN_HEIGHT - 11, SCREEN_WIDTH, 11);
  for (let x = 0; x < SCREEN_WIDTH; x += 2) { canvasContext.fillRect(x, 10, 1, 1); canvasContext.fillRect(x, SCREEN_HEIGHT - 11, 1, 1); }
  const label = level.tutorial ? 'ADDESTRAMENTO' : level.spec.daily ? 'SFIDA ' + level.spec.daily.slice(5).split('-').reverse().join('/') + ' ' + level.sc.name : 'LV' + level.n + ' ' + level.sc.name;
  text(label, 3, 3);
  text('OPERAIE ' + game.ants.length + '/' + level.target + '  COVATA ' + game.brood.length + '  PUNTI ' + game.score, SCREEN_WIDTH - 3, 3, 1, 'r');
  const y = SCREEN_HEIGHT - 8;
  text('CIBO', 3, y);
  bar(22, y - 1, 40, game.stock / stockCapacity());
  text(Math.floor(game.stock) + '/' + stockCapacity(), 66, y);
  if (level.season !== Infinity) {
    text('STAGIONE', 104, y);
    const left = 1 - game.clock / level.season;
    if (left > 0.15 || (frame >> 3) & 1) bar(140, y - 1, 60, left);
  }
  if (game.recall && (frame >> 4) & 1) text('RICHIAMO', SCREEN_WIDTH - 3, y, 1, 'r');
  else if (game.rain.length && (frame >> 3) & 1) text('TEMPORALE!', SCREEN_WIDTH - 3, y, 1, 'r');
  else if (level.plugs.length) text('TAPPI ' + level.plugs.length, SCREEN_WIDTH - 3, y, 1, 'r');
  if (game.msgT > 0 && !(game.msgT < 30 && (frame >> 2) & 1)) textBox(game.msg, SCREEN_WIDTH / 2, 14, 'c');
  if (level.tutorial && game.tut && game.state !== 'done') {
    const step = TUTORIAL[game.tut.step];
    if (step) textBox(tutorialText(step), SCREEN_WIDTH / 2, 26, 'c');
    if (game.state === 'play') text(hint('N: SALTA', 'SALTA: ESCI', 'Y: SALTA'), 3, 14);
  }
  if (game.state === 'replay' && (frame >> 4) & 1) textBox('REPLAY  -  ' + hint('INVIO', 'TOCCA', 'A') + ' PER SALTARE', SCREEN_WIDTH / 2, 38, 'c');
}

function drawOverlay() {
  const level = game.L, blink = (game.frame >> 5) & 1, state = game.state;
  if (state === 'title') {
    drawPanel(30, 16, SCREEN_WIDTH - 60, SCREEN_HEIGHT - 32);
    text('FORMICAIO', SCREEN_WIDTH / 2, 26, 3, 'c');
    text("SEI LA COLONIA: FALLA CRESCERE PRIMA DELL'INVERNO", SCREEN_WIDTH / 2, 46, 1, 'c');
    const controls = hint(
      ['FRECCE : CURSORE    SPAZIO (TIENI) : TRACCIA UNA PISTA', 'X : CAMERA    Z : RICHIAMA    C : TAPPA', 'P PAUSA  R RICOMINCIA  M AUDIO  V REPLAY'],
      ['LEVETTA : CURSORE    TRACCIA (TIENI) : PISTA', 'CAMERA    RICHIAMA    TAPPA', 'II : PAUSA     AUDIO : SUONO SI/NO'],
      ['LEVETTA / CROCE : CURSORE    A (TIENI) : PISTA', 'X : CAMERA    B : RICHIAMA    RB : TAPPA', 'START PAUSA  BACK RICOMINCIA  Y REPLAY']);
    const rules = [
      'PISTA SOTTO TERRA: LE OPERAIE SCAVANO. SULL ERBA: TROVANO IL CIBO',
      'IL CIBO DIVENTA UOVA, LARVE E OPERAIE. SERVONO NURSERY',
      'IL RAGNO MANGIA LE ISOLATE. LA PIOGGIA ALLAGA LE GALLERIE',
    ];
    controls.concat([''], rules).forEach((line, i) => text(line, SCREEN_WIDTH / 2, 58 + i * 9, 1, 'c'));
    if (blink) text(hint('INVIO: GIOCA     G: SFIDA DEL GIORNO', 'TOCCA PER GIOCARE', 'A: GIOCA     Y: SFIDA DEL GIORNO'), SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30, 1, 'c');
  } else if (state === 'intro') {
    const notes = [];
    if (level.rainy) notes.push('TEMPORALI: ' + level.showers.length + ' IN ARRIVO');
    if (level.drought) notes.push('SICCITA: PISTE CHE SVANISCONO IN FRETTA');
    if (level.spiders.length) notes.push('RAGNI: ' + level.spiders.length + '. IN GRUPPO LI SCACCIATE');
    notes.push('OBIETTIVO: ' + level.target + ' OPERAIE' + (level.season === Infinity ? '' : '   STAGIONE: ' + Math.round(level.season / 3600) + ' MINUTI'));
    const promptY = 100 + notes.length * 9 + 6;
    drawPanel(40, 46, SCREEN_WIDTH - 80, promptY - 46 + 16);
    text(level.tutorial ? 'IMPARA A GUIDARE LA COLONIA' : level.spec.daily ? 'SFIDA DEL GIORNO ' + level.spec.daily : 'LIVELLO ' + level.n, SCREEN_WIDTH / 2, 56, 1, 'c');
    text(level.tutorial ? 'ADDESTRAMENTO' : level.sc.name, SCREEN_WIDTH / 2, 68, 2, 'c');
    text(level.tutorial ? hint("N: SALTA L'ADDESTRAMENTO", "SALTA: ESCI DALL'ADDESTRAMENTO", "Y: SALTA L'ADDESTRAMENTO") : level.sc.hint, SCREEN_WIDTH / 2, 88, 1, 'c');
    UI.lines(notes, SCREEN_WIDTH / 2, 100, 9);
    if (blink) text(hint('INVIO PER INIZIARE', 'TOCCA PER INIZIARE', 'A PER INIZIARE'), SCREEN_WIDTH / 2, promptY, 1, 'c');
  } else if (state === 'pause') {
    drawPanel(SCREEN_WIDTH / 2 - 60, SCREEN_HEIGHT / 2 - 18, 120, 36);
    text(STRINGS.pause, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 10, 2, 'c');
    text(hint(STRINGS.resumeKeyboard, STRINGS.resumeTouch, STRINGS.resumePad), SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 6, 1, 'c');
  } else if (state === 'over' && game.overT <= 0) {
    drawPanel(38, 58, SCREEN_WIDTH - 76, 90);
    text('GAME OVER', SCREEN_WIDTH / 2, 68, 3, 'c');
    text(game.overReason, SCREEN_WIDTH / 2, 94, 1, 'c');
    text('OPERAIE ' + game.ants.length + '/' + level.target + '   PUNTI ' + game.score, SCREEN_WIDTH / 2, 108, 1, 'c');
    if (blink) text(hint('INVIO: RIPROVA     V: REPLAY', 'TOCCA: RIPROVA', 'A: RIPROVA     Y: REPLAY'), SCREEN_WIDTH / 2, 128, 1, 'c');
  } else if (state === 'done') {
    const win = game.result === 'win';
    drawPanel(40, 40, SCREEN_WIDTH - 80, 124);
    text(win ? 'COLONIA PRONTA' : "L'INVERNO E' ARRIVATO", SCREEN_WIDTH / 2, 50, 2, 'c');
    UI.stars({ on: SPRITES.starOn, off: SPRITES.starOff }, game.stars, 66);
    text('OPERAIE: ' + game.ants.length + '/' + level.target + '   NATE: ' + level.born + '   PERSE: ' + (level.lostAnts + level.lostBrood), SCREEN_WIDTH / 2, 92, 1, 'c');
    if (win && game.bonus) text('BONUS STELLE: +' + game.bonus, SCREEN_WIDTH / 2, 103, 1, 'c');
    if (!win) text('SERVIVANO ' + level.target + ' OPERAIE', SCREEN_WIDTH / 2, 103, 1, 'c');
    text('PUNTI: ' + game.score, SCREEN_WIDTH / 2, 114, 1, 'c');
    text('1 STELLA: OBIETTIVO  2: SENZA COVATA PERSA  3: +50%', SCREEN_WIDTH / 2, 128, 1, 'c');
    const next = !win ? 'RIPROVA' : level.spec.daily ? 'MENU' : 'PROSSIMO LIVELLO';
    if (blink) text(hint('INVIO: ' + next + '   V: REPLAY', 'TOCCA: ' + next, 'A: ' + next + '   Y: REPLAY'), SCREEN_WIDTH / 2, 148, 1, 'c');
  }
  if (Input.device === 'touch' && window.innerHeight > window.innerWidth && (game.frame >> 5) & 1) {
    textBox(STRINGS.rotatePhone, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 30, 'c');
  }
}

function render() {
  const level = game.L;
  toScreen();
  canvasContext.globalCompositeOperation = 'source-over';
  canvasContext.fillStyle = '#000'; canvasContext.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT); canvasContext.fillStyle = '#fff';
  drawSky();
  toWorld();
  Terrain.draw(level.terrain, cameraLeft() - 4, cameraTop() - 4, SCREEN_WIDTH + 8, SCREEN_HEIGHT + 8, TERRAIN_PATTERNS);
  drawOrders();
  drawChambers();
  drawFood();
  drawSpiders();
  drawAnts();
  drawParticles();
  drawCursor();
  toScreen();
  drawRain();
  if (game.state !== 'title') drawHUD();
  drawOverlay();
}
