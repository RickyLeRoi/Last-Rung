// games/sabbia/src/tutorial.js
'use strict';
// Step conditions read the game state, so doing things in a different order never blocks progress.
const TUTORIAL = [
  { kb: 'FRECCE: MUOVI IL PENNELLO', touch: 'LEVETTA: MUOVI IL PENNELLO', pad: 'LEVETTA: MUOVI IL PENNELLO', done: () => game.used.move },
  { kb: 'TIENI SPAZIO: VERSA LA SABBIA', touch: 'TIENI DISEGNA: VERSA LA SABBIA', pad: 'TIENI A: VERSA LA SABBIA', done: () => game.used.paint },
  { kb: 'X: CAMBIA MATERIALE (Z TORNA INDIETRO)', touch: 'MATERIALE: CAMBIA MATERIALE', pad: 'X: CAMBIA MATERIALE (B TORNA INDIETRO)', done: () => game.used.select },
  { text: "FUOCO SOTTO LA PENTOLA: IL FERRO SI SCALDA E L'ACQUA DIVENTA VAPORE", done: () => game.L.world.counts[MATERIAL.steam] > 0 },
];

const tutorialText = Steps.text;

function updateTutorial() {
  if (game.tut) Steps.update(game.tut, TUTORIAL, () => Sfx.play('ui'));
}
