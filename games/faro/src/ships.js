// games/faro/src/ships.js
'use strict';
// Ships sail left toward the port. A ship inside the beam follows the lane of the beam centre line; rocks sink ships in the same lane.

const SHIP_LIGHT_HEIGHT = 3;

function laneOffset(laneF) {
  const offsets = CONFIG.sea.laneOffsets, lower = Math.floor(clamp(laneF, 0, offsets.length - 1)), upper = Math.min(offsets.length - 1, lower + 1);
  return offsets[lower] + (offsets[upper] - offsets[lower]) * (clamp(laneF, 0, offsets.length - 1) - lower);
}
const shipWaterlineY = ship => waterSurfaceY(ship.x) + laneOffset(ship.laneF);
const rockWaterlineY = rock => waterSurfaceY(rock.x + 7) + laneOffset(rock.lane);

// Lanes are compared on their nominal height (without waves), otherwise the lane lines would wobble under the beam.
const nominalLaneY = lane => CONFIG.sea.base + CONFIG.sea.laneOffsets[lane];
function nearestLane(y) {
  let best = 0;
  CONFIG.sea.laneOffsets.forEach((offset, lane) => { if (Math.abs(nominalLaneY(lane) - y) < Math.abs(nominalLaneY(best) - y)) best = lane; });
  return best;
}

// The lane a ship takes when the beam, tilted by pitch, lights it: the lane nearest to the centre line, with some hysteresis.
function steerLane(ship, pitch) {
  const lamp = CONFIG.lamp, centerY = lamp.y + Math.tan(pitch) * (ship.x + 8 - lamp.x) + SHIP_LIGHT_HEIGHT;
  const candidate = nearestLane(centerY);
  if (candidate !== ship.lane && Math.abs(centerY - nominalLaneY(candidate)) + CONFIG.beam.laneHysteresis >= Math.abs(centerY - nominalLaneY(ship.lane))) return ship.lane;
  return candidate;
}

function sinkShip(ship, rock) {
  ship.state = 'sink'; ship.stateT = 0;
  rock.seen = true;   // learning from the wreck: the rock that sank the ship stays on the map
  game.L.sunk++;
  for (let i = 0; i < 7; i++) {
    addParticle({ t: 'chunk', x: ship.x + randomRange(0, 14), y: shipWaterlineY(ship) - 6, w: 3, h: 2, vx: randomRange(-0.8, 0.8), vy: -randomRange(0.5, 1.6), life: 150 });
  }
  splash(ship.x + 8, 3);
  Sfx.play('sink');
  showMessage('NAVE AFFONDATA!', 100);
}

function dockShip(ship) {
  ship.state = 'dock'; ship.stateT = 0;
  game.L.docked++;
  game.score += CONFIG.score.dock;
  Sfx.play('dock');
  showMessage('NAVE AL PORTO! +' + CONFIG.score.dock, 80);
}

function updateShips(frozen) {
  const level = game.L, config = CONFIG.ship;
  if (!frozen) game.clock++;
  for (const ship of level.ships) {
    if (ship.state === 'wait') {
      if (!frozen && game.clock >= ship.t) { ship.state = 'sail'; ship.x = config.spawnX; Sfx.play('horn'); }
      continue;
    }
    if (ship.state === 'sink' || ship.state === 'dock') { ship.stateT++; continue; }
    if (frozen) continue;

    const slowdown = game.sirenT > 0 ? CONFIG.siren.slow : 1;
    ship.x -= ship.speed * slowdown * (1 - game.wind * 0.1);
    ship.lit = beamContains(ship.x + 8, shipWaterlineY(ship) - SHIP_LIGHT_HEIGHT) ? ship.lit + 1 : 0;
    ship.following = beamFollows(ship.x + 8, shipWaterlineY(ship) - SHIP_LIGHT_HEIGHT);
    if (ship.following) ship.lane = steerLane(ship, game.beam.pitch);
    ship.laneF += clamp(ship.lane - ship.laneF, -config.laneSpeed, config.laneSpeed);

    if (chance(config.wakeChance)) addParticle({ t: 'px', x: ship.x + 17, y: shipWaterlineY(ship), vx: randomRange(0.1, 0.5), vy: -randomRange(0.1, 0.5), g: 0.04, life: 25, drop: true });
    for (const rock of level.rocks) {
      if (Math.abs(ship.x + 9 - (rock.x + 7)) < config.hitDistance && Math.abs(ship.laneF - rock.lane) < 0.55) { sinkShip(ship, rock); break; }
    }
    if (ship.state === 'sail' && ship.x <= CONFIG.port.dockX) dockShip(ship);
  }
}

function gameOver(reason) {
  game.state = 'over';
  game.overT = 110;
  game.overReason = reason;
  Sfx.play('fail');
}

// The level is lost as soon as no outcome can still bring more than half of the ships to the port.
function checkLost() {
  const level = game.L;
  if (level.tutorial || game.state !== 'play') return;
  if ((level.total - level.sunk) * 2 <= level.total) gameOver('TROPPE NAVI AFFONDATE');
}
