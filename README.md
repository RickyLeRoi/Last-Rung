# Last Rung

Gioco di soccorso in elicottero, pixel art bianco su nero. HTML5 Canvas + JavaScript puro, zero dipendenze. Si gioca nel browser (desktop e telefono) e, una volta installato, anche offline.

Rilasciato con licenza [MIT](LICENSE).

## Giocare

`dist/` non è versionato: prima genera il gioco con `npm install && node build.js`, poi apri `dist/last-rung.html` nel browser (doppio clic). Funziona con tastiera, gamepad e touch. In alternativa si gioca online su GitHub Pages (vedi [Pubblicare](#pubblicare)).

Per installarlo sul telefono come app (anche offline), pubblica la cartella `dist/web/` su un sito https: contiene lo stesso gioco più manifest, icone e service worker. Dal browser del telefono poi "Aggiungi a schermata Home". Dettagli, e pubblicazione automatica su GitHub Pages, in [Pubblicare](#pubblicare).

| Azione | Tastiera | Gamepad | Touch |
|---|---|---|---|
| Spinta e direzione | Frecce / WASD | Levetta sinistra o croce, RT spinta dosabile | Levetta virtuale (metà sinistra) |
| Stabilizzatore on/off | X | X o RB | STAB |
| Verricello: riavvolgi / allunga la scaletta | Q / E | Levetta destra, oppure LB / LT | ▲ / ▼ (tenere premuto) |
| Sgancia la scaletta | Spazio | B | SGANCIA |
| Lancia un salvagente | Z | A | SALVAGENTE |
| Secchio d'acqua: cala / svuota / ritira (solo incendi) | C | Y | SECCHIO |
| Pausa / ricomincia | P / R | Start / Back | II / R |
| Replay dell'ultimo tentativo | V | Y | REPLAY |
| Sfida del giorno (dal titolo) | G | Y | SFIDA DEL GIORNO |
| Audio on/off | M | — | AUDIO |
| Salta l'addestramento | N | Y | SALTA |
| Lampi dei fulmini pieni / ridotti | L | — | LAMPI (nel titolo) |

Parametri URL: `?livello=N` parte dal livello N (senza addestramento), `?notte` rende notturni tutti i livelli, `?nebbia` li mette tutti nella nebbia, `?lampi=0` parte con i lampi ridotti, `?debug` espone lo stato in `window.__eli`. I lampi partono ridotti anche se il sistema chiede meno animazioni.

## Regole

- La prima partita parte dall'addestramento (decollo, stabilizzatore, aggancio, atterraggio, verricello). Si può saltare in qualunque momento.
- Anche il rotore di coda uccide (costa 150 punti). I superstiti su un tetto non lo attraversano: aspettano davanti alla coda, quindi conviene atterrare con la scaletta verso di loro.
- Chi muore schizza sangue rosso (unica eccezione al bianco e nero): macchia tetti e pareti degli edifici e, se l'ha ucciso l'elicottero, resta sulla parte dell'elicottero che l'ha colpito (pale, coda, cabina, scaletta).
- Chi è già appeso alla scaletta fa da "corda": il secondo recuperato si aggancia ai piedi del primo, non alla scaletta.
- Chi è appeso e viene trascinato in acqua perde subito la presa, e con lui chi gli sta appeso sotto (dopo l'aggancio c'è un secondo per tirarlo fuori).
- Verricello: la scaletta si allunga fino a 40 px. Si appoggia ai tetti senza attraversarli; più è lunga, più oscilla e più tempo serve per salire.
- Feriti (croce sopra la testa, uno per livello dal livello 2): non si aggrappano alla scaletta. Bisogna atterrare sul loro tetto e aspettare che arrivino zoppicando.
- Panico: quando la barra del tempo di chi è su un tetto in fiamme finisce, corre al bordo lontano dal fuoco, esita un attimo e si butta. Se la scaletta è a portata ci salta sopra.
- Notte (dal secondo giro, sul mare calmo e sulla città allagata): tutto è al buio tranne il faro, che punta dove vai, l'eliporto, le fiamme e le esplosioni. Chi aspetta segnala con una luce.
- Se la coda blocca i superstiti, a terra basta premere la direzione verso di loro per girare l'elicottero.
- Virata: frenare con la freccia opposta non gira l'elicottero. Si gira quando vola già nella nuova direzione, tenendo premuta la freccia un attimo, o subito se è a terra.
- Scaletta impigliata: se la scaletta calata tocca un cavo o un traliccio resta impigliata e l'elicottero non può allontanarsi oltre la corda. Tirando forte chi è appeso perde la presa; senza nessuno appeso uno strappo la libera. Riavvolgendola si libera subito.
- Salvagenti: 3 a bordo, si ricaricano in zona sicura. Il naufrago nelle vicinanze ci nuota incontro e, afferrato, ha mezzo minuto in più.
- Secchio d'acqua (solo negli incendi): si riempie immergendolo, pieno pesa come due persone e intanto la scaletta non si usa. Svuotato sulle fiamme le abbassa fino a spegnerle (+50); spento l'ultimo fuoco di un tetto, chi è lì non ha più il tempo contato.
- Soccorritore: se la scaletta calata col verricello si appoggia sul tetto di un ferito, scende da solo, lo prende in spalla e risale. Bisogna restare fermi: se la scaletta si stacca dal tetto, lui aspetta.
- Persone diverse (dal livello 2): il bambino pesa metà, l'anziano corre a metà velocità, il cane non conta nel totale ma salvarlo vale 150 punti.
- Nebbia dal livello 10 (quando non è notte): limpido solo vicino all'elicottero. Di notte stelle e luna restano visibili; con la luna piena si vede un po' di più.
- Vibrazione sui telefoni e sui gamepad che la supportano (danni, esplosioni, agganci, strappi).
- Aggancio con la scaletta solo sotto il 20% della velocità massima; sopra il 50% la scaletta travolge. Le pale uccidono sempre.
- La scaletta è di corda: oscilla con accelerazioni, frenate e vento, e l'elicottero si inclina in avanti quando accelera.
- La spinta del rotore allontana chi è in acqua, con schizzi. È nulla proprio sotto la scaletta e massima a metà pala. Chi ha la scaletta sopra la testa ci nuota incontro.
- I naufraghi si tengono lontani da muri, scogli e bordi: restano sempre raggiungibili.
- Il rotore schiaccia le fiamme (più basse ma più larghe); nel fumo l'elicottero viene scosso.
- Atterrando piano su un tetto, i superstiti di quel tetto (o di una superficie collegata) corrono a bordo. Massimo 8 persone; con 8 a bordo la velocità massima è il 30%.
- Si salvano portando le persone vicino alla zona sicura. Lì si fanno anche rifornimento e riparazioni.
- Carburante: lo stabilizzatore consuma di più. A secco il motore si spegne.
- Scafo: 3 punti. Urti e atterraggi duri costano un punto, quelli violenti fanno esplodere.
- Il livello finisce quando non resta nessuno da salvare. Vinto se ne salvi più della metà. Stelle: 1 = più della metà, 2 = almeno il 75%, 3 = nessun morto.
- Ogni morte causata da te (pale, travolgimento, detriti, cadute dalla scaletta) costa 150 punti.

## Struttura

```
index.html        pagina di sviluppo: carica i sorgenti separati
build.js          unisce e minifica tutto in dist/last-rung.html (un solo file) e prepara dist/web/ (app installabile)
package.json      solo dipendenze di build (terser)
dist/             output della build, minificato; non versionato (ignorato da git), si genera con node build.js
LICENSE           licenza MIT
.github/workflows/pages.yml   build, test e pubblicazione di dist/web/ su GitHub Pages
engine/           parti generiche, riusabili da altri giochi (in costruzione, vedi PLAN.md)
  core/util.js    matematica, RNG deterministico
  gfx/sprite.js   creazione e contorno degli sprite
  gfx/gfx.js      canvas, primitive a pixel interi, font bitmap
  audio/synth.js  sintesi WebAudio generica (effetti e loop forniti dal gioco)
  tools/png.js    encoder PNG in scala di grigi (build e test)
src/
  config.js       tutti i numeri del gioco (fisica, regole, carburante, punteggi)
  sprites.js      pixel art e hitbox
  state.js        stato della partita
  sfx.js          effetti e loop sonori del gioco
  input.js        tastiera, gamepad, touch
  water.js        onde e molle dell'acqua
  particles.js    particelle e detriti fisici
  level.js        generazione dei livelli e sfida del giorno
  heli.js         elicottero: volo, carburante, scafo, collisioni
  people/
    people.js     stati delle persone e contatti con l'elicottero
    blood.js      sangue su solidi ed elicottero
    swim.js       naufraghi
    chain.js      scaletta, verricello, catena di appesi
    ground.js     sui tetti: corsa, feriti, panico; cadute e corpi
    crew.js       soccorritore al verricello
  gear.js         salvagenti e secchio d'acqua
  tutorial.js     addestramento guidato
  env.js          vento, pioggia, fulmini, telecamera
  render.js       disegno di mondo, HUD e pannelli
  main.js         flusso di gioco, registrazione e replay, ciclo principale
test/
  harness.js      esegue il gioco in Node con un canvas finto
  run.js          suite di test (regole, fisica, replay, gamepad...)
  e2e/            collaudo in Chromium vero, una suite per file (keyboard, touch, gamepad, pwa, devpage, layout, touchui, flow, visual) più lib.js e run.js
  levels.js       ogni livello è risolvibile: il pilota automatico salva ogni persona, una alla volta
  autopilot.js    il pilota automatico, condiviso da levels.js e dai golden
  golden.js       snapshot di stato, frame e Rng; le baseline stanno in golden/ (Node e browser)
  scenarios.js    gli scenari condivisi tra golden Node e golden nel browser
  guards.js       controlli statici sui sorgenti (Math.random, console.log, script in index.html)
```

## Requisiti

- Node.js 18 o successivo e `npm install` (una volta sola) per `build.js` e i test. L'unica dipendenza è `terser`, usata solo in fase di build per minificare il JS: il gioco non ne ha. Per giocare non serve nulla.
- Playwright con Chromium, solo per `test/e2e/run.js`. Non è una dipendenza del progetto: si installa a parte con `npm install -g playwright` e `npx playwright install chromium`.

## Sviluppo

```sh
npm install                                     # una volta sola (terser)
node build.js                                   # genera dist/last-rung.html e dist/web/, minificati
node test/run.js                                # suite di test, 42 test, guardie e test unitari dell'engine compresi (filtro opzionale: node test/run.js replay)
node test/golden.js                             # snapshot di stato, frame e Rng su 15 scenari (--update solo dopo una modifica voluta)
node test/levels.js                             # livelli 1-16 e 20 sfide del giorno risolvibili (~2 minuti)
NODE_PATH=$(npm root -g) node test/e2e/run.js   # collaudo nel browser (serve Playwright; filtro: node test/e2e/run.js touch; ~90 s)
```

Su PowerShell l'ultimo comando diventa `$env:NODE_PATH = (npm root -g); node test/e2e/run.js`. Gli screenshot dei test finiscono in `test/shots/`, cartella ignorata da git.

Durante lo sviluppo si può aprire direttamente `index.html`: i sorgenti sono script classici e funzionano anche da `file://`, senza build. I test girano su `dist/`, quindi dopo ogni modifica ai sorgenti serve `node build.js`.

### Convenzioni

- I sorgenti sono leggibili: nomi per esteso (solo `i`/`j` per gli indici e `x`/`y` per le coordinate). La minificazione avviene solo nella build, quindi `dist/` non si modifica a mano.
- Commenti in inglese e solo dove il motivo non è ovvio (fisica, determinismo, workaround); non servono per raccontare cosa fa il codice.

### Determinismo

Tutto ciò che influenza la partita usa `Rng` (util.js), ri-seminato a ogni tentativo, e il gioco avanza a passo fisso di 1/60 s. Gli input vengono registrati frame per frame (quantizzati al centesimo), così il replay ricostruisce la stessa identica partita. Il test "replay deterministico" lo verifica. Regola per chi modifica: nella simulazione mai `Math.random()`, che è ammesso solo nel render (tremolio) e nell'audio.

## Pubblicare

`node build.js` produce due cose:

- `dist/last-rung.html`: il gioco in un solo file, si apre con un doppio clic.
- `dist/web/`: lo stesso gioco come app installabile (PWA), con `manifest.webmanifest`, le icone e `sw.js`, il service worker che permette di giocare offline. Il service worker funziona solo su https (o su `localhost`), quindi la cartella va servita da un hosting statico.

### GitHub Pages

Il workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) a ogni push su `main` installa le dipendenze (`npm ci`), esegue build e test e, se sono verdi, pubblica `dist/web/`. Per attivarlo, una volta sola: nel repository su GitHub, **Settings → Pages → Build and deployment → Source: GitHub Actions**.

Il gioco sarà su `https://<utente>.github.io/<repository>/`; dal telefono poi "Aggiungi a schermata Home". Va bene anche qualunque altro hosting statico https: basta servire il contenuto di `dist/web/`.

## Licenza

[MIT](LICENSE).
