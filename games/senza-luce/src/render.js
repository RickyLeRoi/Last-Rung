// games/senza-luce/src/render.js
'use strict';
// Drawing only: nothing here may change the simulation state.
const { canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT, DARK, DUSK, DITHER, horizontalLine, verticalLine, outlineRect, blackRect, drawLine, drawCircle, text, textBox, drawPanel, drawSprite } = Gfx;
const hint = UI.hint;
const bar = UI.bar;
const CLIFF_WIDTH = 60, ARCH_LEFT = 6, ARCH_RIGHT = 40, ISLET_HALF_WIDTH = 16;
const MAP_WIDTH = 110;
const MOON_PIXELS = (() => {
  const pixels = [];
  for (let y = -6; y <= 6; y++) for (let x = -6; x <= 6; x++) if (x * x + y * y <= 36 && !((x === -2 && y === -1) || (x === 2 && y === 2) || (x === 1 && y === -3))) pixels.push([x, y]);
  return pixels;
})();

const cameraX = () => round(game.camX);
const toWorld = () => canvasContext.setTransform(1, 0, 0, 1, -cameraX(), 0);
const toScreen = () => canvasContext.setTransform(1, 0, 0, 1, 0, 0);
const isOnScreen = (x, margin) => x > game.camX - margin && x < game.camX + SCREEN_WIDTH + margin;

function drawSea() {
  const frame = game.frame, time = game.time, left = cameraX();
  for (let x = left; x < left + SCREEN_WIDTH; x++) {
    const surface = round(waterSurfaceY(x));
    canvasContext.fillRect(x, surface, 1, 1);
    for (let band = 1; band <= 6; band++) {
      const wave = round(Math.sin(x * 0.06 + time * (0.7 + band * 0.15) + band * 1.7) * 1.5);
      if ((x + band * 7 + (frame >> 3)) % 5 < 2) canvasContext.fillRect(x, surface + band * 11 + wave, 1, 1);
    }
  }
}

const cliffTopY = x => 34 + round(x * 1.1);
const archTopY = x => { const fromCenter = (x - (ARCH_LEFT + ARCH_RIGHT) / 2) / ((ARCH_RIGHT - ARCH_LEFT) / 2); return CONFIG.sea.base - 16 + round(fromCenter * fromCenter * 12); };

// The cliff with the smugglers' cove: an arch at sea level, a lantern inside.
function drawCove() {
  if (!isOnScreen(0, CLIFF_WIDTH)) return;
  const base = CONFIG.sea.base;
  for (let x = 0; x < CLIFF_WIDTH; x++) {
    const topY = cliffTopY(x), inArch = x > ARCH_LEFT && x < ARCH_RIGHT, bottomY = inArch ? archTopY(x) : base;
    canvasContext.fillRect(x, topY, 1, 1);
    for (let y = topY + 1; y < bottomY; y++) if (((x + y) & 1) === 0) canvasContext.fillRect(x, y, 1, 1);
    if (inArch) canvasContext.fillRect(x, bottomY, 1, 1);
  }
  verticalLine(ARCH_LEFT, archTopY(ARCH_LEFT + 1), base); verticalLine(ARCH_RIGHT, archTopY(ARCH_RIGHT - 1), base);
  canvasContext.fillRect(CONFIG.cove.lightX - 1, base - 9, 2, 3);
}

function drawTowers() {
  const base = CONFIG.sea.base, lampY = towerLampY();
  for (const tower of game.L.towers) {
    if (!isOnScreen(tower.x, 30)) continue;
    const x = tower.x;
    for (let offset = -ISLET_HALF_WIDTH; offset <= ISLET_HALF_WIDTH; offset++) {
      const topY = base - 5 + round(offset * offset / 52);
      canvasContext.fillRect(x + offset, topY, 1, 1);
      for (let y = topY + 1; y <= base + 1; y++) if (((x + offset + y) & 1) === 0) canvasContext.fillRect(x + offset, y, 1, 1);
    }
    for (let y = lampY + 4; y < base - 5; y++) {
      const halfWidth = round(2 + (y - lampY) * 0.05);
      canvasContext.fillRect(x - halfWidth, y, 1, 1); canvasContext.fillRect(x + halfWidth, y, 1, 1);
    }
    horizontalLine(x - 5, x + 5, lampY + 4);
    outlineRect(x - 3, lampY - 3, 7, 7);
    canvasContext.fillRect(x - 1, lampY - 1, 3, 3);
    drawLine(x - 4, lampY - 3, x, lampY - 8); drawLine(x, lampY - 8, x + 4, lampY - 3);
  }
}

function drawParticles(afterDark) {
  for (const particle of game.parts) {
    const isLight = particle.t === 'ring' || particle.t === 'smoke';
    if (isLight !== afterDark || !isOnScreen(particle.x, 40)) continue;
    if (particle.t === 'ring') drawCircle(particle.x, particle.y, particle.r, true);
    else if (particle.t === 'smoke') drawCircle(particle.x, particle.y, particle.r, true);
    else if (particle.t === 'chunk') canvasContext.fillRect(round(particle.x), round(particle.y), particle.w, particle.h);
    else canvasContext.fillRect(round(particle.x), round(particle.y), 1, 1);
  }
}

function drawRain() {
  for (const drop of game.rain) drawLine(drop.x, drop.y, drop.x - game.wind * 1.5 - 0.5, drop.y - 3);
}
function drawBolt() {
  if (game.bolt && game.boltT > 0) for (const segment of game.bolt.segs) drawLine(segment[0], segment[1], segment[2], segment[3]);
}

const toLightingCone = (cone, left) => ({ x: cone.x - left, y: cone.y, angle: cone.facing * (Math.PI / 2 - cone.pitch), halfAngle: cone.half, length: cone.length });
const dawnRatio = () => (game.L.dawnAt ? game.clock / game.L.dawnAt : 0);

// Everything is dark except the lamps, the cones, the cove lantern and lightning. The moon and the coming dawn make the dark lighter.
function drawNight() {
  const left = cameraX(), circles = [], cones = [], lampY = towerLampY();
  for (const tower of game.L.towers) {
    circles.push(tower.x - left, lampY, CONFIG.tower.halo);
    const cone = towerCone(tower, game.clock);
    if (cone) cones.push(toLightingCone(cone, left));
  }
  for (const patrol of game.L.patrols) {
    const cone = patrolCone(patrol);
    circles.push(cone.x - left, cone.y, CONFIG.patrol.lantern);
    cones.push(toLightingCone(cone, left));
  }
  circles.push(CONFIG.cove.lightX - left, CONFIG.sea.base - 8, CONFIG.cove.lightRadius);
  if (game.flashT > 0) circles.push(SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_WIDTH);
  if (game.boltT > 0 && game.bolt) for (const segment of game.bolt.segs) circles.push(segment[2] - left, segment[3], 14);
  const pattern = dawnRatio() > CONFIG.dawn.warning ? DITHER : game.L.moon ? DUSK : DARK;
  Lighting.darkness({ circles, cones, pattern });
}

function drawStars() {
  const left = cameraX(), lampY = towerLampY(), covers = [-left, CLIFF_WIDTH - left, cliffTopY(0)];
  for (const tower of game.L.towers) covers.push(tower.x - left - 6, tower.x - left + 7, lampY - 9, tower.x - left - ISLET_HALF_WIDTH, tower.x - left + ISLET_HALF_WIDTH + 1, CONFIG.sea.base - 5);
  Sky.drawNight({ cameraX: left, covers, waterY: waterSurfaceY, stars: game.L.stars, moon: game.L.moon ? { x: 300, y: 26, pixels: MOON_PIXELS } : null, frame: game.frame });
}

// Fog banks: rows of short horizontal dashes drifting slowly.
function drawFogBanks() {
  const frame = game.frame, base = CONFIG.sea.base;
  for (const bank of game.L.fogBanks) {
    const startX = Math.max(round(bank.x), cameraX()), endX = Math.min(round(bank.x + bank.w), cameraX() + SCREEN_WIDTH);
    for (let y = base - 14; y < base + 46; y += 3) {
      for (let x = startX; x < endX; x++) if ((x + y * 5 + (frame >> 4)) % 9 < 3) canvasContext.fillRect(x, y, 1, 1);
    }
  }
}

// A smoke screen: a cluster of dotted puffs that slowly turns around its centre.
function drawSmokes() {
  for (const smoke of game.smokes) {
    const radius = smokeRadius(smoke), turn = smoke.t * 0.01;
    drawCircle(smoke.x, smoke.y, radius * 0.6, true);
    for (let i = 0; i < 5; i++) {
      const angle = turn + i * Math.PI * 0.4;
      drawCircle(smoke.x + Math.cos(angle) * radius * 0.5, smoke.y + Math.sin(angle) * radius * 0.4, radius * 0.45, true);
    }
  }
}

function drawCrates() {
  for (const crate of game.L.crates) {
    if (crate.taken || !isOnScreen(crate.x, 10)) continue;
    drawSprite(SPRITES.crate, crate.x, round(laneWaterlineY(crate.x + 2, crate.lane)) - 3);
  }
}

// Boats are drawn after the dark: the player always knows where everyone is, only the cones decide who sees whom.
function drawBoats() {
  const blink = (game.frame >> 3) & 1, boat = game.boat;
  const items = game.L.patrols.map(patrol => ({ laneF: patrol.laneF, patrol }));
  items.push({ laneF: boat.laneF, patrol: null });
  items.sort((first, second) => first.laneF - second.laneF);
  for (const item of items) {
    const patrol = item.patrol;
    if (patrol) {
      if (!isOnScreen(patrol.x, 30)) continue;
      const topY = round(patrolWaterlineY(patrol)) - SPRITES.patrol.h + 1;
      drawSprite(SPRITES.patrol, patrol.x, topY, patrol.dir > 0);
      const cone = patrolCone(patrol);
      canvasContext.fillRect(round(cone.x), round(cone.y) - 1, 2, 2);
      if (patrol.mode === 'chase' || (patrol.mode === 'suspect' && blink)) text(patrol.mode === 'chase' ? '!' : '?', round(patrolCenterX(patrol)) - 1, topY - 8);
    } else {
      const topY = round(laneWaterlineY(boatSightX(), boat.laneF)) - SPRITES.boat.h + 2;
      drawSprite(SPRITES.boat, boat.x, topY);
      if (game.seen && blink) text('!', round(boatSightX()) - 1, topY - 8);
    }
  }
}

function drawMap() {
  const level = game.L, left = SCREEN_WIDTH - 3 - MAP_WIDTH, y = SCREEN_HEIGHT - 5, toMap = x => left + round(x / level.worldW * (MAP_WIDTH - 1));
  for (let x = left; x < left + MAP_WIDTH; x += 2) canvasContext.fillRect(x, y, 1, 1);
  verticalLine(left, y - 3, y + 1);
  for (const tower of level.towers) verticalLine(toMap(tower.x), y - 3, y);
  for (const crate of level.crates) if (!crate.taken) canvasContext.fillRect(toMap(crate.x), y - 1, 1, 1);
  for (const patrol of level.patrols) if (patrol.mode !== 'chase' || (game.frame >> 3) & 1) canvasContext.fillRect(toMap(patrolCenterX(patrol)), y - 2, 2, 2);
  if ((game.frame >> 4) & 1) horizontalLine(toMap(boatSightX()) - 1, toMap(boatSightX()) + 1, y + 1);
}

function drawHUD() {
  const level = game.L, frame = game.frame, boat = game.boat;
  blackRect(0, 0, SCREEN_WIDTH, 11); blackRect(0, SCREEN_HEIGHT - 11, SCREEN_WIDTH, 11);
  for (let x = 0; x < SCREEN_WIDTH; x += 2) { canvasContext.fillRect(x, 10, 1, 1); canvasContext.fillRect(x, SCREEN_HEIGHT - 11, 1, 1); }
  const label = level.tutorial ? 'ADDESTRAMENTO' : level.spec.daily ? 'SFIDA ' + level.spec.daily.slice(5).split('-').reverse().join('/') + ' ' + level.sc.name : 'LV' + level.n + ' ' + level.sc.name;
  text(label, 3, 3);
  text('CASSE ' + level.cratesTaken + '/' + level.crates.length + '  ALLARMI ' + game.alarms + '  PUNTI ' + game.score, SCREEN_WIDTH - 3, 3, 1, 'r');

  if (game.alarmT === 0 || (frame >> 3) & 1) text(game.alarmT > 0 ? 'ALLARME!' : 'ALLARME', 3, SCREEN_HEIGHT - 8);
  bar(37, SCREEN_HEIGHT - 9, 50, game.alert / CONFIG.alert.max);
  if (level.dawnAt) { text('ALBA', 94, SCREEN_HEIGHT - 8); bar(112, SCREEN_HEIGHT - 9, 40, dawnRatio()); }
  text('FUMO ' + boat.smokes, 160, SCREEN_HEIGHT - 8);
  if (!boat.engineOn && (frame >> 4) & 1) text('MOTORE SPENTO', 194, SCREEN_HEIGHT - 8);
  drawMap();
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
    text('SENZA LUCE', SCREEN_WIDTH / 2, 26, 3, 'c');
    text('ATTRAVERSA LA BAIA SENZA FARTI VEDERE', SCREEN_WIDTH / 2, 46, 1, 'c');
    const controls = hint(
      ["SINISTRA / DESTRA : GAS (LA GROTTA E' A SINISTRA)", 'SU / GIU : CAMBIA CORSIA    MAIUSC : PIANO', 'X : MOTORE ACCESO / SPENTO   SPAZIO : FUMOGENO', 'P PAUSA  R RICOMINCIA  M AUDIO  V REPLAY'],
      ['LEVETTA : GAS (ORIZZ.) E CORSIA (VERT.)', 'SPEGNI : MOTORE SPENTO / ACCESO', 'FUMO : FUMOGENO', 'II : PAUSA     AUDIO : SUONO SI/NO'],
      ['LEVETTA / CROCE : GAS E CORSIA', 'X O RB : MOTORE ACCESO / SPENTO', 'B : FUMOGENO', 'START PAUSA  BACK RICOMINCIA  Y REPLAY']);
    const rules = [
      "SE UNA LUCE TI ILLUMINA SALE L'ALLARME",
      'A TUTTO GAS IL MOTORE SI SENTE: LE MOTOVEDETTE SI GIRANO',
      "RECUPERA LE CASSE ED ENTRA NELLA GROTTA PRIMA DELL'ALBA",
    ];
    controls.concat([''], rules).forEach((line, i) => text(line, SCREEN_WIDTH / 2, 58 + i * 9, 1, 'c'));
    if (blink) text(hint('INVIO: GIOCA     G: SFIDA DEL GIORNO', 'TOCCA PER GIOCARE', 'A: GIOCA     Y: SFIDA DEL GIORNO'), SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30, 1, 'c');
  } else if (state === 'intro') {
    const notes = [];
    if (level.moon) notes.push("LUNA PIENA: LE MOTOVEDETTE VEDONO PIU' LONTANO");
    if (level.storm) notes.push('PIOGGIA: IL MOTORE SI SENTE MENO', 'LAMPI: TI VEDONO LE MOTOVEDETTE VICINE');
    if (level.fog) notes.push('NEBBIA: DENTRO UN BANCO NON TI VEDONO');
    notes.push('FARI: ' + level.towers.length + '   MOTOVEDETTE: ' + level.patrols.length + '   CASSE: ' + level.crates.length);
    if (level.dawnAt) notes.push("L'ALBA ARRIVA TRA " + Math.round(level.dawnAt / 60) + ' SECONDI');
    const promptY = 100 + notes.length * 9 + 6;
    drawPanel(44, 46, SCREEN_WIDTH - 88, promptY - 46 + 16);
    text(level.tutorial ? 'IMPARA A PASSARE INOSSERVATO' : level.spec.daily ? 'SFIDA DEL GIORNO ' + level.spec.daily : 'LIVELLO ' + level.n, SCREEN_WIDTH / 2, 56, 1, 'c');
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
    text('CASSE ' + level.cratesTaken + '/' + level.crates.length + '   PUNTI ' + game.score, SCREEN_WIDTH / 2, 108, 1, 'c');
    if (blink) text(hint('INVIO: RIPROVA     V: REPLAY', 'TOCCA: RIPROVA', 'A: RIPROVA     Y: REPLAY'), SCREEN_WIDTH / 2, 128, 1, 'c');
  } else if (state === 'done') {
    drawPanel(40, 40, SCREEN_WIDTH - 80, 124);
    text('MISSIONE COMPIUTA', SCREEN_WIDTH / 2, 50, 2, 'c');
    UI.stars({ on: SPRITES.starOn, off: SPRITES.starOff }, game.stars, 66);
    text('CASSE: ' + level.cratesTaken + '/' + level.crates.length + '   ALLARMI: ' + game.alarms, SCREEN_WIDTH / 2, 92, 1, 'c');
    if (game.bonus) text('BONUS STELLE: +' + game.bonus, SCREEN_WIDTH / 2, 103, 1, 'c');
    text('PUNTI: ' + game.score, SCREEN_WIDTH / 2, 114, 1, 'c');
    text('1 STELLA: ARRIVATO  2: TUTTE LE CASSE  3: E MAI SCOPERTO', SCREEN_WIDTH / 2, 128, 1, 'c');
    const next = level.spec.daily ? 'MENU' : 'PROSSIMO LIVELLO';
    if (blink) text(hint('INVIO: ' + next + '   V: REPLAY', 'TOCCA: ' + next, 'A: ' + next + '   Y: REPLAY'), SCREEN_WIDTH / 2, 148, 1, 'c');
  }
  if (Input.device === 'touch' && window.innerHeight > window.innerWidth && (game.frame >> 5) & 1) {
    textBox(STRINGS.rotatePhone, SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 30, 'c');
  }
}

function render() {
  toScreen();
  canvasContext.globalCompositeOperation = 'source-over';
  canvasContext.fillStyle = '#000'; canvasContext.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT); canvasContext.fillStyle = '#fff';
  toWorld();
  drawSea();
  drawParticles(false);
  drawBolt();
  toScreen();
  drawRain();
  drawNight();
  drawStars();
  toWorld();
  drawCove();
  drawTowers();
  drawFogBanks();
  drawSmokes();
  drawCrates();
  drawBoats();
  drawParticles(true);
  toScreen();
  if (game.state !== 'title') drawHUD();
  drawOverlay();
  Theme.finishFrame(false);
}
