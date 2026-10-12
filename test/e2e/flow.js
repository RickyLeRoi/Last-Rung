// test/e2e/flow.js
'use strict';
const { check, openWithClock, enterPlay, hold, advance, advanceUntil } = require('./lib');

// Names copied from effects in src/sfx.js.
const EFFECT_NAMES = ['ui', 'hook', 'board', 'save', 'death', 'explode', 'damage', 'contact', 'splash', 'land', 'lowFuel', 'engineDie', 'refuel',
  'stabOn', 'stabOff', 'thunder', 'win', 'scream', 'slip', 'snag', 'throw', 'dump', 'hiss', 'fail'];

const readGame = (page, fields) => page.evaluate(names => { const game = window.__eli.game; const out = {}; for (const name of names) out[name] = game[name]; return out; }, fields);
const snapshot = page => page.evaluate(() => {
  const game = window.__eli.game, heli = game.heli, level = game.L;
  return { x: heli.x, y: heli.y, vx: heli.vx, vy: heli.vy, fuel: heli.fuel, saved: level.saved, dead: level.dead, score: game.score, frame: game.frame, state: game.state };
});

module.exports = async (browser, ctx) => {
  {
    const { page, errors } = await openWithClock(browser, '&livello=1');
    await enterPlay(page);
    await advance(page, 30);
    await page.keyboard.press('KeyP'); await advance(page, 2);
    const paused = await readGame(page, ['state', 'frame']);
    await advance(page, 120);
    const stillPaused = await readGame(page, ['state', 'frame']);
    check(paused.state === 'pause' && stillPaused.frame === paused.frame, 'flusso: P mette in pausa e la simulazione si ferma (frame ' + paused.frame + ' -> ' + stillPaused.frame + ')');
    await page.keyboard.press('KeyP'); await advance(page, 30);
    const resumed = await readGame(page, ['state', 'frame']);
    check(resumed.state === 'play' && resumed.frame > stillPaused.frame, 'flusso: P riprende la partita (frame ' + resumed.frame + ')');

    await page.evaluate(() => { window.__eli.game.score = 250; });
    await page.keyboard.press('KeyR'); await advance(page, 2);
    const restarted = await readGame(page, ['state', 'frame', 'score', 'levelStartScore']);
    check(restarted.frame < 10 && restarted.score === restarted.levelStartScore, 'flusso: R ricomincia il livello (frame ' + restarted.frame + ', punteggio ' + restarted.score + ' = ' + restarted.levelStartScore + ')');

    check(await page.evaluate(() => window.__eli.Sfx.muted) === false, 'flusso: audio attivo all\'avvio');
    await page.keyboard.press('KeyM'); await advance(page, 2);
    const mutedAfterFirst = await page.evaluate(() => window.__eli.Sfx.muted);
    await page.keyboard.press('KeyM'); await advance(page, 2);
    const mutedAfterSecond = await page.evaluate(() => window.__eli.Sfx.muted);
    check(mutedAfterFirst === true && mutedAfterSecond === false, 'flusso: M disattiva e riattiva l\'audio');

    const thrown = await page.evaluate(names => { const failed = []; for (const name of names) { try { window.__eli.Sfx.play(name); } catch (error) { failed.push(name); } } return failed; }, EFFECT_NAMES);
    await advance(page, 5);
    check(thrown.length === 0 && errors.length === 0, 'flusso: tutti i ' + EFFECT_NAMES.length + ' effetti sonori suonano senza errori' + (thrown.length ? ' (eccezioni: ' + thrown.join(', ') + ')' : '') + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }
  {
    const { page } = await openWithClock(browser, '');
    await page.keyboard.press('KeyG'); await advance(page, 2);
    const daily = await page.evaluate(() => {
      const now = new Date(), twoDigits = value => String(value).padStart(2, '0');
      return { spec: window.__eli.game.spec.daily, today: now.getFullYear() + '-' + twoDigits(now.getMonth() + 1) + '-' + twoDigits(now.getDate()), state: window.__eli.game.state };
    });
    check(daily.spec === daily.today && daily.state === 'intro', 'flusso: G dal titolo avvia la sfida del giorno (' + daily.spec + ')');
    await page.close();
  }
  {
    const { page } = await openWithClock(browser, '&livello=2');
    await enterPlay(page);
    await hold(page, 'ArrowUp', 90);
    await page.keyboard.down('ArrowRight');
    const framesToCrash = await advanceUntil(page, '() => window.__eli.game.state === "over"', 2000);
    await page.keyboard.up('ArrowRight');
    const original = await snapshot(page);
    await advanceUntil(page, '() => window.__eli.game.overT <= 0', 300);
    await page.keyboard.press('KeyV'); await advance(page, 2);
    const replayState = await page.evaluate(() => window.__eli.game.state);
    // Enter fast-forwards the whole replay inside a single frame; a second frame would keep simulating the 'over' state.
    await page.keyboard.press('Enter'); await advance(page, 1);
    const replayed = await snapshot(page);
    check(framesToCrash >= 0 && replayState === 'replay' && replayed.state === 'over' && JSON.stringify(replayed) === JSON.stringify(original),
      'flusso: il replay ricostruisce la partita identica (x ' + original.x.toFixed(3) + ' / ' + replayed.x.toFixed(3) + ', frame ' + original.frame + ' / ' + replayed.frame + ')');
    await page.close();
  }
};
