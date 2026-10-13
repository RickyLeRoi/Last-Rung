// games/formicaio/src/tutorial.js
'use strict';
// Step conditions read the game state, so doing things in a different order never blocks progress.
const hasNewChamber = () => game.L.chambers.some(chamber => chamber.type !== 'queen' && chamber.complete);

const TUTORIAL = [
  { kb: 'FRECCE: MUOVI IL CURSORE', touch: 'LEVETTA: MUOVI IL CURSORE', pad: 'LEVETTA: MUOVI IL CURSORE',
    done: () => game.used.move },
  { kb: 'TIENI SPAZIO E SCENDI NELLA TERRA: LE FORMICHE SCAVANO LA PISTA', touch: 'TIENI TRACCIA E SCENDI NELLA TERRA: LE FORMICHE SCAVANO', pad: 'TIENI A E SCENDI NELLA TERRA: LE FORMICHE SCAVANO',
    done: () => game.L.dug >= 4 },
  { kb: 'X IN FONDO ALLA GALLERIA: SEGNA UNA NURSERY', touch: 'CAMERA IN FONDO ALLA GALLERIA: SEGNA UNA NURSERY', pad: 'X IN FONDO ALLA GALLERIA: SEGNA UNA NURSERY',
    done: () => hasNewChamber() || game.L.delivered > 0 },
  { kb: "LE RACCOGLITRICI CERCANO IL CIBO DA SOLE. UNA PISTA SULL'ERBA (SPAZIO) LE MANDA DOVE VUOI",
    touch: "LE RACCOGLITRICI CERCANO IL CIBO DA SOLE. UNA PISTA SULL'ERBA LE MANDA DOVE VUOI",
    pad: "LE RACCOGLITRICI CERCANO IL CIBO DA SOLE. UNA PISTA SULL'ERBA (A) LE MANDA DOVE VUOI",
    done: () => game.L.delivered > 0 },
  { text: 'IL CIBO DIVENTA UOVA, LARVE E OPERAIE: ARRIVA A ' + CONFIG.target.tutorial, done: () => game.ants.length >= game.L.target },
];

const tutorialText = Steps.text;

function updateTutorial() {
  if (game.tut) Steps.update(game.tut, TUTORIAL, () => Sfx.play('ui'));
}
