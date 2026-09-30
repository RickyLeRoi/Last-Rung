'use strict';

// Rotor push vs horizontal distance from the center: zero right under the ladder, peak mid-blade, zero past the tip.
function downwashShape(distanceFromCenter) {
  const swimConfig = CONFIG.swim;
  if (distanceFromCenter < swimConfig.washDead || distanceFromCenter >= swimConfig.washRadius) return 0;
  if (distanceFromCenter < swimConfig.washPeak) return (distanceFromCenter - swimConfig.washDead) / (swimConfig.washPeak - swimConfig.washDead);
  return 1 - (distanceFromCenter - swimConfig.washPeak) / (swimConfig.washRadius - swimConfig.washPeak);
}

function updateFloater(person) {
  const heli = game.heli, level = game.L, water = level.water, swimConfig = CONFIG.swim;
  const personCenterX = person.x + 3.5;
  person.drift = clamp(person.drift + randomRange(-0.006, 0.006), -0.12, 0.12);

  // stay away from walls, rocks and world edges: the ladder is at the center of the 32 px wide heli,
  // so it could never reach someone next to a wall
  let away = 0, nearestObstacleDistance = Infinity, nearestObstacleDirection = 0;
  const avoid = (distanceToObstacle, direction) => {   // direction = toward open water
    if (distanceToObstacle >= swimConfig.avoid) return;
    away += direction * swimConfig.avoidForce * (1 - Math.max(0, distanceToObstacle) / swimConfig.avoid);
    if (distanceToObstacle < nearestObstacleDistance) { nearestObstacleDistance = distanceToObstacle; nearestObstacleDirection = direction; }
  };
  const minCenterX = 16, maxCenterX = level.worldW - 16;
  avoid(personCenterX - minCenterX, 1);
  avoid(maxCenterX - personCenterX, -1);
  for (const solid of level.solids) {
    if (solid.y > waterSurfaceY(clamp(personCenterX, solid.x, solid.x + solid.w)) + 2) continue;
    const leftOf = personCenterX < solid.x + solid.w / 2;
    avoid(leftOf ? solid.x - (person.x + 7) : person.x - (solid.x + solid.w), leftOf ? -1 : 1);
  }
  if (nearestObstacleDirection && Math.sign(person.drift) === -nearestObstacleDirection) person.drift = -person.drift;
  let drift = person.drift + game.wind * 0.015;
  let deltaX = away;
  if (!person.buoy) {
    const buoyConfig = CONFIG.buoy;
    let nearestBuoy = null, nearestDistance = buoyConfig.lure;
    for (const buoy of level.buoys) if (buoy.st === 'float' && Math.abs(buoy.x + 2 - personCenterX) < nearestDistance) { nearestBuoy = buoy; nearestDistance = Math.abs(buoy.x + 2 - personCenterX); }
    if (nearestBuoy) {
      if (nearestDistance < buoyConfig.grab) {
        nearestBuoy.st = 'taken'; person.buoy = nearestBuoy;
        person.timer += buoyConfig.extra; person.tmax = Math.max(person.tmax, person.timer);
        Sfx.play('board');
        showMessage(isDog(person) ? 'IL CANE SI TIENE AL SALVAGENTE' : "HA PRESO IL SALVAGENTE: HA PIU' TEMPO", 90);
      } else { deltaX += Math.sign(nearestBuoy.x + 2 - personCenterX) * buoyConfig.swim; drift *= 0.3; }
    }
  }

  if (heli.state === 'fly' && !heli.engineOff) {
    const offsetFromLadder = personCenterX - (heli.x + 16 + round(heli.lad)), distanceFromLadder = Math.abs(offsetFromLadder);
    const rotorHeightAboveWater = waterSurfaceY(personCenterX) - (heli.y + 12);
    if (rotorHeightAboveWater < swimConfig.washHeight && rotorHeightAboveWater > -6) {
      const washFactor = 1 - clamp(rotorHeightAboveWater, 0, swimConfig.washHeight) / swimConfig.washHeight;
      const push = swimConfig.wash * washFactor * downwashShape(distanceFromLadder);
      deltaX += Math.sign(offsetFromLadder) * push;
      if (push > 0.015 && chance(push * 8)) {
        addParticle({ t: 'px', x: personCenterX + randomRange(-3, 3), y: person.y + 4, vx: Math.sign(offsetFromLadder) * randomRange(0.3, 1.2), vy: -randomRange(0.4, 1.3), g: 0.08, life: 30, drop: true });
      }
    }
    const reach = heli.y + 12 + heli.ladLen > waterSurfaceY(personCenterX) - swimConfig.washHeight;
    if (reach && distanceFromLadder < swimConfig.toLadderRange && Math.hypot(heli.vx, heli.vy) < CONFIG.speed.hook * 1.5) {
      deltaX -= Math.sign(offsetFromLadder) * Math.min(swimConfig.toLadder, distanceFromLadder * 0.01);
      drift *= 0.2;
    }
  }

  person.x += deltaX + drift;
  if (water.ranges) {
    for (const range of water.ranges) if (person.x + 3 >= range[0] - 20 && person.x + 3 <= range[1] + 20) { person.x = clamp(person.x, range[0] + 1, range[1] - 8); break; }
  }
  person.x = clamp(person.x, minCenterX - 3.5, maxCenterX - 3.5);
  for (const solid of level.solids) {
    if (solid.y < waterSurfaceY(person.x + 3) + 2 && person.x < solid.x + solid.w && person.x + 7 > solid.x) {
      person.x = person.x + 3.5 < solid.x + solid.w / 2 ? solid.x - 7.01 : solid.x + solid.w + 0.01;
      person.drift = -person.drift;
    }
  }
  person.y = waterSurfaceY(person.x + 3) - 5;
  if (!isFinite(person.y)) person.y = water.base - 5;
  if (person.buoy) { person.buoy.x = person.x + 1; person.buoy.y = person.y + 4; }
  if (--person.timer <= 0) killPerson(person, 'ANNEGATO', false);
}
