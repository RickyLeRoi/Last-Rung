# Valanga

Soccorso alpino dopo una valanga: trova i sepolti con l'ARTVA, localizzali con la sonda e liberali con la pala prima che finisca la loro aria. Pixel art bianco su nero, HTML5 Canvas + JavaScript puro. Fa parte di [One Bit Games](../../README.md) e usa il [motore comune](../../engine/README.md). **Prototipo (MVP):** completo e testato, con i golden generati.

## Giocare

Genera i giochi con `npm install && npm run build` e apri `dist/valanga.html` (doppio clic), oppure online su Pages: `https://rickyleroi.github.io/one-bit-games/valanga/`.

| Azione | Tastiera | Gamepad | Touch |
|---|---|---|---|
| Cammina | Sinistra / destra (A / D) | Levetta o croce orizzontale | Levetta virtuale |
| Arrampicati fuori da una buca | Su (W) | Levetta o croce in su | Levetta in su |
| Scava in basso (tieni premuto) | Spazio o Z | A | SCAVA |
| Scava di lato | Spazio con una direzione | A con la levetta di lato | SCAVA con la levetta di lato |
| Sonda | X | X o B | SONDA |
| Pausa / ricomincia | P / R | Start / Back | II / R |
| Replay dell'ultimo tentativo | V | Y | REPLAY |
| Sfida del giorno (dal titolo) | G | Y | SFIDA DEL GIORNO |
| Audio on/off | M | - | AUDIO |
| Salta l'addestramento | N | Y | SALTA |

Parametri URL: `?livello=N` parte dal livello N (senza addestramento), `?debug` espone lo stato in `window.__valanga`.

## Regole

- Il pendio scende da sinistra a destra ed e' piu' largo e piu' alto dello schermo: la neve si scava, la roccia no.
- **ARTVA:** segnale del sepolto piu' vicino entro 9 metri: bip sempre piu' rapido e acuto, vibrazione su tre livelli, barra e freccia nella barra in basso; sotto i 2,5 metri compare la distanza in cifre. Nella bufera la barra e' disturbata.
- **Sonda:** un secondo di animazione; se sotto i piedi, entro la sua profondita' e circa una spanna di lato, c'e' un sepolto, lascia un segno sulla neve.
- **Pala:** tenuta premuta scava in verticale; con una direzione scava di lato, e la neve sopra la galleria **crolla** (cade una riga per frame). La neve che crolla su un sepolto lo uccide: si scava dall'alto. Il sepolto e' libero quando la pala lo raggiunge dall'alto.
- **Aria:** ogni sepolto ha 90 secondi (meno nei giri successivi, mai sotto 60). A zero e' perso.
- **Valanghe secondarie** (dal secondo giro e nella bufera): una crepa avvisa, poi la neve scivola sopra di te; nella zona segnata vieni travolto (3 secondi a terra; dal terzo giro sepolto: game over).
- Vinci se ne liberi piu' della meta'; stelle: 1 = piu' della meta', 2 = almeno il 75%, 3 = tutti (bonus 100 / 250 punti).
- Livelli: tre scenari a rotazione (giorno sereno, bufera con vento e neve fitta, notte con la lampada frontale); a ogni giro piu' sepolti (da 2 a 5), piu' profondi, piu' massi. La sfida del giorno e' un livello deciso dalla data.

## Cartella del gioco

```
game.json         id, titolo, manifest, icona (sprite icon), globale di debug __valanga
index.html        pagina di sviluppo (blocco build:js) e comandi touch
src/
  config.js       tutti i numeri (pendio, neve, soccorritore, pala, sonda, ARTVA, valanghe, sfondo)
  state.js        stato della partita
  sprites.js      soccorritore, sepolto, stelle, icona
  sfx.js          effetti e loop del vento
  bindings.js     tasti, pad e assi (configura l'Input dell'engine)
  backdrop.js     catene montuose in parallasse
  level.js        scenari, livelli, sfida del giorno, generazione di pendio, massi e sepolti
  ground.js       terreno a maschera: superficie, scavo, crolli, particelle
  rescuer.js      movimento, pala, sonda, camera
  artva.js        segnale, aria dei sepolti, esiti
  avalanche.js    valanghe secondarie
  env.js          vento e nevicata
  tutorial.js     addestramento (passi con engine/core/steps.js)
  render.js       cielo, pendio, soccorritore, notte, HUD e schermate
  main.js         simulazione, hook del flusso, avvio
test/
  helpers.js      boot() del gioco
  snapshot.js     stato di simulazione per gli hash
  run.js          regole del gioco (segnale, sonda, pala, crolli, aria, valanghe, replay)
  autopilot.js    il soccorritore automatico
  levels.js       livelli 1-9 vinti dal soccorritore (almeno 10 su 12) e almeno 15 sfide su 20
  scenarios.js    scenari condivisi tra golden Node e golden nel browser
  golden.js       snapshot di stato, frame e Rng (baseline in golden/: valanga.json e valanga.browser.json)
  e2e/            suite nel browser: keyboard, touch
```

I golden non si rigenerano per far passare un test: `node games/valanga/test/golden.js --update` solo dopo una modifica voluta (vedi [GUIDELINES.md](../../GUIDELINES.md)).

### Determinismo

La simulazione usa solo `Rng` (ri-seminato a ogni tentativo) e il passo fisso di 1/60 s; gli input sono registrati e il replay ricostruisce la stessa partita. Il generatore dei livelli usa un proprio `mulberry32`. Anche il disegno e' deterministico (scossone e disturbo dell'ARTVA dipendono dal numero di frame), cosi' i golden nel browser coincidono con quelli di Node.
