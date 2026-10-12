// games/valanga/src/avalanche.js
'use strict';
// Secondary avalanches: a crack above the rescuer (warning), then a front of snow runs downhill across the marked zone, leaving a new
// layer behind it (the buried end up deeper). Whoever it catches is knocked down; from the third loop on it buries the rescuer.

function startAvalanche() {
  const config = CONFIG.avalanche, level = game.L, centerX = rescuerCenterX();
  game.avalanche = { phase: 'warning', t: config.warning, startX: clamp(centerX - config.back, 10, level.width - 10), endX: clamp(centerX + config.ahead, 10, level.width - 10), frontX: 0 };
  level.avalancheAt += level.avalancheGap;
  game.shake = Math.max(game.shake, 3);
  Sfx.play('crack');
  showMessage('CREPA! VALANGA IN ARRIVO: ESCI DALLA ZONA', 150);
}

function hitRescuer() {
  const config = CONFIG.avalanche, body = game.rescuer;
  if (game.L.avalancheDeadly) { gameOver('TRAVOLTO DALLA VALANGA'); return; }
  body.stunT = config.stun;
  body.vx = config.speed;
  liftOutOfSnow();
  Sfx.play('stunned');
  showMessage('TRAVOLTO! RIALZATI', 90);
}

function updateAvalanche(frozen) {
  const level = game.L;
  if (frozen || !isLive()) return;
  if (!game.avalanche) {
    if (level.avalancheAt && game.clock >= level.avalancheAt) startAvalanche();
    return;
  }
  const avalanche = game.avalanche, config = CONFIG.avalanche;
  if (avalanche.phase === 'warning') {
    if (--avalanche.t > 0) return;
    avalanche.phase = 'run';
    avalanche.frontX = avalanche.startX;
    Sfx.play('avalanche');
    return;
  }
  avalanche.frontX += config.speed;
  depositSnow(avalanche.frontX, surfaceAt(avalanche.frontX) - 1, config.thickness);
  snowBurst(avalanche.frontX, surfaceAt(avalanche.frontX), 2, 1);
  game.shake = Math.max(game.shake, 1.5);
  if (hitsGround(game.rescuer.x, game.rescuer.y, game.rescuer.w, game.rescuer.h)) liftOutOfSnow();
  if (game.rescuer.stunT === 0 && Math.abs(rescuerCenterX() - avalanche.frontX) < config.hitDistance) hitRescuer();
  if (avalanche.frontX >= avalanche.endX) game.avalanche = null;
}
