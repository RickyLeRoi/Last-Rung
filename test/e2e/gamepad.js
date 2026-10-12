// test/e2e/gamepad.js
'use strict';
const { GAME_URL, check, state } = require('./lib');

module.exports = async (browser, ctx) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.addInitScript(() => {
    window.__rumble = [];
    window.__pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      vibrationActuator: { playEffect: (effectType, options) => { window.__rumble.push(effectType + ':' + options.duration); return Promise.resolve(); } } };
    navigator.getGamepads = () => [window.__pad];
  });
  await page.goto(GAME_URL);
  await page.waitForTimeout(300);
  const press = async buttonIndex => { await page.evaluate(buttonIndex => { window.__pad.buttons[buttonIndex].pressed = true; }, buttonIndex); await page.waitForTimeout(60); await page.evaluate(buttonIndex => { window.__pad.buttons[buttonIndex].pressed = false; }, buttonIndex); await page.waitForTimeout(60); };
  await press(0); await press(0);
  let gameState = await state(page);
  check(gameState.st === 'play', 'gamepad: A conferma nei menu (' + gameState.st + ')');
  const initialY = gameState.y;
  await page.evaluate(() => { window.__pad.axes = [0.6, -0.9]; });
  await page.waitForTimeout(800);
  gameState = await state(page);
  check(gameState.y < initialY - 5 && gameState.vx > 0.2, 'gamepad: levetta analogica muove l\'elicottero');
  await press(2);
  gameState = await state(page);
  check(gameState.stab, 'gamepad: X attiva lo stabilizzatore');
  await page.evaluate(() => { window.__pad.axes = [0, 0, 0, 1]; });
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__pad.axes = [0, 0, 0, 0]; });
  const winchLength = await page.evaluate(() => window.__eli.game.heli.winch);
  check(winchLength > 10, 'gamepad: levetta destra in giù cala la scaletta (' + winchLength.toFixed(1) + ' px)');
  await press(3);
  const levelInfo = await page.evaluate(() => ({ t: window.__eli.game.L.tutorial, n: window.__eli.game.L.n }));
  check(!levelInfo.t && levelInfo.n === 1, "gamepad: Y salta l'addestramento");
  await page.evaluate(() => window.__eli.Sfx.play('explode'));
  const rumbleEvents = await page.evaluate(() => window.__rumble);
  check(rumbleEvents.length > 0 && /dual-rumble/.test(rumbleEvents[0]), 'gamepad: vibrazione (' + rumbleEvents.join(',') + ')');
  await page.close();
};
