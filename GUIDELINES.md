# Linee guida per creare un nuovo gioco

Documento per chi (agent o persona) aggiunge un gioco a One Bit Games. Il riferimento vivo e' **Last Rung** (`games/last-rung/`): quando questo testo e il codice divergono, vale il codice, e va corretto il testo. Il contratto con il motore e' in [engine/README.md](engine/README.md); qui ci sono le regole di stile, di aspetto e di processo che il contratto non copre.

Prima di scrivere codice: leggi `engine/README.md`, `games/last-rung/game.json`, `games/last-rung/index.html` e `games/last-rung/src/main.js` (e' il punto dove il gioco si collega all'engine).

## 1. Principi

1. **Il motore non conosce il gioco.** Tutto cio' che e' specifico (regole, sprite, testi di gioco, livelli) sta in `games/<id>/`. Se ti serve qualcosa che il motore non offre, prima cerca se un altro gioco lo ha gia' (regola del tre: si estrae nell'engine solo quando serve a un secondo gioco), poi proponi l'estrazione; non copiare codice dell'engine nel gioco e non modificare l'engine "di nascosto" per un solo gioco.
2. **Il comportamento degli altri giochi non cambia.** Dopo qualunque modifica all'engine i golden di Last Rung devono restare identici (`npm test`). Se cambiano, e' un bug della tua modifica.
3. **Vanilla-first.** Nessuna nuova dipendenza npm (l'unica e' `terser`, solo per la build), nessun framework, nessuna libreria a runtime. Chiedi prima di aggiungere qualunque cosa.
4. **Script classici, niente ES modules.** Il gioco deve aprirsi da `file://` sia da `index.html` (sorgenti separati) sia dal bundle. I moduli sono IIFE che definiscono un namespace globale.
5. **Determinismo.** La simulazione e' riproducibile dal solo seed e dagli input registrati (vedi sezione 6).
6. **Prima la rete di test, poi il resto.** Un gioco non e' finito finche' conformance, test del gioco ed E2E non sono verdi.

## 2. Aspetto: schermo, colori, font

- **Risoluzione logica 384x216**, a coordinate **intere**, senza antialiasing. Il canvas si adatta alla finestra da solo (`Gfx.fit`): scala intera quando spreca poco, frazionaria sui telefoni. Non ridimensionare il canvas a mano.
- **Colori: solo `#fff` e `#000`.** L'unica eccezione e' il rosso `#d00` (`Gfx.RED`), usato per il sangue o per eventi equivalenti, e va dipinto per ultimo con `UI.red.add/flush` (cosi' l'inversione a schermo intero non lo trasforma in blu). Niente grigi, niente trasparenze, niente gradienti: i mezzi toni si ottengono con i pattern a retino `Gfx.DITHER` (50%), `Gfx.DUSK` e `Gfx.DARK` (piu' scuro). Lo verificano la conformance e le suite E2E (`#fff/#000/#d00` e nessuna coordinata non intera).
- **Stile grafico.** Sprite in `makeSprite(['#.', '.#'])` (un `#` e' un pixel bianco), linee con `Gfx.drawLine`/`drawCircle` (Bresenham, anche tratteggiate), riempimenti a retino. Contorni da 1 px, riquadri doppi per i pannelli (`Gfx.drawPanel`). Il bianco su nero e' la regola: se un disegno non si legge, cambia la forma, non il colore.
- **Barre HUD.** Una fascia nera di 11 px in alto e una in basso (`blackRect`), con una riga puntinata sul bordo interno; l'area di gioco e' quella in mezzo. Barre di stato con `UI.bar`, stelle con `UI.stars`, messaggi a tempo con `showMessage` (centrati in alto, lampeggiano negli ultimi frame).
- **Testo.** Solo il font bitmap 3x5 dell'engine (`Gfx.text`, `Gfx.textBox`, `Gfx.textWidth`), **maiuscolo**, in **italiano**. Il font non ha accenti: scrivi `E'`, `CITTA'`, `PIU'` come fa Last Rung (gli accenti Unicode verrebbero comunque tolti). Le varianti per dispositivo si scrivono con `UI.hint(tastiera, touch, gamepad)`, mai con `if` sparsi.
- **Schermate standard**, con gli stessi stati del motore: titolo (nome, sottotitolo, prompt lampeggiante `(frame >> 5) & 1`), pausa, game over, missione compiuta/fallita con stelle, replay ("REPLAY - ... PER SALTARE"). I testi che l'engine possiede sono in `STRINGS` (`engine/core/strings.js`): usali, e sovrascrivili con `Object.assign(STRINGS, {...})` solo se serve.
- **Audio.** Sintesi con `Synth.create({ volume, effects, loops })`, nessun file audio. Serve almeno l'effetto `ui` (il `Flow` lo suona alla conferma). Il rumble dei telefoni/gamepad si configura in `bindings.rumble`.

## 3. Pagina e CSS (`index.html`)

Parti **copiando** `games/last-rung/index.html` e cambia solo `<title>`, i pulsanti touch e il blocco `build:js`. Regole:

- Sfondo nero, nessun margine, `overflow: hidden`, `touch-action: none`, `user-select: none`; il canvas `#game` (384x216, `tabindex="0"`) e' centrato con `image-rendering: pixelated`.
- **Pulsanti touch**: stesso aspetto per tutti i giochi. Sfondo nero, bordo pieno bianco da 2 px, angoli vivi, font `bold 11px/1 monospace` con `letter-spacing: 1px`, 70x52 px (34 px di altezza in alto a destra, 44 in basso al centro), stato premuto/attivo con colori invertiti (`.act`, `:active`). Posizioni: `tr` (audio, riavvia, pausa, salta), `br`/`bl` (azioni di gioco), `bc` (replay, sfida del giorno). Nessun colore, nessuna ombra, nessuna icona raster: le etichette sono testo maiuscolo breve (il sillabare con `&shy;` e' ammesso).
- **Contratto di markup** letto dall'engine (non cambiare questi nomi): `#touch` (con `data-mode` e `data-state` scritti da `Input.syncUI`), `#stickZone`, `#stickBase`, `#stickKnob`, `button[data-edge="evento"]` per i tocchi singoli, `button[data-hold="nome:valore"]` per i pulsanti tenuti. Le classi `play`, `end`, `title`, `tut` decidono in quali stati il pulsante e' visibile: la logica e' tutta nel CSS (`#touch[data-state="over"] button.end { display: block }`), mai in JavaScript. Eventuali flag aggiuntivi arrivano come `data-<nome>` da `Input.syncUI(stato, { nome: bool }, { '#idPulsante': attivo })`.
- Il blocco `<!-- build:js --> ... <!-- /build:js -->` elenca gli script **relativi alla pagina**, nell'ordine di caricamento: prima `src/config.js`, poi i moduli dell'engine con `../../engine/...`, intercalati con i file del gioco che ne dipendono, per ultimo `src/main.js`. Ogni file di `src/` e di `engine/core|gfx|audio|input|world` deve comparire (lo controllano le guardie).
- Nessun CSS o script esterno, nessun font web, nessuna immagine: tutto e' inline o generato. La build minifica il CSS e il JS e produce il file unico.

## 4. Codice: nomi, stile, commenti

- **Lingue.** Codice, nomi e commenti in **inglese**. Testi dell'interfaccia e nomi dei test in **italiano**. Documenti (README, queste guide) in italiano.
- **Nomi per esteso.** Variabili e funzioni dicono cosa sono: `heliCenterX`, `waterSurfaceY`, `remainingFuel`. Sono ammessi `i`/`j` solo per gli indici dei cicli e `x`/`y` per le coordinate. Niente abbreviazioni nuove (`hp`, `rd`, `wt`, `bl`...): nel codice di Last Rung ce ne sono di storiche, **non copiarle**.
- **Convenzioni.** `camelCase` per variabili e funzioni (verbo per le funzioni: `updateShips`, `drawLighthouse`), `PascalCase` per i namespace globali (`Gfx`, `Water`), `UPPER_SNAKE` per costanti di modulo (`SPRITES`, `TUTORIAL`), booleani come `isLit`/`hasFuel`. Id del gioco e cartelle in `kebab-case` minuscolo; un file per responsabilita', 100-400 righe.
- **Numeri.** Tutti i numeri di bilanciamento (fisica, tempi, punteggi, raggi) stanno in `src/config.js`, con l'unita' nei commenti (px, frame, 60 frame = 1 s). Nessun numero magico sparso nel codice, tranne le coordinate di disegno.
- **Intestazione.** Ogni file inizia con il proprio percorso: `// games/<id>/src/ships.js`, poi `'use strict';`.
- **Commenti.** Solo dove il perche' non e' ovvio (fisica, ordine delle chiamate al Rng, workaround). Mai per raccontare cosa fa il codice. Quando modifichi **logica esistente** (non quando crei un file o sposti/rinomini) usa le firme:
  - nuova funzionalita': `// AAAAMMGG ++ RG #nome_feature`
  - modifica o bugfix: `// AAAAMMGG ** RG #motivo`
  - rimozione: `// AAAAMMGG -- RG`
  con la data del giorno della modifica.
- **Caratteri.** In codice, commenti e documenti solo caratteri ASCII e quelli delle tastiere europee. Trattino semplice `-` (mai il trattino lungo), apici e virgolette dritti, `...` e `->` al posto dei simboli tipografici, niente emoji e niente caratteri per disegnare alberi (`|--` e `\--`). Eccezioni: simboli matematici e i segni di spunta nei documenti. (Il font bitmap ha frecce e triangoli per le etichette dei pulsanti: sono i glifi gia' presenti, non aggiungerne.)
- **Stile del codice.** Funzioni piccole e leggibili, early return, niente classi inutili. Un `for` esplicito batte tre `reduce` annidati. Il codice del gioco non accede alle parti interne dei moduli dell'engine (solo alla loro API) e non le modifica a runtime.

## 5. Come usare l'engine

Dettagli e firme in [engine/README.md](engine/README.md). Il flusso di un gioco e' sempre lo stesso (vedi `games/last-rung/src/main.js` e `bindings.js`):

1. `config.js`: definisce `CONFIG` con almeno `W`, `H`, `input: { deadzone, stickRadius }`, `maxParticles`, `touchGutter`. L'engine legge **solo** queste chiavi (le guardie lo impongono).
2. `state.js`: l'oggetto `game` (stato, livello, punteggio, messaggi...). Il `Flow` legge e scrive i campi `state, introT, overT, overReason, rec, replay, spec, score, levelStartScore, result, softFlash`.
3. `sfx.js`: `Synth.create`. `bindings.js`: `Input.configure({ keyEdges, padEdges, blockKeys, rumble, unlock, axes })` e `Sfx.onPlay(Input.rumble)`. Gli eventi `confirm`, `pause`, `restart`, `mute`, `replay`, `daily`, `skip` hanno un significato fisso per il `Flow`: mappa i tuoi tasti su questi nomi; le azioni di gioco hanno nomi tuoi.
4. Moduli di mondo: `Water`, `Particles`, `Weather`, `Camera`, `Lighting`, `Sky`, `UI`, `Steps`, tutti con wrapper sottili nel gioco (`waterSurfaceY = x => Water.surfaceY(game.L.water, x, game.time)`). Il gioco fornisce hook (`pixel`, `push`, `chunkTrail`, `splash`, `onHitWater`, `onStrike`), l'engine non chiama mai codice del gioco per nome.
5. `main.js`: `Replay.codec({ axes, flags })`, `Flow.create({ run: game, audio: Sfx, idleInput, codec, message, newRun, step, checkEnd, stepInput, beforeState, afterStep, specs, introFrames, debug, testHook })`, poi la partenza (`startLevel(...)` e `game.state = 'title'`) e `Loop.start(flow.step, render)`. Il `testHook` deve contenere almeno `game, CONFIG, startLevel, startReplay, Rng` (l'engine aggiunge `Input`); per i golden e gli E2E serve anche `levelSpec`.
6. Livelli: una funzione `levelSpec(n)` pura (scenario, giro, seed), una `dailySpec(data)` basata su `hashString('<id>-' + data)` e un `genLevel(spec)` che usa un proprio generatore (`mulberry32(spec.seed)`), mai `Math.random` e mai il `Rng` della simulazione.

Regole d'uso:

- **Wrapper, non fork.** Se l'engine non basta, aggiungi un hook o un parametro opzionale con default che non cambia il comportamento esistente, con un test unitario in `engine/test/unit.js`.
- **Un solo posto per ogni cosa:** geometria in `bresenham`/`withBounds`, onde in `Water`, UI in `UI`. Non reimplementare queste cose nel gioco.
- **Ordine delle chiamate al Rng** = parte del contratto di replay: non riordinare, non aggiungere chiamate condizionali tra due gia' esistenti senza capirne l'effetto.

## 6. Determinismo (regole non negoziabili)

- Nella simulazione **mai `Math.random()`**: solo `Rng`, `randomRange`, `chance` (`engine/core/util.js`). `Math.random` e' ammesso solo in `games/*/src/render.js` e nell'audio dell'engine; le guardie falliscono altrove.
- Il passo e' fisso a 1/60 s (`Loop`), il tempo di simulazione e' `game.frame / 60`, mai `Date.now()` o `performance.now()` nella logica. L'unica eccezione e' la data per la sfida del giorno, via `todayString()`.
- Ogni tentativo ri-semina il `Rng` in `newRun`, e gli input sono quelli quantizzati a 0,01 dall'engine. Il replay deve ricostruire la stessa partita identica.
- Il render non modifica lo stato di simulazione, e la simulazione non legge il render.

## 7. Struttura e file di un gioco

```
games/<id>/
  game.json          id, title, shortName, lang, description, icon, debugGlobal
  index.html         pagina di sviluppo (blocco build:js)
  README.md          comandi, regole, struttura (in italiano)
  src/               config, state, sprites, sfx, bindings, level, ..., render, tutorial, main
  test/
    helpers.js       boot() del gioco + funzioni di pilotaggio per i test
    snapshot.js      stato di simulazione per gli hash (vedi sotto)
    run.js           test delle regole del gioco
    levels.js        i livelli sono risolvibili da un pilota automatico (autopilot.js)
    scenarios.js     scenari condivisi dai golden Node e browser
    golden.js        snapshot di stato, frame e Rng (+ golden/<id>.json e <id>.browser.json)
    e2e/             lib.js (riesporta quella dell'engine) e le suite del gioco
```

- `game.json`: `debugGlobal` e' il nome del globale esposto con `?debug` (es. `__faro`); la build lo legge per l'icona (`icon.file`, `icon.sprite`: uno sprite **largo 32 colonne**, piu' `extraRows` e `rotorRow` solo se servono), le suite E2E come `window.__debug`.
- `test/snapshot.js`: `module.exports = (hook, encodeStable) => oggetto` con tutto cio' che deve essere identico tra due esecuzioni (numeri con `encodeStable`, riferimenti ciclici sostituiti con indici). Senza snapshot l'harness usa solo `frame`: debole, non basta per un gioco vero.
- Per aggiungere il gioco al CI: aggiungi l'id alla matrice `game` del job `e2e` in `.github/workflows/pages.yml`. La build, l'hub (`dist/site/index.html`), la conformance e `npm test` lo trovano da soli.

## 8. Test e criteri di "fatto"

Un gioco (o una modifica) e' **finito** solo se tutto questo e' verde, con exit code controllati (un `| tail` in una catena `&&` nasconde i fallimenti):

```sh
npm run build
npm test                                                   # unit, guardie, conformance, run.js e golden di ogni gioco
node games/<id>/test/levels.js                             # solvabilita' dei livelli, ~2 minuti
NODE_PATH=$(npm root -g) node engine/test/e2e/run.js --game <id>    # browser vero; con --game, sia le suite generiche sia quelle del gioco
node --check <file>                                        # su ogni file JS toccato
```

- **Conformance** (`engine/test/conformance.js`): vale per ogni gioco senza modifiche; se ti sembra che vada cambiata, il contratto era sbagliato: discutine prima.
- **Test del gioco** (`run.js`): le regole (fisica, punteggi, esiti), il replay, gli input da tastiera/gamepad/touch, i livelli. Test in italiano, uno per comportamento, con messaggi che spiegano il guasto. Testa a fondo le funzioni centrali; **scrivi anche gli E2E** (browser vero) per layout, touch e flusso, non solo i test in Node.
- **Golden.** Si generano (`node games/<id>/test/golden.js --update`) **solo quando l'utente approva la versione giocabile**. Dopo, non si rigenerano mai per far passare un test: se un golden cambia senza una modifica voluta, e' un bug. Un `--update` richiede l'ok esplicito dell'utente.
- **Nessun errore JS in console** in nessuna suite E2E; palette solo `#fff/#000/#d00`.
- **Playwright** non e' una dipendenza del progetto (si installa a parte). Su questa macchina servono `NODE_OPTIONS=--use-system-ca` per scaricare Chromium; mai disattivare la verifica TLS.
- Se un passo si rivela diverso da come e' descritto nei piani (`PLAN.md`), fermati e chiedi.

## 9. Processo

- **Git.** Commit in Conventional Commits, in inglese e all'imperativo (`feat(faro): add ship steering`). Un commit per passo logico. **Non committare e non fare push**: prepara il messaggio e mostra il diff; i commit li fa l'utente. Spostamenti di file con `git mv` per tenere la storia.
- **Piano prima del codice.** Se un lavoro tocca piu' file o piu' moduli dell'engine, scrivi il piano (`PLAN.md`, `TASK_<NOME>.md`) e fermati per l'approvazione; le domande aperte vanno in `QUESTIONS.md` (massimo 3 domande precise per volta), da svuotare quando l'utente risponde.
- **Un passo alla volta,** con i criteri di accettazione verdi prima di passare al successivo. Riporta in modo onesto cosa e' fallito e cosa non hai verificato (per esempio il CI di GitHub, che in locale non si esegue).
- **Documentazione.** Aggiorna `games/<id>/README.md` (comandi e regole), la tabella dei giochi nel `README.md` di radice e, se cambi il contratto, `engine/README.md`.

## 10. Checklist: nuovo gioco in 12 passi

1. Scegli `<id>` (kebab-case) e leggi `engine/README.md` e Last Rung.
2. Scrivi un breve GDD (regole, comandi, livelli, riuso dell'engine) e fallo approvare.
3. Crea `games/<id>/` con `game.json`, `index.html` (copiato e adattato) e `src/config.js`, `state.js`, `sprites.js`.
4. `sfx.js` e `bindings.js` (comandi tastiera, gamepad, touch con gli eventi standard del `Flow`).
5. Livelli (`levelSpec`, `dailySpec`, `genLevel`) con generatore proprio.
6. Simulazione (`stepSimulation`, `checkEnd`), solo con `Rng`.
7. `render.js`: scena, HUD, schermate standard, nello stile della sezione 2.
8. Tutorial a passi con `Steps` (saltabile con l'evento `skip`).
9. `main.js`: `Replay.codec`, `Flow.create`, `Loop.start`, `testHook`.
10. `npm run build`, poi `node engine/test/conformance.js <id>` finche' e' verde.
11. Test del gioco (`helpers.js`, `snapshot.js`, `run.js`, pilota automatico e `levels.js`, scenari), suite E2E con `--game <id>`.
12. Dopo l'approvazione dell'utente: golden (Node e browser), README del gioco, riga nella tabella di radice, matrice del CI.

## 11. Cose da non fare

- Nuove dipendenze, ES modules, `import`/`require` nei file del gioco, CDN, font o immagini esterne.
- Colori diversi da bianco, nero e (solo dove serve) il rosso `#d00`; coordinate non intere; antialiasing.
- `Math.random` o `Date.now` nella simulazione; riordinare le chiamate al `Rng` di codice esistente.
- Stato o riferimenti al gioco dentro `engine/` (le guardie falliscono su `game.`, `heli`, `SPRITES`, `Sfx`, il globale di debug e su chiavi di `CONFIG` fuori contratto).
- Rigenerare i golden per far passare un test, committare o pubblicare senza l'ok dell'utente.
- Copiare le abbreviazioni storiche di Last Rung nel codice nuovo.
