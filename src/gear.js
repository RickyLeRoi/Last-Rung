'use strict';
function throwBuoy() {
  const heli = game.heli;
  if (heli.state !== 'fly' || heli.engineOff) return;
  if (heli.buoys <= 0) { showMessage('SALVAGENTI FINITI: RICARICALI IN ZONA SICURA', 90); return; }
  heli.buoys--;
  game.L.buoys.push({ x: heli.x + 14 + round(heli.lad), y: heli.y + 12, vx: heli.vx * 0.8, vy: Math.max(0, heli.vy), st: 'air' });
  Sfx.play('throw');
  showMessage('SALVAGENTE LANCIATO (' + heli.buoys + ' RIMASTI)', 60);
}

function updateBuoys() {
  const level = game.L;
  for (const buoy of level.buoys) {
    if (buoy.st === 'air') {
      const previousY = buoy.y;
      buoy.vy += 0.1; buoy.vx *= 0.99;
      buoy.x = clamp(buoy.x + buoy.vx + game.wind * 0.05, 0, level.worldW - 5); buoy.y += buoy.vy;
      const surfaceY = waterSurfaceY(buoy.x + 2);
      if (buoy.y + 3 > surfaceY) { buoy.st = 'float'; buoy.y = surfaceY - 2; splash(buoy.x + 2, 1.2); continue; }
      for (const solid of level.solids) {
        if (buoy.x + 5 > solid.x && buoy.x < solid.x + solid.w && buoy.y + 5 > solid.y && previousY + 5 <= solid.y + 2) { buoy.st = 'rest'; buoy.on = solid; buoy.rel = buoy.x - solid.x; buoy.y = solid.y - 5; break; }
        if (buoy.x + 5 > solid.x && buoy.x < solid.x + solid.w && buoy.y + 5 > solid.y && buoy.y < solid.y + solid.h) { buoy.vx = -buoy.vx * 0.3; buoy.x += buoy.vx * 2; }
      }
      if (buoy.y > CONFIG.H + 10) buoy.st = 'gone';
    } else if (buoy.st === 'float') {
      buoy.x = clamp(buoy.x + game.wind * 0.02, 2, level.worldW - 7);
      buoy.y = waterSurfaceY(buoy.x + 2) - 2;
      for (const solid of level.solids) if (solid.y < buoy.y + 3 && buoy.x + 5 > solid.x && buoy.x < solid.x + solid.w) buoy.x = buoy.x + 2.5 < solid.x + solid.w / 2 ? solid.x - 5 : solid.x + solid.w;
    } else if (buoy.st === 'rest' && buoy.on) { buoy.x = buoy.on.x + buoy.rel; buoy.y = buoy.on.y - 5; }
  }
  if (level.buoys.some(buoy => buoy.st === 'gone')) level.buoys = level.buoys.filter(buoy => buoy.st !== 'gone');
}

function useBucket() {
  const heli = game.heli, bucket = heli.bucket;
  if (heli.state !== 'fly' || heli.engineOff) return;
  if (game.L.sc.id !== 'fire') { showMessage('IL SECCHIO SERVE SOLO NEGLI INCENDI', 70); return; }
  if (!bucket.on) {
    if (heli.att.length) { showMessage('PRIMA FAI SALIRE CHI E\' APPESO ALLA SCALETTA', 80); return; }
    if (heli.crew.st !== 'idle') { showMessage('ASPETTA IL SOCCORRITORE', 60); return; }
    bucket.on = true; heli.winch = CONFIG.winch.min;
    Sfx.play('stabOn');
    showMessage("SECCHIO CALATO: RIEMPILO IMMERGENDOLO NELL'ACQUA", 110);
  } else if (bucket.fill > 0.05) {
    const dropCount = Math.round(CONFIG.bucket.drops * bucket.fill), bucketX = heli.x + 16 + round(heli.lad), bucketY = heli.y + 12 + heli.ladLen;
    for (let i = 0; i < dropCount; i++) addParticle({ t: 'px', wt: true, x: bucketX + randomRange(-3, 3), y: bucketY + randomRange(-2, 2), vx: heli.vx * 0.8 + randomRange(-0.45, 0.45), vy: Math.max(0, heli.vy) + randomRange(0, 0.8), g: 0.09, life: 90 });
    bucket.fill = 0;
    Sfx.play('dump');
    showMessage('ACQUA SGANCIATA!', 50);
  } else {
    bucket.on = false;
    Sfx.play('stabOff');
    showMessage('SECCHIO RITIRATO', 50);
  }
}

function updateBucket() {
  const heli = game.heli, bucket = heli.bucket;
  if (!bucket.on || heli.state !== 'fly') return;
  const bucketX = heli.x + 16 + round(heli.lad), bottom = heli.y + 12 + heli.ladLen;
  if (bottom > waterSurfaceY(bucketX) + 1 && bucket.fill < 1) {
    bucket.fill = Math.min(1, bucket.fill + CONFIG.bucket.fillRate);
    if (chance(0.4)) addParticle({ t: 'px', x: bucketX + randomRange(-3, 3), y: waterSurfaceY(bucketX) - 1, vx: randomRange(-0.8, 0.8), vy: -randomRange(0.3, 1), g: 0.08, life: 25, drop: true });
    if (bucket.fill === 1) showMessage('SECCHIO PIENO: SVUOTALO SULLE FIAMME', 90);
  }
}

function douse(droplet) {
  for (const fire of game.L.fires) {
    const rect = fireRect(fire);
    if (droplet.x >= rect.x - 1 && droplet.x < rect.x + rect.w + 1 && droplet.y >= rect.y - 2 && droplet.y < fire.y + 1) {
      fire.hp -= CONFIG.bucket.hit;
      if (chance(0.5)) addParticle({ t: 'smoke', x: droplet.x, y: droplet.y - 2, r: 1, life: 40 });
      if (fire.hp <= 0) extinguish(fire);
      return true;
    }
  }
  return false;
}

function extinguish(fire) {
  const level = game.L;
  level.fires = level.fires.filter(otherFire => otherFire !== fire);
  for (let i = 0; i < 8; i++) addParticle({ t: 'smoke', x: fire.x + randomRange(0, fire.w), y: fire.y - randomRange(0, 6), r: randomRange(1, 3), life: Math.floor(randomRange(60, 110)) });
  const roof = level.solids.find(solid => solid.kind === 'bld' && fire.x >= solid.x && fire.x < solid.x + solid.w && Math.abs(solid.y - fire.y) < 2);
  if (roof && !level.fires.some(otherFire => otherFire.x >= roof.x && otherFire.x < roof.x + roof.w && Math.abs(otherFire.y - roof.y) < 2)) {
    for (const roofWindow of roof.win || []) roofWindow.fire = false;
    // No flames left on that roof: whoever stands there stops panicking.
    for (const person of level.people) if (person.state === 'stand' && person.on === roof) { person.timer = person.tmax = 0; person.panic = false; }
  }
  game.score += CONFIG.bucket.score;
  Sfx.play('hiss');
  showMessage('INCENDIO SPENTO! +' + CONFIG.bucket.score, 110);
}
