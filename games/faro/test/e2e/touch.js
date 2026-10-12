// games/faro/test/e2e/touch.js
'use strict';
const path = require('path');
const { GAME_URL, SHOTS, check, state, collectErrors } = require('./lib');

module.exports = async (browser, ctx) => {
  const browserContext = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await browserContext.newPage();
  const errors = collectErrors(page);
  await page.goto(GAME_URL);
  await page.waitForTimeout(400);
  await page.touchscreen.tap(420, 200); await page.waitForTimeout(150);
  check(await page.evaluate(() => document.getElementById('touch').classList.contains('on')), 'telefono: i comandi touch compaiono al primo tocco');
  await page.touchscreen.tap(420, 200); await page.waitForTimeout(150);
  let gameState = await state(page);
  check(gameState.st === 'play', 'telefono: tocco = conferma nei menu (' + gameState.st + ')');

  const cdpSession = await browserContext.newCDPSession(page);
  const touch = (type, x, y) => cdpSession.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const initialPitch = gameState.pitch, initialSpread = gameState.spread;
  await touch('touchStart', 150, 250);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', 150 + i * 8, 250 - i * 9); await page.waitForTimeout(20); }
  await page.waitForTimeout(700);
  gameState = await state(page);
  await page.screenshot({ path: path.join(SHOTS, 'faro_phone.png') });
  await touch('touchEnd');
  check(gameState.pitch > initialPitch + 0.05 && gameState.spread < initialSpread - 0.05, 'telefono: la levetta orienta e stringe il fascio (pitch ' + gameState.pitch.toFixed(2) + ', spread ' + gameState.spread.toFixed(2) + ')');

  const sirenBox = await (await page.$('[data-edge="drop"]')).boundingBox();
  await page.touchscreen.tap(sirenBox.x + sirenBox.width / 2, sirenBox.y + sirenBox.height / 2); await page.waitForTimeout(150);
  check((await state(page)).sirenT > 0, 'telefono: il pulsante SIRENA suona la sirena');
  const flashBox = await (await page.$('[data-edge="stab"]')).boundingBox();
  await page.touchscreen.tap(flashBox.x + flashBox.width / 2, flashBox.y + flashBox.height / 2); await page.waitForTimeout(100);
  check((await state(page)).lampFlashT > 0, 'telefono: il pulsante LAMPO lancia il lampo');
  check(errors.length === 0, 'telefono: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browserContext.close();
};
