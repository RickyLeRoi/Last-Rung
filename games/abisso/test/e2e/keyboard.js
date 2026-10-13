// games/abisso/test/e2e/keyboard.js
'use strict';
const path = require('path');
const { GAME_URL, SHOTS, check, onlyBlackWhite, startPlay, state, collectErrors } = require('./lib');

module.exports = async browser => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = collectErrors(page);
  await page.goto(GAME_URL);
  await page.waitForTimeout(500);
  await startPlay(page);
  let gameState = await state(page);
  check(gameState.st === 'play' && gameState.tutorial, "tastiera: dal titolo all'addestramento (" + gameState.st + ')');

  const startX = gameState.x;
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
  gameState = await state(page);
  check(gameState.x > startX + 5, 'tastiera: destra muove il sommergibile (' + startX.toFixed(0) + ' -> ' + gameState.x.toFixed(0) + ')');
  check(gameState.battery === Infinity || gameState.battery > 0, 'tastiera: batteria presente');
  await page.keyboard.press('Space'); await page.waitForTimeout(100);
  check((await state(page)).sonarT > 0, 'tastiera: Spazio lancia il sonar');
  await page.keyboard.press('KeyX'); await page.waitForTimeout(100);
  check((await state(page)).lamp === false, 'tastiera: X spegne il faro');

  await page.keyboard.press('KeyN'); await page.waitForTimeout(100);
  gameState = await state(page);
  check(!gameState.tutorial && gameState.n === 1, "tastiera: N salta l'addestramento (livello " + gameState.n + ')');
  await startPlay(page);
  const startY = (await state(page)).y;
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(1500); await page.keyboard.up('ArrowDown');
  check((await state(page)).y > startY + 10, 'tastiera: giu fa scendere il sommergibile');
  const colors = await onlyBlackWhite(page);
  check(colors.bad === 0 && colors.white > 0, 'tastiera: solo bianco, nero e rosso (' + colors.bad + ' pixel fuori palette)');
  await page.screenshot({ path: path.join(SHOTS, 'abisso_desktop.png') });
  check(errors.length === 0, 'tastiera: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await page.close();
};
