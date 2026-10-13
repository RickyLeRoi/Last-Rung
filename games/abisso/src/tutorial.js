// games/abisso/src/tutorial.js
'use strict';
// Step conditions read the game state, so doing things in a different order never blocks progress.
const TUTORIAL = [
  { kb: 'FRECCE: PROPULSORI. IL SOMMERGIBILE HA INERZIA', touch: 'LEVETTA: PROPULSORI. IL SOMMERGIBILE HA INERZIA', pad: 'LEVETTA: PROPULSORI. IL SOMMERGIBILE HA INERZIA',
    done: () => game.used.move },
  { kb: 'SPAZIO: SONAR. RIVELA PARETI E SUB INTORNO', touch: 'SONAR: RIVELA PARETI E SUB INTORNO', pad: 'A: SONAR. RIVELA PARETI E SUB INTORNO',
    done: () => game.used.sonar || game.L.divers.some(diver => diver.found) },
  { kb: 'X: FARO ACCESO O SPENTO. SPENTO CONSUMA MENO', touch: 'FARO: ACCESO O SPENTO. SPENTO CONSUMA MENO', pad: 'X: FARO ACCESO O SPENTO. SPENTO CONSUMA MENO',
    done: () => game.used.lamp },
  { text: 'SCENDI PIANO FINO AL SUB: SALE A BORDO SE TI FERMI ACCANTO', done: () => game.L.divers.some(diver => diver.state !== 'waiting') },
  { text: 'RIPORTALO SOTTO LA NAVE, IN SUPERFICIE', done: () => game.L.saved > 0 },
];

const tutorialText = Steps.text;

function updateTutorial() {
  if (game.tut) Steps.update(game.tut, TUTORIAL, () => Sfx.play('ui'));
}
