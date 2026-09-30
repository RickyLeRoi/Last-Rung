'use strict';
// Step conditions read the game state, so doing things in a different order never blocks progress.
const tutorialPerson = tag => game.L.people.find(person => person.tut === tag);
const tutorialGone = tag => { const person = tutorialPerson(tag); return !person || person.state === 'saved' || person.state === 'dead'; };
const tutorialTaken = tag => { const person = tutorialPerson(tag); return !person || !['float', 'stand', 'fall'].includes(person.state); };

const TUTORIAL = [
  { kb: 'FRECCIA SU: DECOLLA', touch: 'LEVETTA IN SU: DECOLLA', pad: 'RT O LEVETTA IN SU: DECOLLA',
    done: () => !game.heli.ground || tutorialTaken('float') },
  { kb: 'X: STABILIZZATORE. CON LUI ANDARE PIANO E\' FACILE', touch: 'STAB: STABILIZZATORE. CON LUI ANDARE PIANO E\' FACILE', pad: 'X: STABILIZZATORE. CON LUI ANDARE PIANO E\' FACILE',
    done: () => game.heli.stab || tutorialTaken('float') },
  { text: 'VAI DAL NAUFRAGO > E SCENDI PIANO: LA SCALETTA LO AGGANCIA', done: () => tutorialTaken('float') },
  { text: "PORTALO VICINO ALL'ELIPORTO (H): E' LA ZONA SICURA", done: () => tutorialGone('float') },
  { text: 'ATTERRA PIANO SUL TETTO DEL SUPERSTITE: SALIRA\' A BORDO', done: () => tutorialTaken('roof') },
  { text: 'RIPORTALO ALLA ZONA SICURA', done: () => tutorialGone('roof') },
  { kb: 'VICOLO STRETTO: CALA LA SCALETTA CON E (Q LA RIAVVOLGE)', touch: 'VICOLO STRETTO: CALA LA SCALETTA CON ▼ (▲ LA RIAVVOLGE)', pad: 'VICOLO STRETTO: CALA LA SCALETTA (LEVETTA DESTRA GIU\')',
    done: () => tutorialTaken('alley') },
  { text: "TIRALO FUORI DALL'ACQUA E PORTALO IN SALVO", done: () => tutorialGone('alley') },
];

const tutorialText = step => step.text || hint(step.kb, step.touch, step.pad);

function updateTutorial() {
  const tutorialState = game.tut;
  if (!tutorialState) return;
  while (tutorialState.step < TUTORIAL.length && TUTORIAL[tutorialState.step].done()) { tutorialState.step++; Sfx.play('ui'); }
}
