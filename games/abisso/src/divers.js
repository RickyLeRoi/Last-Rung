// games/abisso/src/divers.js
'use strict';
// Divers wait with their air running out. The sub takes them aboard when it stops next to them (two seats) and lands them at the ship.

const diverCenter = diver => [diver.x + 4, diver.y + 3];

function updateDivers() {
  const level = game.L, sub = game.sub, config = CONFIG.sub, speed = Math.hypot(sub.vx, sub.vy);
  for (const diver of level.divers) {
    if (diver.state !== 'waiting') continue;
    diver.air--;
    if (diver.air <= 0) {
      diver.state = 'lost';
      level.lost++;
      showMessage("UN SUB HA FINITO L'ARIA", 110);
      Sfx.play('lost');
      continue;
    }
    const [x, y] = diverCenter(diver);
    if (Math.hypot(x - subCenterX(), y - subCenterY()) > config.boardRadius) continue;
    if (sub.aboard.length >= config.seats) { if (game.msgT === 0) showMessage("A BORDO NON C'E' POSTO: PORTALI ALLA NAVE", 90); continue; }
    if (speed > config.boardSpeed) { if (game.msgT === 0) showMessage('RALLENTA: IL SUB NON RIESCE A SALIRE', 60); continue; }
    diver.state = 'aboard';
    diver.found = true;
    sub.aboard.push(diver);
    showMessage('SUB A BORDO', 60);
    Sfx.play('board');
  }
  unloadAtShip();
}

// At the surface, under the ship: everybody aboard is saved.
function unloadAtShip() {
  const level = game.L, sub = game.sub, ship = CONFIG.ship;
  if (!sub.aboard.length) return;
  const underShip = subCenterX() >= ship.x && subCenterX() <= ship.x + ship.width;
  if (!underShip || subCenterY() > CONFIG.world.surface + ship.unloadDepth) return;
  for (const diver of sub.aboard) { diver.state = 'saved'; level.saved++; game.score += CONFIG.score.saved; }
  showMessage(sub.aboard.length > 1 ? 'SUB SALVATI' : 'SUB SALVATO', 90);
  sub.aboard = [];
  Sfx.play('saved');
}

const waitingDivers = () => game.L.divers.filter(diver => diver.state === 'waiting');

// Lost as soon as there is no way to save more than half of them; won once nobody is left down there.
function checkOutcome() {
  const level = game.L, sub = game.sub;
  if (sub.hull <= 0) { gameOver('SCAFO SFONDATO'); return; }
  const possible = level.saved + sub.aboard.length + waitingDivers().length;
  if (!level.tutorial && possible * 2 <= level.total) gameOver('TROPPI SUB PERSI');
}
