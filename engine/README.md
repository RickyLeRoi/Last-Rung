# Engine 1-bit

Parti generiche estratte da Last Rung: un gioco le usa fornendo dati e hook, l'engine non conosce il gioco.
Script classici (niente ES modules), ognuno definisce un namespace globale; il gioco si apre da `file://`.

## Regole del contratto

- L'engine non nomina mai il gioco: niente `game.`, `heli`, `SPRITES`, `Sfx`, `__eli` (lo controlla `test/guards.js`).
- Dal `CONFIG` del gioco l'engine legge solo: `W`, `H`, `input` (`deadzone`, `stickRadius`), `maxParticles`, `touchGutter` (default 84).
- **Determinismo.** La simulazione non usa mai `Math.random`: solo `Rng` (`randomRange`, `chance`). `Math.random` e' ammesso solo nel render e nell'audio (`engine/audio/synth.js`). L'**ordine** delle chiamate a `Rng` fa parte del contratto: spostarle rompe replay e golden.
- Il codice del gioco e dell'engine ha le stesse regole: nomi per esteso, commenti in inglese, firme solo sui cambi di logica.

## Ordine di caricamento (`index.html`)

`config` (del gioco) -> `core/util` -> `core/strings` -> `core/geometry` -> `core/replay` -> `core/loop` -> `gfx/sprite` -> sprite del gioco -> `gfx/gfx` -> `gfx/lighting` -> `gfx/ui` -> `core/steps` -> stato del gioco -> `audio/synth` -> effetti del gioco -> `input/input` -> bindings del gioco -> `world/*` e wrapper del gioco -> ... -> `core/flow` -> `main`.
Le dipendenze sono solo "a valle": `Lighting`, `UI` e `Input` usano `Gfx`; `Steps` usa `UI`; `Flow` usa `Input`, `STRINGS`, `todayString`.

## Namespace

| File | Globale | Cosa fa |
|---|---|---|
| `core/util.js` | `Rng`, `randomRange`, `chance`, `hashString`, `clamp`, `overlap`, `round`, `todayString`, `mulberry32` | Matematica e RNG deterministico. `Rng.seed(n)` a ogni partita. |
| `core/strings.js` | `STRINGS` | Testi dell'engine (italiano). Il gioco puo' sovrascriverli con `Object.assign(STRINGS, {...})`. |
| `core/geometry.js` | `bresenham(x0, y0, x1, y1, visit(x, y, index))`, `withBounds(hazard)` | Linee a pixel interi; riquadro `x0/x1/y0/y1` di un pericolo con `pts` piatto. |
| `core/replay.js` | `Replay.codec({ axes, flags })` | `encode(input)` / `decode(frame)`: frame = `[assi * 100..., bitmask dei flag]`. |
| `core/loop.js` | `Loop.start(step, render)` | Passo fisso 60 Hz con accumulatore, tetto 250 ms. |
| `core/steps.js` | `Steps.update(state, steps, onAdvance)`, `Steps.text(step)` | Tutorial a passi con `done()`; il testo dipende dal dispositivo. |
| `core/flow.js` | `Flow.create({...})` | Macchina a stati `title/intro/play/pause/over/done/replay`, registrazione e replay, mute, lampi ridotti. Vedi sotto. |
| `gfx/sprite.js` | `makeSprite(rows)`, `outlineSprite(sprite)` | Sprite da righe `'#.'`. |
| `gfx/gfx.js` | `Gfx` | Canvas, adattamento allo schermo (`fit`), primitive, font bitmap, sprite (`drawSprite(sprite, x, y, flip, skew, skewFromRow = 4)`). |
| `gfx/lighting.js` | `Lighting.darkness({ circles, cones, pattern })`, `Lighting.fog({ clear, lights, thin, dark, dither })` | Buio e nebbia calcolati per colonna. Il gioco costruisce le sorgenti (anche i raggi tremolanti: `Math.random` resta nel gioco). Lasciano `fillStyle = '#fff'`. |
| `gfx/ui.js` | `UI.hint`, `UI.bar`, `UI.stars`, `UI.lines`, `UI.red.add/clear/flush`, `UI.invert` | Helper di HUD; i pixel rossi si dipingono per ultimi. |
| `audio/synth.js` | `Synth.create({ volume, effects(api), loops })` | WebAudio generico. `effects({ tone, noise })` -> mappa nome/funzione; `loops.build({ context, master, noiseSource, filter, gain })` e `loops.update(nodes, levels, now)`. |
| `input/input.js` | `Input.configure(bindings)`, `sample()`, `syncUI()`, `rumble()`, `device` | Tastiera, gamepad, levetta touch, pulsanti. Vedi sotto. |
| `world/water.js` | `Water.make / surfaceY(water, x, time) / push / update` | Superficie a molle + onde. |
| `world/particles.js` | `Particles.add(list, particle, max)`, `Particles.update(list, world)` | Tipi `px`, `bub`, `smoke`, `ring`, `chunk`. Hook: `pixel`, `push`, `chunkTrail`, `splash`. |
| `world/weather.js` | `Weather.wind / initRain / updateRain / makeBolt / tickLightning` | Vento, pioggia, fulmini. |
| `world/camera.js` | `Camera.follow / decayShake` | Inseguimento e tremolio. |
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

## Test

- `engine/test/unit.js`: test unitari (girano dentro `node test/run.js`), con il caricatore a sandbox `engine/test/load.js`.
- Golden e E2E dei giochi: vedi il README principale. Nessun golden deve cambiare quando si modifica l'engine "senza cambiare il comportamento".
