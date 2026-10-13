// games/sabbia/src/render.js
'use strict';
// Drawing only: nothing here may change the simulation state.
const { canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT, DITHER, DARK, makePattern, horizontalLine, verticalLine, outlineRect, blackRect, text, textBox, drawPanel } = Gfx;
const hint = UI.hint;
const bar = UI.bar;
const CELL = CONFIG.grid.cell, GRID_TOP = CONFIG.grid.top;
// Flicker and shake from the frame number and a position, not Math.random: the same frame looks the same however many times it is
// drawn, so the browser golden matches the Node harness pixel for pixel.
const renderNoise = (frame, salt) => (Math.imul(frame ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(salt + 0x632be5ab, 0xc2b2ae35)) >>> 0;
const noiseUnit = (frame, salt) => renderNoise(frame, salt) / 4294967296;


// One texture per material (white shows through '#'); fire is drawn cell by cell, flickering.
const MATERIAL_FILL = [];
MATERIAL_FILL[MATERIAL.iron] = '#fff';
MATERIAL_FILL[MATERIAL.wood] = makePattern(['####', '....', '##.#', '....']);
MATERIAL_FILL[MATERIAL.grass] = makePattern(['#.', '#.', '#.', '..']);
MATERIAL_FILL[MATERIAL.sand] = DITHER;
MATERIAL_FILL[MATERIAL.water] = makePattern(['#...', '.#..', '..#.', '...#']);
MATERIAL_FILL[MATERIAL.acid] = makePattern(['#.#.', '....', '.#.#', '....']);
MATERIAL_FILL[MATERIAL.steam] = DARK;
MATERIAL_FILL[MATERIAL.hotAir] = makePattern(['....', '.#..', '....', '....']);
MATERIAL_FILL[MATERIAL.coldAir] = makePattern(['.#..', '###.', '.#..', '....']);

function fillRun(id, x, y, width) {
  const fill = MATERIAL_FILL[id];
  canvasContext.fillStyle = '#fff'; canvasContext.fillRect(x * CELL, GRID_TOP + y * CELL, width * CELL, CELL);
  if (fill !== '#fff') { canvasContext.fillStyle = fill; canvasContext.fillRect(x * CELL, GRID_TOP + y * CELL, width * CELL, CELL); }
}

function drawWorld() {
  const world = game.L.world, material = world.material;
  for (let y = 0; y < ROWS; y++) {
    let runStart = 0, runId = material[y * COLUMNS];
    for (let x = 1; x <= COLUMNS; x++) {
      const id = x < COLUMNS ? material[y * COLUMNS + x] : -1;
      if (id === runId) continue;
      if (runId !== MATERIAL.empty && runId !== MATERIAL.fire) fillRun(runId, runStart, y, x - runStart);
      runStart = x; runId = id;
    }
  }
  canvasContext.fillStyle = '#fff';
  for (let index = 0; index < CELLS; index++) {
    if (material[index] !== MATERIAL.fire) continue;
    const x = (index % COLUMNS) * CELL, y = GRID_TOP + Math.floor(index / COLUMNS) * CELL;
    canvasContext.fillRect(x, y, CELL, CELL);
    const flicker = renderNoise(game.frame >> 1, index);
    if (flicker & 1) blackRect(x + ((flicker >> 1) & 1), y + ((flicker >> 2) & 1), 1, 1);
  }
}

function drawZone() {
  const zone = game.L.zone;
  if (!zone) return;
  const x0 = zone.x * CELL, y0 = GRID_TOP + zone.y * CELL, x1 = (zone.x + zone.width) * CELL - 1, y1 = GRID_TOP + (zone.y + zone.height) * CELL - 1;
  for (let x = x0; x <= x1; x += 3) { canvasContext.fillRect(x, y0, 1, 1); canvasContext.fillRect(x, y1, 1, 1); }
  for (let y = y0; y <= y1; y += 3) { canvasContext.fillRect(x0, y, 1, 1); canvasContext.fillRect(x1, y, 1, 1); }
}

function drawBrush() {
  if (game.state === 'title') return;
  const radius = CONFIG.brush.sizes[game.brushSize], cursor = game.cursor;
  const x = (Math.round(cursor.x) - radius) * CELL - 1, y = GRID_TOP + (Math.round(cursor.y) - radius) * CELL - 1, size = (2 * radius + 1) * CELL + 2;
  canvasContext.fillStyle = '#000'; outlineRect(x - 1, y - 1, size + 2, size + 2); canvasContext.fillStyle = '#fff';
  outlineRect(x, y, size, size);
}

function drawPalette(y) {
  const level = game.L;
  level.palette.forEach((id, i) => {
    const x = 3 + i * 13;
    if (i === game.selected) outlineRect(x - 2, y - 2, 13, 9);
    if (id === ERASER) { outlineRect(x, y, 9, 5); horizontalLine(x + 2, x + 6, y + 2); return; }
    if (id === MATERIAL.fire) { canvasContext.fillRect(x, y, 9, 5); blackRect(x + 2, y + 1, 1, 1); blackRect(x + 6, y + 3, 1, 1); return; }
    canvasContext.fillStyle = '#fff'; canvasContext.fillRect(x, y, 9, 5);
    if (MATERIAL_FILL[id] !== '#fff') { canvasContext.fillStyle = MATERIAL_FILL[id]; canvasContext.fillRect(x, y, 9, 5); }
    canvasContext.fillStyle = '#fff';
  });
}

function drawHUD() {
  const level = game.L, frame = game.frame, id = level.palette[game.selected];
  blackRect(0, 0, SCREEN_WIDTH, 11); blackRect(0, SCREEN_HEIGHT - 11, SCREEN_WIDTH, 11);
  for (let x = 0; x < SCREEN_WIDTH; x += 2) { canvasContext.fillRect(x, 10, 1, 1); canvasContext.fillRect(x, SCREEN_HEIGHT - 11, 1, 1); }
  const label = level.lab || level.tutorial ? level.name : level.spec.daily ? 'SFIDA ' + level.spec.daily.slice(5).split('-').reverse().join('/') + ' ' + level.name : 'LV' + level.n + ' ' + level.name;
  text(label, 3, 3);
  const budget = level.budget && level.budget[id] !== undefined ? ' ' + level.budget[id] : '';
  text(materialName(id) + budget + '   PENNELLO ' + (game.brushSize + 1) + '   PUNTI ' + game.score, SCREEN_WIDTH - 3, 3, 1, 'r');
  const y = SCREEN_HEIGHT - 8;
  drawPalette(y);
  if (level.goal) {
    const right = SCREEN_WIDTH - 3;
    text('OBIETTIVO', right - 150, y);
    bar(right - 112, y - 1, 46, level.goal.progress());
    text('TEMPO', right - 58, y);
    const left = 1 - game.clock / level.time;
    if (left > 0.15 || (frame >> 3) & 1) bar(right - 36, y - 1, 36, left);
  }
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
    text('SABBIA', SCREEN_WIDTH / 2, 26, 3, 'c');
    text('MATERIALI CHE CADONO, SCORRONO, BRUCIANO ED EVAPORANO', SCREEN_WIDTH / 2, 46, 1, 'c');
    const controls = hint(
      ['FRECCE : PENNELLO    SPAZIO (TIENI) : DIPINGI', 'X / Z : MATERIALE    C : DIMENSIONE', 'P PAUSA  R RICOMINCIA  M AUDIO  V REPLAY'],
      ['LEVETTA : PENNELLO    DISEGNA (TIENI) : DIPINGI', 'MATERIALE    PENNELLO : DIMENSIONE', 'II : PAUSA     AUDIO : SUONO SI/NO'],
      ['LEVETTA / CROCE : PENNELLO    A (TIENI) : DIPINGI', 'X / B : MATERIALE    RB : DIMENSIONE', 'START PAUSA  BACK RICOMINCIA  Y REPLAY']);
    const rules = [
      "IL FERRO PORTA IL CALORE: L'ACQUA SCALDATA DIVENTA VAPORE",
      "L'ERBA BRUCIA IN FRETTA, IL LEGNO A LUNGO; L'ACIDO SCIOGLIE",
      "L'ARIA FREDDA SPEGNE IL FUOCO E FA PIOVERE IL VAPORE",
    ];
    controls.concat([''], rules).forEach((line, i) => text(line, SCREEN_WIDTH / 2, 58 + i * 9, 1, 'c'));
    if (blink) text(hint('INVIO: SFIDE   L: LABORATORIO   G: SFIDA DEL GIORNO', 'TOCCA: SFIDE', 'A: SFIDE   X: LABORATORIO   Y: SFIDA DEL GIORNO'), SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30, 1, 'c');
  } else if (state === 'intro') {
    const notes = [];
    if (level.budget) notes.push(level.palette.map(id => materialName(id) + ' ' + level.budget[id]).join('   '));
    if (level.goal) notes.push('TEMPO: ' + Math.round(level.time / 60) + ' SECONDI' + (level.zone ? '   DIPINGI SOLO NELLA ZONA TRATTEGGIATA' : ''));
    if (level.lab) notes.push(hint('X / Z MATERIALE, C PENNELLO, R SVUOTA TUTTO', 'MATERIALE, PENNELLO, R SVUOTA TUTTO', 'X / B MATERIALE, RB PENNELLO, BACK SVUOTA TUTTO'));
    const promptY = 100 + notes.length * 9 + 6;
    drawPanel(36, 46, SCREEN_WIDTH - 72, promptY - 46 + 16);
    text(level.lab ? 'TUTTI I MATERIALI, NESSUN LIMITE' : level.tutorial ? 'IMPARA A USARE IL PENNELLO' : level.spec.daily ? 'SFIDA DEL GIORNO ' + level.spec.daily : 'SFIDA ' + level.n, SCREEN_WIDTH / 2, 56, 1, 'c');
    text(level.name, SCREEN_WIDTH / 2, 68, 2, 'c');
    text(level.tutorial ? hint("N: SALTA L'ADDESTRAMENTO", "SALTA: ESCI DALL'ADDESTRAMENTO", "Y: SALTA L'ADDESTRAMENTO") : level.hint, SCREEN_WIDTH / 2, 88, 1, 'c');
    UI.lines(notes, SCREEN_WIDTH / 2, 100, 9);
    if (blink) text(hint('INVIO PER INIZIARE', 'TOCCA PER INIZIARE', 'A PER INIZIARE'), SCREEN_WIDTH / 2, promptY, 1, 'c');
  } else if (state === 'pause') {
    drawPanel(SCREEN_WIDTH / 2 - 60, SCREEN_HEIGHT / 2 - 18, 120, 36);
    text(STRINGS.pause, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 10, 2, 'c');
    text(hint(STRINGS.resumeKeyboard, STRINGS.resumeTouch, STRINGS.resumePad), SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 6, 1, 'c');
  } else if (state === 'over' && game.overT <= 0) {
    drawPanel(38, 58, SCREEN_WIDTH - 76, 90);
    text('SFIDA PERSA', SCREEN_WIDTH / 2, 68, 3, 'c');
    text(game.overReason, SCREEN_WIDTH / 2, 94, 1, 'c');
    text('PUNTI ' + game.score, SCREEN_WIDTH / 2, 108, 1, 'c');
    if (blink) text(hint('INVIO: RIPROVA     V: REPLAY', 'TOCCA: RIPROVA', 'A: RIPROVA     Y: REPLAY'), SCREEN_WIDTH / 2, 128, 1, 'c');
  } else if (state === 'done') {
    const win = game.result === 'win';
    drawPanel(40, 40, SCREEN_WIDTH - 80, 124);
    text(win ? 'SFIDA RIUSCITA' : 'TEMPO SCADUTO', SCREEN_WIDTH / 2, 50, 2, 'c');
    UI.stars({ on: SPRITES.starOn, off: SPRITES.starOff }, game.stars, 66);
    if (level.budget) text('MATERIALE AVANZATO: ' + Math.round(budgetLeftShare() * 100) + '%', SCREEN_WIDTH / 2, 92, 1, 'c');
    if (win && game.bonus) text('BONUS: +' + game.bonus, SCREEN_WIDTH / 2, 103, 1, 'c');
    text('PUNTI: ' + game.score, SCREEN_WIDTH / 2, 114, 1, 'c');
    text("STELLE: PIU' MATERIALE AVANZI, PIU' STELLE", SCREEN_WIDTH / 2, 128, 1, 'c');
    const next = !win ? 'RIPROVA' : level.spec.daily ? 'MENU' : 'PROSSIMA SFIDA';
    if (blink) text(hint('INVIO: ' + next + '   V: REPLAY', 'TOCCA: ' + next, 'A: ' + next + '   Y: REPLAY'), SCREEN_WIDTH / 2, 148, 1, 'c');
  }
  if (Input.device === 'touch' && window.innerHeight > window.innerWidth && (game.frame >> 5) & 1) {
    textBox(STRINGS.rotatePhone, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 30, 'c');
  }
}

function render() {
  canvasContext.setTransform(1, 0, 0, 1, 0, 0);
  canvasContext.globalCompositeOperation = 'source-over';
  canvasContext.fillStyle = '#000'; canvasContext.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT); canvasContext.fillStyle = '#fff';
  drawWorld();
  drawZone();
  drawBrush();
  if (game.state !== 'title') drawHUD();
  drawOverlay();
  Theme.finishFrame(true);
}
