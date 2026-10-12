# Il Faro

Sei il guardiano di un faro: di notte guida le navi al porto con la luce, evitando gli scogli che nel buio non si vedono. Pixel art bianco su nero, HTML5 Canvas + JavaScript puro. Fa parte di [One Bit Games](../../README.md) e usa il [motore comune](../../engine/README.md). **Prototipo (MVP):** completo e testato, con i golden generati; il bilanciamento va ancora affinato giocandolo.

## Giocare

Genera i giochi con `npm install && npm run build` e apri `dist/faro.html` (doppio clic), oppure online su Pages: `https://rickyleroi.github.io/one-bit-games/faro/`.

| Azione | Tastiera | Gamepad | Touch |
|---|---|---|---|
| Alza / abbassa il fascio | Sinistra / destra (A / D) | Levetta o croce orizzontale | Levetta virtuale, orizzontale |
| Fascio stretto e lungo / largo e corto | Su / giu (W / S) | Levetta o croce verticale | Levetta virtuale, verticale |
| Sirena (rallenta le navi) | Spazio | B | SIRENA |
| Lampo (illumina tutto, consuma olio) | X | X o RB | LAMPO |
| Pausa / ricomincia | P / R | Start / Back | II / R |
| Replay dell'ultimo tentativo | V | Y | REPLAY |
| Sfida del giorno (dal titolo) | G | Y | SFIDA DEL GIORNO |
| Audio on/off | M | - | AUDIO |
| Salta l'addestramento | N | Y | SALTA |

Parametri URL: `?livello=N` parte dal livello N (senza addestramento), `?debug` espone lo stato in `window.__faro`.

## Regole

- Le navi arrivano da destra e vanno verso il porto (a sinistra, accanto al faro). Il mare ha **tre corsie** (profondita'); gli scogli stanno ognuno in una corsia e sono sempre distanziati, quindi c'e' sempre una corsia libera.
- **Il fascio** e' un cono dal faro. Si vede solo cio' che illumina: il fascio, il porto, il lampo e i fulmini. Gli scogli compaiono quando li illumini e poi restano (attenuati) sulla mappa; uno scoglio che affonda una nave viene rivelato. Le navi hanno una lanterna sempre visibile, lo scafo si vede solo alla luce.
- **Le navi seguono il centro del fascio:** una nave vicina alla linea centrale (entro circa una corsia e mezza) va verso la corsia in cui quella linea incrocia il mare alla sua distanza, e una freccia sopra la lanterna mostra dove sta andando. Una nave lontana dal fascio mantiene la sua corsia. Per mandare una nave in una corsia punta il centro del fascio su quella corsia, all'altezza della nave. Navi a distanze diverse vedono il centro in corsie diverse: la linea sale verso il mare man mano che si allontana dal faro.
- **Stretto e lungo** arriva lontano (ma illumina poco), **largo e corto** illumina molto ma arriva vicino. Con la nebbia la portata cala.
- **Olio:** il fascio lo consuma (di piu' se e' stretto), il lampo costa 18. A zero la lampada si spegne e si riaccende a 15. Si ricarica velocemente quando in mare non c'e' nessuna nave (tra un'ondata e l'altra) e molto piano altrimenti.
- **Sirena:** per 2,5 secondi tutte le navi rallentano al 35%; poi 6 secondi di ricarica.
- **Lampo:** per un attimo illumina tutto il mare e rivela tutti gli scogli.
- **Tempesta:** vento che accelera o rallenta le navi, pioggia e fulmini che per un istante rivelano gli scogli. **Nebbia:** portata ridotta e scogli piu' vicini.
- Una nave che urta uno scoglio nella sua corsia affonda (+0 punti). Una nave al porto vale 100 punti.
- Il livello finisce quando tutte le navi sono al porto o affondate. Vinto se ne attracchi piu' della meta'; si perde subito se ne affondano tante da non poter piu' vincere. Stelle: 1 = piu' della meta', 2 = almeno il 75%, 3 = nessuna affondata (bonus 100 / 250 punti).
- Livelli: tre scenari a rotazione (notte calma, tempesta, nebbia); a ogni giro piu' navi (fino a 6) e piu' scogli (da 2 fino a 5). La sfida del giorno e' un livello deciso dalla data.

## Cartella del gioco

```
game.json         id, titolo, manifest, icona (sprite icon), globale di debug __faro
index.html        pagina di sviluppo (blocco build:js) e comandi touch
src/
  config.js       tutti i numeri (fascio, olio, mare, navi, punteggi)
  state.js        stato della partita
  sprites.js      nave, scoglio, stelle, icona
  sfx.js          effetti e loop del mare/vento
  bindings.js     tasti, pad e assi (configura l'Input dell'engine)
  water.js        wrapper dell'acqua e splash
  particles.js    wrapper delle particelle
  level.js        scenari, livelli, sfida del giorno, generazione di scogli e navi
  lamp.js         fascio, olio, sirena, lampo, scogli rivelati
  ships.js        navi: corsie, illuminazione, scogli, porto, sconfitta
  env.js          vento, pioggia, fulmini
  tutorial.js     addestramento (passi con engine/core/steps.js)
  render.js       mare, faro, porto, notte, HUD e schermate
  main.js         simulazione, hook del flusso, avvio
test/
  helpers.js      boot() del gioco
  snapshot.js     stato di simulazione per gli hash
  run.js          regole del gioco (corsie, scogli nascosti, olio, sirena, esiti, replay, smoke)
  autopilot.js    il guardiano automatico: prova ogni inclinazione del fascio e sceglie la migliore
  levels.js       livelli 1-9 vinti dal guardiano (almeno 10 su 12) e almeno 15 sfide su 20 (~2 minuti)
  scenarios.js    scenari condivisi tra golden Node e golden nel browser
  golden.js       snapshot di stato, frame e Rng (baseline in golden/: faro.json e faro.browser.json)
  e2e/            suite nel browser: keyboard, touch
```

I golden non si rigenerano per far passare un test: `node games/faro/test/golden.js --update` solo dopo una modifica voluta (vedi [GUIDELINES.md](../../GUIDELINES.md)).

### Determinismo

Come in Last Rung: la simulazione usa solo `Rng` (ri-seminato a ogni tentativo) e il passo fisso di 1/60 s; gli input sono registrati e il replay ricostruisce la stessa partita. Il generatore dei livelli usa un proprio `mulberry32`, mai il `Rng` della simulazione.
