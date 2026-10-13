'use strict';
const isActive = person => person.state === 'stand' || person.state === 'float' || person.state === 'hang' || person.state === 'fall' || person.state === 'aboard' || person.state === 'carried';
const isDog = person => person.kind === 'dog';

// relativeX = position along the rooftop. The dog is not counted in the total: it only gives a bonus.
function markSaved(person, safeZone, relativeX) {
  const level = game.L;
  person.state = 'saved'; person.on = safeZone; person.rel = relativeX; person.timer = person.tmax = 0; person.panic = false; person.blocked = false;
  if (isDog(person)) { level.dogsSaved = (level.dogsSaved || 0) + 1; game.score += CONFIG.score.dog; return; }
  level.saved++;
  game.score += CONFIG.score.save;
}
const personRect = person => ({ x: person.x, y: person.y, w: 7, h: 8 });

function board(person) {
  const heli = game.heli;
  if (person.state === 'hang') heli.att = heli.att.filter(attachedPerson => attachedPerson !== person);
  person.state = 'aboard'; person.slot = -1; person.timer = person.tmax = 0; person.panic = false; person.blocked = false;
  heli.cab.push(person);
  Sfx.play('board');
  if (person.buoy) { person.buoy.st = 'gone'; person.buoy = null; }
  showMessage((isDog(person) ? 'CANE A BORDO: ' : 'A BORDO: ') + loadCount() + '/' + CONFIG.load.max, 70);
}

function attach(person, message) {
  const heli = game.heli;
  person.state = 'hang'; person.sw = 0; person.swv = 0; person.ht = 0; person.timer = person.tmax = 0; person.panic = false; person.blocked = false;
  person.slot = heli.att.length;
  if (person.buoy) { person.buoy.st = 'gone'; person.buoy = null; }
  heli.att.push(person);
  Sfx.play('hook');
  const inWater = person.y + 4 > waterSurfaceY(person.x + 3.5);
  showMessage(message || (inWater ? "AGGANCIATO! TIRALO FUORI DALL'ACQUA" : heli.att.length > 1 ? 'AGGANCIATO ALLA CATENA! VAI ALLA ZONA SICURA' : 'AGGANCIATO! PORTALO ALLA ZONA SICURA'));
}

// byPlayer = death caused by the pilot (blades, crushing, debris, falls from the ladder): costs points.
function killPerson(person, cause, byPlayer) {
  if (person.state === 'dead' || person.state === 'saved') return;
  const heli = game.heli, level = game.L, previousState = person.state;
  if (person.buoy) { person.buoy.st = 'float'; person.buoy = null; }
  if (previousState === 'hang') { heli.att = heli.att.filter(attachedPerson => attachedPerson !== person); person.vx = heli.vx; person.vy = heli.vy; }
  if (previousState === 'aboard') heli.cab = heli.cab.filter(attachedPerson => attachedPerson !== person);
  if (previousState === 'stand') { person.deadMode = 'lie'; person.y = person.on.y - 3; }
  else if (previousState === 'float') person.deadMode = 'sink';
  else person.deadMode = 'fall';
  person.state = 'dead'; person.panic = false;
  if (isDog(person)) {
    if (byPlayer) game.score = Math.max(0, game.score + CONFIG.score.dogKill);
    showMessage('CANE PERSO' + (byPlayer ? ' ' + CONFIG.score.dogKill : ''), 120);
    Sfx.play('death');
    bleed(person, previousState);
    return;
  }
  level.dead++;
  if (byPlayer) {
    level.killedByPlayer++;
    game.score = Math.max(0, game.score + CONFIG.score.playerKill);
    showMessage('PERSONA PERSA: ' + cause + ' ' + CONFIG.score.playerKill, 150);
  } else {
    showMessage('PERSONA PERSA: ' + cause, 140);
  }
  Sfx.play('death');
  for (let i = 0; i < 4; i++) addParticle({ t: 'px', x: person.x + 3, y: person.y + 3, vx: randomRange(-1.2, 1.2), vy: -randomRange(0.2, 1.6), g: 0.08, life: 25 });
  bleed(person, previousState);
  game.shake = Math.max(game.shake, 3);
}

function updatePeople() {
  const heli = game.heli, level = game.L, speedLimits = CONFIG.speed;
  const flying = heli.state === 'fly';
  const heliHitboxes = flying ? heliRects(heli, heli.face) : null;
  const ladderHitboxes = flying ? ladderRects(heli) : null;
  const speed = Math.hypot(heli.vx, heli.vy);
  const lethal = game.parts.filter(debris => debris.t === 'chunk' && debris.lethal);

  for (const person of level.people) {
    if (person.noHook > 0) person.noHook--;
    switch (person.state) {
      case 'dead': updateDead(person); continue;
      case 'saved': person.x = person.on.x + person.rel; person.y = person.on.y - 8; continue;
      case 'aboard': person.x = heli.x + 13; person.y = heli.y + 2; continue;
      case 'carried': continue;   // on the rescuer's shoulder (crew.js)
      case 'stand': if (!updateStanding(person, flying)) continue; break;
      case 'float': updateFloater(person); if (person.state !== 'float') continue; break;
      case 'hang': updateHanging(person, speed); if (person.state !== 'hang') continue; break;
      case 'fall': updateFalling(person); if (person.state !== 'fall') continue; break;
    }

    const personBox = personRect(person);
    if (lethal.some(debris => overlap(personBox, debris))) { killPerson(person, 'COLPITO DAI DETRITI', true); continue; }
    if (level.fires.some(fire => overlap(personBox, fireRect(fire)))) { killPerson(person, 'AVVOLTO DALLE FIAMME', false); continue; }
    if (!flying || person.state === 'hang') continue;

    if (overlap(heliHitboxes.rotor, personBox)) { stainHeli(heliHitboxes.rotor, personBox); killPerson(person, 'COLPITO DALLE PALE DEL ROTORE', true); continue; }
    if (!heli.engineOff && overlap(heliHitboxes.tail, personBox)) { stainHeli(heliHitboxes.tail, personBox); killPerson(person, 'COLPITO DAL ROTORE DI CODA', true); continue; }
    const hook = heli.att.length && !heli.ground ? chainHook(heli) : ladderHitboxes.hook;
    if (heli.bucket.on && !heli.ground) {
      if (overlap(hook, personBox) && speed > speedLimits.crushLadder) { killPerson(person, 'TRAVOLTO DAL SECCHIO', true); continue; }
    } else if (!(person.noHook > 0) && overlap(hook, personBox)) {
      if (speed <= speedLimits.hook) {
        if (loadCount() >= CONFIG.load.max) showMessage('ELICOTTERO PIENO: VAI ALLA ZONA SICURA', 60);
        else if (heli.ground) board(person);
        else if (person.injured) showMessage("FERITO: NON SI AGGRAPPA. ATTERRA O CALA IL VERRICELLO SUL SUO TETTO", 90);
        else if (heli.att.length < CONFIG.rescue.ladderSlots) attach(person);
        else showMessage('SCALETTA OCCUPATA: ATTENDI CHE SALGANO', 60);
      } else {
        // 20261013 ** RG #ladder_never_kills: too fast only means no hook
        showMessage('RALLENTA! TROPPO VELOCE PER AGGANCIARE', 60);
      }
      continue;
    }
    // 20261013 -- RG
    for (const partName of ['cabin', 'boom', 'skid']) {
      if (overlap(heliHitboxes[partName], personBox) && speed > speedLimits.crushBody) { stainHeli(heliHitboxes[partName], personBox); killPerson(person, "TRAVOLTO DALL'ELICOTTERO", true); break; }
    }
  }
  if (level.people.some(person => person.gone)) level.people = level.people.filter(person => !person.gone);

  if (heli.ground && !heli.engineOff) {
    if (!heli.tailHint && level.people.some(person => person.state === 'stand' && person.blocked)) {
      heli.tailHint = true;
      showMessage("LA CODA LI BLOCCA: GIRA L'ELICOTTERO VERSO DI LORO", 220);
    }
  } else heli.tailHint = false;
}
