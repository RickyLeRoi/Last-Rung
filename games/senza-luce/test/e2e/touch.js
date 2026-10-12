// games/senza-luce/test/e2e/touch.js
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
  const startX = gameState.x;
  await touch('touchStart', 200, 250);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', 200 - i * 10, 250); await page.waitForTimeout(20); }
  await page.waitForTimeout(900);
  gameState = await state(page);
  await page.screenshot({ path: path.join(SHOTS, 'senza-luce_phone.png') });
  await touch('touchEnd');
  check(gameState.x < startX - 10, 'telefono: la levetta a sinistra porta la barca verso la grotta (' + startX.toFixed(0) + ' -> ' + gameState.x.toFixed(0) + ')');

  const tapButton = async selector => {
    const box = await (await page.$(selector)).boundingBox();
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(150);
  };
  await tapButton('[data-edge="smoke"]');
  check((await state(page)).smokeScreens === 1, 'telefono: il pulsante FUMO lancia un fumogeno');
  await tapButton('[data-edge="engine"]');
  const engineButtonActive = await page.evaluate(() => document.getElementById('bEngine').classList.contains('act'));
  check(!(await state(page)).engineOn && engineButtonActive, 'telefono: SPEGNI spegne il motore e resta premuto');
  await tapButton('[data-edge="engine"]');
  check((await state(page)).engineOn && !(await page.evaluate(() => document.getElementById('bEngine').classList.contains('act'))), 'telefono: SPEGNI di nuovo riaccende il motore');
  check(errors.length === 0, 'telefono: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browserContext.close();
};
