# Sabbia

Un laboratorio di materiali che cadono, scorrono, bruciano ed evaporano, alla Powder Toy, piu' sei sfide da risolvere con pochi materiali. Pixel art bianco su nero, HTML5 Canvas + JavaScript puro. Fa parte di [One Bit Games](../../README.md) e usa il [motore comune](../../engine/README.md). **Prototipo (MVP):** completo e testato, con i golden generati.

## Giocare

Genera i giochi con `npm install && npm run build` e apri `dist/sabbia.html` (doppio clic), oppure online su Pages: `https://rickyleroi.github.io/one-bit-games/sabbia/`.

| Azione | Tastiera | Gamepad | Touch |
|---|---|---|---|
| Muovi il pennello | Frecce (WASD) | Levetta o croce | Levetta virtuale |
| Dipingi (tieni premuto) | Spazio | A | DISEGNA |
| Materiale successivo / precedente | X / Z | X / B | MATERIALE |
| Dimensione del pennello | C | RB | PENNELLO |
| Laboratorio (dal titolo) | L | X | LABORATORIO |
| Pausa / ricomincia (nel laboratorio: svuota) | P / R | Start / Back | II / R |
| Replay dell'ultimo tentativo | V | Y | REPLAY |
| Sfida del giorno (dal titolo) | G | Y | SFIDA DEL GIORNO |
| Audio on/off | M | - | AUDIO |
| Salta l'addestramento | N | Y | SALTA |

Parametri URL: `?livello=N` parte dalla sfida N, `?laboratorio` apre il laboratorio, `?debug` espone lo stato in `window.__sabbia`.

## Materiali

Ogni cella (2 x 2 pixel) ha un materiale e una temperatura. Il calore passa tra celle vicine secondo la conducibilita' (il ferro conduce molto, l'aria pochissimo) e la capacita' termica (legno e acqua si scaldano piano).

| Materiale | Come si muove | Cosa fa |
|---|---|---|
| Ferro | fermo | porta il calore; l'acido lo scioglie molto piano |
| Legno | fermo | a 260 gradi o toccato dal fuoco (raramente) brucia sul posto a lungo |
| Erba | ferma | a 140 gradi o toccata dal fuoco (facilmente) brucia in fretta e propaga |
| Sabbia | cade e si ammucchia | affonda nell'acqua |
| Fuoco | sale tremolando | scalda tutto cio' che tocca; morendo lascia aria calda |
| Acqua | cade e si allarga | a 100 gradi diventa vapore; spegne il fuoco diventando vapore |
| Vapore | sale | raffreddandosi (o toccando aria fredda) torna acqua; in cima al cielo se ne va |
| Acido | cade e si allarga | scioglie erba, legno, sabbia e (piano) ferro, consumandosi; nell'acqua si diluisce |
| Aria calda | sale | scalda; raffreddandosi sparisce |
| Aria fredda | scende | raffredda, spegne il fuoco, condensa il vapore; scaldandosi sparisce |

Esempi: una pentola di ferro con l'acqua dentro e il fuoco sotto fa vapore finche' non e' vuota; un prato toccato dal fuoco brucia tutto; il fumo caldo che scorre sotto una trave di legno puo' accendere quello che c'e' in fondo.

## Sfide

Sei sfide a rotazione: RIEMPI LA VASCA (sabbia su una rampa), BOLLITURA (svuota la pentola col fuoco), PRATO (brucia tutti i prati, salva la casa di legno), ACIDO (apri il serbatoio di legno e riempi la vasca), INCENDIO (spegni il fuoco prima che bruci la cassa), NUVOLA (porta il vapore in cima al cielo). Ognuna ha i suoi materiali, contati, una zona in cui si puo' dipingere (tratteggiata), un tempo e un obiettivo nella barra in basso. Stelle in base al materiale avanzato: 3 = almeno la meta', 2 = almeno un quinto, 1 = il resto. A ogni giro meno materiale e meno tempo. La sfida del giorno e' una sfida decisa dalla data. Il laboratorio non ha limiti e non finisce.

## Cartella del gioco

```
game.json         id, titolo, manifest, icona (sprite icon), globale di debug __sabbia
index.html        pagina di sviluppo (blocco build:js) e comandi touch
src/
  config.js       tutti i numeri (griglia, calore, materiali e reazioni, sfide, punteggi)
  materials.js    identificativi e tabelle per materiale
  sim.js          l'automa: reazioni, movimento, calore
  challenges.js   laboratorio, addestramento, sfide (scene, materiali, zone, obiettivi)
  brush.js        pennello, zona, materiale contato, gomma
  state.js        stato della partita
  sprites.js      stelle, icona
  sfx.js          effetti e loop di fuoco e vapore
  bindings.js     tasti, pad e assi (configura l'Input dell'engine)
  tutorial.js     addestramento (passi con engine/core/steps.js)
  render.js       materiali con il loro retino, zona, pennello, HUD e schermate
  main.js         simulazione, hook del flusso, avvio
test/
  helpers.js      boot() del gioco
  snapshot.js     stato di simulazione per gli hash (tutta la griglia)
  run.js          una prova per ogni interazione, pennello, sfide, replay, prestazioni
  autopilot.js    un copione per sfida, giocato da tastiera
  levels.js       sfide 1-9 vinte (almeno 10 su 12) e almeno 15 sfide del giorno su 20 (~15 s)
  scenarios.js    scenari condivisi tra golden Node e golden nel browser
  golden.js       snapshot di stato, frame e Rng (baseline in golden/: sabbia.json e sabbia.browser.json)
  e2e/            suite nel browser: keyboard, touch
```

I golden non si rigenerano per far passare un test: `node games/sabbia/test/golden.js --update` solo dopo una modifica voluta (vedi [GUIDELINES.md](../../GUIDELINES.md)).

### Determinismo

L'automa usa solo `Rng` (ri-seminato a ogni tentativo) in un ordine fisso: prima tutte le reazioni, poi tutti i movimenti, dal basso, col lato alternato a ogni frame; gli input sono registrati e il replay ricostruisce la stessa partita. Le scene delle sfide non usano numeri casuali. Anche il tremolio del fuoco dipende dal numero di frame, cosi' i golden nel browser coincidono con quelli di Node.
