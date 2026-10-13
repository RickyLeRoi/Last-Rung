// games/formicaio/test/e2e/touch.js
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
  const center = async selector => { const box = await (await page.$(selector)).boundingBox(); return [box.x + box.width / 2, box.y + box.height / 2]; };
  const startY = gameState.y;
  const [trailX, trailY] = await center('[data-hold="trail:1"]');
  await touch('touchStart', 150, 200);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', 150, 200 + i * 10); await page.waitForTimeout(20); }
  await cdpSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 250, id: 1 }, { x: trailX, y: trailY, id: 2 }] });
  await page.waitForTimeout(700);
  check(await page.evaluate(() => document.querySelector('[data-hold="trail:1"]').classList.contains('act')), 'telefono: TRACCIA resta premuto mentre lo tieni');
  await touch('touchEnd');
  gameState = await state(page);
  check(gameState.y > startY + 10, 'telefono: la levetta muove il cursore (' + startY.toFixed(0) + ' -> ' + gameState.y.toFixed(0) + ')');
  check(gameState.orders > 3, 'telefono: tenendo TRACCIA il cursore lascia una pista di scavo (' + gameState.orders + ' ordini)');
  const [chamberX, chamberY] = await center('[data-edge="chamber"]');
  await page.touchscreen.tap(chamberX, chamberY); await page.waitForTimeout(100);
  check((await state(page)).chambers === 2, 'telefono: CAMERA segna una camera');
  const [recallX, recallY] = await center('#recallButton');
  await page.touchscreen.tap(recallX, recallY); await page.waitForTimeout(100);
  check((await state(page)).recall && await page.evaluate(() => document.getElementById('recallButton').classList.contains('act')), 'telefono: RICHIAMA si accende e resta acceso');
  check(await page.evaluate(() => getComputedStyle(document.querySelector('[data-edge="plug"]')).display === 'none'), 'telefono: TAPPA nascosto senza pioggia');
  await page.screenshot({ path: path.join(SHOTS, 'formicaio_phone.png') });
  check(errors.length === 0, 'telefono: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browserContext.close();
};
