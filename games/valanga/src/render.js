// games/valanga/src/render.js
'use strict';
// Drawing only: nothing here may change the simulation state.
const { canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT, DARK, DITHER, horizontalLine, verticalLine, outlineRect, blackRect, drawLine, drawCircle, text, textBox, drawPanel, drawSprite } = Gfx;
const hint = UI.hint;
const bar = UI.bar;
const TERRAIN_PATTERNS = { [CONFIG.material.snow]: DITHER, [CONFIG.material.rock]: DARK };

const cameraLeft = () => round(game.camX);
const cameraTop = () => round(game.camY);
function toWorld() {
  const shakeX = game.shake ? round((Math.random() - 0.5) * game.shake * 2) : 0, shakeY = game.shake ? round((Math.random() - 0.5) * game.shake * 2) : 0;
  canvasContext.setTransform(1, 0, 0, 1, -cameraLeft() + shakeX, -cameraTop() + shakeY);
}
const toScreen = () => canvasContext.setTransform(1, 0, 0, 1, 0, 0);
const isOnScreen = (x, margin) => x > game.camX - margin && x < game.camX + SCREEN_WIDTH + margin;

function drawSky() {
  const level = game.L;
  if (level.night) {
    Sky.drawNight({ cameraX: cameraLeft(), covers: [], waterY: () => Infinity, stars: level.stars, moon: null, frame: game.frame });
  } else if (!level.storm) {
    const sunX = 316, sunY = 34 - round(game.camY * 0.05);
    for (let y = -7; y <= 7; y++) { const halfWidth = round(Math.sqrt(49 - y * y)); horizontalLine(sunX - halfWidth, sunX + halfWidth, sunY + y); }
  }
  Parallax.draw(level.backdrop, cameraLeft(), cameraTop());
}

function drawBuried() {
  for (const victim of game.L.victims) if (victim.state !== 'saved' && isOnScreen(victim.x, 20)) drawSprite(SPRITES.buried, victim.x, round(victim.y));
}

function drawSurfaceMarks() {
  const config = CONFIG.victim;
  for (const victim of game.L.victims) {
    if (!isOnScreen(victim.x, 20)) continue;
    if (victim.state === 'saved') drawSprite(SPRITES.saved, victim.x, round(victim.y) - 2);
    else if (victim.state === 'lost') { const x = victim.x + config.w / 2, y = surfaceAt(x) - 7; verticalLine(x, y, y + 6); horizontalLine(x - 2, x + 2, y + 2); }
  }
  for (const mark of game.probeMarks) {
    if (!isOnScreen(mark.x, 10)) continue;
    verticalLine(mark.x, mark.y - 5, mark.y);
    if (mark.hit) { canvasContext.fillRect(mark.x + 1, mark.y - 5, 3, 2); }
  }
}

function drawRescuer() {
  const body = game.rescuer, x = round(body.x), y = round(body.y), facingLeft = body.face < 0;
  const sprite = body.walk >> 3 & 1 ? SPRITES.rescuerStep : SPRITES.rescuer;
  if (body.stunT > 0 && (game.frame >> 2) & 1) return;
  drawSprite(sprite, x, y, facingLeft);
  const handX = facingLeft ? x : x + body.w - 1;
  if (body.digging) {
    const swing = (body.digT >> 2) & 1;
    drawLine(handX, y + 5, handX + body.face * (4 + swing), y + 8 + swing);
  }
  if (body.probeT > 0) {
    const config = CONFIG.probe, progress = Math.min(1, (config.frames - body.probeT) / (config.frames - config.resultAt));
    verticalLine(x + 2, y + body.h, y + body.h + round(config.depth * progress));
  }
}

function drawParticles() {
  for (const particle of game.parts) {
    if (!isOnScreen(particle.x, 20)) continue;
    if (particle.t === 'chunk') canvasContext.fillRect(round(particle.x), round(particle.y), particle.w, particle.h);
    else if (particle.t === 'px') canvasContext.fillRect(round(particle.x), round(particle.y), 1, 1);
  }
}

function drawAvalanche() {
  const avalanche = game.avalanche;
  if (!avalanche) return;
  if (avalanche.phase === 'warning') {
    if (!((game.frame >> 3) & 1)) return;
    for (let x = round(avalanche.startX); x <= avalanche.endX; x += 3) canvasContext.fillRect(x, surfaceAt(x) - 14, 2, 1);
    text('!', round(avalanche.startX), surfaceAt(avalanche.startX) - 24);
    return;
  }
  const frontX = round(avalanche.frontX), surface = surfaceAt(frontX);
  for (let y = surface - 16; y < surface; y += 2) canvasContext.fillRect(frontX + ((y >> 1) & 1), y, 1, 1);
}

function drawSnowfall() {
  for (const flake of game.rain) canvasContext.fillRect(round(flake.x), round(flake.y), 1, 1);
}

// At night only the head torch lights the slope (a circle around the rescuer and a cone where they look).
function drawNight() {
  const body = game.rescuer, config = CONFIG.night, x = rescuerCenterX() - cameraLeft(), headY = body.y + 2 - cameraTop();
  Lighting.darkness({
    circles: [x, body.y + body.h / 2 - cameraTop(), config.lamp],
    cones: [{ x, y: headY, angle: body.face * (Math.PI / 2 - config.conePitch), halfAngle: config.coneHalf, length: config.coneLength }],
    pattern: DARK,
  });
}

function drawSignal() {
  const signal = game.signal, y = SCREEN_HEIGHT - 8;
  text('ARTVA', 3, y);
  if (!signal) { bar(25, y - 1, 50, 0); text('--', 80, y); return; }
  const noise = game.L.storm ? (Math.random() - 0.5) * 0.3 : 0;
  bar(25, y - 1, 50, signal.strength + noise);
  const deltaX = victimCenterX(signal.victim) - rescuerCenterX();
  text(Math.abs(deltaX) < 5 ? '▼' : deltaX < 0 ? '<' : '>', 80, y);
  if (signal.distance < CONFIG.artva.digits) text((signal.distance / 10).toFixed(1) + ' M', 88, y);
}

function drawAir() {
  const y = SCREEN_HEIGHT - 8;
  text('ARIA', 124, y);
  game.L.victims.forEach((victim, i) => {
    const x = 142 + i * 22;
    if (victim.state === 'saved') text('OK', x + 4, y);
    else if (victim.state === 'lost') text('X', x + 6, y);
    else if (victim.air > 600 || (game.frame >> 3) & 1) bar(x, y - 1, 18, victim.air === Infinity ? 1 : victim.air / victim.maxAir);
  });
}

function drawHUD() {
  const level = game.L, frame = game.frame;
  blackRect(0, 0, SCREEN_WIDTH, 11); blackRect(0, SCREEN_HEIGHT - 11, SCREEN_WIDTH, 11);
  for (let x = 0; x < SCREEN_WIDTH; x += 2) { canvasContext.fillRect(x, 10, 1, 1); canvasContext.fillRect(x, SCREEN_HEIGHT - 11, 1, 1); }
  const label = level.tutorial ? 'ADDESTRAMENTO' : level.spec.daily ? 'SFIDA ' + level.spec.daily.slice(5).split('-').reverse().join('/') + ' ' + level.sc.name : 'LV' + level.n + ' ' + level.sc.name;
  text(label, 3, 3);
  text('SALVATI ' + level.saved + '/' + level.total + '  PERSI ' + level.lost + '  PUNTI ' + game.score, SCREEN_WIDTH - 3, 3, 1, 'r');
  drawSignal();
  drawAir();
  if (game.avalanche && (frame >> 3) & 1) text('VALANGA!', SCREEN_WIDTH - 3, SCREEN_HEIGHT - 8, 1, 'r');
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
    drawPanel(34, 16, SCREEN_WIDTH - 68, SCREEN_HEIGHT - 32);
    text('VALANGA', SCREEN_WIDTH / 2, 26, 3, 'c');
    text("TROVA I SEPOLTI CON L'ARTVA E LIBERALI", SCREEN_WIDTH / 2, 46, 1, 'c');
    const controls = hint(
      ['SINISTRA / DESTRA : CAMMINA    SU : ARRAMPICATI', 'SPAZIO (TIENI) : SCAVA IN BASSO, CON UNA DIREZIONE DI LATO', 'X : SONDA', 'P PAUSA  R RICOMINCIA  M AUDIO  V REPLAY'],
      ['LEVETTA : CAMMINA, IN SU ARRAMPICATI', 'SCAVA (TIENI) : IN BASSO, CON LA LEVETTA DI LATO', 'SONDA : CERCA SOTTO I PIEDI', 'II : PAUSA     AUDIO : SUONO SI/NO'],
      ['LEVETTA / CROCE : CAMMINA E ARRAMPICATI', 'A (TIENI) : SCAVA IN BASSO, CON LA LEVETTA DI LATO', 'X O B : SONDA', 'START PAUSA  BACK RICOMINCIA  Y REPLAY']);
    const rules = [
      "PIU' BIP, PIU' VICINO: LA SONDA TI DICE DOVE SCAVARE",
      "SCAVA DALL'ALTO: SE LA NEVE CROLLA SUL SEPOLTO, MUORE",
      'OGNI SEPOLTO HA ARIA PER POCO. SE SENTI UNA CREPA, SCAPPA',
    ];
    controls.concat([''], rules).forEach((line, i) => text(line, SCREEN_WIDTH / 2, 58 + i * 9, 1, 'c'));
    if (blink) text(hint('INVIO: GIOCA     G: SFIDA DEL GIORNO', 'TOCCA PER GIOCARE', 'A: GIOCA     Y: SFIDA DEL GIORNO'), SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30, 1, 'c');
  } else if (state === 'intro') {
    const notes = [];
    if (level.storm) notes.push('BUFERA: IL VENTO TI SPINGE, L ARTVA DISTURBATO');
    if (level.night) notes.push('NOTTE: VEDI SOLO CON LA LAMPADA FRONTALE');
    if (level.avalancheAt) notes.push(level.avalancheDeadly ? 'VALANGHE: SE TI PRENDONO SEI SEPOLTO TU' : 'VALANGHE: ATTENTO ALLE CREPE');
    notes.push('SEPOLTI: ' + level.total + (level.tutorial ? '' : '   ARIA: ' + Math.round(level.victims[0].maxAir / 60) + ' SECONDI'));
    const promptY = 100 + notes.length * 9 + 6;
    drawPanel(44, 46, SCREEN_WIDTH - 88, promptY - 46 + 16);
    text(level.tutorial ? 'IMPARA A USARE ARTVA, SONDA E PALA' : level.spec.daily ? 'SFIDA DEL GIORNO ' + level.spec.daily : 'LIVELLO ' + level.n, SCREEN_WIDTH / 2, 56, 1, 'c');
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
    if (!win) text("SERVE SALVARE PIU' DELLA META' DEI SEPOLTI", SCREEN_WIDTH / 2, 103, 1, 'c');
    text('PUNTI: ' + game.score, SCREEN_WIDTH / 2, 114, 1, 'c');
    text("1 STELLA: PIU' DELLA META'  2: 75%  3: TUTTI", SCREEN_WIDTH / 2, 128, 1, 'c');
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
  drawBuried();
  Terrain.draw(level.terrain, cameraLeft() - 4, cameraTop() - 4, SCREEN_WIDTH + 8, SCREEN_HEIGHT + 8, TERRAIN_PATTERNS);
  drawSurfaceMarks();
  drawParticles();
  drawRescuer();
  toScreen();
  drawSnowfall();
  if (level.night) drawNight();
  toWorld();
  drawAvalanche();
  if (level.night) drawRescuer();
  toScreen();
  if (game.state !== 'title') drawHUD();
  drawOverlay();
  Theme.finishFrame(!level.night);
}
