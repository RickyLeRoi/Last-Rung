# Engine 1-bit

Parti generiche estratte da Last Rung: un gioco le usa fornendo dati e hook, l'engine non conosce il gioco.
Per creare un gioco seguire anche le [linee guida](../GUIDELINES.md) (aspetto, CSS, nomi, test, processo). Script classici (niente ES modules), ognuno definisce un namespace globale; il gioco si apre da `file://`.

## Regole del contratto

- L'engine non nomina mai il gioco: niente `game.`, `heli`, `SPRITES`, `Sfx`, `__eli` (lo controlla `test/guards.js`).
- Dal `CONFIG` del gioco l'engine legge solo: `W`, `H`, `input` (`deadzone`, `stickRadius`), `maxParticles`, `touchGutter` (default 84).
- **Determinismo.** La simulazione non usa mai `Math.random`: solo `Rng` (`randomRange`, `chance`). `Math.random` e' ammesso solo nel render e nell'audio (`engine/audio/synth.js`). L'**ordine** delle chiamate a `Rng` fa parte del contratto: spostarle rompe replay e golden.
- Il codice del gioco e dell'engine ha le stesse regole: nomi per esteso, commenti in inglese, firme solo sui cambi di logica.

## Ordine di caricamento (`index.html`)

`config` (del gioco) -> `core/util` -> `core/strings` -> `core/geometry` -> `core/replay` -> `core/loop` -> `gfx/sprite` -> sprite del gioco -> `gfx/gfx` -> `gfx/lighting` -> `gfx/sky` -> `gfx/parallax` -> `gfx/ui` -> `core/steps` -> stato del gioco -> `audio/synth` -> effetti del gioco -> `input/input` -> bindings del gioco -> `world/*` e wrapper del gioco -> ... -> `core/flow` -> `main`.
Le dipendenze sono solo "a valle": `Lighting`, `UI` e `Input` usano `Gfx`; `Steps` usa `UI`; `Flow` usa `Input`, `STRINGS`, `todayString`.

## Namespace

| File | Globale | Cosa fa |
|---|---|---|
| `core/util.js` | `Rng`, `randomRange`, `chance`, `hashString`, `clamp`, `overlap`, `round`, `todayString`, `mulberry32`, `interpolateTable` | Matematica e RNG deterministico. `Rng.seed(n)` a ogni partita. `interpolateTable(valori, indice)`: interpolazione lineare a indice frazionario (le corsie). |
| `core/strings.js` | `STRINGS` | Testi dell'engine (italiano). Il gioco puo' sovrascriverli con `Object.assign(STRINGS, {...})`. |
| `core/geometry.js` | `bresenham(x0, y0, x1, y1, visit(x, y, index))`, `coneContains(cone, x, y, minHalfWidth)`, `withBounds(hazard)` | Linee a pixel interi; punto dentro un cono `{ x, y, pitch, half, length, facing }` (pitch sotto l'orizzontale, `facing` -1 = verso sinistra, larghezza minima opzionale vicino al vertice); riquadro `x0/x1/y0/y1` di un pericolo con `pts` piatto. |
| `core/replay.js` | `Replay.codec({ axes, flags })` | `encode(input)` / `decode(frame)`: frame = `[assi * 100..., bitmask dei flag]`. |
| `core/loop.js` | `Loop.start(step, render)` | Passo fisso 60 Hz con accumulatore, tetto 250 ms. |
| `core/steps.js` | `Steps.update(state, steps, onAdvance)`, `Steps.text(step)` | Tutorial a passi con `done()`; il testo dipende dal dispositivo. |
| `core/flow.js` | `Flow.create({...})` | Macchina a stati `title/intro/play/pause/over/done/replay`, registrazione e replay, mute, lampi ridotti. Vedi sotto. |
| `gfx/sprite.js` | `makeSprite(rows)`, `outlineSprite(sprite)` | Sprite da righe `'#.'`. |
| `gfx/gfx.js` | `Gfx` | Canvas, adattamento allo schermo (`fit`), primitive, font bitmap, sprite (`drawSprite(sprite, x, y, flip, skew, skewFromRow = 4)`). |
| `gfx/lighting.js` | `Lighting.darkness({ circles, cones, pattern })`, `Lighting.fog({ clear, lights, thin, dark, dither })`, `Lighting.fogBanks({ time, wind, clear })` | Buio e nebbia calcolati per colonna. Il gioco costruisce le sorgenti (anche i raggi tremolanti: `Math.random` resta nel gioco). Lasciano `fillStyle = '#fff'`. |
| `gfx/sky.js` | `Sky.drawNight({ cameraX, covers, waterY, stars, moon, frame })` | Stelle e luna, disegnate solo dove la scena non le copre (`covers` = `[daX, aX, y, ...]`, piu' la superficie dell'acqua). |
| `gfx/parallax.js` | `Parallax.draw(layers, cameraX, cameraY)`, `covers(layers, cameraX, cameraY)`, `ridge(random, shape)`, `blocks(rectangles, offsetX, length)` | Sfondi a strati che scorrono a una frazione della camera (`factor`, `factorY`), dal piu' lontano al piu' vicino. Uno strato e' un profilo di altezze per colonna (ripetuto, o fermo con `wrap: false`), riempito con un retino (bianco visto attraverso il pattern) o un colore pieno, con bordo `solid`/`dotted` e dettagli (luci) solo dentro la sagoma. Profondita' in 1 bit: lontano = contorno puntinato su nero, piu' vicino = retino piu' fitto. `covers` va passato a `Sky.drawNight` cosi' le stelle spariscono dietro le sagome. I generatori ricevono il `mulberry32` del gioco (mai il `Rng`): lo sfondo e' dato di render, la simulazione non lo legge. Commento in testa al file per i campi. |
| `gfx/ui.js` | `UI.hint`, `UI.bar`, `UI.stars`, `UI.lines`, `UI.red.add/clear/flush`, `UI.invert` | Helper di HUD; i pixel rossi si dipingono per ultimi. |
| `audio/synth.js` | `Synth.create({ volume, effects(api), loops })` | WebAudio generico. `effects({ tone, noise })` -> mappa nome/funzione; `loops.build({ context, master, noiseSource, filter, gain })` e `loops.update(nodes, levels, now)`. |
| `input/input.js` | `Input.configure(bindings)`, `sample()`, `syncUI()`, `rumble()`, `device` | Tastiera, gamepad, levetta touch, pulsanti. Vedi sotto. |
| `world/water.js` | `Water.make / surfaceY(water, x, time) / push / update` | Superficie a molle + onde. |
| `world/particles.js` | `Particles.add(list, particle, max)`, `Particles.update(list, world)` | Tipi `px`, `bub`, `smoke`, `ring`, `chunk`. Hook: `pixel`, `push`, `chunkTrail`, `splash`, `solidAt(x, y, w, h)` (i detriti si posano sul terreno del gioco). In un mondo piu' alto dello schermo `world.screenHeight` va passato con l'altezza del mondo, altrimenti le particelle sotto y = altezza + 30 spariscono. |
| `world/weather.js` | `Weather.wind / initRain / updateRain / makeBolt / tickLightning` | Vento, pioggia, fulmini. `updateRain` accetta `fall`, `fallSpread` e `drift` opzionali (default 4, 1, 0,5 = la pioggia di sempre): valori bassi fanno la neve. |
| `world/camera.js` | `Camera.follow / decayShake` | Inseguimento e tremolio; `follow` vale anche per l'asse y. |
| `world/terrain.js` | `Terrain.make / get / isSolid / fillRect / fillCircle / carveCircle / settleColumn / surfaceY / hitsRect / moveRect / draw` | Terreno a maschera di materiali (0 vuoto, gli altri numeri li sceglie il gioco), un pixel per cella; fuori dalla maschera pareti e fondo sono pieni. Scavo e riempimento per materiale, materiale sciolto che cade di una riga per frame (`settleColumn`), movimento a sotto-passi con gradino (`moveRect`), disegno della sola finestra visibile con un retino per materiale (sotto la trasformazione della camera del gioco). La generazione resta nei giochi. |
| `tools/png.js` | `encodeGrayscalePng(width, height, pixels)` | Solo Node (build e test). |

## `Input.configure(bindings)`

```js
Input.configure({
  keyEdges:  { Enter: 'confirm', ... },        // evento al tasto premuto
  padEdges:  { 0: ['confirm', 'buoy'], ... },  // evento al pulsante del pad
  blockKeys: ['ArrowUp', ...],                  // preventDefault
  rumble:    { explode: [320, 1], ... },        // [ms, intensita'], usato da Input.rumble(nome)
  unlock:    () => Sfx.unlock(),                // primo gesto dell'utente
  axes(raw)  { return { hx, up, down, winch, padActive }; },
});
// raw = { keys, pad: { axes, buttons, pressed(i), axis(value) } | null, touch: { stickX, stickY, held } }
```

L'engine quantizza a 0,01 **tutti** gli assi restituiti da `axes()` (`padActive` e' un'indicazione, non un asse). L'evento `confirm` e' usato dall'engine (primo tocco, tocco sulla zona levetta fuori dal gioco). Contratto di markup: `#touch`, `#stickZone`, `#stickBase`, `#stickKnob`, `[data-edge="nome"]`, `[data-hold="nome:valore"]`. `syncUI(state, flags, activeButtons)` scrive `data-mode`, `data-state` e `data-<flag>` sulla radice e attiva i pulsanti a interruttore.

## `Flow.create(options)`

Opzioni (dettaglio nel commento in testa a `core/flow.js`): `run` (oggetto stato del gioco), `audio` (`toggleMute`, `play`), `idleInput`, `codec`, `message`, `newRun`, `step`, `checkEnd`, `stepInput`, `beforeState`, `afterStep`, `specs: { first, daily, next }`, `introFrames`, `debug`, `testHook`. Restituisce `{ step, startRun, restart, startReplay }`; `Loop.start(flow.step, render)` fa partire il gioco.
Sull'oggetto `run` l'engine legge e scrive: `state`, `introT`, `overT`, `overReason`, `rec`, `replay`, `spec`, `score`, `levelStartScore`, `result`, `softFlash`.

## Un gioco nel repository

Un gioco e' `games/<id>/` con:

- `game.json`: `id`, `title`, `shortName`, `lang`, `description`, `icon` (`file` e `sprite` da cui la build legge le righe dello sprite, `extraRows`, `rotorRow`) e `debugGlobal` (nome del globale esposto con `?debug`, usato dalle suite E2E come `window.__debug`).
- `index.html`: pagina di sviluppo; il blocco `<!-- build:js --> ... <!-- /build:js -->` elenca gli script **relativi alla pagina** (`../../engine/...` e `src/...`), nell'ordine di caricamento.
- `src/` e, per i test, `test/`.

`node engine/tools/build.js [id...]` costruisce `dist/<id>.html`, `dist/site/<id>/` (PWA con scope nella cartella del gioco, cache `<id>-<hash>`: la Cache Storage e' condivisa da tutti i giochi della stessa origine, quindi ogni service worker cancella solo le proprie vecchie versioni, quelle col prefisso `<id>-`) e l'hub `dist/site/index.html` generato dai `game.json`.

## Test

- `engine/test/unit.js`: test unitari (sandbox `engine/test/load.js`); `engine/test/guards.js`: guardie statiche (niente `Math.random` nella simulazione, script elencati, engine non accoppiato al gioco).
- `engine/test/conformance.js`: suite che **ogni** gioco deve passare, sul bundle in `dist/`: avvio dal titolo con test hook completo (`game`, `CONFIG`, `startLevel`, `startReplay`, `Rng`, `Input`), flusso confirm/pausa/restart, 3000 frame di input casuali presi dai bindings del gioco (solo interi, solo `#fff/#000/#d00`), replay deterministico. Per gli hash di stato un gioco puo' fornire `games/<id>/test/snapshot.js`.
- `engine/test/e2e/`: suite nel browser generiche (`devpage`, `layout`, `pwa`, `golden`, `hub`), lanciate con `--game <id>`; il `golden` legge scenari e baseline da `games/<id>/test/`. Le suite specifiche stanno in `games/<id>/test/e2e/`.
- `npm test` (`engine/test/all.js`) esegue unit, guardie, conformance e, per ogni gioco, `test/run.js` e `test/golden.js`.
