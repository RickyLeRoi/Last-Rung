'use strict';
const NO_INPUT = Object.freeze({ hx: 0, up: 0, down: 0, winch: 0, stab: false, drop: false, buoy: false, bucket: false });

function loadCount() { const heli = game.heli; return heli.att.length + heli.cab.length; }
const personWeight = person => (person.kind && CONFIG.kinds[person.kind] ? CONFIG.kinds[person.kind].weight : 1);
function loadWeight() {
  const heli = game.heli;
  let totalWeight = 0;
  for (const person of heli.att) totalWeight += personWeight(person);
  for (const person of heli.cab) totalWeight += personWeight(person);
  if (heli.bucket && heli.bucket.on) totalWeight += heli.bucket.fill * CONFIG.bucket.weight;
  if (heli.crew && heli.crew.carry) totalWeight += personWeight(heli.crew.carry);
  return totalWeight;
}

function maxSpeed() {
  const loadConfig = CONFIG.load;
  return CONFIG.phys.maxV * (1 - (1 - loadConfig.minSpeedFactor) * Math.min(loadConfig.max, loadWeight()) / loadConfig.max);
}

// Returns an array that is also indexed by name (rotor, tail, cabin, boom, skid, ladder).
// The 'ladder' box is only the stowed part under the skid; the winched one is in ladderRects() (chain.js).
function heliRects(heli, face) {
  const swing = round(heli.lad || 0);
  const rects = HITBOX.map(hitbox => ({ k: hitbox.k, x: heli.x + (face > 0 ? hitbox.x : 32 - hitbox.x - hitbox.w) + (hitbox.k === 'ladder' ? swing : 0), y: heli.y + hitbox.y, w: hitbox.w, h: hitbox.h }));
  for (const rect of rects) rects[rect.k] = rect;
  return rects;
}

function newHeli() {
  const safeZone = game.L.safe;
  const x = safeZone.x + safeZone.w / 2 - 16, y = safeZone.y - 16;
  return {
    x, y, px: x, py: y, vx: 0, vy: 0, ax: 0, face: 1,
    state: 'fly',            // fly | sink | dead
    ground: safeZone, gOff: -16,    // surface it rests on (null = flying)
    rot: 0, spin: 1,
    att: [], cab: [],
    sinkT: 0, wf: 0, thr: false, up: 0,
    stab: false,
    fuel: CONFIG.fuel.max, engineOff: false, strandT: 0,
    hp: CONFIG.hull.max, iframes: 0, repairT: 0,
    lad: 0, ladV: 0,         // ladder swing (px offset of the bottom from the vertical)
    ladLen: CONFIG.winch.min,
    winch: CONFIG.winch.min,
    tailHint: false,
    turnT: 0,
    snag: null,              // point where the ladder is snagged { x, y, len, t }
    buoys: CONFIG.buoy.count,
    bucket: { on: false, fill: 0 },
    crew: { st: 'idle' },
    winchMoving: false, ladRest: null,
    tilt: 0,                 // nose tilt (px of height difference)
    turb: 0,
  };
}

function tryFace(direction) {
  const heli = game.heli;
  if (heli.face === direction) return;
  const rects = heliRects(heli, direction);
  for (const solid of game.L.solids) for (const rect of rects) if (overlap(rect, solid)) return;
  heli.face = direction;
}

function gameOver(reason) {
  game.state = 'over';
  game.overT = 110;
  game.overReason = reason;
  Sfx.play('fail');
}

function release(person) {
  const heli = game.heli;
  person.state = 'fall'; person.vx = heli.vx + randomRange(-0.3, 0.3); person.vy = heli.vy; person.slot = -1; person.dropped = true;
  heli.att = heli.att.filter(otherPerson => otherPerson !== person);
  heli.cab = heli.cab.filter(otherPerson => otherPerson !== person);
}

function drown() {
  const heli = game.heli;
  heli.state = 'sink'; heli.sinkT = 0;
  for (const person of heli.att.concat(heli.cab)) { release(person); person.x = heli.x + randomRange(8, 20); person.y = heli.y + 4; }
  crewLost();
  heli.snag = null;
  splash(heli.x + 16, 3);
  showMessage('ROTORE IN ACQUA: MOTORE SPENTO!', 200);
  Sfx.play('engineDie');
  game.shake = 4;
}

function explode(reason) {
  const heli = game.heli;
  if (heli.state === 'dead') return;
  // the sprite breaks into 4x4 blocks: each block is a physical debris chunk
  const cells = {};
  for (let i = 0; i < SPRITES.heli.p.length; i += 2) {
    let spriteX = SPRITES.heli.p[i];
    const spriteY = SPRITES.heli.p[i + 1];
    if (heli.face < 0) spriteX = 31 - spriteX;
    const cellKey = (spriteX >> 2) + ',' + (spriteY >> 2);
    (cells[cellKey] = cells[cellKey] || []).push(spriteX & 3, spriteY & 3);
  }
  for (const cellKey in cells) {
    const [cellX, cellY] = cellKey.split(',').map(Number), chunkOffsetX = cellX * 4, chunkOffsetY = cellY * 4;
    addParticle({
      t: 'chunk', x: heli.x + chunkOffsetX, y: heli.y + chunkOffsetY, w: 4, h: 4, pts: cells[cellKey],
      vx: heli.vx * 0.6 + (chunkOffsetX + 2 - 16) * 0.08 + randomRange(-0.7, 0.7),
      vy: heli.vy * 0.5 + (chunkOffsetY + 2 - 8) * 0.1 - randomRange(0.8, 2.6),
      life: Math.floor(randomRange(480, 700)), lethal: true, fire: chance(0.35),
    });
  }
  addParticle({ t: 'chunk', x: heli.x + 14 + round(heli.lad), y: heli.y + 12, w: 4, h: 4, pts: [0, 0, 3, 0, 0, 1, 1, 1, 2, 1, 3, 1, 0, 2, 3, 2, 0, 3, 1, 3, 2, 3, 3, 3],
    vx: heli.vx * 0.6 + randomRange(-0.5, 0.5), vy: heli.vy * 0.5 - randomRange(0.5, 1.5), life: 600, lethal: true });
  for (let bladeIndex = 0; bladeIndex < 4; bladeIndex++) {
    const points = [];
    for (let i = 0; i < 7; i++) points.push(i, 0);
    addParticle({ t: 'chunk', x: heli.x + 2 + bladeIndex * 7, y: heli.y, w: 7, h: 1, pts: points, vx: (bladeIndex < 2 ? -1 : 1) * randomRange(1.6, 3.2), vy: -randomRange(0.6, 2.2), life: 560, lethal: true });
  }
  for (let i = 0; i < 46; i++) {
    const angle = randomRange(0, Math.PI * 2), speed = randomRange(0.5, 3);
    addParticle({ t: 'px', x: heli.x + 16, y: heli.y + 8, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.5, g: 0.05, life: Math.floor(randomRange(15, 45)) });
  }
  for (let i = 0; i < 10; i++) addParticle({ t: 'smoke', x: heli.x + 16 + randomRange(-8, 8), y: heli.y + 8 + randomRange(-4, 4), r: randomRange(1, 4), life: Math.floor(randomRange(50, 100)) });
  addParticle({ t: 'ring', x: heli.x + 16, y: heli.y + 8, r: 2, life: 14 });
  for (const person of heli.att.slice()) release(person);
  crewLost();
  heli.snag = null;
  for (const person of heli.cab.slice()) {
    person.x = heli.x + 13; person.y = heli.y + 4; person.vx = heli.vx; person.vy = heli.vy - 1;
    killPerson(person, "A BORDO DELL'ELICOTTERO", true);
  }
  heli.state = 'dead';
  game.shake = 16;
  if (heli.wf > 0) splash(heli.x + 16, 4);
  Sfx.play('explode');
  gameOver(reason);
}

function damageHeli(reason) {
  const heli = game.heli;
  if (heli.iframes > 0) return false;
  heli.hp--;
  heli.iframes = CONFIG.hull.invuln;
  game.shake = Math.max(game.shake, 6);
  for (let i = 0; i < 14; i++) addParticle({ t: 'px', x: heli.x + 16 + randomRange(-8, 8), y: heli.y + 8, vx: randomRange(-1.5, 1.5), vy: -randomRange(0.3, 1.8), g: 0.08, life: 25 });
  if (heli.hp <= 0) { explode('SCAFO DISTRUTTO: ' + reason); return true; }
  Sfx.play('damage');
  showMessage("DANNO ALLO SCAFO! INTEGRITA' " + heli.hp + '/' + CONFIG.hull.max, 120);
  return false;
}

function land(surface, penetration) {
  const heli = game.heli;
  heli.y -= penetration; heli.vx = 0; heli.vy = 0;
  heli.ground = surface; heli.gOff = heli.y - surface.y;
  Sfx.play('land');
  const waiting = game.L.people.some(person => person.state === 'stand' && (person.on === surface || person.on.adj.includes(surface)));
  showMessage(surface.safe ? 'ATTERRATO IN ZONA SICURA' : waiting ? 'ATTERRATO: I SUPERSTITI CORRONO A BORDO' : 'ATTERRATO', 80);
}

function collideHeli() {
  const heli = game.heli, level = game.L, speedLimits = CONFIG.speed;
  const rects = heliRects(heli, heli.face);
  const speed = Math.hypot(heli.vx, heli.vy);
  const bounce = restitution => { heli.x = heli.px; heli.y = heli.py; heli.vx *= -restitution; heli.vy *= -restitution; };

  for (const solid of level.solids) {
    if (solid === heli.ground) continue;
    if (solid.x > heli.x + 33 || solid.x + solid.w < heli.x - 1 || solid.y > heli.y + 17 || solid.y + solid.h < heli.y - 1) continue;
    // 'from above': every touching part was above the surface one frame ago (no side hits)
    let rotor = false, body = false, above = true, penetration = 0, onlyLadder = true;
    const deltaY = heli.y - heli.py;
    for (const rect of rects) {
      if (!overlap(rect, solid)) continue;
      if (rect.k === 'rotor') { rotor = true; break; }
      body = true;
      if (rect.k !== 'ladder') onlyLadder = false;
      const bottom = rect.y + rect.h;
      if (bottom - deltaY > solid.y + 1.5) above = false;
      penetration = Math.max(penetration, bottom - solid.y);
    }
    if (rotor) {
      if (speed <= speedLimits.land) { bounce(0.4); if (damageHeli('LE PALE HANNO URTATO UN OSTACOLO')) return; continue; }
      explode('LE PALE HANNO URTATO UN OSTACOLO');
      return;
    }
    if (!body) continue;
    if (onlyLadder && !above) { heli.ladV = -heli.ladV * 0.5 - Math.sign(heli.lad) * 0.3; continue; }

    if (above && penetration <= 8) {
      const soft = heli.vy <= speedLimits.land && Math.abs(heli.vx) <= speedLimits.landH;
      if (soft && heli.thr) { heli.y -= penetration; if (heli.vy > 0) heli.vy = 0; continue; }   // taking off: the deck pushes the heli up
      if (soft) { land(solid, penetration); continue; }
      if (heli.vy <= speedLimits.hardLand && Math.abs(heli.vx) <= speedLimits.hard) {
        heli.y -= penetration; heli.vy = -Math.abs(heli.vy) * 0.35; heli.vx *= 0.5;
        if (damageHeli('ATTERRAGGIO TROPPO DURO')) return;
        continue;
      }
      explode("SCHIANTO: DISCESA TROPPO VELOCE");
      return;
    }
    if (speed <= speedLimits.land) { bounce(0.35); Sfx.play('contact'); showMessage('ATTENZIONE: CONTATTO!', 50); continue; }
    if (speed <= speedLimits.hard) { bounce(0.45); if (damageHeli('URTO CONTRO UN OSTACOLO')) return; continue; }
    explode('SCHIANTO CONTRO UN OSTACOLO');
    return;
  }

  for (const hazard of level.haz) {
    if (hazard.x1 < heli.x - 1 || hazard.x0 > heli.x + 33 || hazard.y1 < heli.y - 1 || hazard.y0 > heli.y + 17) continue;
    for (let i = 0; i < hazard.pts.length; i += 2) {
      const pointX = hazard.pts[i] + 0.5, pointY = hazard.pts[i + 1] + 0.5;
      for (const rect of rects) {
        if (pointX >= rect.x && pointX < rect.x + rect.w && pointY >= rect.y && pointY < rect.y + rect.h) {
          explode(hazard.cable ? 'IMPIGLIATO NEI CAVI ELETTRICI' : 'URTATO UN TRALICCIO');
          return;
        }
      }
    }
  }
  for (const fire of level.fires) {
    const fireArea = fireRect(fire);
    for (const rect of rects) if (overlap(rect, fireArea)) { explode('ELICOTTERO AVVOLTO DALLE FIAMME'); return; }
  }
}

function isInSafeZone(heli, safeZone) {
  const rescueConfig = CONFIG.rescue, heliCenterX = heli.x + 16, heliBottom = heli.y + 16;
  return heli.ground === safeZone || (heliCenterX > safeZone.x - rescueConfig.safeNearX && heliCenterX < safeZone.x + safeZone.w + rescueConfig.safeNearX && heliBottom >= safeZone.y - rescueConfig.safeNearAbove && heliBottom <= safeZone.y + rescueConfig.safeNearBelow);
}

function unloadAtSafe() {
  const heli = game.heli, safeZone = game.L.safe, rescueConfig = CONFIG.rescue;
  if (heli.state !== 'fly') return;
  if (!loadCount()) { if (isInSafeZone(heli, safeZone)) heli.buoys = CONFIG.buoy.count; return; }
  const heliCenterX = heli.x + 16, heliBottom = heli.y + 16, speed = Math.hypot(heli.vx, heli.vy);
  if (isInSafeZone(heli, safeZone)) heli.buoys = CONFIG.buoy.count;
  const near = heli.ground === safeZone ||
    (heliCenterX > safeZone.x - rescueConfig.safeNearX && heliCenterX < safeZone.x + safeZone.w + rescueConfig.safeNearX && heliBottom >= safeZone.y - rescueConfig.safeNearAbove && heliBottom <= safeZone.y + rescueConfig.safeNearBelow && speed <= CONFIG.speed.crushBody);
  if (!near) return;
  const carriedPeople = heli.att.concat(heli.cab);
  heli.att = []; heli.cab = [];
  const before = game.score;
  carriedPeople.forEach((person, i) => {
    person.slot = -1;
    markSaved(person, safeZone, clamp(round(heliCenterX - safeZone.x - 3.5 + ((i & 1) ? 1 : -1) * (7 + (i >> 1) * 4)), 1, safeZone.w - 8));
    for (let particleIndex = 0; particleIndex < 6; particleIndex++) addParticle({ t: 'px', x: safeZone.x + person.rel + 3, y: safeZone.y - 8, vx: randomRange(-1, 1), vy: -randomRange(0.5, 1.8), g: 0.06, life: 30 });
  });
  Sfx.play('save');
  const people = carriedPeople.filter(person => person.kind !== 'dog').length, dogs = carriedPeople.length - people;
  showMessage((people > 1 ? people + ' PERSONE IN SALVO' : people ? 'PERSONA IN SALVO' : '') + (dogs ? (people ? ' E IL CANE' : 'CANE IN SALVO') : '') + '! +' + (game.score - before));
}

function burnFuel(input) {
  const heli = game.heli, fuelConfig = CONFIG.fuel;
  if (heli.engineOff || game.L.tutorial) return;
  const burn = heli.ground
    ? (heli.ground.safe ? 0 : fuelConfig.idle)
    : fuelConfig.base + input.up * fuelConfig.thrust + (heli.stab ? fuelConfig.stab : 0) + loadWeight() * fuelConfig.perPerson;
  const before = heli.fuel;
  heli.fuel = Math.max(0, heli.fuel - burn);
  if (before > fuelConfig.low && heli.fuel <= fuelConfig.low) showMessage('CARBURANTE IN RISERVA! TORNA ALLA ZONA SICURA', 160);
  if (heli.fuel <= fuelConfig.low && heli.fuel > 0 && game.frame % 60 === 0) Sfx.play('lowFuel');
  if (heli.fuel <= 0) {
    heli.engineOff = true; heli.stab = false;
    showMessage('CARBURANTE ESAURITO! MOTORE SPENTO', 200);
    Sfx.play('engineDie');
  }
}

function groundService() {
  const heli = game.heli, fuelConfig = CONFIG.fuel, hullConfig = CONFIG.hull;
  if (!heli.ground.safe) {
    if (heli.engineOff && ++heli.strandT > fuelConfig.stranded) gameOver('CARBURANTE ESAURITO');
    return;
  }
  heli.strandT = 0;
  if (heli.fuel < fuelConfig.max) {
    const fuelBefore = heli.fuel;
    heli.fuel = Math.min(fuelConfig.max, heli.fuel + fuelConfig.refuel);
    if (fuelBefore < 1 || game.frame % 40 === 0) Sfx.play('refuel');
    if (heli.fuel === fuelConfig.max) showMessage('PIENO FATTO', 60); else if (game.msgT < 5) showMessage('RIFORNIMENTO...', 20);
  }
  if (heli.hp < hullConfig.max && ++heli.repairT >= hullConfig.repair) {
    heli.repairT = 0; heli.hp++;
    showMessage("SCAFO RIPARATO: " + heli.hp + '/' + hullConfig.max, 80);
  }
  if (heli.engineOff && heli.fuel >= fuelConfig.restart) { heli.engineOff = false; showMessage('MOTORE RIAVVIATO', 80); }
}

function updateWinch(input) {
  const heli = game.heli, winchConfig = CONFIG.winch, level = game.L;
  const previousLength = heli.ladLen;
  if (!heli.bucket.on) heli.winch = clamp(heli.winch + (input.winch || 0) * winchConfig.speed, winchConfig.min, winchConfig.max);
  let wantedLength = heli.ground ? winchConfig.min : heli.bucket.on ? CONFIG.bucket.rope : heli.winch;
  const ladderTopY = heli.y + 12, ladderX = heli.x + 14 + round(heli.lad);
  heli.ladRest = null;
  for (const solid of level.solids) {
    if (solid.x < ladderX + 4 && solid.x + solid.w > ladderX && solid.y >= ladderTopY - 0.5 && solid.y < ladderTopY + wantedLength) { wantedLength = Math.max(winchConfig.min, solid.y - ladderTopY); heli.ladRest = solid; }
  }
  heli.ladLen = wantedLength < heli.ladLen ? wantedLength : Math.min(wantedLength, heli.ladLen + winchConfig.speed);
  heli.winchMoving = Math.abs(heli.ladLen - previousLength) > 0.05 && !heli.ground;
  if (heli.ladRest && heli.ladLen > winchConfig.min + 2 && heli.ladRest.y - ladderTopY > heli.ladLen + 0.5) heli.ladRest = null;
  detectSnag();
  if (heli.ladLen > winchConfig.min + 0.5) {
    const hook = ladderRects(heli).hook;
    for (const solid of level.solids) {
      if (solid.y < ladderTopY && overlap(hook, solid)) { heli.ladV = -heli.ladV * 0.5 - Math.sign(heli.lad || 1) * 0.3; heli.lad -= Math.sign(heli.lad || 1); break; }
    }
  }
}

function detectSnag() {
  const heli = game.heli;
  if (heli.snag || heli.ground || heli.ladLen < CONFIG.winch.min + 3) return;
  const ropeRect = ladderRects(heli).rope, scanTop = ropeRect.y + 5, scanBottom = ropeRect.y + ropeRect.h;
  for (const hazard of game.L.haz) {
    if (hazard.x1 < ropeRect.x || hazard.x0 >= ropeRect.x + ropeRect.w || hazard.y1 < scanTop || hazard.y0 >= scanBottom) continue;
    for (let i = 0; i < hazard.pts.length; i += 2) {
      const pointX = hazard.pts[i], pointY = hazard.pts[i + 1];
      if (pointX >= ropeRect.x && pointX < ropeRect.x + ropeRect.w && pointY >= scanTop && pointY < scanBottom) {
        heli.snag = { x: pointX + 0.5, y: pointY + 0.5, len: pointY + 0.5 - (heli.y + 12), t: 0 };
        Sfx.play('snag');
        showMessage('SCALETTA IMPIGLIATA! RIAVVOLGILA O TORNA INDIETRO', 160);
        return;
      }
    }
  }
}

// The heli is tethered to the snag point (cannot go farther than the rope). Pulling hard for a while makes
// hanging people lose their grip; with nobody hanging, a jerk frees the ladder. Reeling in above the point also frees it.
function applySnag() {
  const heli = game.heli, snag = heli.snag, snagConfig = CONFIG.snag;
  if (!snag) return;
  if (heli.ground || heli.ladLen < snag.len - 1) { heli.snag = null; showMessage('SCALETTA LIBERATA', 60); return; }
  const deltaX = heli.x + 16 - snag.x, deltaY = heli.y + 12 - snag.y, distance = Math.hypot(deltaX, deltaY), maxDistance = snag.len + 1;
  heli.lad = clamp(snag.x - (heli.x + 16), -12, 12) * (heli.ladLen / Math.max(1, snag.len));
  heli.ladV = 0;
  if (distance <= maxDistance) { snag.t = Math.max(0, snag.t - 1); return; }
  const normalX = deltaX / distance, normalY = deltaY / distance;
  heli.x -= normalX * (distance - maxDistance); heli.y -= normalY * (distance - maxDistance);
  const outwardSpeed = heli.vx * normalX + heli.vy * normalY;
  if (outwardSpeed > 0) { heli.vx -= outwardSpeed * normalX; heli.vy -= outwardSpeed * normalY; }
  if (outwardSpeed > snagConfig.pull) snag.t++; else snag.t = Math.max(0, snag.t - 1);
  if (snag.t < snagConfig.tear) return;
  snag.t = 0;
  game.shake = Math.max(game.shake, 4);
  if (heli.att.length) { loseGrip(0, 'STRAPPO! CHI ERA APPESO HA PERSO LA PRESA'); return; }
  heli.snag = null;
  Sfx.play('snag');
  showMessage('STRAPPO: SCALETTA LIBERATA', 80);
}

function updateLadderAndTilt() {
  const heli = game.heli, ladderConfig = CONFIG.ladder;
  if (heli.ground) {
    heli.lad *= 0.6; heli.ladV = 0;
    heli.tilt *= 0.8; heli.turb = 0;
    return;
  }
  const lengthRatio = heli.ladLen / CONFIG.winch.min, swingLimit = ladderConfig.swing * Math.sqrt(lengthRatio);
  heli.ladV += -ladderConfig.spring / lengthRatio * heli.lad - heli.ax * ladderConfig.accel + game.wind * ladderConfig.wind;
  heli.ladV *= Math.pow(ladderConfig.damping, 1 / Math.sqrt(lengthRatio));
  heli.lad = clamp(heli.lad + heli.ladV, -swingLimit, swingLimit);
  if (Math.abs(heli.lad) === swingLimit) heli.ladV *= -0.3;
  const target = clamp(heli.vx / CONFIG.phys.maxV * 2.4 + heli.ax * 25, -2.5, 2.5);
  heli.tilt += (target - heli.tilt) * 0.15;
}

function updateHeli(input, frozen) {
  const heli = game.heli, level = game.L, physics = CONFIG.phys;
  if (heli.state === 'dead') return;
  if (heli.state === 'sink') {
    heli.spin *= 0.97; heli.rot += 0.45 * heli.spin;
    heli.vy += 0.012; heli.vx *= 0.93; heli.vy *= 0.93;
    heli.x += heli.vx; heli.y += heli.vy;
    if (chance(0.35)) addParticle({ t: 'bub', x: heli.x + randomRange(4, 28), y: heli.y + randomRange(0, 12), life: 200 });
    if (++heli.sinkT === 130) gameOver("ROTORE SOTT'ACQUA: ELICOTTERO AFFONDATO");
    return;
  }
  if (heli.iframes > 0) heli.iframes--;
  heli.spin += ((heli.engineOff ? 0.3 : 1) - heli.spin) * 0.03;
  heli.rot += 0.45 * heli.spin;
  if (frozen && !heli.ground) return;
  if (heli.engineOff) input = NO_INPUT;

  if (input.stab) {
    heli.stab = !heli.stab;
    Sfx.play(heli.stab ? 'stabOn' : 'stabOff');
    showMessage(heli.stab ? 'STABILIZZATORE ATTIVO' : 'STABILIZZATORE SPENTO', 60);
  }
  if (input.drop && heli.att.length) { for (const person of heli.att.slice()) release(person); showMessage('SCALETTA SGANCIATA'); }
  if (input.buoy) throwBuoy();
  if (input.bucket) useBucket();

  const gravity = physics.gravity + loadWeight() * physics.loadGravity;
  const damage = CONFIG.hull.max - heli.hp;
  const horizontalAcceleration = physics.hAcc * (1 - CONFIG.hull.controlLoss * damage);
  let accelerationX = 0, accelerationY = gravity;
  heli.thr = input.up > 0;
  heli.up = input.up;
  if (heli.engineOff) {
  } else if (heli.stab) {
    // stabilizer: inputs request a velocity, the engine chases it within its physical limits
    const speedCap = CONFIG.stab.cap, gain = CONFIG.stab.k;
    const targetVelocityX = input.hx * speedCap, targetVelocityY = (input.down - input.up) * speedCap;
    accelerationX = clamp((targetVelocityX - heli.vx) * gain, -horizontalAcceleration, horizontalAcceleration);
    accelerationY = gravity + clamp((targetVelocityY - heli.vy) * gain - gravity, -physics.thrust, physics.downAcc);
  } else {
    accelerationY += -input.up * physics.thrust + input.down * physics.downAcc;
    accelerationX = input.hx * horizontalAcceleration;
  }
  // turning: braking (opposite arrow) does not turn the heli. It turns once already moving in the
  // new direction, after holding the key briefly, or immediately when grounded.
  const turnDirection = input.hx < -0.3 ? -1 : input.hx > 0.3 ? 1 : 0;
  if (turnDirection && turnDirection !== heli.face) {
    heli.turnT++;
    if (heli.ground || heli.vx * turnDirection > CONFIG.turn.moving || heli.turnT >= CONFIG.turn.hold) tryFace(turnDirection);
  } else heli.turnT = 0;

  const previousVelocityX = heli.vx;
  heli.px = heli.x; heli.py = heli.y;
  burnFuel(input);

  if (heli.ground) {
    if (accelerationY < 0) heli.ground = null;
    else { heli.vx = 0; heli.vy = 0; heli.y = heli.ground.y + heli.gOff; groundService(); }
  }
  if (!heli.ground) {
    heli.strandT = 0;
    accelerationX += game.wind * physics.windForce;
    if (damage > 0) accelerationX += randomRange(-1, 1) * CONFIG.hull.jitter * damage;
    const heliCenterX = heli.x + 16;
    let turbulence = 0;
    for (const fire of level.fires) {
      const deltaX = Math.abs(heliCenterX - (fire.x + fire.w / 2)), above = fire.y - (heli.y + 16);
      if (deltaX < fire.w / 2 + 14 && above > 0 && above < 110) {
        const plumeProximity = (1 - deltaX / (fire.w / 2 + 14)) * (1 - above / 110);
        turbulence = Math.max(turbulence, Math.min(1, plumeProximity * 2));
        accelerationY -= physics.fireLift;
        accelerationX += randomRange(-1, 1) * (physics.fireTurb + physics.smokeShake * plumeProximity);
        accelerationY += randomRange(-1, 1) * (0.025 + physics.smokeShake * 0.8 * plumeProximity);
      }
    }
    heli.turb = turbulence;
    heli.vx += accelerationX; heli.vy += accelerationY;
    const waterY = waterSurfaceY(heliCenterX), waterFraction = clamp((heli.y + 12 - waterY) / physics.waterDepth, 0, 1);
    if (waterFraction > 0 && heli.wf === 0) {
      splash(heliCenterX, Math.min(4, Math.abs(heli.vy) * 2.5 + 1));
      showMessage('IN ACQUA! RISALI PRIMA CHE IL ROTORE TOCCHI', 90);
    }
    heli.wf = waterFraction;
    const drag = waterFraction > 0 ? physics.drag - physics.waterDrag - physics.waterDragDepth * waterFraction : physics.drag;
    heli.vx *= drag; heli.vy *= drag;
    if (!input.hx && !heli.stab) heli.vx *= physics.hBrake;
    const allowedSpeed = heli.stab ? Math.min(maxSpeed(), CONFIG.stab.hardCap) : maxSpeed();
    const speed = Math.hypot(heli.vx, heli.vy);
    if (speed > allowedSpeed) { heli.vx *= allowedSpeed / speed; heli.vy *= allowedSpeed / speed; }
    heli.x += heli.vx; heli.y += heli.vy;
    if (heli.x < 0) { heli.x = 0; heli.vx = 0; }
    if (heli.x > level.worldW - 32) { heli.x = level.worldW - 32; heli.vx = 0; }
    if (heli.y < physics.ceiling) { heli.y = physics.ceiling; if (heli.vy < 0) heli.vy = 0; }
    applySnag();
    if (waterFraction > 0 && chance(0.25)) addParticle({ t: 'bub', x: heliCenterX + randomRange(-10, 10), y: waterY + randomRange(2, 8), life: 120 });
  }
  heli.ax = heli.vx - previousVelocityX;
  updateLadderAndTilt();
  updateWinch(input);
  updateCrew();

  // rotor under the water surface = engine dead for good
  if (heli.y > waterSurfaceY(heli.x + 2) || heli.y > waterSurfaceY(heli.x + 16) || heli.y > waterSurfaceY(heli.x + 30)) { drown(); return; }

  const heliCenterX = heli.x + 16, waterY = waterSurfaceY(heliCenterX);
  if (waterY !== Infinity && !heli.engineOff) {
    const rotorToWater = waterY - (heli.y + 12);
    if (rotorToWater > -4 && rotorToWater < 40) {
      const washFactor = 1 - Math.max(0, rotorToWater) / 40;
      pushWater(heliCenterX, 0.22 * washFactor, 4);
      if (chance(0.6 * washFactor)) {
        const direction = chance(0.5) ? -1 : 1;
        addParticle({ t: 'px', x: heliCenterX + direction * randomRange(4, 20), y: waterY - 1, vx: direction * randomRange(0.6, 1.8), vy: -randomRange(0.3, 1.2), g: 0.08, life: 40, drop: true });
      }
    }
  }
  if (damage > 0 && chance(0.1 * damage)) addParticle({ t: 'smoke', x: heli.x + (heli.face > 0 ? 18 : 14), y: heli.y + 2, r: 1, life: Math.floor(randomRange(40, 80)) });

  collideHeli();
  if (heli.state === 'fly') unloadAtSafe();
}
