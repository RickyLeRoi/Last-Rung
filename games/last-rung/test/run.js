#!/usr/bin/env node
'use strict';
const fs = require('fs');
const os = require('os');   // 20260930 ** RG #windows_devnull: '/dev/null' does not exist on Windows
const path = require('path');
const { boot, flyTo, goTo, randomKeysPolicy, place, roofWithoutObstacles } = require('./helpers');

const SHOTS = path.join(__dirname, '..', '..', '..', 'dist', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const shotPath = name => path.join(SHOTS, name + '.png');

const tests = [];
const test = (name, testBody) => tests.push({ name, fn: testBody });
function assert(condition, message) { if (!condition) throw new Error(message); }

function dropOnto(level, dropHeight, initialVelocityX, keys) {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(level));
  const rooftop = roofWithoutObstacles(game);
  place(harness, rooftop.x + rooftop.w / 2 - 16 - initialVelocityX * 40, rooftop.y - 16 - dropHeight, initialVelocityX, 0);
  for (let i = 0; i < 600; i++) { harness.set(keys); harness.tick(); if (game.heli.ground || game.heli.state !== 'fly') break; }
  return { landed: game.heli.state === 'fly' && game.heli.ground === rooftop, hp: game.heli.hp, reason: game.overReason, G: game, g: harness };
}

test('smoke: input casuali su tutti gli scenari, solo pixel interi B/N', () => {
  for (const levelNumber of [1, 2, 3, 4, 5, 8]) {
    const harness = boot(); harness.play(harness.hook.levelSpec(levelNumber));
    const keysPolicy = randomKeysPolicy(levelNumber);
    for (let i = 0; i < 2500; i++) {
      if (i % 10 === 0) harness.set(keysPolicy(i));
      if (i % 700 === 699) harness.tap('Enter');
      if (i % 400 === 0) harness.shot(os.devNull);
      harness.tick();
    }
    assert(harness.stats.nonInt === 0, 'lv' + levelNumber + ': coordinate non intere ' + harness.stats.nonInt);
    assert(harness.stats.badColor === 0, 'lv' + levelNumber + ': colori fuori palette ' + harness.stats.badColor);
  }
});

test('livelli 1-16 e 60 sfide giornaliere: una sola zona sicura e almeno una persona', () => {
  const harness = boot();
  const specs = [];
  for (let levelNumber = 1; levelNumber <= 16; levelNumber++) specs.push(harness.hook.levelSpec(levelNumber));
  for (let day = 1; day <= 60; day++) specs.push(harness.hook.dailySpec('2026-' + String(1 + (day % 12)).padStart(2, '0') + '-' + String(1 + (day % 28)).padStart(2, '0')));
  const seen = new Set();
  for (const spec of specs) {
    harness.hook.startLevel(spec, 0);
    const level = harness.game.L;
    assert(level.solids.filter(solid => solid.safe).length === 1, 'zone sicure != 1 in ' + JSON.stringify(spec));
    assert(level.total >= 1, 'nessuna persona in ' + JSON.stringify(spec));
    if (spec.daily) seen.add(spec.scenario);
  }
  assert(seen.size === 4, 'le sfide giornaliere non coprono tutti gli scenari');
});

test('reattività: margine per restare sotto la soglia di aggancio', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  place(harness, 300, 60);
  let frameCount = 0;
  for (; frameCount < 200; frameCount++) { harness.set(['ArrowRight', game.heli.vy > 0 ? 'ArrowUp' : '']); harness.tick(); if (Math.abs(game.heli.vx) > harness.hook.CONFIG.speed.hook) break; }
  assert(frameCount + 1 >= 10, 'soglia superata in ' + (frameCount + 1) + ' frame');
  return (frameCount + 1) + ' frame di freccia laterale prima di superare la soglia';
});

test('stabilizzatore (X): resta fermo in aria e non supera la soglia di aggancio', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  place(harness, 300, 60, 1.2, -0.5);
  harness.tap('KeyX');
  assert(game.heli.stab, 'X non attiva lo stabilizzatore');
  harness.hold([], 240);
  const startY = game.heli.y; harness.hold([], 120);
  assert(Math.abs(game.heli.y - startY) < 1 && Math.hypot(game.heli.vx, game.heli.vy) < 0.01, 'non resta sospeso');
  let peakSpeed = 0;
  for (let i = 0; i < 240; i++) { harness.set(['ArrowRight', 'ArrowDown']); harness.tick(); peakSpeed = Math.max(peakSpeed, Math.hypot(game.heli.vx, game.heli.vy)); }
  assert(peakSpeed < harness.hook.CONFIG.speed.hook, 'velocità ' + peakSpeed + ' oltre la soglia');
  harness.tap('KeyX');
  assert(!game.heli.stab, 'X non spegne lo stabilizzatore');
  return 'velocità massima con stabilizzatore ' + peakSpeed.toFixed(3);
});

test('atterraggi: morbidi ok, duri = danno, a sasso = esplosione', () => {
  for (const levelNumber of [3, 4]) {
    let result = dropOnto(levelNumber, 14, 0, []); assert(result.landed && result.hp === 3, 'lv' + levelNumber + ' caduta 14px');
    result = dropOnto(levelNumber, 25, 0, []); assert(result.landed && result.hp === 3, 'lv' + levelNumber + ' caduta 25px');
    result = dropOnto(levelNumber, 25, 0.6, []); assert(result.landed, 'lv' + levelNumber + ' diagonale');
    result = dropOnto(levelNumber, 45, 0, []); assert(result.hp === 2 && result.G.heli.state === 'fly', 'lv' + levelNumber + ' 45px: atteso danno e rimbalzo, hp=' + result.hp + ' ' + result.reason);
    result = dropOnto(levelNumber, 60, 0, ['ArrowDown']); assert(result.G.heli.state === 'dead', 'lv' + levelNumber + ' picchiata da 60px: attesa esplosione');
  }
});

test('scafo: 3 urti laterali medi = distrutto; riparazione in zona sicura', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(3));
  const rooftop = roofWithoutObstacles(game);
  for (let hit = 1; hit <= 3; hit++) {
    place(harness, rooftop.x - 34, rooftop.y - 12, 1.6, 0);   // skid at the rooftop corner height, blades above it
    for (let i = 0; i < 60 && game.heli.hp > 3 - hit && game.heli.state === 'fly'; i++) { harness.set(game.heli.vy > 0 ? ['ArrowUp'] : []); harness.tick(); }
    game.heli.iframes = 0;
    if (hit < 3) assert(game.heli.hp === 3 - hit && game.heli.state === 'fly', 'urto ' + hit + ': hp=' + game.heli.hp + ' ' + game.heli.state + ' ' + game.overReason);
  }
  assert(game.heli.state === 'dead' && /SCAFO DISTRUTTO/.test(game.overReason), 'atteso scafo distrutto: ' + game.overReason);
  const thirdHarness = boot(); const thirdGame = thirdHarness.play(thirdHarness.hook.levelSpec(3)); const thirdRooftop = roofWithoutObstacles(thirdGame);
  place(thirdHarness, thirdRooftop.x - 33, thirdRooftop.y + 20, 0.5, 0);
  thirdHarness.hold(['ArrowUp'], 3);
  assert(thirdGame.heli.state === 'fly' && thirdGame.heli.hp === 2, 'pale lente: atteso danno, hp=' + thirdGame.heli.hp + ' ' + thirdGame.overReason);
  const fourthHarness = boot(); const fourthGame = fourthHarness.play(fourthHarness.hook.levelSpec(3)); const fourthRooftop = roofWithoutObstacles(fourthGame);
  place(fourthHarness, fourthRooftop.x - 34, fourthRooftop.y + 20, 1.6, 0);
  fourthHarness.hold(['ArrowUp'], 3);
  assert(fourthGame.heli.state === 'dead', 'pale veloci: attesa esplosione');
  const secondHarness = boot(); const secondGame = secondHarness.play(secondHarness.hook.levelSpec(3));
  secondGame.heli.hp = 1;
  secondHarness.hold([], 2 * 125);
  assert(secondGame.heli.hp === 3, 'in zona sicura lo scafo non si ripara: hp=' + secondGame.heli.hp);
});

test('carburante: lo stabilizzatore consuma di più, a secco il motore si spegne, in zona sicura si fa il pieno', () => {
  const burn = stabilizerOn => {
    const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
    place(harness, 300, 60);
    if (stabilizerOn) harness.tap('KeyX');
    const startFuel = game.heli.fuel;
    for (let i = 0; i < 300; i++) { harness.set(stabilizerOn ? [] : (game.heli.vy > 0 ? ['ArrowUp'] : [])); harness.tick(); }
    return startFuel - game.heli.fuel;
  };
  const normalBurn = burn(false), stabilizedBurn = burn(true);
  assert(stabilizedBurn > normalBurn * 1.5, 'consumo stab ' + stabilizedBurn + ' vs normale ' + normalBurn);
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(3));
  const rooftop = roofWithoutObstacles(game);
  place(harness, rooftop.x + rooftop.w / 2 - 16, rooftop.y - 30);
  game.heli.fuel = 0.05;
  harness.hold(['ArrowUp'], 10);
  assert(game.heli.engineOff, 'motore non spento a secco');
  for (let i = 0; i < 400 && game.state === 'play'; i++) { harness.set(['ArrowUp']); harness.tick(); }
  assert(game.state === 'over' && /CARBURANTE/.test(game.overReason), 'atteso game over per carburante: ' + game.state + ' ' + game.overReason);
  const secondHarness = boot(); const secondGame = secondHarness.play(secondHarness.hook.levelSpec(1));
  secondGame.heli.fuel = 0; secondGame.heli.engineOff = true;
  secondHarness.hold([], 200);
  assert(secondGame.heli.fuel === 100 && !secondGame.heli.engineOff, 'nessun pieno/riavvio in zona sicura');
  return 'consumo 5 s: normale ' + normalBurn.toFixed(2) + ', stabilizzatore ' + stabilizedBurn.toFixed(2);
});

test('superstiti corrono anche da superfici collegate (ponte -> torretta)', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  const tower = game.L.solids.find(solid => solid.kind === 'tower'), hull = game.L.solids.find(solid => solid.kind === 'hull');
  assert(tower.adj.includes(hull), 'torretta e ponte non collegati');
  const onHull = game.L.people.find(person => person.on === hull);
  place(harness, tower.x + tower.w / 2 - 16, tower.y - 30);
  harness.tap('KeyX');
  for (let i = 0; i < 600 && !game.heli.ground; i++) { harness.set(['ArrowDown']); harness.tick(); }
  assert(game.heli.ground === tower, 'non atterrato sulla torretta');
  harness.hold([], 400);
  assert(onHull.state === 'aboard', 'il superstite sul ponte non è salito: ' + onHull.state);
});

test('penalità: una persona uccisa dalle pale costa 150 punti', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  game.score = 1000;
  const person = game.L.people.find(candidate => candidate.state === 'float');
  place(harness, person.x - 12, person.y + 2);
  harness.tick();
  assert(person.state === 'dead', 'persona non colpita: ' + person.state);
  assert(game.score === 850 && game.L.killedByPlayer === 1, 'punteggio ' + game.score);
});

test('rotore di coda: uccide, macchia di rosso solo il punto colpito', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  game.score = 1000;
  const person = game.L.people.find(candidate => candidate.state === 'float');
  person.timer = person.tmax = 99999;
  const heli = game.heli;
  place(harness, person.x, person.y - 8);   // tail rotor (sprite columns 0-1, rows 2-8) over the person; blades and cabin elsewhere
  harness.tick();
  assert(person.state === 'dead', 'il rotore di coda non ha ucciso: ' + person.state);
  assert(/CODA/.test(game.msg), 'messaggio sbagliato: ' + game.msg);
  assert(game.score === 850 && game.L.killedByPlayer === 1, 'punteggio ' + game.score);
  assert(heli.blood && heli.blood.length >= 2, 'nessuna macchia sull\'elicottero');
  for (let i = 0; i < heli.blood.length; i += 2) assert(heli.blood[i] <= 1 && heli.blood[i + 1] >= 2 && heli.blood[i + 1] <= 8, 'macchia fuori dalla coda: ' + heli.blood[i] + ',' + heli.blood[i + 1]);
  // mirrored heli: the tail is on the right, blood stays on the tail (sprite columns 0-1)
  const secondHarness = boot(); const secondGame = secondHarness.play(secondHarness.hook.levelSpec(1));
  const mirroredPerson = secondGame.L.people.find(candidate => candidate.state === 'float'); mirroredPerson.timer = mirroredPerson.tmax = 99999;
  secondGame.heli.face = -1; place(secondHarness, mirroredPerson.x - 25, mirroredPerson.y - 8);
  secondHarness.tick();
  assert(mirroredPerson.state === 'dead' && secondGame.heli.blood && secondGame.heli.blood.every((value, index) => index % 2 || value <= 1), 'coda a destra: attesa morte e macchie sulla coda');
});

test('rotore di coda: i superstiti non lo attraversano, dall\'altra parte salgono', () => {
  const landing = dropOnto(3, 14, 0, []); const game = landing.G;
  assert(landing.landed, 'non atterrato');
  const landingSolid = game.heli.ground, heli = game.heli, tail = game.heli.face > 0 ? heli.x : heli.x + 30;
  const [blockedPerson, boardingPerson] = game.L.people.filter(person => person.state === 'stand' || person.state === 'float').slice(0, 2);
  const putOnSolid = (person, relativeX) => { Object.assign(person, { state: 'stand', on: landingSolid, rel: relativeX, x: landingSolid.x + relativeX, y: landingSolid.y - 8, timer: 0, tmax: 0, run: false }); };
  putOnSolid(blockedPerson, 1);
  putOnSolid(boardingPerson, landingSolid.w - 9);
  landing.g.tick(500);
  assert(blockedPerson.state === 'stand' && blockedPerson.x + 7 <= tail, 'il superstite ha attraversato/toccato la coda: ' + blockedPerson.state + ' x=' + blockedPerson.x + ' coda=' + tail);
  assert(boardingPerson.state === 'aboard', 'il superstite dalla parte giusta non è salito: ' + boardingPerson.state);
  assert(/CODA LI BLOCCA/.test(game.msg) || game.msgT === 0, 'nessun avviso: ' + game.msg);
  assert(blockedPerson.blocked, 'il superstite bloccato non è segnalato');
  landing.g.hold([game.heli.face > 0 ? 'ArrowLeft' : 'ArrowRight'], 3);
  assert(game.heli.ground === landingSolid, "girandosi a terra l'elicottero ha decollato");
  landing.g.hold([], 300);
  assert(blockedPerson.state === 'aboard', "dopo la virata il superstite non è salito: " + blockedPerson.state);
});

test('sangue: le persone uccise macchiano i solidi, non l\'elicottero', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(3));
  const rooftop = roofWithoutObstacles(game);
  const person = game.L.people.find(candidate => candidate.state !== 'dead');
  Object.assign(person, { state: 'stand', on: rooftop, rel: 20, x: rooftop.x + 20, y: rooftop.y - 8, timer: 1, tmax: 1, injured: true });
  place(harness, rooftop.x + rooftop.w + 120, 20); harness.tap('KeyX');
  harness.tick(120);
  assert(person.state === 'dead', 'non morto: ' + person.state);
  assert(rooftop.blood && rooftop.blood.length >= 6, 'poche macchie sul tetto: ' + (rooftop.blood && rooftop.blood.length / 2));
  for (let i = 0; i < rooftop.blood.length; i += 2) {
    const x = rooftop.blood[i], y = rooftop.blood[i + 1];
    assert(y <= 1 || x <= 1 || x >= rooftop.w - 2, 'macchia a mezz\'aria dentro l\'edificio: ' + x + ',' + y);
  }
  assert(!game.heli.blood || game.heli.blood.length === 0, 'elicottero macchiato senza contatto');
});

test('catena: il secondo recuperato si appende al primo, non alla scaletta', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  const floatingPeople = game.L.people.filter(candidate => candidate.state === 'float');
  const [firstPerson, secondPerson] = floatingPeople; firstPerson.timer = firstPerson.tmax = secondPerson.timer = secondPerson.tmax = 99999;
  const heli = game.heli;
  place(harness, firstPerson.x - 12.5, firstPerson.y - 12);
  harness.tap('KeyX'); harness.tick();
  assert(firstPerson.state === 'hang' && heli.att[0] === firstPerson, 'primo non agganciato: ' + firstPerson.state);
  secondPerson.x = heli.x + 12.5; secondPerson.timer = secondPerson.tmax = 99999;
  harness.tick(2);
  assert(secondPerson.state === 'hang' && heli.att[1] === secondPerson, 'secondo non agganciato: ' + secondPerson.state);
  assert(Math.abs(secondPerson.y - (firstPerson.y + 7)) < 0.01, 'il secondo non pende dal primo: y ' + secondPerson.y + ' vs ' + firstPerson.y);
  assert(firstPerson.y === heli.y + 13, 'il primo non pende dalla scaletta');
  game.heli.vx = game.heli.vy = 0;
  harness.hold([], 130);
  assert(firstPerson.state === 'aboard', 'il primo non è salito: ' + firstPerson.state);
});

test('hitbox per nome: rotore, coda, cabina, trave, pattino, scaletta', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  for (const face of [1, -1]) {
    const rects = harness.hook.heliRects(game.heli, face);
    for (const rectName of ['rotor', 'tail', 'cabin', 'boom', 'skid', 'ladder']) assert(rects[rectName] && rects[rectName].k === rectName && rects.includes(rects[rectName]), 'manca ' + rectName);
    assert(face > 0 ? rects.tail.x < rects.cabin.x : rects.tail.x > rects.cabin.x, 'coda dalla parte sbagliata');
  }
});

test('catena in acqua: chi viene trascinato nell\'acqua perde subito la presa', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  const [firstPerson, secondPerson] = game.L.people.filter(candidate => candidate.state === 'float');
  firstPerson.timer = firstPerson.tmax = secondPerson.timer = secondPerson.tmax = 99999;
  const heli = game.heli, config = harness.hook.CONFIG;
  place(harness, firstPerson.x - 12.5, firstPerson.y - 12);
  harness.tap('KeyX'); harness.tick();
  assert(firstPerson.state === 'hang', 'non agganciato');
  harness.hold(['ArrowUp'], 40); harness.hold([], 30);
  assert(firstPerson.state === 'hang' && firstPerson.y + 4 < 150, 'sollevato ma ha mollato: ' + firstPerson.state);
  firstPerson.ht = -99999;
  for (let i = 0; i < 600 && secondPerson.state === 'float'; i++) { secondPerson.x = firstPerson.x; harness.set(['ArrowDown']); harness.tick(); }
  assert(secondPerson.state === 'hang' && heli.att[1] === secondPerson, 'secondo non in catena: ' + secondPerson.state);
  secondPerson.ht = config.chain.grace + 1;
  let lost = -1;
  for (let i = 0; i < 300 && lost < 0; i++) { harness.set(['ArrowDown']); harness.tick(); if (secondPerson.state !== 'hang') lost = i; }
  assert(lost >= 0, 'il secondo non ha mai mollato');
  assert(firstPerson.state === 'hang', 'il primo (ancora fuori) ha mollato anche lui');
  assert(heli.att.length === 1, 'catena non aggiornata');
  harness.tick(3);
  assert(secondPerson.state === 'float' || secondPerson.state === 'fall', 'dopo aver mollato dovrebbe essere in acqua: ' + secondPerson.state);
  assert(secondPerson.noHook > 0, 'si riaggrapperebbe subito');
});

test('verricello: la scaletta si allunga, si appoggia ai tetti, si riavvolge', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  const heli = game.heli, winchConfig = harness.hook.CONFIG.winch;
  place(harness, 560, 40);
  harness.tap('KeyX');
  harness.keyDown('KeyE'); harness.tick(120); harness.keyUp('KeyE');
  assert(Math.abs(heli.ladLen - winchConfig.max) < 0.01 && heli.winch === winchConfig.max, 'non arriva al massimo: ' + heli.ladLen);
  const hookRect = harness.hook.ladderRects(heli).hook;
  assert(Math.abs(hookRect.y + 4 - (heli.y + 12 + winchConfig.max)) < 0.01, 'la presa non è in fondo alla scaletta');
  const secondHarness = boot(); const secondGame = secondHarness.play(secondHarness.hook.levelSpec(3));
  const rooftop = roofWithoutObstacles(secondGame);
  place(secondHarness, rooftop.x + rooftop.w / 2 - 16, rooftop.y - 30); secondHarness.tap('KeyX');
  secondHarness.keyDown('KeyE'); secondHarness.tick(100); secondHarness.keyUp('KeyE');
  const secondHeli = secondGame.heli, gap = rooftop.y - (secondHeli.y + 12);
  assert(secondHeli.ladLen <= gap + 0.01 && secondHeli.ladLen >= gap - 1, 'scaletta dentro il tetto: len ' + secondHeli.ladLen.toFixed(1) + ' distanza ' + gap.toFixed(1));
  assert(secondHeli.hp === 3 && secondHeli.state === 'fly', 'appoggiare la scaletta ha fatto danni');
  secondHarness.keyDown('KeyQ'); secondHarness.tick(100); secondHarness.keyUp('KeyQ');
  assert(secondHeli.ladLen === winchConfig.min && secondHeli.winch === winchConfig.min, 'non si riavvolge: ' + secondHeli.ladLen);
  const thirdHarness = boot(); const thirdGame = thirdHarness.play(thirdHarness.hook.levelSpec(1));
  const person = thirdGame.L.people.find(candidate => candidate.state === 'float'); person.timer = person.tmax = 99999;
  place(thirdHarness, person.x - 12.5, person.y - 36); thirdHarness.tap('KeyX');
  thirdHarness.keyDown('KeyE');
  for (let i = 0; i < 200 && person.state === 'float'; i++) { thirdGame.heli.x = person.x - 12.5 - Math.round(thirdGame.heli.lad); thirdHarness.tick(); }
  thirdHarness.keyUp('KeyE'); thirdHarness.tick();
  assert(person.state === 'hang', 'con la scaletta calata non aggancia: ' + person.state + ' len ' + thirdGame.heli.ladLen.toFixed(1));
  assert(Math.abs(person.y - (thirdGame.heli.y + 9 + thirdGame.heli.ladLen)) < 0.01, 'non pende dal fondo della scaletta');
  return 'lunghezza ' + winchConfig.min + '-' + winchConfig.max + ' px';
});

test('feriti: non si aggrappano alla scaletta, salgono solo atterrando (piano)', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(3));
  const injuredPeople = game.L.people.filter(person => person.injured);
  assert(injuredPeople.length === 1, 'attesi 1 ferito, trovati ' + injuredPeople.length);
  assert(injuredPeople[0].state === 'stand' && injuredPeople[0].on.w >= 44, 'ferito non su un tetto largo');
  const injuredPerson = injuredPeople[0], rooftop = injuredPerson.on;
  place(harness, injuredPerson.x + 3.5 - 16, injuredPerson.y - 12); harness.tap('KeyX');
  harness.tick(30);
  assert(injuredPerson.state === 'stand', 'il ferito si è aggrappato: ' + injuredPerson.state);
  assert(/FERITO/.test(game.msg), 'nessun avviso: ' + game.msg);
  let secondHarness, secondGame, secondInjuredPerson, secondRooftop;
  for (const levelNumber of [3, 7, 11, 15, 4, 8, 12, 6, 10]) {
    secondHarness = boot(); secondGame = secondHarness.play(secondHarness.hook.levelSpec(levelNumber));
    secondInjuredPerson = secondGame.L.people.find(candidate => candidate.injured); secondRooftop = secondInjuredPerson && secondInjuredPerson.on;
    if (secondRooftop && secondRooftop.w >= 50 && !secondGame.L.haz.some(hazard => hazard.x1 >= secondRooftop.x - 2 && hazard.x0 <= secondRooftop.x + secondRooftop.w + 2 && hazard.y0 < secondRooftop.y) && !secondGame.L.fires.some(fire => fire.x < secondRooftop.x + secondRooftop.w && fire.x + fire.w > secondRooftop.x)) break;
  }
  const landingCenterX = secondInjuredPerson.rel + 3.5 > secondRooftop.w / 2 ? secondRooftop.x + 17 : secondRooftop.x + secondRooftop.w - 17;
  secondGame.heli.face = secondInjuredPerson.x > landingCenterX ? 1 : -1;
  place(secondHarness, landingCenterX - 16, secondRooftop.y - 20);
  secondInjuredPerson.timer = secondInjuredPerson.tmax = 0;
  for (let i = 0; i < 300 && !secondGame.heli.ground; i++) { secondHarness.set(secondGame.heli.vy > 0.3 ? ['ArrowUp'] : []); secondHarness.tick(); }
  assert(secondGame.heli.ground === secondRooftop, 'non atterrato sul tetto del ferito');
  const startX = secondInjuredPerson.x; secondHarness.tick(20);
  const walkSpeed = Math.abs(secondInjuredPerson.x - startX) / 20;
  assert(walkSpeed > 0 && walkSpeed < secondHarness.hook.CONFIG.rescue.runSpeed * 0.5, "velocita' del ferito " + walkSpeed.toFixed(2));
  secondHarness.hold([], 900);
  assert(secondInjuredPerson.state === 'aboard', 'il ferito non è salito: ' + secondInjuredPerson.state);
  return 'cammina a ' + walkSpeed.toFixed(2) + ' px/frame';
});

test('panico: a fine barra corre al bordo e si butta; con la scaletta vicina ci salta sopra', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(4));
  const timedPerson = game.L.people.find(candidate => candidate.state === 'stand' && candidate.tmax > 0 && !candidate.injured);
  assert(timedPerson, 'nessun superstite a tempo');
  place(harness, 40, 30); harness.tap('KeyX');
  timedPerson.timer = 1;
  harness.tick(2);
  assert(timedPerson.panic && timedPerson.state === 'stand', 'niente panico: ' + timedPerson.state);
  let leftRoofAtFrame = -1;
  for (let i = 0; i < 300 && leftRoofAtFrame < 0; i++) { harness.tick(); if (timedPerson.state !== 'stand') leftRoofAtFrame = i; }
  assert(leftRoofAtFrame > 0, 'non si è buttato');
  assert(timedPerson.state === 'fall' || timedPerson.state === 'dead' || timedPerson.state === 'float', 'stato dopo il salto: ' + timedPerson.state);
  const secondHarness = boot(); const secondGame = secondHarness.play(secondHarness.hook.levelSpec(4));
  const secondTimedPerson = secondGame.L.people.find(candidate => candidate.state === 'stand' && candidate.tmax > 0 && !candidate.injured);
  const rooftop = secondTimedPerson.on;
  const fire = secondGame.L.fires.find(candidate => candidate.x + candidate.w > rooftop.x && candidate.x < rooftop.x + rooftop.w);
  const direction = fire && fire.x + fire.w / 2 < secondTimedPerson.x + 3.5 ? 1 : -1;
  const edgeX = direction > 0 ? rooftop.x + rooftop.w + 4 : rooftop.x - 4;
  place(secondHarness, edgeX - 16, rooftop.y - 26); secondHarness.tap('KeyX');
  secondTimedPerson.timer = 1;
  for (let i = 0; i < 200 && secondTimedPerson.state === 'stand'; i++) { secondGame.heli.x = edgeX - 16; secondGame.heli.vx = 0; secondHarness.tick(); }
  assert(secondTimedPerson.state === 'hang', 'non è saltato sulla scaletta: ' + secondTimedPerson.state);
  return 'dal tetto in ' + leftRoofAtFrame + ' frame';
});

test('notte: buio (retino) tranne il faro, persone segnalate, solo B/N', () => {
  const run = night => {
    const harness = boot({ search: night ? '?notte' : '' }); const game = harness.play(harness.hook.levelSpec(1));
    assert(game.L.night === night, 'notte non impostata');
    game.L.moonFull = false;
    place(harness, 500, 40); harness.tap('KeyX'); harness.tick(30);
    harness.shot(shotPath(night ? 'night' : 'day'));
    let white = 0; for (let i = 120 * 384; i < 204 * 384; i++) if (harness.buf[i] === 255) white++;   // sea rows only: sky (stars and moon stay lit) and HUD are excluded
    assert(harness.stats.badColor === 0 && harness.stats.nonInt === 0, 'palette/pixel');
    return { white, g: harness, G: game };
  };
  const dayResult = run(false), nightResult = run(true);
  assert(nightResult.white < dayResult.white * 0.6, 'di notte non è abbastanza buio: ' + nightResult.white + ' vs ' + dayResult.white);
  const levelFiveSpec = boot().hook.levelSpec(5);
  assert(levelFiveSpec.night && !boot().hook.levelSpec(1).night && !boot().hook.levelSpec(8).night, 'livelli notturni sbagliati');
  return 'pixel bianchi giorno ' + dayResult.white + ', notte ' + nightResult.white;
});

test('lampo: il sangue resta rosso; con i lampi ridotti niente inversione', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(2));
  place(harness, 300, 40); harness.tap('KeyX'); harness.tick(5);
  const rig = game.L.solids.find(solid => solid.kind === 'rig');
  game.camX = rig.x - 100;
  rig.blood = [10, 0, 11, 0, 12, 0];
  game.lightningT = 99999; game.flashT = 0; harness.tick();
  harness.shot(os.devNull);
  const bloodPixel = () => harness.buf[Math.round(rig.y) * 384 + Math.round(rig.x) + 10 - Math.round(game.camX)];
  const countWhitePixels = () => { let whiteCount = 0; for (const pixel of harness.buf) if (pixel === 255) whiteCount++; return whiteCount; };
  assert(bloodPixel() === 128, 'sangue non rosso: ' + bloodPixel());
  const initialWhiteCount = countWhitePixels();
  game.flashT = 3; game.camX = rig.x - 100; harness.shot(os.devNull);
  assert(bloodPixel() === 128, 'col lampo il sangue non è più rosso: ' + bloodPixel());
  assert(countWhitePixels() > initialWhiteCount * 2, 'il lampo pieno non inverte lo schermo');
  game.softFlash = true; game.flashT = 3; game.camX = rig.x - 100; harness.shot(os.devNull);
  assert(countWhitePixels() < initialWhiteCount * 1.5, 'con i lampi ridotti lo schermo si inverte lo stesso');
  harness.tap('KeyL');
  assert(game.softFlash === false, 'L non cambia i lampi');
  const secondHarness = boot({ search: '?lampi=0' });
  assert(secondHarness.game.softFlash === true, '?lampi=0 ignorato');
});

test('addestramento: parte dal titolo, si completa, si salta', () => {
  const harness = boot(); const game = harness.game;
  harness.tick(5); harness.tap('Enter'); harness.tick(2);
  assert(game.L.tutorial && game.state === 'intro', 'il titolo non porta all\'addestramento');
  harness.tap('Enter'); harness.tick(2);
  const level = game.L, getHeli = () => game.heli, safeZone = level.safe;
  const deliver = () => { goTo(harness, () => getHeli().x + 16, () => 50, 2); goTo(harness, () => safeZone.x + safeZone.w / 2, () => 50, 1.5); for (let i = 0; i < 1500 && harness.hook.loadCount() > 0; i++) flyTo(harness, safeZone.x + safeZone.w / 2, safeZone.y - 6, 0.5); };
  harness.hold(['ArrowUp'], 40); harness.tap('KeyX'); harness.tick();
  assert(game.tut.step === 2, 'passi decollo/stabilizzatore non superati: ' + game.tut.step);
  harness.tap('KeyX');
  const floatingPerson = level.people.find(person => person.tut === 'float');
  goTo(harness, () => floatingPerson.x + 3.5, () => 60, 2);
  harness.tap('KeyX');
  for (let i = 0; i < 2000 && floatingPerson.state === 'float'; i++) { const deltaX = floatingPerson.x + 3.5 - (getHeli().x + 16), deltaY = floatingPerson.y + 4 - (getHeli().y + 16); harness.set([deltaX > 1 ? 'ArrowRight' : deltaX < -1 ? 'ArrowLeft' : '', deltaY > 0 ? 'ArrowDown' : deltaY < -2 ? 'ArrowUp' : '']); harness.tick(); }
  harness.tap('KeyX');
  deliver();
  assert(level.saved === 1 && game.tut.step === 4, 'primo salvataggio: saved ' + level.saved + ' passo ' + game.tut.step);
  const roofPerson = level.people.find(person => person.tut === 'roof'), rooftop = roofPerson.on;
  goTo(harness, () => rooftop.x + 16, () => 50, 1.5); goTo(harness, () => rooftop.x + 16, () => rooftop.y - 14, 0.8);
  for (let i = 0; i < 900 && !getHeli().ground; i++) flyTo(harness, rooftop.x + 16, rooftop.y + 2, 0.45);
  harness.hold([roofPerson.x > getHeli().x + 16 ? 'ArrowRight' : 'ArrowLeft'], 3); harness.hold([], 250);
  deliver();
  assert(level.saved === 2 && game.tut.step === 6, 'secondo salvataggio: saved ' + level.saved + ' passo ' + game.tut.step);
  const alleyPerson = level.people.find(person => person.tut === 'alley');
  goTo(harness, () => alleyPerson.x + 3.5, () => 60, 1.5);
  harness.tap('KeyX');
  for (let i = 0; i < 300; i++) { const deltaX = alleyPerson.x + 3.5 - (getHeli().x + 16); harness.set([deltaX > 0.5 ? 'ArrowRight' : deltaX < -0.5 ? 'ArrowLeft' : '', getHeli().y < 118 ? 'ArrowDown' : '']); harness.tick(); }
  assert(getHeli().y + 16 < alleyPerson.y - 10, 'senza verricello si arriva al naufrago del vicolo: il passo non serve');
  harness.keyDown('KeyE');
  for (let i = 0; i < 600 && alleyPerson.state === 'float'; i++) { const deltaX = alleyPerson.x + 3.5 - (getHeli().x + 16); harness.set([deltaX > 0.5 ? 'ArrowRight' : deltaX < -0.5 ? 'ArrowLeft' : '']); harness.tick(); }
  harness.keyUp('KeyE');
  assert(alleyPerson.state === 'hang', 'col verricello non lo aggancia: ' + alleyPerson.state);
  harness.keyDown('KeyQ'); harness.hold(['ArrowUp'], 80); harness.keyUp('KeyQ');
  harness.tap('KeyX'); deliver(); harness.tick(120);
  assert(game.state === 'done' && game.result === 'win', 'addestramento non completato: ' + game.state + ' ' + level.saved);
  const frames = game.frame;
  harness.tap('Enter'); harness.tick(2);
  assert(!game.L.tutorial && game.L.n === 1, 'dopo l\'addestramento non parte il livello 1');
  const secondHarness = boot(); secondHarness.tick(5); secondHarness.tap('Enter'); secondHarness.tick(2); secondHarness.tap('KeyN'); secondHarness.tick(2);
  assert(!secondHarness.game.L.tutorial && secondHarness.game.L.n === 1, 'N non salta');
  const thirdHarness = boot({ search: '?livello=3' }); thirdHarness.tick(5); thirdHarness.tap('Enter'); thirdHarness.tick(2);
  assert(!thirdHarness.game.L.tutorial && thirdHarness.game.L.n === 3, '?livello=3 passa dall\'addestramento');
  return 'completato dal pilota automatico in ' + frames + ' frame';
});

test('virata: frenare non gira l\'elicottero; si gira volando nella nuova direzione o a terra', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  const heli = game.heli;
  place(harness, 400, 50, 1.8, 0); heli.face = 1;
  let turnedAt = null;
  for (let i = 0; i < 120 && turnedAt === null; i++) { harness.set(['ArrowLeft', heli.vy > 0 ? 'ArrowUp' : '']); harness.tick(); if (heli.face < 0) turnedAt = heli.vx; }
  assert(turnedAt !== null && turnedAt < 0, 'girato mentre andava ancora avanti (vx ' + turnedAt + ')');
  const secondHarness = boot(); const secondGame = secondHarness.play(secondHarness.hook.levelSpec(1));
  place(secondHarness, 400, 50); secondGame.heli.face = 1;
  secondHarness.tap('ArrowLeft');
  assert(secondGame.heli.face === 1, 'un colpetto di freccia lo gira');
  const landing = dropOnto(3, 14, 0, []);
  const initialFace = landing.G.heli.face;
  landing.g.hold([initialFace > 0 ? 'ArrowLeft' : 'ArrowRight'], 1);
  assert(landing.G.heli.face === -initialFace && landing.G.heli.ground, 'a terra non si gira subito');
  return 'girato a vx ' + turnedAt.toFixed(2);
});

test('scaletta impigliata in un cavo: tiene l\'elicottero, lo strappo fa perdere la presa, riavvolta si libera', () => {
  const setup = () => {
    const harness = boot(); const game = harness.play(harness.hook.levelSpec(3));
    const cable = game.L.haz.find(candidate => candidate.cable);
    const cableMiddleX = Math.round((cable.x0 + cable.x1) / 2), pointIndex = cable.pts.findIndex((value, index) => index % 2 === 0 && value === cableMiddleX), cableY = cable.pts[pointIndex + 1];
    place(harness, cableMiddleX - 16, cableY - 45); harness.tap('KeyX');
    harness.keyDown('KeyE'); harness.tick(90); harness.keyUp('KeyE');
    return { g: harness, G: game, h: game.heli };
  };
  const { g: harness, G: game, h: heli } = setup();
  assert(heli.snag, 'la scaletta non si impiglia');
  const snag = heli.snag;
  harness.hold(['ArrowUp'], 40);
  const distance = Math.hypot(heli.x + 16 - snag.x, heli.y + 12 - snag.y);
  assert(heli.snag === snag && distance <= snag.len + 1.5, "l'elicottero si allontana oltre la corda: " + distance.toFixed(1) + ' > ' + snag.len.toFixed(1));
  harness.hold(['ArrowUp'], 40);
  assert(heli.snag !== snag, 'lo strappo non libera la scaletta');
  harness.hold([], 20);
  harness.keyDown('KeyQ'); harness.hold([], 90); harness.keyUp('KeyQ');
  assert(!heli.snag, 'riavvolta non si libera');
  const secondScenario = setup();
  const person = secondScenario.G.L.people.find(candidate => candidate.state === 'stand' && !candidate.injured);
  secondScenario.h.att.push(person); person.state = 'hang'; person.ht = 0; person.sw = person.swv = 0;
  let lost = false;
  for (let i = 0; i < 200 && !lost; i++) { secondScenario.g.set(['ArrowUp']); secondScenario.g.tick(); if (person.state !== 'hang') lost = true; }
  assert(lost, 'tirando forte chi è appeso non molla');
});

test('salvagente: il naufrago lo prende e ha più tempo; si ricaricano in zona sicura', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  const heli = game.heli, buoyConfig = harness.hook.CONFIG.buoy;
  const person = game.L.people.find(candidate => candidate.state === 'float');
  person.timer = person.tmax = 1000;
  place(harness, person.x - 12, person.y - 70); harness.tap('KeyX'); harness.tick(2);
  game.heli.x = person.x - 12 - 20; harness.tap('KeyZ');
  assert(heli.buoys === buoyConfig.count - 1, 'salvagente non lanciato');
  let framesUntilCatch = 0;
  for (; framesUntilCatch < 400 && !person.buoy; framesUntilCatch++) harness.tick();
  assert(person.buoy, 'il naufrago non prende il salvagente');
  assert(person.timer > 1000 + buoyConfig.extra - 500, 'nessun tempo in più: ' + person.timer);
  for (let i = 0; i < 5; i++) harness.tap('KeyZ');
  assert(heli.buoys === 0 && /FINITI/.test(game.msg), 'non finiscono: ' + heli.buoys);
  const safeZone = game.L.safe; place(harness, safeZone.x + safeZone.w / 2 - 16, safeZone.y - 20); harness.tick(10);
  assert(heli.buoys === buoyConfig.count, 'non si ricaricano in zona sicura: ' + heli.buoys);
  return 'preso dopo ' + framesUntilCatch + ' frame';
});

test('secchio: si riempie in acqua, pesa, spegne le fiamme; solo negli incendi', () => {
  const seaHarness = boot(); const seaGame = seaHarness.play(seaHarness.hook.levelSpec(1));
  place(seaHarness, 300, 60); seaHarness.tap('KeyC');
  assert(!seaGame.heli.bucket.on && /INCENDI/.test(seaGame.msg), 'secchio usabile fuori dagli incendi');
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(4));
  const heli = game.heli;
  place(harness, 550 - 16, 150); harness.tap('KeyX'); harness.tap('KeyC');
  assert(heli.bucket.on, 'secchio non calato');
  const emptySpeedLimit = harness.hook.maxSpeed();
  for (let i = 0; i < 300 && heli.bucket.fill < 1; i++) { harness.set(['ArrowDown']); harness.tick(); }
  assert(heli.bucket.fill === 1, 'non si riempie: ' + heli.bucket.fill);
  assert(harness.hook.maxSpeed() < emptySpeedLimit * 0.85, 'pieno non pesa');
  const fire = game.L.fires.find(candidateFire => game.L.people.some(person => person.state === 'stand' && person.tmax > 0 && Math.abs(person.on.y - candidateFire.y) < 2 && candidateFire.x >= person.on.x && candidateFire.x < person.on.x + person.on.w));
  const roofPerson = game.L.people.find(person => person.state === 'stand' && person.tmax > 0 && Math.abs(person.on.y - fire.y) < 2 && fire.x >= person.on.x && fire.x < person.on.x + person.on.w);
  let dumps = 0;
  for (let dumpAttempt = 0; dumpAttempt < 4 && game.L.fires.includes(fire); dumpAttempt++) {
    heli.bucket.fill = 1;
    place(harness, fire.x + fire.w / 2 - 16, fire.y - 60); harness.tick(20);
    harness.tap('KeyC'); dumps++; harness.tick(70);
  }
  assert(!game.L.fires.includes(fire), 'il fuoco non si spegne');
  assert(roofPerson.tmax === 0 && roofPerson.state === 'stand', 'chi era sul tetto ha ancora il tempo contato');
  harness.tap('KeyC');
  assert(!heli.bucket.on, 'a vuoto il secchio non si ritira');
  return 'spento con ' + dumps + ' secchi';
});

test('soccorritore: scaletta calata sul tetto del ferito, lo porta su da solo', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(3));
  const injuredPerson = game.L.people.find(candidate => candidate.injured), rooftop = injuredPerson.on;
  const hoverX = injuredPerson.x + 30 < rooftop.x + rooftop.w - 4 ? injuredPerson.x + 30 : injuredPerson.x - 30;
  place(harness, hoverX - 16, rooftop.y - 50); harness.tap('KeyX');
  harness.keyDown('KeyE');
  const seen = new Set();
  for (let i = 0; i < 900 && injuredPerson.state !== 'aboard'; i++) { game.heli.x = hoverX - 16; game.heli.vx = 0; harness.tick(); seen.add(game.heli.crew.st); }
  harness.keyUp('KeyE');
  assert(injuredPerson.state === 'aboard', 'il ferito non è arrivato a bordo: ' + injuredPerson.state + ' ' + [...seen]);
  for (const phase of ['down', 'walk', 'return', 'up']) assert(seen.has(phase), 'fase mancante: ' + phase);
  assert(game.heli.crew.st === 'idle', 'soccorritore non rientrato');
  return [...seen].join(' > ');
});

test('persone diverse: bambino leggero, anziano lento, cane fuori dal conteggio con bonus', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(3));
  const kinds = game.L.people.map(person => person.kind);
  assert(kinds.includes('kid') && kinds.includes('old') && kinds.filter(kind => kind === 'dog').length === 1, 'tipi: ' + kinds);
  assert(game.L.total === game.L.people.length - 1, 'il cane conta nel totale');
  assert(!boot().play(boot().hook.levelSpec(1)).L.people.some(person => person.kind !== 'adult'), 'il livello 1 ha già persone diverse');
  const heli = game.heli, kid = game.L.people.find(person => person.kind === 'kid'), adult = game.L.people.find(person => person.kind === 'adult' && !person.injured);
  heli.cab.push(kid); const kidSpeedLimit = harness.hook.maxSpeed(); heli.cab.length = 0;
  heli.cab.push(adult); const adultSpeedLimit = harness.hook.maxSpeed(); heli.cab.length = 0;
  assert(kidSpeedLimit > adultSpeedLimit, 'il bambino pesa come un adulto');
  const dog = game.L.people.find(person => person.kind === 'dog');
  const safeZone = game.L.safe; game.score = 0;
  dog.state = 'aboard'; heli.cab.push(dog);
  place(harness, safeZone.x + safeZone.w / 2 - 16, safeZone.y - 20); harness.tick(5);
  assert(dog.state === 'saved' && game.L.saved === 0 && game.score === harness.hook.CONFIG.score.dog, 'cane: saved ' + game.L.saved + ' punti ' + game.score);
  const run = kind => {
    const landing = dropOnto(3, 14, 0, []), runner = landing.G.L.people.find(person => person.kind === kind), landingSolid = landing.G.heli.ground;
    Object.assign(runner, { state: 'stand', on: landingSolid, rel: landingSolid.w - 9, x: landingSolid.x + landingSolid.w - 9, y: landingSolid.y - 8, timer: 0, tmax: 0, injured: false });
    landing.G.heli.face = 1;
    const startRelativeX = runner.rel; landing.g.tick(10); return Math.abs(runner.rel - startRelativeX) / 10;
  };
  const oldSpeed = run('old'), adultSpeed = run('adult');
  assert(oldSpeed < adultSpeed * 0.7, 'anziano non più lento: ' + oldSpeed + ' vs ' + adultSpeed);
});

test('nebbia dal livello 10 e luna piena: si vede meno lontano, la luna piena schiarisce la notte', () => {
  const gameHook = boot().hook;
  assert(gameHook.levelSpec(10).fog && gameHook.levelSpec(12).fog && !gameHook.levelSpec(9).fog && !gameHook.levelSpec(11).fog && !gameHook.levelSpec(4).fog, 'livelli con nebbia sbagliati');
  const count = (levelNumber, search, prepare) => {
    const harness = boot({ search }); const game = harness.play(harness.hook.levelSpec(levelNumber));
    if (prepare) prepare(game);
    place(harness, 400, 40); harness.tap('KeyX'); harness.tick(20); game.camX = 250;
    harness.shot(os.devNull);
    assert(harness.stats.badColor === 0 && harness.stats.nonInt === 0, 'palette');
    let near = 0, far = 0;
    for (let y = 100; y < 204; y++) for (let x = 0; x < 384; x++) if (harness.buf[y * 384 + x] === 255) { if (Math.abs(x - 166) < 50) near++; else far++; }
    return { near, far };
  };
  const clear = count(2, '', game => { game.L.fog = false; }), fog = count(2, '?nebbia');
  assert(fog.far < clear.far * 0.6, 'la nebbia non nasconde il lontano: ' + fog.far + ' vs ' + clear.far);
  const dark = count(1, '?notte', game => { game.L.moonFull = false; }), full = count(1, '?notte', game => { game.L.moonFull = true; });
  assert(full.far > dark.far * 1.2, 'la luna piena non schiarisce: ' + full.far + ' vs ' + dark.far);
  return 'lontano: sereno ' + clear.far + ', nebbia ' + fog.far + ' | notte ' + dark.far + ', luna piena ' + full.far;
});

test('fine livello: vittoria sopra la metà, stelle 1/2/3', () => {
  const run = (saved, total) => {
    const harness = boot(); const game = harness.play(harness.hook.levelSpec(3));
    game.L.people = game.L.people.filter(person => person.kind !== 'dog');
    game.L.people.forEach((person, index) => {
      person.on = game.L.safe; person.rel = 2;
      if (index < saved) { person.state = 'saved'; game.L.saved++; } else if (index < total) { person.state = 'dead'; person.deadMode = 'lie'; game.L.dead++; } else { person.state = 'saved'; game.L.saved++; }
    });
    game.L.total = game.L.people.length;
    harness.hold(['ArrowUp'], 100);
    return game;
  };
  const peopleCount = boot().play(boot().hook.levelSpec(3)).L.total;
  let finishedGame = run(peopleCount, peopleCount); assert(finishedGame.result === 'win' && finishedGame.stars === 3, '6/6: ' + finishedGame.result + ' ' + finishedGame.stars);
  finishedGame = run(peopleCount - 1, peopleCount); assert(finishedGame.result === 'win' && finishedGame.stars === 2, '5/6: ' + finishedGame.stars);
  finishedGame = run(peopleCount - 2, peopleCount); assert(finishedGame.result === 'win' && finishedGame.stars === 1, '4/6: ' + finishedGame.stars);
  finishedGame = run(peopleCount - 3, peopleCount); assert(finishedGame.result === 'fail' && finishedGame.stars === 0, '3/6: ' + finishedGame.result);
});

test('carico: con 8 persone la velocità massima è il 30%', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  place(harness, 300, 50);
  for (let i = 0; i < 8; i++) game.heli.cab.push({ state: 'aboard' });
  let peakSpeed = 0;
  for (let i = 0; i < 400; i++) { harness.set(i % 3 ? ['ArrowRight', 'ArrowUp'] : ['ArrowRight']); harness.tick(); peakSpeed = Math.max(peakSpeed, Math.hypot(game.heli.vx, game.heli.vy)); }
  assert(Math.abs(peakSpeed / harness.hook.CONFIG.phys.maxV - 0.3) < 0.005, 'rapporto ' + peakSpeed / harness.hook.CONFIG.phys.maxV);
});

test('detriti: non attraversano i piloni sottili (sotto-passi)', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(2));
  const leg = game.L.solids.find(solid => solid.kind === 'leg');
  harness.hook.addParticle({ t: 'chunk', x: leg.x - 12, y: leg.y + 20, w: 4, h: 4, pts: [0, 0], vx: 3.9, vy: 0, life: 600, lethal: true });
  const chunk = game.parts[game.parts.length - 1];
  for (let i = 0; i < 6; i++) harness.tick();
  assert(chunk.x + chunk.w <= leg.x + 0.01, 'il detrito è passato attraverso: x=' + chunk.x + ' leg=' + leg.x);
});

test('salvataggi completi col pilota automatico in ogni scenario', () => {
  const summaries = [];
  for (const [levelNumber, mode] of [[1, 'float'], [2, 'float'], [3, 'roof'], [4, 'roof']]) {
    const harness = boot(); const game = harness.play(harness.hook.levelSpec(levelNumber));
    const safeZone = game.L.safe;
    const cruise = 26;
    for (let rescueIndex = 0; rescueIndex < 2; rescueIndex++) {
      const person = game.L.people.find(candidate => (mode === 'float' ? candidate.state === 'float' : candidate.state === 'stand' && !candidate.on.safe && candidate.on.kind === 'bld'));
      if (!person) break;
      goTo(harness, () => game.heli.x + 16, () => cruise, 2);
      if (mode === 'float') {
        goTo(harness, () => person.x + 3.5, () => cruise, 2);
        harness.tap('KeyX');
        for (let i = 0; i < 3000 && person.state === 'float' && game.state === 'play'; i++) {
          const heli = game.heli, deltaX = (person.x + 3.5) - (heli.x + 16), deltaY = (person.y + 4) - (heli.y + 16);
          harness.set([deltaX > 1 ? 'ArrowRight' : deltaX < -1 ? 'ArrowLeft' : '', deltaY > 0 ? 'ArrowDown' : deltaY < -2 ? 'ArrowUp' : '']);
          harness.tick();
        }
        harness.tap('KeyX');
      } else {
        const rooftop = person.on, obstacleSpans = [];
        for (const hazard of game.L.haz) if (hazard.x1 >= rooftop.x - 2 && hazard.x0 <= rooftop.x + rooftop.w + 2 && hazard.y1 >= rooftop.y - 30 && hazard.y0 < rooftop.y) obstacleSpans.push([hazard.x0 - 2, hazard.x1 + 2]);
        for (const fire of game.L.fires) if (fire.x < rooftop.x + rooftop.w && fire.x + fire.w > rooftop.x) obstacleSpans.push([fire.x - 2, fire.x + fire.w + 2]);
        let landingX = rooftop.x + rooftop.w / 2, bestClearance = -1e9;
        for (let candidateX = rooftop.x + 17; candidateX <= rooftop.x + rooftop.w - 17; candidateX++) {
          let clearance = 1e9;
          for (const obstacleSpan of obstacleSpans) clearance = Math.min(clearance, Math.max(obstacleSpan[0] - (candidateX + 16), (candidateX - 16) - obstacleSpan[1]));
          if (clearance > bestClearance) { bestClearance = clearance; landingX = candidateX; }
        }
        goTo(harness, () => landingX, () => cruise, 1.5);
        goTo(harness, () => landingX, () => rooftop.y - 14, 0.8);
        for (let i = 0; i < 900 && !game.heli.ground && game.heli.state === 'fly'; i++) flyTo(harness, landingX, rooftop.y + 2, 0.45);
        harness.hold([], 300);
      }
      goTo(harness, () => game.heli.x + 16, () => cruise, 2);
      goTo(harness, () => safeZone.x + safeZone.w / 2, () => cruise, 1.6);
      for (let i = 0; i < 1500 && game.heli.state === 'fly' && game.state === 'play' && harness.hook.loadCount() > 0; i++) flyTo(harness, safeZone.x + safeZone.w / 2, safeZone.y - 6, 0.5);
      if (game.state !== 'play') break;
    }
    if (levelNumber === 3) harness.shot(shotPath('rescue_lv3'));
    assert(game.L.saved >= 1, 'lv' + levelNumber + ': nessun salvataggio (' + game.state + ' ' + game.overReason + ')');
    summaries.push('lv' + levelNumber + ' salvati ' + game.L.saved + ' (morti ' + game.L.dead + ')');
  }
  return summaries.join(', ');
});

test('replay deterministico: stessa partita, frame per frame', () => {
  const summaries = [];
  for (const levelNumber of [2, 4]) {
    const harness = boot(); const game = harness.play(harness.hook.levelSpec(levelNumber));
    const keysPolicy = randomKeysPolicy(levelNumber * 7);
    for (let i = 0; i < 2400 && game.state === 'play'; i++) {
      if (i % 9 === 0) harness.set(keysPolicy(i));
      if (i === 300 || i === 900) harness.tap('KeyX');
      if (i === 1500) harness.tap('Space');
      if (i === 400) harness.keyDown('KeyE');
      if (i === 470) harness.keyUp('KeyE');
      if (i === 600) harness.tap('KeyC');
      if (i === 650) harness.tap('KeyZ');
      if (i === 1000) harness.keyDown('KeyQ');
      if (i === 1030) harness.keyUp('KeyQ');
      harness.tick();
    }
    harness.set([]);
    const takeSnapshot = () => JSON.stringify({
      x: game.heli.x, y: game.heli.y, vx: game.heli.vx, st: game.heli.state, fuel: game.heli.fuel, hp: game.heli.hp, lad: game.heli.ladLen, winch: game.heli.winch, buoys: game.heli.buoys, bucket: game.heli.bucket.on + ':' + game.heli.bucket.fill, fires: game.L.fires.map(fire => fire.hp.toFixed(3)).join(),
      saved: game.L.saved, dead: game.L.dead, score: game.score, parts: game.parts.length,
      people: game.L.people.map(person => person.state + ':' + person.x.toFixed(3)).join(','),
    });
    const endedBy = game.state;
    // pause a still-running game here: the replay must end at exactly this point
    if (game.state === 'play') game.state = 'pause';
    const recordedSnapshot = takeSnapshot();
    const frames = game.rec.frames.length;
    harness.hook.startReplay();
    assert(game.state === 'replay', 'replay non avviato');
    let replayTicks = 0;
    while (game.state === 'replay' && game.replay.i < frames && replayTicks < 100000) { harness.tick(); replayTicks++; }
    const replaySnapshot = takeSnapshot();
    assert(recordedSnapshot === replaySnapshot, 'lv' + levelNumber + ': il replay diverge\n' + recordedSnapshot.slice(0, 300) + '\n' + replaySnapshot.slice(0, 300));
    summaries.push('lv' + levelNumber + ' ' + frames + ' frame (' + endedBy + ')');
  }
  return summaries.join(', ');
});

test('gamepad: levetta analogica, pulsante X per lo stabilizzatore', () => {
  const gamepad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
  const harness = boot({ gamepad: gamepad }); const game = harness.play(harness.hook.levelSpec(1));
  place(harness, 300, 80);
  gamepad.axes = [0.5, -0.7];
  harness.tick(40);
  assert(game.heli.vx > 0.3 && game.heli.vy < 0, 'la levetta non muove: vx=' + game.heli.vx + ' vy=' + game.heli.vy);
  gamepad.buttons[2].pressed = true; harness.tick(); gamepad.buttons[2].pressed = false; harness.tick();
  assert(game.heli.stab, 'pulsante X non attiva lo stabilizzatore');
  gamepad.axes = [0.3, 0];
  harness.tick(120);
  assert(game.heli.vx > 0.05 && game.heli.vx < 0.3 * 0.432 + 0.02, 'analogico non proporzionale in stab: vx=' + game.heli.vx);
  return 'vx con levetta al 30% in stab: ' + game.heli.vx.toFixed(3);
});

test('naufraghi: si staccano da muri e bordi e tornano raggiungibili dalla scaletta', () => {
  const summaries = [];
  const cases = [
    [1, game => { const rock = game.L.solids.find(solid => solid.kind === 'rock'); return { x: rock.x - 8, wall: rock }; }, 'scoglio'],
    [1, game => { const hull = game.L.solids.find(solid => solid.kind === 'hull'); return { x: hull.x + hull.w + 1, wall: hull }; }, 'relitto'],
    [1, () => ({ x: 2, wall: null }), 'bordo sinistro'],
    [4, game => { const groundSolid = game.L.solids.find(solid => solid.kind === 'ground' && solid.x > 0); return { x: groundSolid.x - 8, wall: groundSolid }; }, 'parete della voragine'],
  ];
  for (const [levelNumber, findSpot, caseName] of cases) {
    const harness = boot(); const game = harness.play(harness.hook.levelSpec(levelNumber));
    const person = game.L.people.find(candidate => candidate.state === 'float');
    const spot = findSpot(game);
    person.x = spot.x; person.timer = person.tmax = 99999;
    place(harness, spot.x > 400 ? 150 : 600, 20);
    harness.tap('KeyX');
    harness.tick(360);
    const personCenterX = person.x + 3.5;
    const gap = spot.wall ? Math.min(Math.abs(personCenterX - spot.wall.x), Math.abs(personCenterX - (spot.wall.x + spot.wall.w))) : personCenterX;
    assert(person.state === 'float' && gap >= 16, caseName + ': ancora a ' + gap.toFixed(1) + ' px (serve >= 16 per la scaletta)');
    summaries.push(caseName + ' ' + gap.toFixed(0) + 'px');
  }
  return summaries.join(', ');
});

test('spinta del rotore: nulla sotto la scaletta, laterale fuori centro, con schizzi', () => {
  const drift = offset => {
    const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
    const person = game.L.people.find(candidate => candidate.state === 'float');
    person.timer = person.tmax = 99999; person.drift = 0;
    person.x = 560;
    harness.tap('KeyX');
    place(harness, person.x + 3.5 - 16 - offset, 0);
    game.heli.y = game.heli.py = game.L.water.base - 30;
    const startX = person.x, initialParticleCount = game.parts.length;
    let sprays = 0;
    for (let i = 0; i < 90; i++) { harness.tick(); sprays += game.parts.filter(particle => particle.t === 'px' && particle.drop).length; }
    return { dx: person.x - startX, sprays };
  };
  const centre = drift(0), side = drift(10), other = drift(-10);
  assert(Math.abs(centre.dx) < 1.5, 'sotto la scaletta si è spostato di ' + centre.dx.toFixed(2));
  // heli to the left (offset +10) pushes the person right, and vice versa
  assert(side.dx > 3 && other.dx < -3, 'fuori centro non viene spinto via: ' + side.dx.toFixed(2) + ' / ' + other.dx.toFixed(2));
  assert(side.sprays > 0, 'nessuno schizzo');
  return 'spostamento in 1.5 s: al centro ' + centre.dx.toFixed(2) + ' px, a 10 px dal centro ' + side.dx.toFixed(1) + ' px';
});

test('scaletta mobile: resta indietro accelerando, va avanti frenando, la hitbox la segue', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(1));
  place(harness, 300, 60);
  let minLad = 0, maxLad = 0;
  for (let i = 0; i < 30; i++) { harness.set(['ArrowRight', game.heli.vy > 0 ? 'ArrowUp' : '']); harness.tick(); minLad = Math.min(minLad, game.heli.lad); }
  for (let i = 0; i < 30; i++) { harness.set(['ArrowLeft', game.heli.vy > 0 ? 'ArrowUp' : '']); harness.tick(); maxLad = Math.max(maxLad, game.heli.lad); }
  assert(minLad < -1.5, 'accelerando la scaletta non resta indietro: ' + minLad.toFixed(2));
  assert(maxLad > 1.5, 'frenando la scaletta non va avanti: ' + maxLad.toFixed(2));
  game.heli.lad = 3;
  const ladderRect = harness.hook.heliRects(game.heli, game.heli.face).ladder;
  assert(ladderRect.x === Math.round(game.heli.x) + 14 + 3 || Math.abs(ladderRect.x - (game.heli.x + 17)) < 1, 'hitbox della scaletta ferma');
  const secondHarness = boot(); const secondGame = secondHarness.play(secondHarness.hook.levelSpec(3));
  const rooftop = roofWithoutObstacles(secondGame);
  place(secondHarness, rooftop.x - 21, rooftop.y - 13.5);
  secondGame.heli.lad = 4; secondGame.heli.ladV = 1;
  secondHarness.hold(secondGame.heli.vy > 0 ? ['ArrowUp'] : [], 20);
  assert(secondGame.heli.hp === 3 && secondGame.heli.state === 'fly', 'la scaletta contro il muro ha danneggiato: hp=' + secondGame.heli.hp);
  return 'oscillazione ' + minLad.toFixed(1) + ' / +' + maxLad.toFixed(1) + ' px';
});

test('fuoco: sotto il rotore si abbassa e si allarga, il fumo scuote l\'elicottero', () => {
  const harness = boot(); const game = harness.play(harness.hook.levelSpec(4));
  const fire = game.L.fires[0];
  const before = { ...(() => { const size = { h: fire.h * 0.8, w: fire.w }; return size; })() };
  harness.tap('KeyX');
  place(harness, fire.x + fire.w / 2 - 16, fire.y - 16 - 22);
  const velocitiesX = [];
  for (let i = 0; i < 90; i++) { harness.tick(); velocitiesX.push(game.heli.vx); }
  const pressed = game.L.fires[0].press;
  const flameHeight = fire.h * (1 - 0.55 * pressed) * 0.8;
  assert(pressed > 0.4, 'fiamme non schiacciate: press=' + pressed.toFixed(2));
  assert(flameHeight < before.h * 0.8, 'fiamma non più bassa');
  assert(game.heli.turb > 0.3, 'nessuna turbolenza nel fumo: ' + game.heli.turb);
  const jitter = velocitiesX.reduce((total, velocity, index) => index ? total + Math.abs(velocity - velocitiesX[index - 1]) : 0, 0) / velocitiesX.length;
  const secondHarness = boot(); const secondGame = secondHarness.play(secondHarness.hook.levelSpec(4));
  secondHarness.tap('KeyX'); place(secondHarness, 520, 60);
  const calmVelocitiesX = []; for (let i = 0; i < 90; i++) { secondHarness.tick(); calmVelocitiesX.push(secondGame.heli.vx); }
  const calm = calmVelocitiesX.reduce((total, velocity, index) => index ? total + Math.abs(velocity - calmVelocitiesX[index - 1]) : 0, 0) / calmVelocitiesX.length;
  assert(jitter > calm * 3, 'scossoni nel fumo non maggiori: ' + jitter + ' vs ' + calm);
  harness.shot(shotPath('fire_press'));
  return 'fiamma alta ' + (100 * (1 - 0.55 * pressed)).toFixed(0) + '%, scossoni x' + (jitter / Math.max(calm, 1e-6)).toFixed(0);
});

test('screenshot: titolo, intro, missione compiuta, game over', () => {
  const harness = boot();
  harness.tick(40); harness.shot(shotPath('title'));
  harness.tap('Enter'); harness.tick(10); harness.shot(shotPath('intro'));
  const game = harness.game;
  game.state = 'play';
  game.L.people.forEach(person => { person.state = 'saved'; person.on = game.L.safe; person.rel = 2; game.L.saved++; });
  harness.hold(['ArrowUp'], 100);
  harness.tick(40); harness.shot(shotPath('done'));
  const secondHarness = boot(); const secondGame = secondHarness.play(secondHarness.hook.levelSpec(4));
  const rooftop = roofWithoutObstacles(secondGame);
  place(secondHarness, rooftop.x - 40, rooftop.y + 10, 2.4, 0);
  secondHarness.hold(['ArrowRight'], 20); secondHarness.shot(shotPath('boom'));
  secondHarness.tick(130); secondHarness.shot(shotPath('over'));
});

test('build: HTML, CSS e JS minificati (niente commenti, indentazione né marcatori dei file)', () => {
  const page = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'dist', 'last-rung.html'), 'utf8');
  const css = page.match(/<style>([\s\S]*?)<\/style>/)[1];
  assert(!page.includes('<!--'), 'commenti HTML rimasti');
  assert(!page.includes('// ====='), 'marcatori dei file rimasti nel bundle');
  assert(!css.includes('/*') && !css.includes('\n'), 'CSS non minificato');
  assert(page.split('\n').length <= 2, 'la pagina ha ' + page.split('\n').length + ' righe: HTML o JS non minificato');
  return (page.length / 1024).toFixed(1) + ' KB';
});

(async () => {
  const filter = process.argv[2];
  let pass = 0, fail = 0;
  for (const entry of tests) {
    if (filter && !entry.name.includes(filter)) continue;
    const startTime = Date.now();
    try {
      const info = await entry.fn();
      pass++;
      console.log('  OK   ' + entry.name + (info ? '  [' + info + ']' : '') + '  (' + (Date.now() - startTime) + ' ms)');
    } catch (error) {
      fail++;
      console.log('  FAIL ' + entry.name + '\n       ' + (error.stack || error).toString().split('\n').slice(0, 4).join('\n       '));
    }
  }
  console.log('\n' + pass + ' ok, ' + fail + ' falliti');
  process.exit(fail ? 1 : 0);
})();
