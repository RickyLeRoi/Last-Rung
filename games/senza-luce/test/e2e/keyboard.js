// games/senza-luce/test/e2e/keyboard.js
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
  check(gameState.tutorial, "tastiera: la prima partita parte dall'addestramento");

  const startX = gameState.x;
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(700); await page.keyboard.up('ArrowLeft');
  gameState = await state(page);
  check(gameState.x < startX - 10, 'tastiera: sinistra porta la barca verso la grotta (' + startX.toFixed(0) + ' -> ' + gameState.x.toFixed(0) + ')');
  const startLane = gameState.lane;
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(400); await page.keyboard.up('ArrowDown');
  check((await state(page)).lane === startLane + 1, 'tastiera: giu cambia corsia di una sola corsia');
  await page.keyboard.press('Space'); await page.waitForTimeout(150);
  gameState = await state(page);
  check(gameState.smokes === 1 && gameState.smokeScreens === 1, 'tastiera: Spazio lancia un fumogeno (' + gameState.smokes + ' rimasti)');
  await page.keyboard.press('KeyX'); await page.waitForTimeout(150);
  check(!(await state(page)).engineOn, 'tastiera: X spegne il motore');
  await page.keyboard.press('KeyX'); await page.waitForTimeout(150);
  check((await state(page)).engineOn, 'tastiera: X lo riaccende');

  await page.keyboard.press('KeyN'); await page.waitForTimeout(100);
  gameState = await state(page);
  check(!gameState.tutorial && gameState.n === 1, "tastiera: N salta l'addestramento (livello " + gameState.n + ')');
  await startPlay(page);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowLeft');
  const colors = await onlyBlackWhite(page);
  check(colors.bad === 0 && colors.white > 0, 'tastiera: solo bianco, nero e rosso (' + colors.bad + ' pixel fuori palette)');
  await page.screenshot({ path: path.join(SHOTS, 'senza-luce_desktop.png') });
  check(errors.length === 0, 'tastiera: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await page.close();
};
