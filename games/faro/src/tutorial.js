// games/faro/src/tutorial.js
'use strict';
// Step conditions read the game state, so doing things in a different order never blocks progress.
const allShipsResolved = () => game.L.ships.every(ship => ship.state === 'sink' || ship.state === 'dock');

const TUTORIAL = [
  { kb: 'SINISTRA / DESTRA: ALZA E ABBASSA IL FASCIO', touch: 'LEVETTA A SINISTRA / DESTRA: ALZA E ABBASSA IL FASCIO', pad: 'LEVETTA A SINISTRA / DESTRA: ALZA E ABBASSA IL FASCIO',
    done: () => game.used.move },
  { kb: 'SU: FASCIO STRETTO E LUNGO. GIU: LARGO E CORTO', touch: 'LEVETTA IN SU: STRETTO E LUNGO. IN GIU: LARGO E CORTO', pad: 'LEVETTA IN SU: STRETTO E LUNGO. IN GIU: LARGO E CORTO',
    done: () => game.used.spread },
  { text: 'PUNTA IL FASCIO SU UNA NAVE: SEGUE LA CORSIA DOVE PUNTA IL CENTRO', done: () => game.L.ships.some(ship => ship.following) || allShipsResolved() },
  { kb: 'SPAZIO: LA SIRENA RALLENTA LE NAVI', touch: 'SIRENA: RALLENTA LE NAVI', pad: 'B: LA SIRENA RALLENTA LE NAVI',
    done: () => game.used.siren || allShipsResolved() },
  { kb: 'X: IL LAMPO ILLUMINA TUTTO (CONSUMA OLIO). GLI SCOGLI SI VEDONO SOLO CON LA LUCE', touch: 'LAMPO: ILLUMINA TUTTO (CONSUMA OLIO). GLI SCOGLI SI VEDONO SOLO CON LA LUCE', pad: 'X: IL LAMPO ILLUMINA TUTTO (CONSUMA OLIO). GLI SCOGLI SI VEDONO SOLO CON LA LUCE',
    done: () => game.used.flash || allShipsResolved() },
  { text: 'PORTA LE NAVI AL PORTO SENZA FARLE URTARE GLI SCOGLI', done: allShipsResolved },
];

const tutorialText = Steps.text;

function updateTutorial() {
  if (game.tut) Steps.update(game.tut, TUTORIAL, () => Sfx.play('ui'));
}
