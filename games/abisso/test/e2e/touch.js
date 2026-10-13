// games/abisso/test/e2e/touch.js
'use strict';
const path = require('path');
const { GAME_URL, SHOTS, check, state, collectErrors } = require('./lib');

module.exports = async browser => {
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
  const touch = (type, x, y, id = 1) => cdpSession.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
  const center = async selector => { const box = await (await page.$(selector)).boundingBox(); return [box.x + box.width / 2, box.y + box.height / 2]; };
  const startX = gameState.x;
  await touch('touchStart', 150, 250);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', 150 + i * 10, 250); await page.waitForTimeout(20); }
  await page.waitForTimeout(700);
  await touch('touchEnd');
  gameState = await state(page);
  check(gameState.x > startX + 5, 'telefono: la levetta muove il sommergibile (' + startX.toFixed(0) + ' -> ' + gameState.x.toFixed(0) + ')');
  const [sonarX, sonarY] = await center('[data-edge="sonar"]');
  await page.touchscreen.tap(sonarX, sonarY); await page.waitForTimeout(100);
  check((await state(page)).sonarT > 0, 'telefono: il pulsante SONAR lancia il sonar');
  const [lampX, lampY] = await center('#lampButton');
  await page.touchscreen.tap(lampX, lampY); await page.waitForTimeout(100);
  check((await state(page)).lamp === false && !(await page.evaluate(() => document.getElementById('lampButton').classList.contains('act'))), 'telefono: FARO spegne il faro e il pulsante si spegne');
  await page.screenshot({ path: path.join(SHOTS, 'abisso_phone.png') });
  check(errors.length === 0, 'telefono: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browserContext.close();
};
