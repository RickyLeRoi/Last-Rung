// games/faro/src/lamp.js
'use strict';
// The lighthouse lamp: a beam (cone) the player tilts and widens, fed by an oil tank, plus the siren and the signal flash.

function beamGeometry() {
  const beam = game.beam, config = CONFIG.beam;
  const lengthFactor = game.L && game.L.fog ? config.fogFactor : 1;
  return {
    x: CONFIG.lamp.x, y: CONFIG.lamp.y, pitch: beam.pitch,
    half: config.halfMin + (config.halfMax - config.halfMin) * beam.spread,
    length: (config.lenLong + (config.lenShort - config.lenLong) * beam.spread) * lengthFactor,
  };
}

function beamContains(x, y) {
  if (!game.beam.on) return false;
  const geometry = beamGeometry(), deltaX = x - geometry.x, deltaY = y - geometry.y;
  if (deltaX <= 0 || Math.hypot(deltaX, deltaY) > geometry.length) return false;
  return Math.abs(Math.atan2(deltaY, deltaX) - geometry.pitch) <= Math.max(geometry.half, CONFIG.beam.minHalfWidth / deltaX);
}

// Ships steer by the beam centre line, so they react in a wider band than the one that is visibly lit.
function beamFollows(x, y) {
  if (!game.beam.on) return false;
  const geometry = beamGeometry(), deltaX = x - geometry.x, deltaY = y - geometry.y;
  if (deltaX <= 0 || Math.hypot(deltaX, deltaY) > geometry.length) return false;
  return Math.abs(Math.atan2(deltaY, deltaX) - geometry.pitch) <= Math.max(geometry.half, CONFIG.beam.followWidth / deltaX);
}

// Lit by the beam, the flash, lightning or the port lights.
function isRevealed(x, y) {
  if (game.lampFlashT > 0 || game.flashT > 0 || game.boltT > 0) return true;
  const port = CONFIG.port;
  return Math.hypot(x - port.lightX, y - port.lightY) < port.lightRadius || beamContains(x, y);
}

function updateLamp(input) {
  const beam = game.beam, config = CONFIG.beam, oil = CONFIG.oil;
  if (input.hx) game.used.move = true;
  if (input.up || input.down) game.used.spread = true;
  beam.pitch = clamp(beam.pitch + input.hx * config.pitchSpeed, config.pitchMin, config.pitchMax);
  beam.spread = clamp(beam.spread + (input.down - input.up) * config.spreadSpeed, 0, 1);

  const sailing = game.L.ships.some(ship => ship.state === 'sail');
  if (beam.on) game.oil -= oil.beam + (1 - beam.spread) * oil.narrowExtra;
  game.oil += sailing ? (beam.on ? 0 : oil.trickle) : oil.recharge;
  game.oil = clamp(game.oil, 0, oil.max);
  if (beam.on && game.oil <= 0) { beam.on = false; Sfx.play('lampOut'); showMessage('OLIO FINITO: LA LAMPADA SI SPEGNE', 120); }
  else if (!beam.on && game.oil >= oil.restart) { beam.on = true; Sfx.play('lampOn'); }

  if (input.stab && game.lampFlashT === 0 && game.oil >= oil.flash) {
    game.oil -= oil.flash;
    game.lampFlashT = CONFIG.flash.frames;
    game.used.flash = true;
    Sfx.play('flash');
  }
  if (input.drop && game.sirenCool === 0) {
    game.sirenT = CONFIG.siren.frames;
    game.sirenCool = CONFIG.siren.cooldown;
    game.used.siren = true;
    Sfx.play('siren');
    addParticle({ t: 'ring', x: CONFIG.lamp.x, y: CONFIG.lamp.y, r: 4, life: 70 });
  }
  for (const rock of game.L.rocks) {
    const y = rockWaterlineY(rock) - 3;
    if (!rock.seen && (isRevealed(rock.x, y) || isRevealed(rock.x + 7, y) || isRevealed(rock.x + 13, y))) rock.seen = true;
  }
  if (game.lampFlashT > 0) game.lampFlashT--;
  if (game.sirenT > 0) game.sirenT--;
  if (game.sirenCool > 0) game.sirenCool--;
}
