// test/e2e/touch.js
'use strict';
const path = require('path');
const { GAME_URL, SHOTS, check, state } = require('./lib');

module.exports = async (browser, ctx) => {
  const browserContext = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await browserContext.newPage();
  await page.addInitScript(() => { window.__vib = []; navigator.vibrate = duration => { window.__vib.push(duration); return true; }; });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(GAME_URL);
  await page.waitForTimeout(400);
  const canvasWidth = await page.evaluate(() => parseFloat(document.getElementById('game').style.width));
  check(canvasWidth > 600, 'telefono: il gioco riempie lo schermo (larghezza canvas ' + canvasWidth + 'px su 844)');
  await page.touchscreen.tap(420, 200); await page.waitForTimeout(150);
  const shown = await page.evaluate(() => document.getElementById('touch').classList.contains('on'));
  check(shown, 'telefono: i comandi touch compaiono al primo tocco');
  await page.touchscreen.tap(420, 200); await page.waitForTimeout(150);
  let gameState = await state(page);
  check(gameState.st === 'play', 'telefono: tocco = conferma nei menu (' + gameState.st + ')');
  const cdpSession = await browserContext.newCDPSession(page);
  const touch = (type, x, y) => cdpSession.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const initialY = gameState.y;
  await touch('touchStart', 150, 250);
  for (let i = 1; i <= 5; i++) { await touch('touchMove', 150 + i * 6, 250 - i * 9); await page.waitForTimeout(20); }
  await page.waitForTimeout(900);
  gameState = await state(page);
  await page.screenshot({ path: path.join(SHOTS, 'browser_phone.png') });
  await touch('touchEnd');
  check(gameState.y < initialY - 5 && gameState.vx > 0, 'telefono: la levetta fa salire e spostare a destra (dy ' + (gameState.y - initialY).toFixed(1) + ', vx ' + gameState.vx.toFixed(2) + ')');
  const stabButton = await page.$('#bStab');
  const stabButtonBox = await stabButton.boundingBox();
  await page.touchscreen.tap(stabButtonBox.x + stabButtonBox.width / 2, stabButtonBox.y + stabButtonBox.height / 2); await page.waitForTimeout(150);
  gameState = await state(page);
  const isActive = await page.evaluate(() => document.getElementById('bStab').classList.contains('act'));
  check(gameState.stab && isActive, 'telefono: pulsante STAB attiva lo stabilizzatore e si evidenzia');
  const winchDownBox = await (await page.$('[data-winch="1"]')).boundingBox();
  await touch('touchStart', winchDownBox.x + winchDownBox.width / 2, winchDownBox.y + winchDownBox.height / 2);
  await page.waitForTimeout(600);
  await touch('touchEnd');
  const ladderLength = await page.evaluate(() => window.__eli.game.heli.winch);
  check(ladderLength > 10, 'telefono: tenendo premuto ▼ la scaletta si allunga (' + ladderLength.toFixed(1) + ' px)');
  const skip = await page.$('button[data-edge="skip"]');
  const isSkipVisible = skip && await skip.isVisible();
  check(isSkipVisible, "telefono: pulsante SALTA visibile durante l'addestramento");
  const gear = await page.evaluate(() => {
    const buoyButton = document.querySelector('button[data-edge="buoy"]'), bucketButton = document.querySelector('button[data-edge="bucket"]');
    return { buoy: buoyButton && getComputedStyle(buoyButton).display !== 'none', bucket: bucketButton && getComputedStyle(bucketButton).display !== 'none' };
  });
  check(gear.buoy && !gear.bucket, 'telefono: pulsante SALVAGENTE visibile, SECCHIO solo negli incendi');
  const buoyBox = await (await page.$('button[data-edge="buoy"]')).boundingBox();
  await page.touchscreen.tap(buoyBox.x + buoyBox.width / 2, buoyBox.y + buoyBox.height / 2); await page.waitForTimeout(120);
  const buoysLeft = await page.evaluate(() => window.__eli.game.heli.buoys);
  check(buoysLeft === 2, 'telefono: SALVAGENTE lancia un salvagente (' + buoysLeft + ' rimasti)');
  await page.evaluate(() => window.__eli.Sfx.play('damage'));
  const vibrations = await page.evaluate(() => window.__vib);
  check(vibrations.length > 0, 'telefono: vibrazione sui danni (' + vibrations.join(',') + ' ms)');
  if (isSkipVisible) { const skipBox = await skip.boundingBox(); await page.touchscreen.tap(skipBox.x + skipBox.width / 2, skipBox.y + skipBox.height / 2); await page.waitForTimeout(150); }
  const levelInfo = await page.evaluate(() => ({ t: window.__eli.game.L.tutorial, n: window.__eli.game.L.n }));
  check(!levelInfo.t && levelInfo.n === 1, "telefono: SALTA porta al livello 1");
  check(errors.length === 0, 'telefono: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await browserContext.close();
};
