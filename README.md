# One Bit Games

Giochi in pixel art bianco su nero (un bit), HTML5 Canvas e JavaScript puro, zero dipendenze a runtime. Condividono un piccolo motore (`engine/`) e ognuno vive nella sua cartella in `games/`. Si giocano nel browser (desktop e telefono) e, una volta installati come app, anche offline.

Rilasciato con licenza [MIT](LICENSE).

## Giochi

| Gioco | Cartella | Descrizione |
|---|---|---|
| Last Rung | [games/last-rung/](games/last-rung/README.md) | Soccorso in elicottero: comandi, regole e livelli |
| Il Faro | [games/faro/](games/faro/README.md) | Guida le navi al porto con la luce del faro (prototipo) |

Online (GitHub Pages): l'hub sulla radice elenca i giochi, ognuno ha il suo indirizzo, ad esempio `https://rickyleroi.github.io/one-bit-games/last-rung/`. Ogni gioco è una app a sé (service worker nella propria cartella): chi aveva installato Last Rung dal vecchio indirizzo deve reinstallarlo.

## Struttura

```
engine/           il motore comune (contratto e API in engine/README.md)
  core/ gfx/ audio/ input/ world/   moduli del motore
  tools/          build.js (build di tutti i giochi) e png.js
  test/           harness, test unitari, guardie, conformance, suite E2E generiche
games/
  last-rung/      un gioco: game.json, index.html, src/, test/, README.md
  faro/           il secondo gioco
dist/             output della build, non versionato (si genera con npm run build)
  <id>.html       il gioco in un solo file (doppio clic)
  site/           quello che va su Pages: index.html (hub) e <id>/ (app installabile)
.github/workflows/pages.yml   build, test, E2E e pubblicazione di dist/site/
```

## Requisiti

- Node.js 18 o successivo e `npm install` (una volta sola). L'unica dipendenza è `terser`, usata solo dalla build per minificare il JS. Per giocare non serve nulla.
- Playwright con Chromium, solo per le suite E2E. Non è una dipendenza del progetto: si installa a parte con `npm install -g playwright` e `npx playwright install chromium`.

## Sviluppo

```sh
npm install                                     # una volta sola (terser)
npm run build                                   # tutti i giochi: dist/<id>.html, dist/site/<id>/ e l'hub
node engine/tools/build.js last-rung            # un gioco solo
npm test                                        # unit, guardie, conformance, suite e golden di ogni gioco
node games/last-rung/test/levels.js             # livelli risolvibili col pilota automatico (~2 minuti)
NODE_PATH=$(npm root -g) node engine/test/e2e/run.js --game last-rung   # collaudo nel browser (serve Playwright; filtro: ... touch; ~100 s)
```

Su PowerShell l'ultimo comando diventa `$env:NODE_PATH = (npm root -g); node engine/test/e2e/run.js --game last-rung`. Gli screenshot dei test finiscono in `dist/shots/`.

Durante lo sviluppo si può aprire direttamente `games/<id>/index.html`: i sorgenti sono script classici e funzionano anche da `file://`, senza build. I test girano su `dist/`, quindi dopo ogni modifica ai sorgenti serve `npm run build`.

Gli snapshot golden (`games/<id>/test/golden/`) non si rigenerano per far passare un test: `node games/<id>/test/golden.js --update` solo dopo una modifica voluta del comportamento.

### Convenzioni

- Nomi per esteso (solo `i`/`j` per gli indici e `x`/`y` per le coordinate); commenti in inglese e solo dove il motivo non è ovvio; testi dell'interfaccia in italiano. La minificazione avviene solo nella build.
- Un gioco si aggiunge creando `games/<id>/` con `game.json`, `index.html` (blocco `build:js`) e `src/`; la build, l'hub e la conformance lo trovano da soli. Vedi [engine/README.md](engine/README.md) e, per chi crea un nuovo gioco (persone o agent), le [linee guida](GUIDELINES.md): colori, CSS, nomi, uso dell'engine, test e processo.

## Pubblicare

`npm run build` produce `dist/<id>.html` (un solo file) e `dist/site/`: l'hub (`index.html`) più, per ogni gioco, una cartella `<id>/` con la pagina, `manifest.webmanifest`, le icone e `sw.js` (service worker per giocare offline, con scope nella cartella del gioco). Il service worker funziona solo su https o su `localhost`. L'hub non ha service worker: offline si apre il gioco già visitato, non l'hub.

### GitHub Pages

Il workflow [.github/workflows/pages.yml](.github/workflows/pages.yml) a ogni push su `main` esegue build, `npm test` e le suite E2E (una per gioco) e, se sono tutte verdi, pubblica `dist/site/`. Una volta sola: nel repository su GitHub, **Settings -> Pages -> Build and deployment -> Source: GitHub Actions**.

## Licenza

[MIT](LICENSE).
