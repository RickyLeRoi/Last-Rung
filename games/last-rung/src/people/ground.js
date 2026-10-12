'use strict';

// Returns true if the person boarded. Never crosses the tail rotor: waits in front of it (blocked).
function runToHeli(person) {
  const heli = game.heli, ground = heli.ground;
  person.run = false; person.blocked = false;
  if (!ground || heli.engineOff || loadCount() >= CONFIG.load.max) return false;
  if (person.on !== ground && !person.on.adj.includes(ground)) return false;
  let targetX = person.on === ground ? heli.x + 12.5 : (person.x + 3.5 < ground.x + ground.w / 2 ? ground.x - 7 : ground.x + ground.w);
  if (person.on === ground) {
    const tailRect = heliRects(heli, heli.face).tail, personX = person.on.x + person.rel;
    if (personX + 7 <= tailRect.x && targetX > tailRect.x - 8) { targetX = tailRect.x - 8; person.blocked = true; }
    else if (personX >= tailRect.x + tailRect.w && targetX < tailRect.x + tailRect.w + 1) { targetX = tailRect.x + tailRect.w + 1; person.blocked = true; }
  }
  const target = clamp(targetX - person.on.x, 1, person.on.w - 8);
  const deltaX = target - person.rel;
  if (Math.abs(deltaX) <= 1) {
    if (person.blocked) return false;
    board(person); return true;
  }
  const stepSpeed = CONFIG.rescue.runSpeed * (person.injured ? CONFIG.injured.walk : 1) * kindRunFactor(person);
  person.rel += Math.sign(deltaX) * Math.min(stepSpeed, Math.abs(deltaX));
  person.run = true;
  return false;
}

const kindRunFactor = person => (person.kind && CONFIG.kinds[person.kind] ? CONFIG.kinds[person.kind].run : 1);

// Returns false if the person changed state (boarded, died, jumped).
function updateStanding(person, flying) {
  let running = false;
  if (flying) { if (runToHeli(person)) return false; running = person.run; } else { person.run = false; person.blocked = false; }
  if (person.panic && !running && updatePanic(person)) return false;
  person.x = person.on.x + person.rel; person.y = person.on.y - 8;
  if (person.tmax > 0 && --person.timer <= 0) {
    if (person.injured) { killPerson(person, 'AVVOLTO DALLE FIAMME', false); return false; }
    person.panic = true; person.tmax = 0;
    Sfx.play('scream');
    showMessage(isDog(person) ? 'IL CANE SI STA PER BUTTARE DAL TETTO!' : 'PANICO! UN SUPERSTITE STA PER BUTTARSI DAL TETTO', 140);
  }
  return true;
}

// Returns true if the person left the rooftop (jumped onto the ladder or off the edge).
function updatePanic(person) {
  const heli = game.heli, rooftop = person.on, panicConfig = CONFIG.panic;
  if (heli.state === 'fly' && !heli.ground && !heli.engineOff && heli.att.length < CONFIG.rescue.ladderSlots &&
      loadCount() < CONFIG.load.max && Math.hypot(heli.vx, heli.vy) <= CONFIG.speed.crushLadder) {
    const hook = chainHook(heli);
    const deltaX = hook.x + hook.w / 2 - (person.x + 3.5), deltaY = hook.y - person.y;
    if (Math.abs(deltaX) < panicConfig.reach && deltaY > -panicConfig.reachUp && deltaY < panicConfig.reachDown) {
      person.x = hook.x; person.y = hook.y;
      attach(person, "SI E' LANCIATO SULLA SCALETTA!");
      return true;
    }
  }
  if (!person.dir) {
    const nearbyFire = game.L.fires.find(fire => fire.x + fire.w > rooftop.x && fire.x < rooftop.x + rooftop.w && Math.abs(fire.y - rooftop.y) < 2);
    const personCenterX = person.rel + 3.5;
    person.dir = nearbyFire ? (nearbyFire.x + nearbyFire.w / 2 - rooftop.x < personCenterX ? 1 : -1) : (personCenterX < rooftop.w / 2 ? -1 : 1);
  }
  person.rel = clamp(person.rel + person.dir * panicConfig.run * kindRunFactor(person), 1, rooftop.w - 8);
  person.run = true;
  if (person.rel > 1 && person.rel < rooftop.w - 8) return false;
  // hesitates briefly at the edge (last chance for the ladder), then jumps
  if ((person.edgeT = (person.edgeT || 0) + 1) < panicConfig.hesitate) return false;
  person.state = 'fall'; person.panic = false; person.run = false; person.dropped = false; person.timer = person.tmax = 0;
  person.x = person.dir < 0 ? rooftop.x - 7.5 : rooftop.x + rooftop.w + 0.5; person.y = rooftop.y - 8;
  person.vx = person.dir * panicConfig.jumpVx; person.vy = -panicConfig.jumpVy;
  return true;
}

function updateFalling(person) {
  const level = game.L, previousX = person.x, previousY = person.y;
  person.vy += CONFIG.phys.personGravity;
  person.vx *= 0.99;
  person.x = clamp(person.x + person.vx, 0, level.worldW - 7);
  person.y += person.vy;
  const personBox = personRect(person);
  for (const solid of level.solids) {
    if (!overlap(personBox, solid)) continue;
    if (previousY + 8 <= solid.y + 2) {
      person.y = solid.y - 8; person.on = solid; person.rel = clamp(round(person.x - solid.x), 1, solid.w - 8); person.state = 'stand';
      if (person.vy > CONFIG.speed.fallKill) { killPerson(person, 'CADUTA DA TROPPO IN ALTO', person.dropped); return; }
      person.vx = person.vy = 0;
      if (solid.safe) {
        markSaved(person, solid, person.rel);
        Sfx.play('save');
        showMessage(isDog(person) ? 'CANE IN SALVO! +' + CONFIG.score.dog : 'PERSONA IN SALVO! +' + CONFIG.score.save);
      } else if (level.fires.some(fire => fire.x >= solid.x && fire.x < solid.x + solid.w && fire.y === solid.y)) {
        person.tmax = person.timer = CONFIG.timers.fallFire;
      } else {
        person.tmax = person.timer = 0;
      }
      return;
    }
    person.x = previousX; person.vx = 0;
  }
  if (person.y + 5 > waterSurfaceY(person.x + 3)) {
    person.state = 'float';
    splash(person.x + 3, Math.min(3, 1 + person.vy));
    person.vx = person.vy = 0;
    if (person.timer <= 0 || !person.tmax) person.tmax = person.timer = CONFIG.timers.fallFloat;
    return;
  }
  if (person.y > CONFIG.H + 20) { person.gone = true; if (!isDog(person)) level.dead++; }
}

function updateDead(person) {
  if (person.deadMode === 'lie') { if (person.on) { person.x = person.on.x + person.rel; person.y = person.on.y - 3; } return; }
  if (person.deadMode === 'sink') {
    person.y += 0.25;
    if (person.y > waterSurfaceY(person.x + 3) + 26 || person.y > CONFIG.H + 10) person.gone = true;
    return;
  }
  const previousY = person.y;
  person.vy += CONFIG.phys.personGravity; person.x += person.vx; person.y += person.vy; person.vx *= 0.99;
  const bodyRect = { x: person.x, y: person.y, w: 8, h: 3 };
  for (const solid of game.L.solids) {
    if (overlap(bodyRect, solid) && previousY + 3 <= solid.y + 2) {
      person.deadMode = 'lie'; person.on = solid; person.rel = round(person.x - solid.x); person.y = solid.y - 3;
      for (let i = 0; i < 4; i++) stainSolid(solid, person.x + randomRange(0, 8), solid.y);
      return;
    }
  }
  if (person.y + 2 > waterSurfaceY(person.x + 4)) { person.deadMode = 'sink'; splash(person.x + 4, 1.5); return; }
  if (person.y > CONFIG.H + 10) person.gone = true;
}
