// games/abisso/src/render.js
'use strict';
// Drawing only: nothing here may change the simulation state.
const { canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT, DITHER, DARK, DUSK, makePattern, horizontalLine, blackRect, drawCircle, text, textBox, drawPanel, drawSprite } = Gfx;
const hint = UI.hint;
const bar = UI.bar;
const TERRAIN_PATTERNS = { [CONFIG.material.rock]: DUSK, [CONFIG.material.hull]: makePattern(['####', '#...', '####', '..#.']), [CONFIG.material.silt]: DARK };

// Shake from the frame number, not Math.random: the same frame looks the same however many times it is drawn (browser golden).
const renderNoise = frame => ((Math.imul(frame ^ 0x9e3779b9, 0x85ebca6b) >>> 0) / 4294967296) - 0.5;

const cameraLeft = () => round(game.camX);
const cameraTop = () => round(game.camY);
function toWorld() {
  const shakeX = game.shake ? round(renderNoise(game.frame) * game.shake * 2) : 0, shakeY = game.shake ? round(renderNoise(game.frame + 7) * game.shake * 2) : 0;
  canvasContext.setTransform(1, 0, 0, 1, -cameraLeft() + shakeX, -cameraTop() + shakeY);
}
const toScreen = () => canvasContext.setTransform(1, 0, 0, 1, 0, 0);

// Walls never lit stay black: only the cells already seen are drawn (the lit ones at full strength, the rest dimmed by the dark).
function hideUnseen() {
  const level = game.L, cell = CONFIG.cell;
  const firstX = Math.max(0, Math.floor(game.camX / cell) - 1), lastX = Math.min(level.seenWidth - 1, Math.ceil((game.camX + SCREEN_WIDTH) / cell) + 1);
  const firstY = Math.max(0, Math.floor(game.camY / cell) - 1), lastY = Math.min(level.seenHeight - 1, Math.ceil((game.camY + SCREEN_HEIGHT) / cell) + 1);
  canvasContext.fillStyle = '#000';
  for (let cellY = firstY; cellY <= lastY; cellY++) {
    let runStart = -1;
    for (let cellX = firstX; cellX <= lastX + 1; cellX++) {
      const hidden = cellX <= lastX && !level.seen[cellY * level.seenWidth + cellX];
      if (hidden && runStart < 0) runStart = cellX;
      if (!hidden && runStart >= 0) { canvasContext.fillRect(runStart * cell, cellY * cell, (cellX - runStart) * cell, cell); runStart = -1; }
    }
  }
  canvasContext.fillStyle = '#fff';
}

function drawDivers() {
  for (const diver of game.L.divers) {
    if (diver.state !== 'waiting') continue;
    drawSprite((game.frame >> 4) & 1 ? SPRITES.diverStep : SPRITES.diver, diver.x, diver.y);
    if (diver.found && (game.frame >> 3) & 1) canvasContext.fillRect(diver.x + 7, diver.y + 1, 1, 1);
  }
}

function drawSub() {
  const sub = game.sub;
  drawSprite(SPRITES.sub, round(sub.x), round(sub.y), sub.face < 0);
  sub.aboard.forEach((diver, i) => canvasContext.fillRect(round(sub.x) + 5 + i * 3, round(sub.y) + 4, 1, 1));
}

function drawParticles() {
  for (const particle of game.parts) {
    if (particle.t === 'bub') { canvasContext.fillRect(round(particle.x), round(particle.y), 1, 1); continue; }
    if (particle.t === 'chunk') canvasContext.fillRect(round(particle.x), round(particle.y), particle.w, particle.h);
  }
}

function drawDark() {
  const sub = game.sub, lamp = CONFIG.lamp, offsetX = cameraLeft(), offsetY = cameraTop();
  const circles = [subCenterX() - offsetX, subCenterY() - offsetY, lamp.halo];
  for (const diver of game.L.divers) if (diver.state === 'waiting' && diver.found) circles.push(diver.x + 4 - offsetX, diver.y + 3 - offsetY, CONFIG.diver.light);
  const cones = sub.lamp ? [{ x: subCenterX() - offsetX, y: subCenterY() - offsetY, angle: lampAngle(), halfAngle: lamp.half, length: lamp.length }] : [];
  Lighting.darkness({ circles, cones, pattern: DARK });
}

// Above the sea: night sky, stars, the support ship riding the waves and the surface seen from below.
function drawSky() {
  const level = game.L, offsetX = cameraLeft(), offsetY = cameraTop(), frame = game.frame;
  const surfaceTop = Math.ceil(CONFIG.world.surface + 3 - offsetY);
  if (surfaceTop <= 0) return;
  blackRect(0, 0, SCREEN_WIDTH, Math.min(SCREEN_HEIGHT, surfaceTop));
  for (const star of level.stars) if (star.y - offsetY < surfaceTop - 4 && !(star.tw && ((frame + star.ph) % 120) < 10)) canvasContext.fillRect(star.x, star.y - offsetY, 1, 1);
  for (let x = 0; x < SCREEN_WIDTH; x++) {
    const surface = round(surfaceAtX(x + offsetX) - offsetY);
    if (surface < SCREEN_HEIGHT) { blackRect(x, surface - 3, 1, 4); canvasContext.fillRect(x, surface, 1, 1); }
  }
  const ship = CONFIG.ship, shipY = round(surfaceAtX(ship.x + ship.width / 2)) - 9;
  drawSprite(SPRITES.ship, ship.x - offsetX, shipY - offsetY);
}

function drawPulsesAndSilt() {
  const offsetX = cameraLeft(), offsetY = cameraTop(), range = CONFIG.sonar.range;
  for (const pulse of game.pulses) if (pulse.r <= range) drawCircle(pulse.x - offsetX, pulse.y - offsetY, pulse.r, true);
  canvasContext.fillStyle = DITHER;
  for (const cloud of game.silt) {
    const x = cloud.x - offsetX, y = cloud.y - offsetY, radius = round(cloud.r);
    for (let deltaY = -radius; deltaY <= radius; deltaY++) {
      const half = Math.floor(Math.sqrt(radius * radius - deltaY * deltaY));
      canvasContext.fillRect(round(x - half), round(y + deltaY), half * 2, 1);
    }
  }
  canvasContext.fillStyle = '#fff';
}

// Arrows on the screen edge towards the found divers that are out of sight.
function drawDiverArrows() {
  const offsetX = game.camX, offsetY = game.camY;
  for (const diver of game.L.divers) {
    if (diver.state !== 'waiting' || !diver.found) continue;
    const x = diver.x + 4 - offsetX, y = diver.y + 3 - offsetY;
    if (x >= 0 && x < SCREEN_WIDTH && y >= 12 && y < SCREEN_HEIGHT - 12) continue;
    const arrowX = clamp(round(x), 6, SCREEN_WIDTH - 10), arrowY = clamp(round(y), 16, SCREEN_HEIGHT - 20);
    text(y >= SCREEN_HEIGHT - 12 ? '▼' : y < 12 ? '▲' : x < 0 ? '<' : '>', arrowX, arrowY);
  }
}

function drawHUD() {
  const level = game.L, sub = game.sub, frame = game.frame;
  blackRect(0, 0, SCREEN_WIDTH, 11); blackRect(0, SCREEN_HEIGHT - 11, SCREEN_WIDTH, 11);
  for (let x = 0; x < SCREEN_WIDTH; x += 2) { canvasContext.fillRect(x, 10, 1, 1); canvasContext.fillRect(x, SCREEN_HEIGHT - 11, 1, 1); }
  const label = level.tutorial ? 'ADDESTRAMENTO' : level.spec.daily ? 'SFIDA ' + level.spec.daily.slice(5).split('-').reverse().join('/') + ' ' + level.sc.name : 'LV' + level.n + ' ' + level.sc.name;
  text(label, 3, 3);
  text('SALVATI ' + level.saved + '/' + level.total + '  PERSI ' + level.lost + '  PUNTI ' + game.score, SCREEN_WIDTH - 3, 3, 1, 'r');
  const y = SCREEN_HEIGHT - 8;
  text('SCAFO', 3, y);
  if (sub.hull > 0.3 || (frame >> 3) & 1) bar(25, y - 1, 30, sub.hull);
  text('BATT', 60, y);
  if (level.battery === Infinity) text('--', 78, y);
  else if (sub.battery > 15 || (frame >> 3) & 1) bar(78, y - 1, 30, sub.battery / level.battery);
  text('BORDO', 114, y);
  for (let seat = 0; seat < CONFIG.sub.seats; seat++) { const x = 136 + seat * 6; if (seat < sub.aboard.length) canvasContext.fillRect(x, y, 4, 5); else Gfx.outlineRect(x, y, 4, 5); }
  text(Math.max(0, Math.round((subCenterY() - CONFIG.world.surface) / 10)) + ' M', 152, y);
  text(sub.lamp ? 'FARO' : '', 178, y);
  if (sub.sonarT > 0) bar(198, y - 1, 16, 1 - sub.sonarT / CONFIG.sonar.cooldown); else text('SONAR', 198, y);
  const waiting = waitingDivers();
  waiting.forEach((diver, i) => {
    const x = SCREEN_WIDTH - 3 - (waiting.length - i) * 20;
    if (diver.air === Infinity) text('--', x + 4, y);
    else if (diver.air > 600 || (frame >> 3) & 1) bar(x, y - 1, 17, diver.air / diver.maxAir);
  });
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
    text('ABISSO', SCREEN_WIDTH / 2, 26, 3, 'c');
    text('TROVA I SUB NEL BUIO E RIPORTALI ALLA NAVE', SCREEN_WIDTH / 2, 46, 1, 'c');
    const controls = hint(
      ['FRECCE : PROPULSORI    SPAZIO : SONAR    X : FARO', 'P PAUSA  R RICOMINCIA  M AUDIO  V REPLAY'],
      ['LEVETTA : PROPULSORI    SONAR    FARO', 'II : PAUSA     AUDIO : SUONO SI/NO'],
      ['LEVETTA / CROCE : PROPULSORI    A : SONAR    X : FARO', 'START PAUSA  BACK RICOMINCIA  Y REPLAY']);
    const rules = [
      "IL SONAR RIVELA PARETI E SUB, IL FARO E' DOVE VAI",
      'URTI VELOCI ROVINANO LO SCAFO; IL LIMO TOGLIE LA VISTA',
      'DUE POSTI A BORDO. LA BATTERIA SCARICA TI FA SOLO RISALIRE',
    ];
    controls.concat([''], rules).forEach((line, i) => text(line, SCREEN_WIDTH / 2, 62 + i * 9, 1, 'c'));
    if (blink) text(hint('INVIO: GIOCA     G: SFIDA DEL GIORNO', 'TOCCA PER GIOCARE', 'A: GIOCA     Y: SFIDA DEL GIORNO'), SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30, 1, 'c');
  } else if (state === 'intro') {
    const notes = ['SUB DA SALVARE: ' + level.total + (level.tutorial ? '' : '   ARIA: DA ' + Math.round(Math.min(...level.divers.map(diver => diver.maxAir)) / 60) + ' A ' + Math.round(Math.max(...level.divers.map(diver => diver.maxAir)) / 60) + ' SECONDI')];
    if (level.currents.length) notes.push('CORRENTI FORTI: TI SPINGONO DI LATO');
    if (!level.tutorial) notes.push("PROFONDITA': " + Math.round((level.height - CONFIG.world.surface) / 10) + ' METRI');
    const promptY = 100 + notes.length * 9 + 6;
    drawPanel(44, 46, SCREEN_WIDTH - 88, promptY - 46 + 16);
    text(level.tutorial ? 'IMPARA A GUIDARE IL SOMMERGIBILE' : level.spec.daily ? 'SFIDA DEL GIORNO ' + level.spec.daily : 'LIVELLO ' + level.n, SCREEN_WIDTH / 2, 56, 1, 'c');
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
    text('SALVATI ' + level.saved + '/' + level.total + '   PUNTI ' + game.score, SCREEN_WIDTH / 2, 108, 1, 'c');
    if (blink) text(hint('INVIO: RIPROVA     V: REPLAY', 'TOCCA: RIPROVA', 'A: RIPROVA     Y: REPLAY'), SCREEN_WIDTH / 2, 128, 1, 'c');
  } else if (state === 'done') {
    const win = game.result === 'win';
    drawPanel(40, 40, SCREEN_WIDTH - 80, 124);
    text(win ? 'MISSIONE COMPIUTA' : 'MISSIONE FALLITA', SCREEN_WIDTH / 2, 50, 2, 'c');
    UI.stars({ on: SPRITES.starOn, off: SPRITES.starOff }, game.stars, 66);
    text('SALVATI: ' + level.saved + '/' + level.total + '   PERSI: ' + level.lost, SCREEN_WIDTH / 2, 92, 1, 'c');
    if (win && game.bonus) text('BONUS STELLE: +' + game.bonus, SCREEN_WIDTH / 2, 103, 1, 'c');
    if (!win) text("SERVE SALVARE PIU' DELLA META' DEI SUB", SCREEN_WIDTH / 2, 103, 1, 'c');
    text('PUNTI: ' + game.score, SCREEN_WIDTH / 2, 114, 1, 'c');
    text("1 STELLA: PIU' DELLA META'  2: 75%  3: TUTTI, SCAFO SANO", SCREEN_WIDTH / 2, 128, 1, 'c');
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
  toWorld();
  Terrain.draw(level.terrain, cameraLeft() - 4, cameraTop() - 4, SCREEN_WIDTH + 8, SCREEN_HEIGHT + 8, TERRAIN_PATTERNS);
  hideUnseen();
  drawDivers();
  drawParticles();
  drawSub();
  toScreen();
  drawDark();
  drawSky();
  drawPulsesAndSilt();
  drawDiverArrows();
  if (game.state !== 'title') drawHUD();
  drawOverlay();
  Theme.finishFrame(false);
}
