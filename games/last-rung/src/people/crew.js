'use strict';
// Rescuer state machine: idle -> down -> walk -> return -> up. If the ladder leaves the rooftop he waits for it.

const crewLadderX = heli => heli.x + 14 + round(heli.lad);

function crewInjuredTarget(heli) {
  const restSolid = heli.ladRest, ladderX = crewLadderX(heli) + 2;
  let nearestInjured = null, nearestDistance = CONFIG.crew.reach;
  for (const person of game.L.people) {
    if (person.state !== 'stand' || !person.injured || person.on !== restSolid) continue;
    const distance = Math.abs(person.x + 3.5 - ladderX);
    if (distance < nearestDistance) { nearestInjured = person; nearestDistance = distance; }
  }
  return nearestInjured;
}

function updateCrew() {
  const heli = game.heli, crew = heli.crew, crewConfig = CONFIG.crew;
  if (heli.state !== 'fly') return;
  const ladderX = crewLadderX(heli), ladderTopY = heli.y + 12, bottom = ladderTopY + heli.ladLen;
  const resting = crew.on ? heli.ladRest === crew.on : !!heli.ladRest;
  // landed: the rescuer boards at once (with the injured person, if already picked up)
  if (heli.ground && crew.st !== 'idle') {
    if (crew.carry) board(crew.carry);
    heli.crew = { st: 'idle' };
    return;
  }
  switch (crew.st) {
    case 'idle': {
      if (heli.engineOff || heli.bucket.on || heli.att.length || !heli.ladRest || heli.ladLen < CONFIG.winch.min + 2) return;
      if (Math.hypot(heli.vx, heli.vy) > CONFIG.speed.hook * 1.5 || loadCount() >= CONFIG.load.max) return;
      const person = crewInjuredTarget(heli);
      if (!person) return;
      heli.crew = { st: 'down', x: ladderX, y: ladderTopY - 4, on: heli.ladRest, target: person, carry: null, waitSaid: false };
      Sfx.play('hook');
      showMessage('IL SOCCORRITORE SCENDE: RESTA FERMO', 110);
      return;
    }
    case 'down':
      crew.x = ladderX; crew.y += crewConfig.climb;
      if (!resting) { crew.st = 'up'; return; }
      if (crew.y + 8 >= bottom) { crew.st = 'walk'; crew.y = crew.on.y - 8; crew.rel = clamp(ladderX - crew.on.x, 0, crew.on.w - 7); }
      return;
    case 'walk': {
      const person = crew.target;
      if (!person || person.state !== 'stand' || person.on !== crew.on) { crew.st = 'return'; return; }
      const deltaX = person.rel - crew.rel;
      crew.rel += Math.sign(deltaX) * Math.min(crewConfig.walk, Math.abs(deltaX));
      crew.x = crew.on.x + crew.rel; crew.y = crew.on.y - 8;
      if (Math.abs(deltaX) <= 1) {
        crew.carry = person; person.state = 'carried'; person.timer = person.tmax = 0; person.panic = false;
        Sfx.play('board');
        showMessage('FERITO RECUPERATO: TORNA ALLA SCALETTA', 90);
        crew.st = 'return';
      }
      return;
    }
    case 'return': {
      crew.x = crew.on.x + crew.rel; crew.y = crew.on.y - 8;
      if (!resting) {
        if (!crew.waitSaid) { crew.waitSaid = true; showMessage('IL SOCCORRITORE ASPETTA LA SCALETTA SUL TETTO', 140); }
        break;
      }
      crew.waitSaid = false;
      const deltaX = clamp(ladderX - crew.on.x, 0, crew.on.w - 7) - crew.rel;
      crew.rel += Math.sign(deltaX) * Math.min(crew.carry ? crewConfig.carry : crewConfig.walk, Math.abs(deltaX));
      crew.x = crew.on.x + crew.rel;
      if (Math.abs(deltaX) <= 1) crew.st = 'up';
      break;
    }
    case 'up':
      crew.x = ladderX; crew.y -= crew.carry ? crewConfig.climb * 0.6 : crewConfig.climb;
      if (crew.y <= ladderTopY - 4) {
        if (crew.carry) board(crew.carry);
        heli.crew = { st: 'idle' };
        return;
      }
      break;
  }
  if (crew.carry) { crew.carry.x = crew.x; crew.carry.y = crew.y - 3; }
}

function crewLost() {
  const heli = game.heli, crew = heli.crew;
  if (crew && crew.carry) { const person = crew.carry; person.state = 'fall'; person.vx = 0; person.vy = 0; person.dropped = false; }
  heli.crew = { st: 'idle' };
}
