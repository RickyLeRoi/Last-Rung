// games/faro/test/e2e/keyboard.js
'use strict';
const path = require('path');
const { GAME_URL, SHOTS, check, onlyBlackWhite, startPlay, state, collectErrors } = require('./lib');

module.exports = async (browser, ctx) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = collectErrors(page);
  await page.goto(GAME_URL);
  await page.waitForTimeout(500);
  await startPlay(page);
  let gameState = await state(page);
  check(gameState.st === 'play', 'tastiera: dal titolo alla partita (' + gameState.st + ')');
  check(await page.evaluate(() => window.__debug.game.L.tutorial), "tastiera: la prima partita parte dall'addestramento");

  const initialPitch = gameState.pitch;
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
  gameState = await state(page);
  check(gameState.pitch > initialPitch + 0.1, 'tastiera: destra abbassa il fascio (' + initialPitch.toFixed(2) + ' -> ' + gameState.pitch.toFixed(2) + ')');
  const initialSpread = gameState.spread;
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500); await page.keyboard.up('ArrowUp');
  gameState = await state(page);
  check(gameState.spread < initialSpread - 0.1, 'tastiera: su stringe il fascio (' + initialSpread.toFixed(2) + ' -> ' + gameState.spread.toFixed(2) + ')');
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  check((await state(page)).sirenT > 0, 'tastiera: Spazio suona la sirena');
  const oilBefore = (await state(page)).oil;
  await page.keyboard.press('KeyX'); await page.waitForTimeout(100);
  const afterFlash = await state(page);
  check(afterFlash.lampFlashT > 0 && afterFlash.oil < oilBefore - 5, 'tastiera: X lancia il lampo e consuma olio (' + oilBefore.toFixed(1) + ' -> ' + afterFlash.oil.toFixed(1) + ')');

  await page.keyboard.press('KeyN'); await page.waitForTimeout(100);
  const after = await page.evaluate(() => ({ tutorial: window.__debug.game.L.tutorial, n: window.__debug.game.L.n }));
  check(!after.tutorial && after.n === 1, "tastiera: N salta l'addestramento (livello " + after.n + ')');
  await startPlay(page);
  await page.waitForTimeout(3000);
  const colors = await onlyBlackWhite(page);
  check(colors.bad === 0 && colors.white > 0, 'tastiera: solo bianco, nero e rosso (' + colors.bad + ' pixel fuori palette)');
  await page.screenshot({ path: path.join(SHOTS, 'faro_desktop.png') });
  check(errors.length === 0, 'tastiera: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await page.close();
};
