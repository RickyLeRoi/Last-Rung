'use strict';

function bleed(person, previousState) {
  const bloodConfig = CONFIG.blood, heli = game.heli;
  for (let i = 0; i < bloodConfig.drops; i++) {
    addParticle({ t: 'px', bl: true, x: person.x + 3 + randomRange(-2, 2), y: person.y + 3 + randomRange(-2, 2), vx: randomRange(-1.4, 1.4) + (previousState === 'hang' ? heli.vx : 0), vy: -randomRange(0.1, 1.5), g: 0.08, life: 60 });
  }
  if (previousState === 'stand' && person.on) for (let i = 0; i < 5; i++) stainSolid(person.on, person.on.x + person.rel + randomRange(-1, 8), person.on.y);
}

function stainSolid(solid, x, y) {
  const bloodPixels = solid.blood || (solid.blood = []);
  if (bloodPixels.length >= CONFIG.blood.maxSolid * 2) return;
  let localX = round(x - solid.x), localY = round(y - solid.y);
  const width = round(solid.w), height = round(solid.h || 1);
  localX = clamp(localX, 0, width - 1); localY = clamp(localY, 0, height - 1);
  const distanceLeft = localX, distanceRight = width - 1 - localX, distanceTop = localY, distanceBottom = height - 1 - localY, nearestEdgeDistance = Math.min(distanceLeft, distanceRight, distanceTop, distanceBottom);
  if (nearestEdgeDistance === distanceTop) localY = 0; else if (nearestEdgeDistance === distanceLeft) localX = 0; else if (nearestEdgeDistance === distanceRight) localX = width - 1; else localY = height - 1;
  bloodPixels.push(localX, localY);
  if (chance(0.4)) bloodPixels.push(clamp(localX + (nearestEdgeDistance === distanceTop || nearestEdgeDistance === distanceBottom ? 0 : (nearestEdgeDistance === distanceLeft ? 1 : -1)), 0, width - 1), clamp(localY + (nearestEdgeDistance === distanceTop ? 1 : nearestEdgeDistance === distanceBottom ? -1 : 0), 0, height - 1));
}

// Stored in right-facing sprite coordinates; for the ladder, relative to its top.
function stainHeli(rect, personBox) {
  const heli = game.heli, bloodConfig = CONFIG.blood;
  if (!heli.blood) heli.blood = [];
  const overlapLeft = Math.max(rect.x, personBox.x), overlapRight = Math.min(rect.x + rect.w, personBox.x + personBox.w), overlapTop = Math.max(rect.y, personBox.y), overlapBottom = Math.min(rect.y + rect.h, personBox.y + personBox.h);
  const onLadder = rect.k === 'ladder' || rect.k === 'hook' || rect.k === 'rope';
  const swing = onLadder ? round(heli.lad || 0) : 0;
  const minLocalX = onLadder ? 14 : round(rect.x) - round(heli.x), maxLocalX = onLadder ? 17 : minLocalX + round(rect.w) - 1;
  const minLocalY = round(rect.y) - round(heli.y), maxLocalY = minLocalY + round(rect.h) - 1;
  for (let y = Math.floor(overlapTop); y < overlapBottom; y++) for (let x = Math.floor(overlapLeft); x < overlapRight; x++) {
    if (heli.blood.length >= bloodConfig.maxHeli * 2) return;
    const localX = clamp(x - round(heli.x) - swing, minLocalX, maxLocalX);
    heli.blood.push(heli.face > 0 || onLadder ? localX : 31 - localX, clamp(y - round(heli.y), minLocalY, maxLocalY));
  }
}
