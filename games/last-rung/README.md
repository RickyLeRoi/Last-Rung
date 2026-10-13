# Last Rung

Gioco di soccorso in elicottero, pixel art bianco su nero. HTML5 Canvas + JavaScript puro, zero dipendenze. Si gioca nel browser (desktop e telefono) e, una volta installato, anche offline. Fa parte di [One Bit Games](../../README.md) e usa il [motore comune](../../engine/README.md).

## Giocare

`dist/` non è versionato: prima genera i giochi con `npm install && npm run build`, poi apri `dist/last-rung.html` nel browser (doppio clic). Funziona con tastiera, gamepad e touch. In alternativa si gioca online su GitHub Pages: `https://rickyleroi.github.io/one-bit-games/last-rung/`.

Per installarlo sul telefono come app (anche offline), apri la pagina del gioco su Pages e usa "Aggiungi a schermata Home". La build prepara l'app in `dist/site/last-rung/` (stesso gioco più manifest, icone e service worker; serve https). Dettagli nel [README di progetto](../../README.md).

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
| Audio on/off | M | - | AUDIO |
| Salta l'addestramento | N | Y | SALTA |
| Lampi dei fulmini pieni / ridotti | L | - | LAMPI (nel titolo) |

Parametri URL: `?livello=N` parte dal livello N (senza addestramento), `?notte` rende notturni tutti i livelli, `?nebbia` li mette tutti nella nebbia, `?lampi=0` parte con i lampi ridotti, `?debug` espone lo stato in `window.__eli`. I lampi partono ridotti anche se il sistema chiede meno animazioni.

## Regole

- La prima partita parte dall'addestramento (decollo, stabilizzatore, aggancio, atterraggio, verricello). Si può saltare in qualunque momento.
- Anche il rotore di coda uccide (costa 150 punti). I superstiti su un tetto non lo attraversano: aspettano davanti alla coda, quindi conviene atterrare con la scaletta verso di loro.
- Chi muore schizza sangue rosso (unica eccezione al bianco e nero): macchia tetti e pareti degli edifici e, se l'ha ucciso l'elicottero, resta sulla parte dell'elicottero che l'ha colpito (pale, coda, cabina).
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
- Aggancio con la scaletta solo sotto il 20% della velocità massima; più veloce la scaletta non aggancia, ma non fa male a nessuno. Le pale uccidono sempre.
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

## Cartella del gioco

```
game.json         id, titolo, manifest, icona, globale di debug (letto dalla build e dai test)
index.html        pagina di sviluppo: carica engine e sorgenti separati (blocco build:js)
src/
  config.js       tutti i numeri del gioco (fisica, regole, carburante, punteggi)
  sprites.js      pixel art e hitbox
  state.js        stato della partita
  sfx.js          effetti e loop sonori del gioco
  bindings.js     tasti, pulsanti del pad e assi del gioco (configura l'Input dell'engine)
  water.js        wrapper dell'acqua e splash
  particles.js    hook delle particelle (secchio, sangue, scie) e downwash
  level.js        generazione dei livelli e sfida del giorno
  heli.js         elicottero: volo, carburante, scafo, collisioni
  people/         persone: contatti, sangue, naufraghi, scaletta e catena, tetti, soccorritore
  gear.js         salvagenti e secchio d'acqua
  tutorial.js     addestramento guidato (passi del gioco, logica in engine/core/steps.js)
  env.js          fuoco e orchestrazione di vento, pioggia, fulmini, camera
  render.js       disegno di mondo, HUD e pannelli
  main.js         simulazione, hook del flusso, avvio
test/
  helpers.js      boot() del gioco e funzioni di pilotaggio per i test
  snapshot.js     lo stato di simulazione usato dagli hash dei golden
  run.js          suite di test (regole, fisica, replay, gamepad...)
  levels.js       ogni livello è risolvibile: il pilota automatico salva ogni persona (~2 minuti)
  autopilot.js    il pilota automatico, condiviso da levels.js e dai golden
  golden.js       snapshot di stato, frame e Rng; baseline in golden/ (Node e browser)
  scenarios.js    scenari condivisi tra golden Node e golden nel browser
  e2e/            suite nel browser specifiche del gioco: keyboard, touch, gamepad, flow, visual, touchui
```

### Determinismo

Tutto ciò che influenza la partita usa `Rng`, ri-seminato a ogni tentativo, e il gioco avanza a passo fisso di 1/60 s. Gli input vengono registrati frame per frame (quantizzati al centesimo), così il replay ricostruisce la stessa identica partita. Regola per chi modifica: nella simulazione mai `Math.random()`, ammesso solo nel render (tremolio) e nell'audio.
