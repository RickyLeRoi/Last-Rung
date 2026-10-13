// games/faro/src/render.js
'use strict';
// Drawing only: nothing here may change the simulation state.
const { canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT, DARK, horizontalLine, verticalLine, outlineRect, blackRect, drawLine, drawCircle, text, textBox, drawPanel, drawSprite } = Gfx;
const hint = UI.hint;
const bar = UI.bar;
const TOWER_X = 31, TOWER_BASE_Y = 148, TOWER_TOP_Y = 84;
const ISLAND_WIDTH = 62, PIER_Y = 140;

function drawSea() {
  const frame = game.frame, time = game.time;
  for (let x = 0; x < SCREEN_WIDTH; x++) {
    const surface = round(waterSurfaceY(x));
    canvasContext.fillRect(x, surface, 1, 1);
    for (let band = 1; band <= 6; band++) {
      const wave = round(Math.sin(x * 0.06 + time * (0.7 + band * 0.15) + band * 1.7) * 1.5);
      if ((x + band * 7 + (frame >> 3)) % 5 < 2) canvasContext.fillRect(x, surface + band * 11 + wave, 1, 1);
    }
  }
}

function islandTopY(x) { return TOWER_BASE_Y + (x > 48 ? (x - 48) * 2 : 0); }

function drawLighthouse() {
  for (let x = 0; x < ISLAND_WIDTH; x++) {
    const topY = islandTopY(x);
    canvasContext.fillRect(x, topY, 1, 1);
    for (let y = topY + 1; y < SCREEN_HEIGHT - 11; y++) if (((x + y) & 1) === 0) canvasContext.fillRect(x, y, 1, 1);
  }
  for (let y = TOWER_TOP_Y; y <= TOWER_BASE_Y; y++) {
    const halfWidth = round(3.5 + (y - TOWER_TOP_Y) * 0.055);
    canvasContext.fillRect(TOWER_X - halfWidth, y, 1, 1); canvasContext.fillRect(TOWER_X + halfWidth, y, 1, 1);
    const inStripe = (y >= 100 && y < 110) || (y >= 124 && y < 134);
    if (inStripe) for (let x = TOWER_X - halfWidth + 1; x < TOWER_X + halfWidth; x++) if (((x + y) & 1) === 0) canvasContext.fillRect(x, y, 1, 1);
  }
  horizontalLine(TOWER_X - 8, TOWER_X + 8, TOWER_TOP_Y);
  outlineRect(TOWER_X - 5, TOWER_TOP_Y - 16, 11, 16);
  canvasContext.fillRect(CONFIG.lamp.x - 1, CONFIG.lamp.y - 1, 3, 3);
  drawLine(TOWER_X - 6, TOWER_TOP_Y - 16, TOWER_X, TOWER_TOP_Y - 24); drawLine(TOWER_X, TOWER_TOP_Y - 24, TOWER_X + 6, TOWER_TOP_Y - 16);
}

function drawPort() {
  horizontalLine(ISLAND_WIDTH + 2, 100, PIER_Y);
  for (let x = 66; x <= 98; x += 8) verticalLine(x, PIER_Y, PIER_Y + 6);
  outlineRect(66, PIER_Y - 16, 12, 16); canvasContext.fillRect(70, PIER_Y - 10, 3, 3);
  outlineRect(80, PIER_Y - 12, 10, 12); canvasContext.fillRect(84, PIER_Y - 7, 2, 3);
  drawLine(66, PIER_Y - 16, 72, PIER_Y - 21); drawLine(72, PIER_Y - 21, 78, PIER_Y - 16);
  verticalLine(98, PIER_Y - 14, PIER_Y); canvasContext.fillRect(97, PIER_Y - 16, 3, 2);
}

function drawRocks() {
  for (const rock of game.L.rocks) if (rock.seen) drawSprite(SPRITES.rock, rock.x, round(rockWaterlineY(rock)) - 5);
}

function shipTopY(ship) {
  const sinking = ship.state === 'sink' ? Math.min(14, ship.stateT * 0.25) : 0;
  return round(shipWaterlineY(ship)) - SPRITES.ship.h + 1 + sinking;
}
const isShipVisible = ship => ship.state === 'sail' || (ship.state === 'sink' && ship.stateT <= 70) || (ship.state === 'dock' && ship.stateT <= 90);

function drawShips() {
  for (const ship of game.L.ships) if (isShipVisible(ship)) drawSprite(SPRITES.ship, ship.x, shipTopY(ship));
}

// The lantern on the mast is drawn after the darkness: ships are always spotted, only their hull needs the light.
function drawLanterns() {
  for (const ship of game.L.ships) {
    if (ship.state !== 'sail') continue;
    canvasContext.fillRect(round(ship.x) + 7, shipTopY(ship) - 3, 2, 2);
    // A ship that follows the beam shows where it is heading: an arrow toward its target lane.
    if (ship.following && Math.abs(ship.lane - ship.laneF) > 0.05) text(ship.lane < ship.laneF ? '▲' : '▼', round(ship.x) + 5, shipTopY(ship) - 10);
  }
}

function drawRainAndBolt() {
  for (const drop of game.rain) drawLine(drop.x, drop.y, drop.x - game.wind * 1.5 - 0.5, drop.y - 3);
  if (game.bolt && game.boltT > 0) for (const segment of game.bolt.segs) drawLine(segment[0], segment[1], segment[2], segment[3]);
}

function drawParticles(rings) {
  for (const particle of game.parts) {
    const isRing = particle.t === 'ring';
    if (isRing !== rings) continue;
    if (isRing) drawCircle(particle.x, particle.y, particle.r, true);
    else if (particle.t === 'chunk') canvasContext.fillRect(round(particle.x), round(particle.y), particle.w, particle.h);
    else if (particle.t === 'px' || particle.t === 'bub') canvasContext.fillRect(round(particle.x), round(particle.y), 1, 1);
  }
}

// Everything is dark except the lamp, the port, the lanterns, the beam, the flash and lightning.
function drawNight() {
  const lamp = CONFIG.lamp, port = CONFIG.port, circles = [lamp.x, lamp.y, CONFIG.night.halo, lamp.x, CONFIG.night.tower.y, CONFIG.night.tower.radius, port.lightX, port.lightY, port.lightRadius];
  for (const ship of game.L.ships) if (ship.state === 'sail') circles.push(ship.x + 8, shipTopY(ship) - 2, CONFIG.night.lantern);
  const wholeScreen = [SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2, SCREEN_WIDTH];
  if (game.lampFlashT > 0 || game.flashT > 0) circles.push(...wholeScreen);
  if (game.boltT > 0 && game.bolt) for (const segment of game.bolt.segs) circles.push(segment[2], segment[3], 14);
  const geometry = beamGeometry();
  const cones = game.beam.on ? [{ x: geometry.x, y: geometry.y, angle: Math.PI / 2 - geometry.pitch, halfAngle: geometry.half, length: geometry.length }] : [];
  Lighting.darkness({ circles, cones, pattern: DARK });
}

function drawStars() {
  const covers = [TOWER_X - 9, TOWER_X + 9, TOWER_TOP_Y - 24, 0, ISLAND_WIDTH, TOWER_BASE_Y, ISLAND_WIDTH, 100, PIER_Y - 22, ...Parallax.covers(game.L.backdrop, 0, 0)];
  Sky.drawNight({ cameraX: 0, covers, waterY: waterSurfaceY, stars: game.L.stars, moon: null, frame: game.frame });
}

function drawHUD() {
  const level = game.L, frame = game.frame;
  blackRect(0, 0, SCREEN_WIDTH, 11); blackRect(0, SCREEN_HEIGHT - 11, SCREEN_WIDTH, 11);
  for (let x = 0; x < SCREEN_WIDTH; x += 2) { canvasContext.fillRect(x, 10, 1, 1); canvasContext.fillRect(x, SCREEN_HEIGHT - 11, 1, 1); }
  const label = level.tutorial ? 'ADDESTRAMENTO' : level.spec.daily ? 'SFIDA ' + level.spec.daily.slice(5).split('-').reverse().join('/') + ' ' + level.sc.name : 'LV' + level.n + ' ' + level.sc.name;
  text(label, 3, 3);
  text('AL PORTO ' + level.docked + '/' + level.total + '  AFFONDATE ' + level.sunk + '  PUNTI ' + game.score, SCREEN_WIDTH - 3, 3, 1, 'r');

  text('OLIO', 3, SCREEN_HEIGHT - 8);
  bar(24, SCREEN_HEIGHT - 9, 60, game.oil / CONFIG.oil.max);
  text('SIRENA', 94, SCREEN_HEIGHT - 8);
  bar(122, SCREEN_HEIGHT - 9, 40, 1 - game.sirenCool / CONFIG.siren.cooldown);
  if (!game.beam.on && (frame >> 4) & 1) text('LAMPADA SPENTA', SCREEN_WIDTH - 3, SCREEN_HEIGHT - 8, 1, 'r');
  if (game.msgT > 0 && !(game.msgT < 30 && (frame >> 2) & 1)) textBox(game.msg, SCREEN_WIDTH / 2, 14, 'c');
  if (level.tutorial && game.tut && game.state !== 'done') {
    const step = TUTORIAL[game.tut.step];
    if (step) textBox(tutorialText(step), SCREEN_WIDTH / 2, 26, 'c');
    if (game.state === 'play') text(hint('N: SALTA', 'SALTA: ESCI', 'Y: SALTA'), 3, 14);
  }
  if (game.state === 'replay' && (frame >> 4) & 1) textBox('REPLAY  -  ' + hint('INVIO', 'TOCCA', 'A') + ' PER SALTARE', SCREEN_WIDTH / 2, 32, 'c');
}

function drawOverlay() {
  const level = game.L, blink = (game.frame >> 5) & 1, state = game.state;
  if (state === 'title') {
    drawPanel(34, 16, SCREEN_WIDTH - 68, SCREEN_HEIGHT - 32);
    text('IL FARO', SCREEN_WIDTH / 2, 26, 3, 'c');
    text('GUIDA LE NAVI AL PORTO CON LA LUCE', SCREEN_WIDTH / 2, 46, 1, 'c');
    const controls = hint(
      ['SINISTRA / DESTRA : ALZA E ABBASSA IL FASCIO', 'SU : STRETTO E LUNGO   GIU : LARGO E CORTO', 'SPAZIO : SIRENA (RALLENTA LE NAVI)', 'X : LAMPO (ILLUMINA TUTTO, CONSUMA OLIO)', 'P PAUSA  R RICOMINCIA  M AUDIO  V REPLAY'],
      ['LEVETTA : ORIENTA IL FASCIO (ORIZZ.) E LO APRE (VERT.)', 'SIRENA : RALLENTA LE NAVI', 'LAMPO : ILLUMINA TUTTO, CONSUMA OLIO', 'II : PAUSA     AUDIO : SUONO SI/NO'],
      ['LEVETTA / CROCE : ORIENTA E APRE IL FASCIO', 'B : SIRENA (RALLENTA LE NAVI)', 'X O RB : LAMPO (CONSUMA OLIO)', 'START PAUSA  BACK RICOMINCIA  Y REPLAY']);
    const rules = [
      'LE NAVI ILLUMINATE SEGUONO IL CENTRO DEL FASCIO',
      'GLI SCOGLI SI VEDONO SOLO CON LA LUCE',
      "L'OLIO SI RICARICA QUANDO NON CI SONO NAVI",
      "SERVE PORTARE AL PORTO PIU' DELLA META'",
    ];
    controls.concat([''], rules).forEach((line, i) => text(line, SCREEN_WIDTH / 2, 56 + i * 9, 1, 'c'));
    if (blink) text(hint('INVIO: GIOCA     G: SFIDA DEL GIORNO', 'TOCCA PER GIOCARE', 'A: GIOCA     Y: SFIDA DEL GIORNO'), SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30, 1, 'c');
  } else if (state === 'intro') {
    const notes = [];
    if (level.fog) notes.push('NEBBIA: LA LUCE ARRIVA MENO LONTANO');
    if (level.lightning) notes.push('FULMINI: PER UN ATTIMO VEDI GLI SCOGLI');
    notes.push('NAVI: ' + level.total + "  (SERVE PIU' DELLA META')");
    const promptY = 100 + notes.length * 9 + 6;
    drawPanel(48, 46, SCREEN_WIDTH - 96, promptY - 46 + 16);
    text(level.tutorial ? 'IMPARA A USARE IL FARO' : level.spec.daily ? 'SFIDA DEL GIORNO ' + level.spec.daily : 'LIVELLO ' + level.n, SCREEN_WIDTH / 2, 56, 1, 'c');
    text(level.sc.name, SCREEN_WIDTH / 2, 68, 2, 'c');
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
    text('AL PORTO ' + level.docked + '/' + level.total + '   PUNTI ' + game.score, SCREEN_WIDTH / 2, 108, 1, 'c');
    if (blink) text(hint('INVIO: RIPROVA     V: REPLAY', 'TOCCA: RIPROVA', 'A: RIPROVA     Y: REPLAY'), SCREEN_WIDTH / 2, 128, 1, 'c');
  } else if (state === 'done') {
    const win = game.result === 'win';
    drawPanel(40, 40, SCREEN_WIDTH - 80, 124);
    text(win ? 'MISSIONE COMPIUTA' : 'MISSIONE FALLITA', SCREEN_WIDTH / 2, 50, 2, 'c');
    UI.stars({ on: SPRITES.starOn, off: SPRITES.starOff }, game.stars, 66);
    text('AL PORTO: ' + level.docked + '/' + level.total + '   AFFONDATE: ' + level.sunk, SCREEN_WIDTH / 2, 92, 1, 'c');
    if (win && game.bonus) text('BONUS STELLE: +' + game.bonus, SCREEN_WIDTH / 2, 103, 1, 'c');
    if (!win) text("SERVE PORTARE AL PORTO PIU' DELLA META' DELLE NAVI", SCREEN_WIDTH / 2, 103, 1, 'c');
    text('PUNTI: ' + game.score, SCREEN_WIDTH / 2, 114, 1, 'c');
    text("1 STELLA: PIU' DELLA META'  2: 75%  3: NESSUNA AFFONDATA", SCREEN_WIDTH / 2, 128, 1, 'c');
    const next = !win ? 'RIPROVA' : level.spec.daily ? 'MENU' : 'PROSSIMO LIVELLO';
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
  Parallax.draw(game.L.backdrop, 0, 0);
  drawSea();
  drawRocks();
  drawLighthouse();
  drawPort();
  drawShips();
  drawParticles(false);
  drawRainAndBolt();
  drawNight();
  drawStars();
  drawLanterns();
  drawParticles(true);
  if (game.L.fog) Lighting.fogBanks({ time: game.time, wind: game.wind, clear: [CONFIG.lamp.x, CONFIG.lamp.y, 40] });
  if (game.state !== 'title') drawHUD();
  drawOverlay();
  Theme.finishFrame(false);
}
