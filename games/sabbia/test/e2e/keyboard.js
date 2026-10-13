// games/sabbia/test/e2e/keyboard.js
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
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(400); await page.keyboard.up('ArrowLeft');
  gameState = await state(page);
  check(gameState.x < startX - 5, 'tastiera: sinistra muove il pennello (' + startX.toFixed(0) + ' -> ' + gameState.x.toFixed(0) + ')');
  await page.keyboard.down('Space'); await page.waitForTimeout(400); await page.keyboard.up('Space');
  check((await state(page)).sand > 0, 'tastiera: Spazio tenuto versa la sabbia');
  const before = (await state(page)).selected;
  await page.keyboard.press('KeyX'); await page.waitForTimeout(100);
  check((await state(page)).selected !== before, 'tastiera: X cambia materiale');
  const brush = (await state(page)).brush;
  await page.keyboard.press('KeyC'); await page.waitForTimeout(100);
  check((await state(page)).brush !== brush, 'tastiera: C cambia la dimensione del pennello');

  await page.keyboard.press('KeyN'); await page.waitForTimeout(100);
  gameState = await state(page);
  check(!gameState.tutorial && gameState.n === 1, "tastiera: N salta l'addestramento (sfida " + gameState.n + ')');
  await startPlay(page);
  await page.keyboard.down('Space'); await page.waitForTimeout(800); await page.keyboard.up('Space');
  await page.waitForTimeout(600);
  const colors = await onlyBlackWhite(page);
  check(colors.bad === 0 && colors.white > 0, 'tastiera: solo bianco, nero e rosso (' + colors.bad + ' pixel fuori palette)');
  await page.screenshot({ path: path.join(SHOTS, 'sabbia_desktop.png') });

  await page.goto(GAME_URL);
  await page.waitForTimeout(400);
  await page.keyboard.press('KeyL'); await page.waitForTimeout(150);
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  gameState = await state(page);
  check(gameState.lab && gameState.st === 'play', 'tastiera: L dal titolo apre il laboratorio (' + gameState.st + ')');
  check(errors.length === 0, 'tastiera: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await page.close();
};
