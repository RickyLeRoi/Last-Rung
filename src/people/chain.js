'use strict';

// hook = last 4 px (people grab it), rope = whole rope (crushes people when flying fast).
function ladderRects(heli) {
  const swing = round(heli.lad || 0), ladderLength = heli.ladLen, x = heli.x + 14, ladderTopY = heli.y + 12;
  return {
    hook: { k: 'hook', x: x + swing, y: ladderTopY + ladderLength - 4, w: 4, h: 4 },
    rope: { k: 'rope', x: x + Math.min(0, swing), y: ladderTopY, w: 4 + Math.abs(swing), h: ladderLength },
  };
}

function chainHook(heli) {
  const last = heli.att[heli.att.length - 1];
  return last ? { k: 'chain', x: last.x, y: last.y + 4, w: 7, h: 4 } : ladderRects(heli).hook;
}

function updateHanging(person, speed) {
  const heli = game.heli, chainIndex = heli.att.indexOf(person);
  person.ht++;
  person.swv += -0.05 * person.sw - heli.ax * 1.4;
  person.swv *= 0.9;
  person.sw = clamp(person.sw + person.swv, -3, 3);
  let chainOffsetX = 0;
  for (let j = 0; j < chainIndex; j++) chainOffsetX += heli.att[j].sw * 0.5;
  person.slot = chainIndex;
  person.x = heli.x + 12.5 + round(heli.lad) + round(chainOffsetX);
  person.y = heli.y + 9 + heli.ladLen + 7 * chainIndex;
  // dragged into water: loses grip at once (and everyone hanging below). Only the first moments
  // after hooking are tolerated, to leave time to pull the person out.
  if (person.ht > CONFIG.chain.grace && person.y + 4 > waterSurfaceY(person.x + 3.5)) { loseGrip(chainIndex); return; }
  const climb = CONFIG.rescue.boardAfter + (heli.ladLen - CONFIG.winch.min) * CONFIG.winch.climb;
  if (chainIndex === 0 && person.ht > (heli.ground ? 25 : climb) && speed < CONFIG.speed.hook * 1.5) { board(person); return; }
  const personBox = personRect(person);
  for (const solid of game.L.solids) {
    if (overlap(personBox, solid) && speed > CONFIG.speed.crushBody) { stainSolid(solid, person.x + 3, person.y + 4); killPerson(person, 'SBATTUTO CONTRO UN OSTACOLO', true); return; }
  }
}

function loseGrip(chainIndex, message) {
  const heli = game.heli, droppedPeople = heli.att.slice(chainIndex);
  for (const person of droppedPeople) { release(person); person.noHook = CONFIG.chain.noHook; }
  if (!message) splash(droppedPeople[0].x + 3.5, 2);
  Sfx.play('slip');
  showMessage(message || (droppedPeople.length > 1 ? "HANNO PERSO LA PRESA IN ACQUA! TIENILI FUORI DALL'ACQUA" : "HA PERSO LA PRESA IN ACQUA! TIENILO FUORI DALL'ACQUA"), 150);
}
