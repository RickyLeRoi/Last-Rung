// games/valanga/src/tutorial.js
'use strict';
// Step conditions read the game state, so doing things in a different order never blocks progress.
const anySaved = () => game.L.saved > 0;

const TUTORIAL = [
  { kb: 'SINISTRA / DESTRA: CAMMINA. IN DISCESA SI VA PIU VELOCI', touch: 'LEVETTA: CAMMINA. IN DISCESA SI VA PIU VELOCI', pad: 'LEVETTA: CAMMINA. IN DISCESA SI VA PIU VELOCI',
    done: () => game.used.move },
  { text: "L'ARTVA BIPPA PIU VELOCE QUANDO TI AVVICINI: SEGUI LA FRECCIA", done: () => (game.signal && game.signal.strength > 0.6) || anySaved() },
  { kb: 'X: SONDA. TROVA IL SEPOLTO SOTTO I TUOI PIEDI', touch: 'SONDA: TROVA IL SEPOLTO SOTTO I TUOI PIEDI', pad: 'X: SONDA. TROVA IL SEPOLTO SOTTO I TUOI PIEDI',
    done: () => game.L.victims.some(victim => victim.found) || anySaved() },
  { kb: 'SPAZIO (TIENI PREMUTO): SCAVA IN BASSO. DI LATO LA NEVE CROLLA', touch: 'SCAVA (TIENI PREMUTO): IN BASSO. DI LATO LA NEVE CROLLA', pad: 'A (TIENI PREMUTO): SCAVA IN BASSO. DI LATO LA NEVE CROLLA',
    done: () => game.used.dig || anySaved() },
  { kb: 'LIBERA IL SEPOLTO. SU: ARRAMPICATI FUORI DALLA BUCA', touch: 'LIBERA IL SEPOLTO. LEVETTA IN SU: ESCI DALLA BUCA', pad: 'LIBERA IL SEPOLTO. IN SU: ESCI DALLA BUCA',
    done: anySaved },
];

const tutorialText = Steps.text;

function updateTutorial() {
  if (game.tut) Steps.update(game.tut, TUTORIAL, () => Sfx.play('ui'));
}
