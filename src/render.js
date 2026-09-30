'use strict';
// Drawing only: Math.random is allowed here because it never feeds the simulation.
const { canvasContext, SCREEN_WIDTH, SCREEN_HEIGHT, DITHER, DARK, DUSK, RED, horizontalLine, verticalLine, outlineRect, blackRect, drawLine, drawCircle, text, textBox, drawPanel, drawSprite, drawSpriteScaled } = Gfx;

// Blood pixels are painted last so the lightning inversion does not turn them blue.
const redPixels = [];
function drawRed() {
  if (!redPixels.length) return;
  canvasContext.fillStyle = RED;
  for (let i = 0; i < redPixels.length; i += 2) canvasContext.fillRect(redPixels[i], redPixels[i + 1], 1, 1);
  canvasContext.fillStyle = '#fff';
}

const hint = (keyboard, touch, gamepad) => (Input.device === 'touch' ? touch : Input.device === 'pad' ? gamepad : keyboard);

function moonPixels(level) {
  const key = level.night && !level.moonFull ? 'falce' : 'piena';
  if (level._moon && level._moon.key === key) return level._moon.px;
  const seen = new Set(), pixels = [];
  const addPixel = (x, y) => { const pixelKey = x + ',' + y; if (!seen.has(pixelKey)) { seen.add(pixelKey); pixels.push([x, y]); } };
  const radius = 8;
  if (key === 'piena') {
    for (let angleIndex = 0; angleIndex < 64; angleIndex++) addPixel(round(Math.cos(angleIndex / 64 * Math.PI * 2) * radius), round(Math.sin(angleIndex / 64 * Math.PI * 2) * radius));
    for (let angleIndex = 0; angleIndex < 16; angleIndex += 2) addPixel(3 + round(Math.cos(angleIndex / 16 * Math.PI * 2) * 2), -2 + round(Math.sin(angleIndex / 16 * Math.PI * 2) * 2));
    addPixel(-3, 3); addPixel(-2, 2); addPixel(2, 4); addPixel(-4, -2);
  } else {   // crescent: moon rim outside the covering circle, plus the covering circle rim inside the moon
    const coverX = 4, coverY = -2, coverRadius = 7;
    for (let angleIndex = 0; angleIndex < 96; angleIndex++) {
      const cosine = Math.cos(angleIndex / 96 * Math.PI * 2), sine = Math.sin(angleIndex / 96 * Math.PI * 2);
      const x = cosine * radius, y = sine * radius;
      if ((x - coverX) ** 2 + (y - coverY) ** 2 > coverRadius * coverRadius) addPixel(round(x), round(y));
      const coverPointX = coverX + cosine * coverRadius, coverPointY = coverY + sine * coverRadius;
      if (coverPointX * coverPointX + coverPointY * coverPointY < radius * radius) addPixel(round(coverPointX), round(coverPointY));
    }
  }
  level._moon = { key, px: pixels };
  return pixels;
}

function drawBackground() {
  const level = game.L, cameraX = game.camX, frame = game.frame, time = game.time;
  for (const star of level.stars) {
    const x = round(star.x - cameraX * 0.08);
    if (x < 0 || x >= SCREEN_WIDTH || (star.tw && ((frame + star.ph) % 120) < 10)) continue;
    canvasContext.fillRect(x, star.y, 1, 1);
  }
  if (level.moon) {
    const moonX = round(level.moon.x - cameraX * 0.03), moonY = level.moon.y;
    for (const moonPixel of moonPixels(level)) canvasContext.fillRect(moonX + moonPixel[0], moonY + moonPixel[1], 1, 1);
  }
  const span = SCREEN_WIDTH + 240;
  for (const cloud of level.clouds) {
    const x = round((((cloud.x - cameraX * cloud.par + time * cloud.sp) % span) + span) % span - 120);
    for (let i = 0; i < cloud.pts.length; i += 2) canvasContext.fillRect(x + cloud.pts[i], cloud.y + cloud.pts[i + 1], 1, 1);
  }
  for (const building of level.skyline) {
    const x = round(building.x - cameraX * 0.35);
    if (x + building.w < 0 || x > SCREEN_WIDTH) continue;
    for (let edgeY = building.y; edgeY < building.bot; edgeY += 2) { canvasContext.fillRect(x, edgeY, 1, 1); canvasContext.fillRect(x + building.w, edgeY, 1, 1); }
    for (let edgeX = x; edgeX <= x + building.w; edgeX += 2) canvasContext.fillRect(edgeX, building.y, 1, 1);
    for (let i = 0; i < building.lights.length; i += 2) canvasContext.fillRect(x + building.lights[i], building.y + building.lights[i + 1], 1, 1);
  }
}

function drawSolid(solid, cameraX) {
  const x = round(solid.x), y = round(solid.y), width = round(solid.w), frame = game.frame;
  switch (solid.kind) {
    case 'bld': {
      const bottom = Math.min(SCREEN_HEIGHT, round(solid.y + solid.h));
      blackRect(x, y, width, bottom - y);
      horizontalLine(x, x + width - 1, y); verticalLine(x, y, bottom); verticalLine(x + width - 1, y, bottom);
      for (let i = x + 2; i < x + width - 2; i += 2) canvasContext.fillRect(i, y + 2, 1, 1);
      for (const windowPane of solid.win) {
        if (windowPane.x < cameraX - 6 || windowPane.x > cameraX + SCREEN_WIDTH) continue;
        outlineRect(windowPane.x, windowPane.y, 4, 5);
        if (windowPane.fire) {
          const flicker = (frame >> 2) + windowPane.x;
          canvasContext.fillRect(windowPane.x + 1, windowPane.y + 3, 2, 1);
          canvasContext.fillRect(windowPane.x + 1 + (flicker & 1), windowPane.y + 2 - ((flicker >> 1) & 1), 1, 1);
        } else if (windowPane.lit) canvasContext.fillRect(windowPane.x + 1 + (windowPane.x & 1), windowPane.y + 2, 1, 1);
      }
      if (solid.safe) {
        text('H', x + (width >> 1) - 1, y + 5);
        if ((frame >> 4) & 1) { canvasContext.fillRect(x, y - 1, 1, 1); canvasContext.fillRect(x + width - 1, y - 1, 1, 1); }
      }
      if (solid.door) outlineRect(x + (width >> 1) - 3, bottom - 9, 6, 9);
      break;
    }
    case 'ground': {
      blackRect(x, y, width, SCREEN_HEIGHT - y);
      horizontalLine(x, x + width - 1, y);
      const visibleLeft = Math.max(x, cameraX), visibleRight = Math.min(x + width, cameraX + SCREEN_WIDTH);
      for (let speckY = y + 4; speckY < SCREEN_HEIGHT; speckY += 5) for (let speckX = visibleLeft; speckX < visibleRight; speckX++) if (((speckX * 7 + speckY * 3) % 13) === 0) canvasContext.fillRect(speckX, speckY, 1, 1);
      if (x > 0) verticalLine(x, y, SCREEN_HEIGHT);
      if (x + width < game.L.worldW) verticalLine(x + width - 1, y, SCREEN_HEIGHT);
      break;
    }
    case 'boat':
      blackRect(x + 1, y + 1, width - 2, 8);
      horizontalLine(x, x + width - 1, y); drawLine(x, y, x + 6, y + 9); drawLine(x + width - 1, y, x + width - 5, y + 9); horizontalLine(x + 6, x + width - 5, y + 9);
      for (let i = x + 4; i < x + width - 4; i += 2) canvasContext.fillRect(i, y + 3, 1, 1);
      drawCircle(x + (width >> 1), y + 6, 2);
      canvasContext.fillRect(x - 1, y - 1, 1, 1); canvasContext.fillRect(x + width, y - 1, 1, 1);
      break;
    case 'hull':
      blackRect(x + 1, y + 1, width - 2, 26);
      horizontalLine(x, x + width - 1, y); drawLine(x, y, x + 10, y + 26); verticalLine(x + width - 1, y, y + 26); horizontalLine(x + 10, x + width - 1, y + 26);
      for (let i = x + 22; i < x + width - 12; i += 12) drawCircle(i, y + 7, 1);
      for (let i = x + 2; i < x + width - 30; i += 2) canvasContext.fillRect(i, y - 3, 1, 1);
      break;
    case 'tower':
      blackRect(x, y, width, solid.h); outlineRect(x, y, width, solid.h + 1);
      for (let i = 0; i < 3; i++) outlineRect(x + 2 + i * 6, y + 4, 4, 3);
      break;
    case 'rock':
      blackRect(x, y, width, 40);
      horizontalLine(x + 3, x + width - 4, y); drawLine(x + 3, y, x, y + 3); drawLine(x + width - 4, y, x + width - 1, y + 3);
      verticalLine(x, y + 3, y + 40); verticalLine(x + width - 1, y + 3, y + 40);
      drawLine(x + 8, y + 4, x + 12, y + 10); drawLine(x + 12, y + 10, x + 10, y + 16); drawLine(x + 22, y + 3, x + 26, y + 9); drawLine(x + 26, y + 9, x + 30, y + 13);
      break;
    case 'rig':
      blackRect(x, y, width, solid.h); outlineRect(x, y, width, solid.h);
      for (let i = 0; i + 4 < width; i += 4) drawLine(x + i, y + solid.h - 1, x + i + 2, y);
      for (let i = x; i < x + width; i += 2) canvasContext.fillRect(i, y - 3, 1, 1);
      for (let i = 1; i < width; i += 10) verticalLine(x + i, y - 3, y - 1);
      break;
    case 'leg':
      verticalLine(x, y, SCREEN_HEIGHT); verticalLine(x + width - 1, y, SCREEN_HEIGHT);
      for (let braceY = y + 2; braceY < SCREEN_HEIGHT; braceY += 8) drawLine(x, braceY, x + width - 1, braceY + 4);
      break;
  }
}

function drawFire(fire) {
  // the rotor flattens the flames: lower and wider (see fireRect)
  const rect = fireRect(fire), baseFlameHeight = rect.h / 0.8, left = round(rect.x), width = round(rect.w);
  let previousY = -1;
  const baseY = round(fire.y), time = game.time;
  for (let i = 0; i < width; i++) {
    const column = left + i, phaseOffset = column - fire.x;   // phase tied to world position so the flame does not scroll while widening
    const noise = Math.abs(Math.sin(phaseOffset * 1.3 + time * (9 + fire.press * 6) + fire.seed) * Math.sin(phaseOffset * 0.55 - time * 5.7 + fire.seed * 2));
    const edge = Math.min(1, (Math.min(i, width - 1 - i) + 1) / 3);
    const flameHeight = baseFlameHeight * (0.3 + 0.7 * noise) * edge, y = round(fire.y - flameHeight);
    if (previousY < 0) verticalLine(column, y, baseY - 1);
    else if (previousY < y - 1) canvasContext.fillRect(column, previousY + 1, 1, y - previousY);
    else if (previousY > y + 1) canvasContext.fillRect(column, y, 1, previousY - y);
    else canvasContext.fillRect(column, y, 1, 1);
    if (i & 1) canvasContext.fillRect(column, round(fire.y - flameHeight * 0.45), 1, 1);
    previousY = y;
  }
  verticalLine(left + width - 1, previousY, baseY - 1);
}

function drawDecor(decor, cameraX) {
  if (decor.x < cameraX - 20 || decor.x > cameraX + SCREEN_WIDTH + 20) return;
  if (decor.k === 'tree') {
    const waterBase = game.L.water.base;
    drawCircle(decor.x, waterBase - 10, 5); drawCircle(decor.x - 1, waterBase - 11, 2, true); verticalLine(decor.x, waterBase - 5, waterBase + 4);
    return;
  }
  const surfaceY = waterSurfaceY(decor.x + 3);
  if (surfaceY === Infinity) return;
  const y = round(surfaceY), x = round(decor.x);
  if (decor.k === 'crate') { blackRect(x, y - 3, 6, 5); outlineRect(x, y - 3, 6, 5); drawLine(x, y - 3, x + 5, y + 1); }
  else if (decor.k === 'buoy') { verticalLine(x, y - 8, y); canvasContext.fillRect(x - 1, y - 2, 3, 1); if ((game.frame >> 5) & 1) canvasContext.fillRect(x, y - 10, 1, 1); }
  else if (decor.k === 'car') { horizontalLine(x + 3, x + 9, y - 4); drawLine(x + 3, y - 4, x + 1, y - 1); drawLine(x + 9, y - 4, x + 11, y - 1); horizontalLine(x, x + 12, y - 1); verticalLine(x + 6, y - 3, y - 2); }
}

function kindSprite(person, armsUp) {
  switch (person.kind) {
    case 'kid': return armsUp ? SPRITES.kidUp : SPRITES.kidOut;
    case 'old': return armsUp ? SPRITES.oldUp : SPRITES.oldOut;
    case 'dog': return armsUp ? SPRITES.dog1 : SPRITES.dog2;
    default: return armsUp ? SPRITES.up : SPRITES.out;
  }
}
function drawBody(person, armsUp, offsetY, skew) {
  const sprite = kindSprite(person, armsUp);
  drawSprite(sprite, person.x + ((7 - sprite.w) >> 1), person.y + 8 - sprite.h + (offsetY || 0), false, skew);
}
function drawHanging(person) {
  if (person.kind === 'kid' || person.kind === 'dog') drawBody(person, true, 0, person.sw);
  else drawSprite(SPRITES.hang, person.x, person.y, false, person.sw);
}

function drawPerson(person) {
  const phasedFrame = game.frame + person.ph, heli = game.heli;
  switch (person.state) {
    case 'stand': {
      if (person.injured) {
        drawSprite(person.run && ((phasedFrame / 8) | 0) % 2 ? SPRITES.inj2 : SPRITES.inj, person.x, person.y);
        if ((phasedFrame >> 4) & 1) { const crossX = round(person.x) + 3, crossY = round(person.y) - (person.tmax > 0 ? 8 : 5); canvasContext.fillRect(crossX - 1, crossY, 3, 1); canvasContext.fillRect(crossX, crossY - 1, 1, 3); }
        break;
      }
      const period = person.panic ? 3 : person.run ? 5 : (Math.abs(heli.x + 16 - person.x - 3) < 90 ? 8 : 22);
      drawBody(person, ((phasedFrame / period) | 0) % 2);
      if (person.blocked && (phasedFrame >> 3) & 1) text('!', round(person.x) + 2, round(person.y) - 7);
      break;
    }
    case 'float':
      drawBody(person, ((phasedFrame / 10) | 0) % 2);
      if (person.buoy) { blackRect(round(person.x) - 1, round(person.y) + 4, 9, 3); outlineRect(round(person.x) - 1, round(person.y) + 4, 9, 3); }
      break;
    case 'fall': drawBody(person, ((phasedFrame / 4) | 0) % 2); break;
    case 'saved': drawBody(person, (phasedFrame % 50) < 25, -((phasedFrame % 50) < 8 ? 1 : 0)); break;
    case 'dead': drawSprite(SPRITES.dead, person.x, person.y); break;
  }
}

function drawHeli() {
  const heli = game.heli;
  if (heli.state === 'dead') return;
  if (heli.iframes > 0 && (game.frame >> 2) & 1) return;
  // visual-only shake in smoke (the physical turbulence lives in heli.js)
  const jitter = heli.turb > 0.25 ? () => (Math.random() < heli.turb * 0.6 ? (Math.random() < 0.5 ? -1 : 1) : 0) : () => 0;
  const x = round(heli.x) + jitter(), y = round(heli.y) + jitter(), flipped = heli.face < 0;
  const tilt = heli.tilt || 0;
  const tiltOffset = sourceColumn => round(tilt * (sourceColumn - 16) / 16);
  const heliSprite = SPRITES.heli;
  canvasContext.fillStyle = '#000';
  for (let column = 0; column < 32; column++) {
    const span = SPRITES.heliFill[flipped ? 31 - column : column];
    if (span) canvasContext.fillRect(x + column, y + span[0] + tiltOffset(column), 1, span[1] - span[0] + 1);
  }
  canvasContext.fillStyle = '#fff';
  for (let i = 0; i < heliSprite.p.length; i += 2) {
    const column = flipped ? 31 - heliSprite.p[i] : heliSprite.p[i];
    canvasContext.fillRect(x + column, y + heliSprite.p[i + 1] + tiltOffset(column), 1, 1);
  }
  const rotorCenter = flipped ? 15 : 16, rotorHalfLength = round(1 + 14 * Math.abs(Math.cos(heli.rot)));
  drawLine(x + rotorCenter - rotorHalfLength + 1, y + tiltOffset(rotorCenter - rotorHalfLength + 1), x + rotorCenter + rotorHalfLength, y + tiltOffset(rotorCenter + rotorHalfLength));
  for (let i = 0; i < Math.min(heli.cab.length, 3); i++) {
    const column = flipped ? 31 - (22 + i) : 22 + i;
    canvasContext.fillRect(x + column, y + 5 + tiltOffset(column), 1, 1);
  }
  const ladderTop = y + 12 + tiltOffset(16), swing = heli.lad || 0, ladderLength = Math.max(1, round(heli.ladLen));
  const ladderX = x + 14, swingOffset = rung => round(swing * rung / Math.max(1, ladderLength - 1));
  if (heli.bucket.on) {
    const bucketX = x + 16 + round(swing), bucketY = ladderTop + ladderLength - 5;
    drawLine(x + 16, ladderTop, bucketX, bucketY);
    blackRect(bucketX - 3, bucketY, 7, 5);
    horizontalLine(bucketX - 3, bucketX + 3, bucketY); verticalLine(bucketX - 3, bucketY, bucketY + 3); verticalLine(bucketX + 3, bucketY, bucketY + 3); horizontalLine(bucketX - 2, bucketX + 2, bucketY + 4);
    const fillLevel = round(4 * heli.bucket.fill);
    if (fillLevel > 0) { canvasContext.fillStyle = DITHER; canvasContext.fillRect(bucketX - 2, bucketY + 4 - fillLevel, 5, fillLevel); canvasContext.fillStyle = '#fff'; }
  } else {
    canvasContext.fillStyle = '#000'; canvasContext.fillRect(ladderX + 1 + Math.min(0, round(swing)), ladderTop, 2 + Math.abs(round(swing)), ladderLength); canvasContext.fillStyle = '#fff';
    drawLine(ladderX, ladderTop, ladderX + round(swing), ladderTop + ladderLength - 1);
    drawLine(ladderX + 3, ladderTop, ladderX + 3 + round(swing), ladderTop + ladderLength - 1);
    for (let rung = 1; rung < ladderLength; rung += 2) horizontalLine(ladderX + swingOffset(rung), ladderX + 3 + swingOffset(rung), ladderTop + rung);
  }
  if (heli.blood && heli.blood.length) {
    for (let i = 0; i < heli.blood.length; i += 2) {
      const spriteColumn = heli.blood[i], localY = heli.blood[i + 1];
      if (localY >= 12) {
        const rung = localY - 12;
        if (rung < ladderLength) redPixels.push(x + spriteColumn + swingOffset(rung), ladderTop + rung);
        continue;
      }
      const column = flipped ? 31 - spriteColumn : spriteColumn;
      if (localY === 0 && Math.abs(column - rotorCenter) > rotorHalfLength) continue;
      redPixels.push(x + column, y + localY + tiltOffset(column));
    }
  }
  for (let i = heli.att.length - 1; i >= 0; i--) drawHanging(heli.att[i]);
  const crew = heli.crew;
  if (crew && crew.st !== 'idle') {
    drawSprite(SPRITES.crew, crew.x, crew.y);
    if (crew.carry) drawSprite(SPRITES.dead, crew.x - 1, crew.y - 2);
  }
}

function drawParticle(particle) {
  switch (particle.t) {
    case 'px':
      if (particle.bl) redPixels.push(round(particle.x), round(particle.y)); else canvasContext.fillRect(round(particle.x), round(particle.y), 1, 1);
      break;
    case 'chunk': {
      if (particle.life < 60 && (game.frame >> 2) & 1) break;
      const x = round(particle.x), y = round(particle.y);
      for (let i = 0; i < particle.pts.length; i += 2) canvasContext.fillRect(x + particle.pts[i], y + particle.pts[i + 1], 1, 1);
      break;
    }
    case 'smoke': drawCircle(particle.x, particle.y, particle.r, true); break;
    case 'ring': drawCircle(particle.x, particle.y, particle.r); break;
  }
}

const waterY = new Int16Array(SCREEN_WIDTH + 8);
function drawWater() {
  const water = game.L.water;
  if (!water) return;
  const leftX = Math.floor(game.camX) - 2, columnCount = SCREEN_WIDTH + 6, frame = game.frame, time = game.time;
  canvasContext.fillStyle = DITHER;
  for (let i = 0; i < columnCount; i++) {
    const worldX = leftX + i, surface = waterSurfaceY(worldX);
    if (surface === Infinity) { waterY[i] = -999; continue; }
    const surfaceY = round(surface);
    waterY[i] = surfaceY;
    canvasContext.fillRect(worldX, surfaceY + 1, 1, SCREEN_HEIGHT + 10 - surfaceY);
  }
  canvasContext.fillStyle = '#fff';
  for (let i = 0; i < columnCount; i++) {
    const surfaceY = waterY[i];
    if (surfaceY === -999) continue;
    const worldX = leftX + i, previousSurfaceY = i > 0 && waterY[i - 1] !== -999 ? waterY[i - 1] : surfaceY;
    if (previousSurfaceY < surfaceY - 1) canvasContext.fillRect(worldX, previousSurfaceY + 1, 1, surfaceY - previousSurfaceY);
    else if (previousSurfaceY > surfaceY + 1) canvasContext.fillRect(worldX, surfaceY, 1, previousSurfaceY - surfaceY);
    else canvasContext.fillRect(worldX, surfaceY, 1, 1);
    if (((worldX + (frame >> 3)) % 3 + 3) % 3 === 0) canvasContext.fillRect(worldX, surfaceY + 2, 1, 1);
    let streak = ((Math.floor(worldX + time * 36) % 19) + 19) % 19; if (streak < 4) canvasContext.fillRect(worldX, surfaceY + 9, 1, 1);
    streak = ((Math.floor(worldX - time * 24) % 23) + 23) % 23; if (streak < 3) canvasContext.fillRect(worldX, surfaceY + 20, 1, 1);
    streak = ((Math.floor(worldX + time * 15) % 29) + 29) % 29; if (streak < 5) canvasContext.fillRect(worldX, surfaceY + 34, 1, 1);
    if (water.A[0] > 4 && i > 0 && i < columnCount - 1 && waterY[i + 1] !== -999 && surfaceY < waterY[i - 1] && surfaceY <= waterY[i + 1]) canvasContext.fillRect(worldX, surfaceY - 1, 1, 1);
  }
}

function drawWorld(cameraX) {
  const level = game.L, frame = game.frame;
  for (const solid of level.solids) {
    if (solid.x > cameraX + SCREEN_WIDTH + 4 || solid.x + solid.w < cameraX - 4) continue;
    drawSolid(solid, cameraX);
    if (solid.blood && solid.blood.length) {
      const solidX = round(solid.x), solidY = round(solid.y);
      for (let i = 0; i < solid.blood.length; i += 2) redPixels.push(solidX + solid.blood[i], solidY + solid.blood[i + 1]);
    }
  }
  for (const hazard of level.haz) {
    if (hazard.x0 > cameraX + SCREEN_WIDTH || hazard.x1 < cameraX) continue;
    for (let i = 0; i < hazard.pts.length; i += 2) canvasContext.fillRect(hazard.pts[i], hazard.pts[i + 1], 1, 1);
    if (hazard.blink && (frame >> 4) & 1) canvasContext.fillRect(hazard.blink[0], hazard.blink[1] - 2, 1, 1);
  }
  for (const fire of level.fires) if (!(fire.x > cameraX + SCREEN_WIDTH || fire.x + fire.w < cameraX)) drawFire(fire);
  for (const decor of level.decor) drawDecor(decor, cameraX);
  for (const buoy of level.buoys) if (buoy.st !== 'taken') { blackRect(round(buoy.x), round(buoy.y), 5, 5); drawCircle(round(buoy.x) + 2, round(buoy.y) + 2, 2); }
  for (const person of level.people) if (person.state !== 'hang' && person.state !== 'aboard' && person.state !== 'carried') drawPerson(person);
  drawHeli();
  for (const particle of game.parts) if (particle.t !== 'bub') drawParticle(particle);
  drawWater();
  for (const particle of game.parts) if (particle.t === 'bub') canvasContext.fillRect(round(particle.x), round(particle.y), 1, 1);
  if (game.bolt && game.boltT > 0) for (const segment of game.bolt.segs) drawLine(segment[0], segment[1], segment[2], segment[3]);
  for (const person of level.people) {
    if ((person.state === 'stand' || person.state === 'float') && person.tmax > 0) {
      const timeRatio = person.timer / person.tmax;
      if (timeRatio < 0.25 && (frame >> 3) & 1) continue;
      canvasContext.fillRect(round(person.x), round(person.y) - 3, Math.max(1, Math.ceil(7 * timeRatio)), 1);
    }
  }
  if (!level.night && !level.fog) drawSafeMarker();   // at night and in fog it is drawn later, on top of the darkness
}

function drawSafeMarker() {
  const level = game.L, frame = game.frame;
  const safeZone = level.safe, arrowX = round(safeZone.x + safeZone.w / 2), arrowY = round(safeZone.y) - 23 + ((frame >> 4) & 1);
  canvasContext.fillRect(arrowX - 3, arrowY, 7, 1); canvasContext.fillRect(arrowX - 2, arrowY + 1, 5, 1); canvasContext.fillRect(arrowX - 1, arrowY + 2, 3, 1); canvasContext.fillRect(arrowX, arrowY + 3, 1, 1);
  const heli = game.heli;
  if (Math.abs(heli.x + 16 - arrowX) > 44 || heli.y + 16 < arrowY - 24) text('ZONA SICURA', arrowX, arrowY - 7, 1, 'c');
}

// Dark pattern everywhere except lit zones (heli halo and cone, helipad, fires, explosions), computed per column.
// offsetX/offsetY: world-to-screen shift (camera + shake).
function drawNight(offsetX, offsetY) {
  const heli = game.heli, level = game.L, nightConfig = CONFIG.night;
  const circles = [], cones = [];
  if (heli.state !== 'dead') {
    circles.push(heli.x + 16 - offsetX, heli.y + 8 + offsetY, nightConfig.halo);
    if (heli.state === 'fly' && !heli.engineOff) {
      const angle = clamp(heli.vx * 0.35 + heli.face * 0.22, -0.8, 0.8);
      cones.push({ x: heli.x + 16 - offsetX, y: heli.y + 13 + offsetY, a: angle, dx: Math.sin(angle), dy: Math.cos(angle), c: Math.cos(nightConfig.cone), len: nightConfig.coneLen });
    }
  }
  const safeZone = level.safe;
  circles.push(safeZone.x + safeZone.w / 2 - offsetX, safeZone.y + offsetY, nightConfig.safe);
  for (const fire of level.fires) circles.push(fire.x + fire.w / 2 - offsetX, fire.y - fire.h / 2 + offsetY, nightConfig.fire + fire.w / 2 + Math.random() * 3);
  for (const particle of game.parts) {
    if (particle.t === 'ring') circles.push(particle.x - offsetX, particle.y + offsetY, particle.r + 14);
    else if (particle.t === 'chunk' && particle.fire) circles.push(particle.x - offsetX, particle.y + offsetY, 6);
  }
  if (game.boltT > 0 && game.bolt) for (const segment of game.bolt.segs) circles.push(segment[2] - offsetX, segment[3] + offsetY, 14);
  const litSpans = [];
  canvasContext.fillStyle = level.moonFull ? DUSK : DARK;
  for (let column = 0; column < SCREEN_WIDTH; column++) {
    litSpans.length = 0;
    const columnCenterX = column + 0.5;
    for (let i = 0; i < circles.length; i += 3) {
      const deltaX = columnCenterX - circles[i], radius = circles[i + 2];
      if (deltaX > -radius && deltaX < radius) { const halfChord = Math.sqrt(radius * radius - deltaX * deltaX); litSpans.push(circles[i + 1] - halfChord, circles[i + 1] + halfChord); }
    }
    for (const cone of cones) {
      const coneDeltaX = columnCenterX - cone.x;
      if (coneDeltaX < -cone.len || coneDeltaX > cone.len) continue;
      let litTop = 1e9, litBottom = -1e9;
      const scanStart = Math.max(0, Math.floor(cone.y - cone.len)), scanEnd = Math.min(SCREEN_HEIGHT, Math.ceil(cone.y + cone.len));
      for (let y = scanStart; y < scanEnd; y++) {
        const coneDeltaY = y + 0.5 - cone.y, distance = Math.sqrt(coneDeltaX * coneDeltaX + coneDeltaY * coneDeltaY);
        if (distance <= cone.len && coneDeltaX * cone.dx + coneDeltaY * cone.dy >= cone.c * distance) { if (y < litTop) litTop = y; litBottom = y + 1; }
      }
      if (litBottom > litTop) litSpans.push(litTop, litBottom);
    }
    const order = [];
    for (let i = 0; i < litSpans.length; i += 2) order.push(i);
    order.sort((first, second) => litSpans[first] - litSpans[second]);
    let darkFromY = 0;
    for (const i of order) {
      const spanTop = Math.max(0, Math.floor(litSpans[i])), spanBottom = Math.min(SCREEN_HEIGHT, Math.ceil(litSpans[i + 1]));
      if (spanTop > darkFromY) canvasContext.fillRect(column, darkFromY, 1, spanTop - darkFromY);
      if (spanBottom > darkFromY) darkFromY = spanBottom;
    }
    if (darkFromY < SCREEN_HEIGHT) canvasContext.fillRect(column, darkFromY, 1, SCREEN_HEIGHT - darkFromY);
  }
  canvasContext.fillStyle = '#fff';
  for (const cone of cones) {
    for (const sign of [-1, 1]) {
      const edgeAngle = cone.a + sign * nightConfig.cone;
      drawLine(cone.x, cone.y, cone.x + Math.sin(edgeAngle) * cone.len * 0.8, cone.y + Math.cos(edgeAngle) * cone.len * 0.8, true);
    }
  }
}

function drawNightSky(cameraX) {
  const level = game.L, columnTop = new Int16Array(SCREEN_WIDTH).fill(SCREEN_HEIGHT), frame = game.frame;
  const coverColumns = (fromX, toX, y) => {
    for (let column = Math.max(0, Math.floor(fromX)); column < Math.min(SCREEN_WIDTH, Math.ceil(toX)); column++) if (y < columnTop[column]) columnTop[column] = y;
  };
  for (const solid of level.solids) coverColumns(solid.x - cameraX - 1, solid.x + solid.w - cameraX + 1, solid.y - 1);
  for (const hazard of level.haz) coverColumns(hazard.x0 - cameraX - 1, hazard.x1 - cameraX + 2, hazard.y0 - 2);
  for (const building of level.skyline) { const x = round(building.x - cameraX * 0.35); coverColumns(x - 1, x + building.w + 2, building.y - 1); }
  for (const fire of level.fires) coverColumns(fire.x - cameraX - 4, fire.x + fire.w - cameraX + 4, fire.y - fire.h - 6);
  const heli = game.heli;
  if (heli.state !== 'dead') coverColumns(heli.x - cameraX - 2, heli.x + 34 - cameraX, heli.y - 2);
  for (let column = 0; column < SCREEN_WIDTH; column++) { const surfaceY = waterSurfaceY(column + cameraX); if (surfaceY - 1 < columnTop[column]) columnTop[column] = round(surfaceY) - 1; }
  const isVisible = (x, y) => x >= 0 && x < SCREEN_WIDTH && y < columnTop[x];
  for (const star of level.stars) {
    const x = round(star.x - cameraX * 0.08);
    if (!isVisible(x, star.y) || (star.tw && ((frame + star.ph) % 120) < 10)) continue;
    canvasContext.fillRect(x, star.y, 1, 1);
  }
  if (level.moon) {
    const moonX = round(level.moon.x - cameraX * 0.03), moonY = level.moon.y;
    for (const moonPixel of moonPixels(level)) if (isVisible(moonX + moonPixel[0], moonY + moonPixel[1])) canvasContext.fillRect(moonX + moonPixel[0], moonY + moonPixel[1], 1, 1);
  }
}

// Fog: clear near the heli, DITHER further out, DARK far away; fires punch holes through it.
function drawFog(offsetX, offsetY) {
  const heli = game.heli, level = game.L, fogConfig = CONFIG.fog;
  const heliX = heli.x + 16 - offsetX, heliY = heli.y + 8 + offsetY;
  const clear = [heliX, heliY, fogConfig.clear], lights = [];
  for (const fire of level.fires) lights.push(fire.x + fire.w / 2 - offsetX, fire.y - fire.h / 2 + offsetY, fogConfig.fire + fire.w / 2);
  const circleSpan = (circle, column) => { const deltaX = column + 0.5 - circle[0]; if (deltaX <= -circle[2] || deltaX >= circle[2]) return null; const halfChord = Math.sqrt(circle[2] * circle[2] - deltaX * deltaX); return [circle[1] - halfChord, circle[1] + halfChord]; };
  for (let column = 0; column < SCREEN_WIDTH; column++) {
    const litSpans = [];
    const clearSpan = circleSpan(clear, column); if (clearSpan) litSpans.push(clearSpan);
    for (let i = 0; i < lights.length; i += 3) { const lightSpan = circleSpan([lights[i], lights[i + 1], lights[i + 2]], column); if (lightSpan) litSpans.push(lightSpan); }
    const thin = circleSpan([heliX, heliY, fogConfig.thin], column);
    let y = 0;
    litSpans.sort((first, second) => first[0] - second[0]);
    const fill = (fromY, toY) => {
      if (toY <= fromY) return;
      if (!thin) { canvasContext.fillStyle = DARK; canvasContext.fillRect(column, fromY, 1, toY - fromY); return; }
      const thinTop = Math.max(0, Math.floor(thin[0])), thinBottom = Math.min(SCREEN_HEIGHT, Math.ceil(thin[1]));
      const segment = (segTop, segBottom, pattern) => { segTop = Math.max(segTop, fromY); segBottom = Math.min(segBottom, toY); if (segBottom > segTop) { canvasContext.fillStyle = pattern; canvasContext.fillRect(column, segTop, 1, segBottom - segTop); } };
      segment(0, thinTop, DARK); segment(thinTop, thinBottom, DITHER); segment(thinBottom, SCREEN_HEIGHT, DARK);
    };
    for (const litSpan of litSpans) {
      const litTop = Math.max(0, Math.floor(litSpan[0])), litBottom = Math.min(SCREEN_HEIGHT, Math.ceil(litSpan[1]));
      fill(y, litTop);
      if (litBottom > y) y = litBottom;
    }
    fill(y, SCREEN_HEIGHT);
  }
  canvasContext.fillStyle = '#fff';
  const time = game.time;
  for (let i = 0; i < 9; i++) {
    const bankY = 22 + i * 19 + round(Math.sin(time * 0.4 + i) * 3);
    const bankX = ((i * 131 + time * (8 + (i % 3) * 5) + game.wind * time * 4) % (SCREEN_WIDTH + 80) + SCREEN_WIDTH + 80) % (SCREEN_WIDTH + 80) - 40;
    if (Math.hypot(bankX + 15 - heliX, bankY - heliY) < fogConfig.clear) continue;
    for (let dash = 0; dash < 30; dash += 3) canvasContext.fillRect(round(bankX + dash), bankY + ((dash / 3) & 1), 1, 1);
  }
}

function drawBeacons() {
  const frame = game.frame;
  drawSafeMarker();
  for (const person of game.L.people) {
    if (person.state !== 'stand' && person.state !== 'float') continue;
    const x = round(person.x) + 3, y = round(person.y) - 2;
    if (((frame + person.ph * 7) % 50) < 14) { canvasContext.fillRect(x, y - 1, 1, 1); canvasContext.fillRect(x - 1, y - 2, 3, 1); canvasContext.fillRect(x, y - 3, 1, 1); }
    if (person.tmax > 0) {
      const timeRatio = person.timer / person.tmax;
      if (!(timeRatio < 0.25 && (frame >> 3) & 1)) canvasContext.fillRect(round(person.x), round(person.y) - 3, Math.max(1, Math.ceil(7 * timeRatio)), 1);
    }
  }
}

function bar(x, y, width, fraction) {
  outlineRect(x, y, width, 7);
  canvasContext.fillRect(x + 1, y + 1, round((width - 2) * clamp(fraction, 0, 1)), 5);
}

function drawHUD() {
  const level = game.L, heli = game.heli, frame = game.frame;
  blackRect(0, 0, SCREEN_WIDTH, 11); blackRect(0, SCREEN_HEIGHT - 11, SCREEN_WIDTH, 11);
  for (let x = 0; x < SCREEN_WIDTH; x += 2) { canvasContext.fillRect(x, 10, 1, 1); canvasContext.fillRect(x, SCREEN_HEIGHT - 11, 1, 1); }

  const label = level.tutorial ? 'ADDESTRAMENTO' : level.spec.daily ? 'SFIDA ' + level.spec.daily.slice(5).split('-').reverse().join('/') + ' ' + level.sc.name : 'LV' + level.n + ' ' + level.sc.name;
  text(label, 3, 3);
  if (level.wind) {
    const arrowCount = clamp(round(Math.abs(game.wind) * 2), 1, 4);
    text('VENTO ' + (game.wind >= 0 ? '>' : '<').repeat(arrowCount), 3 + Gfx.textWidth(label) + 10, 3);
  }
  text('SALVATI ' + level.saved + '/' + level.total + '  PERSI ' + level.dead + '  PUNTI ' + game.score, SCREEN_WIDTH - 3, 3, 1, 'r');

  const flying = heli.state === 'fly', speed = flying ? Math.hypot(heli.vx, heli.vy) : 0, y = SCREEN_HEIGHT - 9;
  text('VEL', 3, SCREEN_HEIGHT - 8);
  bar(17, y, 52, speed / CONFIG.phys.maxV);
  const hookX = 18 + round(50 * CONFIG.speed.hook / CONFIG.phys.maxV);
  canvasContext.fillRect(hookX, SCREEN_HEIGHT - 11, 1, 2); canvasContext.fillRect(hookX, SCREEN_HEIGHT - 2, 1, 2);
  if (flying && loadCount()) {
    const loadLimitX = 18 + round(50 * maxSpeed() / CONFIG.phys.maxV);
    canvasContext.fillRect(loadLimitX, SCREEN_HEIGHT - 11, 1, 2); canvasContext.fillRect(loadLimitX, SCREEN_HEIGHT - 2, 1, 2);
  }
  if (flying && (game.state === 'play' || game.state === 'replay')) {
    if (speed <= CONFIG.speed.hook) text('AGGANCIO OK', 73, SCREEN_HEIGHT - 8);
    else if (speed > CONFIG.speed.crushLadder && (frame >> 3) & 1) text('TROPPO VELOCE', 73, SCREEN_HEIGHT - 8);
  }
  const fuelFrac = heli.fuel / CONFIG.fuel.max, lowFuel = heli.fuel <= CONFIG.fuel.low;
  if (!lowFuel || (frame >> 3) & 1) text('CARB', 130, SCREEN_HEIGHT - 8);
  bar(148, y, 40, fuelFrac);
  text('SCAFO', 194, SCREEN_HEIGHT - 8);
  for (let i = 0; i < CONFIG.hull.max; i++) {
    if (i < heli.hp) canvasContext.fillRect(216 + i * 5, SCREEN_HEIGHT - 8, 3, 5); else outlineRect(216 + i * 5, SCREEN_HEIGHT - 8, 3, 5);
  }
  if (heli.stab && flying) { canvasContext.fillRect(236, SCREEN_HEIGHT - 10, 19, 9); canvasContext.fillStyle = '#000'; text('STAB', 238, SCREEN_HEIGHT - 8); canvasContext.fillStyle = '#fff'; }
  const winchConfig = CONFIG.winch;
  if (flying && heli.bucket.on) { text('ACQUA', 260, SCREEN_HEIGHT - 8); bar(281, y, 26, heli.bucket.fill); }
  else if (flying && heli.winch > winchConfig.min) { text('SCALA', 260, SCREEN_HEIGHT - 8); bar(281, y, 26, (heli.winch - winchConfig.min) / (winchConfig.max - winchConfig.min)); }
  for (let i = 0; i < heli.buoys; i++) drawCircle(314 + i * 6, SCREEN_HEIGHT - 6, 2);
  text('A BORDO ' + loadCount() + '/' + CONFIG.load.max, SCREEN_WIDTH - 3, SCREEN_HEIGHT - 8, 1, 'r');

  if (game.msgT > 0 && !(game.msgT < 30 && (frame >> 2) & 1)) textBox(game.msg, SCREEN_WIDTH / 2, 14, 'c');
  if (flying && heli.wf > 0 && (frame >> 3) & 1) textBox('IN ACQUA! RISALI!', SCREEN_WIDTH / 2, 23, 'c');
  if (flying && !heli.ground && !heli.engineOff) {
    const heliBottom = heli.y + 16;
    let below = null;
    for (const solid of level.solids) if (solid.x < heli.x + 30 && solid.x + solid.w > heli.x + 2 && solid.y >= heliBottom - 2 && solid.y - heliBottom < 28 && (!below || solid.y < below.y)) below = solid;
    if (below) {
      const safeToLand = heli.vy <= CONFIG.speed.land && Math.abs(heli.vx) <= CONFIG.speed.landH;
      if (safeToLand || (frame >> 2) & 1) textBox(safeToLand ? 'ATTERRAGGIO OK' : 'TROPPO VELOCE PER ATTERRARE', SCREEN_WIDTH / 2, SCREEN_HEIGHT - 22, 'c');
    }
  }
  if (flying && heli.engineOff && (frame >> 3) & 1) textBox('MOTORE SPENTO: CERCA UN APPOGGIO', SCREEN_WIDTH / 2, 23, 'c');

  let left = 0, right = 0;
  const cameraX = game.camX;
  for (const person of level.people) {
    if (person.state !== 'stand' && person.state !== 'float' && person.state !== 'fall') continue;
    if (person.x + 7 < cameraX) left++; else if (person.x > cameraX + SCREEN_WIDTH) right++;
  }
  if (left) textBox('<' + left, 2, SCREEN_HEIGHT / 2 - 3);
  if (right) textBox(right + '>', SCREEN_WIDTH - 2, SCREEN_HEIGHT / 2 - 3, 'r');
  const needSafe = loadCount() || heli.fuel <= CONFIG.fuel.low || heli.hp < CONFIG.hull.max;
  if (needSafe) {
    const safeX = level.safe.x + level.safe.w / 2;
    if (safeX < cameraX) textBox('<SICURO', 2, SCREEN_HEIGHT / 2 + 7);
    else if (safeX > cameraX + SCREEN_WIDTH) textBox('SICURO>', SCREEN_WIDTH - 2, SCREEN_HEIGHT / 2 + 7, 'r');
  }
  if (level.tutorial && game.tut && game.state !== 'done') {
    const step = TUTORIAL[game.tut.step];
    if (step) textBox(tutorialText(step), SCREEN_WIDTH / 2, 26, 'c');
    if (game.state === 'play') text(hint('N: SALTA', 'SALTA: ESCI', 'Y: SALTA'), 3, 14);
  }
  if (game.state === 'replay' && (frame >> 4) & 1) textBox('REPLAY  -  ' + hint('INVIO', 'TOCCA', 'A') + ' PER SALTARE', SCREEN_WIDTH / 2, 32, 'c');
}

function drawStars(starCount, y) {
  for (let i = 0; i < 3; i++) drawSpriteScaled(i < starCount ? SPRITES.starOn : SPRITES.starOff, SCREEN_WIDTH / 2 - 31 + i * 22, y, 2);
}

function drawOverlay() {
  const level = game.L, blink = (game.frame >> 5) & 1, state = game.state;
  if (state === 'title') {
    drawPanel(34, 16, SCREEN_WIDTH - 68, SCREEN_HEIGHT - 32);
    text('LAST RUNG', SCREEN_WIDTH / 2, 26, 3, 'c');
    text("SALVA CHI E' IN DIFFICOLTA'", SCREEN_WIDTH / 2, 46, 1, 'c');
    const controls = hint(
      ['FRECCE / WASD : SPINTA E DIREZIONE', 'X : STABILIZZATORE (ACCESO/SPENTO)', 'Q / E : SCALETTA   Z : SALVAGENTE   C : SECCHIO', 'SPAZIO : SGANCIA LA SCALETTA', 'P PAUSA  R RICOMINCIA  M AUDIO  V REPLAY'],
      ['LEVETTA A SINISTRA : SPINTA E DIREZIONE', 'STAB : STABILIZZATORE (ACCESO/SPENTO)', '▲ / ▼ : SCALETTA   SALVAGENTE   SECCHIO', 'SGANCIA : LIBERA LA SCALETTA', 'II : PAUSA     AUDIO : SUONO SI/NO'],
      ['LEVETTA / CROCE : DIREZIONE   RT : SPINTA', 'X O RB : STABILIZZATORE', 'LEVETTA DESTRA : SCALETTA   A : SALVAGENTE   Y : SECCHIO', 'B : SGANCIA LA SCALETTA', 'START PAUSA  BACK RICOMINCIA  Y REPLAY']);
    const rules = [
      "AGGANCIO SOTTO IL 20% DI VELOCITA'",
      'ATTERRA SUI TETTI: I SUPERSTITI SALGONO',
      'FERITI (+): ATTERRA O CALA IL VERRICELLO SUL TETTO',
      "MAX 8 A BORDO. PIU' CARICO = PIU' LENTO",
      'ZONA SICURA: SALVI, CARBURANTE, RIPARAZIONI',
      "SE IL ROTORE TOCCA L'ACQUA SEI FINITO",
    ];
    controls.concat([''], rules).forEach((line, i) => text(line, SCREEN_WIDTH / 2, 56 + i * 9, 1, 'c'));
    text('LAMPI DEI FULMINI: ' + (game.softFlash ? 'RIDOTTI' : 'PIENI') + hint('   (L PER CAMBIARE)', '   (TASTO LAMPI)', ''), SCREEN_WIDTH / 2, SCREEN_HEIGHT - 42, 1, 'c');
    if (blink) text(hint('INVIO: GIOCA     G: SFIDA DEL GIORNO', 'TOCCA PER GIOCARE', 'A: GIOCA     Y: SFIDA DEL GIORNO'), SCREEN_WIDTH / 2, SCREEN_HEIGHT - 30, 1, 'c');
  } else if (state === 'intro') {
    const notes = [];
    if (level.night) notes.push(level.moonFull ? 'NOTTE DI LUNA PIENA: IL FARO ILLUMINA DOVE VAI' : 'NOTTE: IL FARO ILLUMINA DOVE VAI');
    if (level.fog) notes.push('NEBBIA: SI VEDE SOLO DA VICINO');
    if (level.people.some(person => person.injured)) notes.push("C'E' UN FERITO (+): ATTERRA O CALA IL VERRICELLO");
    if (level.people.some(person => person.kind === 'dog')) notes.push("C'E' ANCHE UN CANE: BONUS +" + CONFIG.score.dog);
    if (level.sc.id === 'fire' && !level.tutorial) notes.push(hint('C', 'SECCHIO', 'Y') + ': SECCHIO PER SPEGNERE LE FIAMME');
    const promptY = 112 + notes.length * 9 + 6;
    drawPanel(48, 46, SCREEN_WIDTH - 96, promptY - 46 + 16);
    text(level.tutorial ? 'IMPARA A PILOTARE' : level.spec.daily ? 'SFIDA DEL GIORNO ' + level.spec.daily : 'LIVELLO ' + level.n, SCREEN_WIDTH / 2, 56, 1, 'c');
    text(level.sc.name, SCREEN_WIDTH / 2, 68, 2, 'c');
    text(level.tutorial ? hint("N: SALTA L'ADDESTRAMENTO", "SALTA: ESCI DALL'ADDESTRAMENTO", "Y: SALTA L'ADDESTRAMENTO") : level.sc.hint, SCREEN_WIDTH / 2, 88, 1, 'c');
    text('DA SALVARE: ' + level.total + "  (SERVE PIU' DELLA META')", SCREEN_WIDTH / 2, 99, 1, 'c');
    notes.forEach((line, i) => text(line, SCREEN_WIDTH / 2, 112 + i * 9, 1, 'c'));
    if (blink) text(hint('INVIO PER INIZIARE', 'TOCCA PER INIZIARE', 'A PER INIZIARE'), SCREEN_WIDTH / 2, promptY, 1, 'c');
  } else if (state === 'pause') {
    drawPanel(SCREEN_WIDTH / 2 - 60, SCREEN_HEIGHT / 2 - 18, 120, 36);
    text('PAUSA', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 - 10, 2, 'c');
    text(hint('P PER RIPRENDERE', 'TOCCA PER RIPRENDERE', 'START PER RIPRENDERE'), SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 6, 1, 'c');
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
    drawStars(game.stars, 66);
    text('SALVATI: ' + level.saved + '/' + level.total + '   PERSI: ' + level.dead + (level.killedByPlayer ? ' (' + level.killedByPlayer + ' PER COLPA TUA)' : ''), SCREEN_WIDTH / 2, 92, 1, 'c');
    if (win && game.bonus) text('BONUS STELLE: +' + game.bonus, SCREEN_WIDTH / 2, 103, 1, 'c');
    if (!win) text("SERVE SALVARE PIU' DELLA META' DELLE PERSONE", SCREEN_WIDTH / 2, 103, 1, 'c');
    text('PUNTI: ' + game.score, SCREEN_WIDTH / 2, 114, 1, 'c');
    text("1 STELLA: PIU' DELLA META'  2: 75%  3: NESSUN MORTO", SCREEN_WIDTH / 2, 128, 1, 'c');
    const next = !win ? 'RIPROVA' : level.spec.daily ? 'MENU' : 'PROSSIMO LIVELLO';
    if (blink) text(hint('INVIO: ' + next + '   V: REPLAY', 'TOCCA: ' + next, 'A: ' + next + '   Y: REPLAY'), SCREEN_WIDTH / 2, 148, 1, 'c');
  }
  if (Input.device === 'touch' && window.innerHeight > window.innerWidth && (game.frame >> 5) & 1) {
    textBox('RUOTA IL TELEFONO IN ORIZZONTALE', SCREEN_WIDTH / 2, SCREEN_HEIGHT / 2 + 30, 'c');
  }
}

function render() {
  redPixels.length = 0;
  canvasContext.setTransform(1, 0, 0, 1, 0, 0);
  canvasContext.globalCompositeOperation = 'source-over';
  canvasContext.fillStyle = '#000'; canvasContext.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT); canvasContext.fillStyle = '#fff';
  drawBackground();
  const shake = game.shake;
  const shakeX = shake ? round((Math.random() * 2 - 1) * shake) : 0, shakeY = shake ? round((Math.random() * 2 - 1) * shake) : 0;
  const cameraX = round(game.camX);
  canvasContext.setTransform(1, 0, 0, 1, -cameraX + shakeX, shakeY);
  drawWorld(cameraX);
  drawRed();
  canvasContext.setTransform(1, 0, 0, 1, 0, 0);
  for (const drop of game.rain) drawLine(drop.x, drop.y, drop.x - game.wind * 1.5 - 0.5, drop.y - 3);
  const fullFlash = game.flashT > 0 && !game.softFlash;
  if (game.L.night && !fullFlash) {
    drawNight(cameraX - shakeX, shakeY);
    drawNightSky(cameraX);
    canvasContext.setTransform(1, 0, 0, 1, -cameraX + shakeX, shakeY);
    drawBeacons();
    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
  } else if (game.L.fog) {
    drawFog(cameraX - shakeX, shakeY);
    canvasContext.setTransform(1, 0, 0, 1, -cameraX + shakeX, shakeY);
    drawSafeMarker();
    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (fullFlash) {
    canvasContext.globalCompositeOperation = 'difference';
    canvasContext.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);
    canvasContext.globalCompositeOperation = 'source-over';
    canvasContext.setTransform(1, 0, 0, 1, -cameraX + shakeX, shakeY);
    drawRed();
    canvasContext.setTransform(1, 0, 0, 1, 0, 0);
  }
  if (game.state !== 'title') drawHUD();
  drawOverlay();
}
