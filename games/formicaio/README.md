# Formicaio

Sei la colonia: guida le formiche con le piste di feromone, scava il nido e fallo crescere prima dell'inverno. Pixel art bianco su nero, HTML5 Canvas + JavaScript puro. Fa parte di [One Bit Games](../../README.md) e usa il [motore comune](../../engine/README.md). **Prototipo (MVP):** completo e testato, con i golden generati.

## Giocare

Genera i giochi con `npm install && npm run build` e apri `dist/formicaio.html` (doppio clic), oppure online su Pages: `https://rickyleroi.github.io/one-bit-games/formicaio/`.

| Azione | Tastiera | Gamepad | Touch |
|---|---|---|---|
| Muovi il cursore | Frecce (WASD) | Levetta o croce | Levetta virtuale |
| Traccia una pista (tieni premuto) | Spazio | A | TRACCIA |
| Segna una camera / cambiale tipo | X | X | CAMERA |
| Richiamo (tutte dentro) acceso/spento | Z | B | RICHIAMA |
| Tappa una galleria (o togli il tappo) | C | RB | TAPPA (solo con la pioggia) |
| Pausa / ricomincia | P / R | Start / Back | II / R |
| Replay dell'ultimo tentativo | V | Y | REPLAY |
| Sfida del giorno (dal titolo) | G | Y | SFIDA DEL GIORNO |
| Audio on/off | M | - | AUDIO |
| Salta l'addestramento | N | Y | SALTA |

Parametri URL: `?livello=N` parte dal livello N (senza addestramento), `?debug` espone lo stato in `window.__formicaio`.

## Regole

- Sezione di un prato: sopra l'erba e il cielo, sotto la terra con sassi, radici e sacche di sabbia. La regina parte in una piccola camera sotto l'ingresso con 4 operaie.
- **Due caste.** Le **operaie** scavano e tappano. Le **raccoglitrici** (il 60% della colonia) escono da sole, esplorano l'erba, sentono il cibo vicino e lo portano al nido, lasciando una pista che le altre seguono.
- **Piste.** Sotto terra una pista e' un ordine di scavo: le operaie scavano lungo la pista e portano la terra sul cumulo intorno all'ingresso. Sull'erba una pista non rivela il cibo: e' la strada che le formiche preferiscono (un passo sulla pista costa un terzo di un passo sull'erba aperta) e le esploratrici la seguono verso l'esterno. Le piste sull'erba svaniscono in 30 secondi (15 nella siccita') se le raccoglitrici non le ripassano col cibo.
- **Camere.** Una camera segnata si scava come una pista; finita, una **nursery** ospita 8 tra uova, larve e pupe (la camera della regina 3), una **dispensa** alza le scorte di 30.
- **Crescita.** Con cibo in scorta e posto in nursery la regina depone; uovo (6 s), larva (10 s, mangia una volta), pupa (6 s), operaia. La regina tiene da parte il cibo per le larve che devono ancora mangiare.
- **Ragno:** gira sull'erba; una formica sola entro la sua portata viene mangiata (poi il ragno resta sazio 30 secondi), due o piu' formiche vicine lo fanno scappare. Sotto terra non arriva.
- **Pioggia:** un tuono avvisa 6 secondi prima; l'acqua entra da ogni buco aperto e scende nelle gallerie. Covata e formiche sotto l'acqua muoiono, la regina con l'acqua alla testa annega (game over). Il richiamo fa rientrare le raccoglitrici; il tappo, portato dalle operaie con la terra del cumulo, ferma l'acqua. L'acqua ferma filtra piano nella terra.
- **Sabbia:** scavando sotto una sacca di sabbia, la sabbia frana nella galleria; chi ci resta sotto viene spinto fuori o si perde.
- **Esiti.** Vinci se a fine stagione hai le operaie richieste; il livello finisce prima se arrivi a una volta e mezza l'obiettivo. Stelle: 1 = obiettivo, 2 = obiettivo senza covata persa, 3 = una volta e mezza l'obiettivo. Si perde se la regina muore o la colonia si estingue.
- Livelli: tre scenari a rotazione (prato, pioggia, siccita'); a ogni giro obiettivo +2, stagione piu' corta, temporali piu' fitti, dal quarto giro un secondo ragno. La sfida del giorno e' un livello deciso dalla data.

## Cartella del gioco

```
game.json         id, titolo, manifest, icona (sprite icon), globale di debug __formicaio
index.html        pagina di sviluppo (blocco build:js) e comandi touch
src/
  config.js       tutti i numeri (mondo, terreno, piste, esploratrici, formiche, covata, cibo, ragno, pioggia, punteggi)
  state.js        stato della partita
  sprites.js      formica, regina, covata, cibo, ragno, stelle, icona
  sfx.js          effetti e loop della pioggia
  bindings.js     tasti, pad e assi (configura l'Input dell'engine)
  backdrop.js     colline e cespugli in parallasse
  level.js        scenari, livelli, sfida del giorno, generazione del terreno, cibo, ragni e temporali
  grid.js         griglia delle formiche e mappe di distanza pesate
  soil.js         scavo, cumulo, tappi, sabbia che frana, acqua che scorre
  orders.js       cursore, piste, camere, tappi, richiamo, feromone
  colony.js       regina, covata, scorte, cibo nuovo
  ants.js         caste, compiti, esploratrici, movimento
  threats.js      ragni e temporali
  tutorial.js     addestramento (passi con engine/core/steps.js)
  render.js       cielo, terreno, piste, camere, formiche, HUD e schermate
  main.js         simulazione, hook del flusso, avvio
test/
  helpers.js      boot() del gioco
  snapshot.js     stato di simulazione per gli hash
  run.js          regole del gioco (scavo, esploratrici, piste, camere, covata, ragno, pioggia, sabbia, richiamo, esiti, replay)
  autopilot.js    la colonia automatica (camere, piste verso il cibo visto, tappi prima della pioggia)
  levels.js       livelli 1-9 vinti (almeno 10 su 12) e almeno 15 sfide su 20 (~30 s)
  scenarios.js    scenari condivisi tra golden Node e golden nel browser
  golden.js       snapshot di stato, frame e Rng (baseline in golden/: formicaio.json e formicaio.browser.json)
  e2e/            suite nel browser: keyboard, touch
```

I golden non si rigenerano per far passare un test: `node games/formicaio/test/golden.js --update` solo dopo una modifica voluta (vedi [GUIDELINES.md](../../GUIDELINES.md)).

### Determinismo

La simulazione usa solo `Rng` (ri-seminato a ogni tentativo, che decide solo i pareggi tra celle ugualmente buone e le scelte delle esploratrici) e il passo fisso di 1/60 s; gli input sono registrati e il replay ricostruisce la stessa partita. Il generatore dei livelli e lo sfondo usano un proprio `mulberry32`.
