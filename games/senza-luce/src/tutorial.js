// games/senza-luce/src/tutorial.js
'use strict';
// Step conditions read the game state, so doing things in a different order never blocks progress.
const hasArrived = () => game.L.arrived;

const TUTORIAL = [
  { kb: 'SINISTRA: VERSO LA GROTTA. DESTRA: INDIETRO', touch: 'LEVETTA A SINISTRA: VERSO LA GROTTA', pad: 'LEVETTA A SINISTRA: VERSO LA GROTTA',
    done: () => game.used.move },
  { kb: 'SU / GIU: CAMBIA CORSIA', touch: 'LEVETTA IN SU / IN GIU: CAMBIA CORSIA', pad: 'LEVETTA IN SU / IN GIU: CAMBIA CORSIA',
    done: () => game.used.lane || hasArrived() },
  { text: "STAI AL BUIO: SE UNA LUCE TI ILLUMINA SALE L'ALLARME", done: () => game.seenT > 0 || game.boat.x < game.L.towers[0].x || hasArrived() },
  { kb: 'X: SPEGNI IL MOTORE. SILENZIO, MA LA CORRENTE TI PORTA AL LARGO', touch: 'SPEGNI: MOTORE SPENTO. SILENZIO, MA LA CORRENTE TI PORTA AL LARGO', pad: 'X: SPEGNI IL MOTORE. SILENZIO, MA LA CORRENTE TI PORTA AL LARGO',
    done: () => game.used.engine || hasArrived() },
  { kb: 'SPAZIO: FUMOGENO. LA LUCE NON LO ATTRAVERSA', touch: 'FUMO: FUMOGENO. LA LUCE NON LO ATTRAVERSA', pad: 'B: FUMOGENO. LA LUCE NON LO ATTRAVERSA',
    done: () => game.used.smoke || hasArrived() },
  { text: 'RECUPERA LA CASSA ED ENTRA NELLA GROTTA, A SINISTRA', done: hasArrived },
];

const tutorialText = Steps.text;

function updateTutorial() {
  if (game.tut) Steps.update(game.tut, TUTORIAL, () => Sfx.play('ui'));
}
