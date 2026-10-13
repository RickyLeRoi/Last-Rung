// games/sabbia/test/e2e/touch.js
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
  const touch = (type, points) => cdpSession.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  const center = async selector => { const box = await (await page.$(selector)).boundingBox(); return [box.x + box.width / 2, box.y + box.height / 2]; };
  const startX = gameState.x;
  await touch('touchStart', [{ x: 150, y: 200, id: 1 }]);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', [{ x: 150 + i * 10, y: 200, id: 1 }]); await page.waitForTimeout(20); }
  const [paintX, paintY] = await center('[data-hold="paint:1"]');
  await touch('touchStart', [{ x: 200, y: 200, id: 1 }, { x: paintX, y: paintY, id: 2 }]);
  await page.waitForTimeout(600);
  check(await page.evaluate(() => document.querySelector('[data-hold="paint:1"]').classList.contains('act')), 'telefono: DISEGNA resta premuto mentre lo tieni');
  await touch('touchEnd', []);
  gameState = await state(page);
  check(gameState.x > startX + 5, 'telefono: la levetta muove il pennello (' + startX.toFixed(0) + ' -> ' + gameState.x.toFixed(0) + ')');
  check(gameState.sand > 0, 'telefono: tenendo DISEGNA si versa la sabbia (' + gameState.sand + ')');
  const before = gameState.selected;
  const [nextX, nextY] = await center('[data-edge="next"]');
  await page.touchscreen.tap(nextX, nextY); await page.waitForTimeout(100);
  check((await state(page)).selected !== before, 'telefono: MATERIALE cambia materiale');
  await page.screenshot({ path: path.join(SHOTS, 'sabbia_phone.png') });
  check(errors.length === 0, 'telefono: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browserContext.close();
};
