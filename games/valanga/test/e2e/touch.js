// games/valanga/test/e2e/touch.js
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
  const touch = (type, x, y, id = 1) => cdpSession.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
  const startX = gameState.x;
  await touch('touchStart', 150, 250);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', 150 + i * 10, 250); await page.waitForTimeout(20); }
  await page.waitForTimeout(900);
  await touch('touchEnd');
  gameState = await state(page);
  check(gameState.x > startX + 10, 'telefono: la levetta fa camminare il soccorritore (' + startX.toFixed(0) + ' -> ' + gameState.x.toFixed(0) + ')');
  await page.waitForTimeout(200);

  const center = async selector => { const box = await (await page.$(selector)).boundingBox(); return [box.x + box.width / 2, box.y + box.height / 2]; };
  const [probeX, probeY] = await center('[data-edge="probe"]');
  await page.touchscreen.tap(probeX, probeY); await page.waitForTimeout(100);
  check((await state(page)).probeT > 0, 'telefono: il pulsante SONDA pianta la sonda');
  await page.waitForTimeout(800);
  const beforeDig = await state(page);
  const [digX, digY] = await center('[data-hold="dig:1"]');
  await touch('touchStart', digX, digY, 2); await page.waitForTimeout(1500);
  check(await page.evaluate(() => document.querySelector('[data-hold="dig:1"]').classList.contains('act')), 'telefono: SCAVA resta premuto mentre lo tieni');
  await touch('touchEnd');
  gameState = await state(page);
  await page.screenshot({ path: path.join(SHOTS, 'valanga_phone.png') });
  check(gameState.dug && gameState.y > beforeDig.y + 3, 'telefono: tenendo SCAVA il soccorritore scava e scende (y ' + beforeDig.y.toFixed(0) + ' -> ' + gameState.y.toFixed(0) + ')');
  check(errors.length === 0, 'telefono: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browserContext.close();
};
