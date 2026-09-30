#!/usr/bin/env node
/*
 * Real-browser check (headless Chromium via Playwright):
 *   NODE_PATH=$(npm root -g) node test/browser.js
 */
'use strict';
const path = require('path');
const { chromium } = require('playwright');
const URL = 'file://' + path.join(__dirname, '..', 'dist', 'last-rung.html') + '?debug';
const SHOTS = path.join(__dirname, 'shots');
let fails = 0;
const check = (passed, message) => { console.log((passed ? '  OK   ' : '  FAIL ') + message); if (!passed) fails++; };

async function onlyBlackWhite(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('game'), pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let badCount = 0, whiteCount = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const channelValue = pixels[i];
      const isBlood = channelValue === 221 && pixels[i + 1] === 0 && pixels[i + 2] === 0;
      if (!isBlood && (pixels[i + 1] !== channelValue || pixels[i + 2] !== channelValue || (channelValue !== 0 && channelValue !== 255))) badCount++;
      if (channelValue === 255) whiteCount++;
    }
    return { bad: badCount, white: whiteCount };
  });
}
// Two Enter presses within the same frame count as one, hence the retry loop.
async function startPlay(page) {
  for (let i = 0; i < 6; i++) {
    if (await page.evaluate(() => window.__eli.game.state) === 'play') return;
    await page.keyboard.press('Enter'); await page.waitForTimeout(60);
  }
}
const state = page => page.evaluate(() => { const game = window.__eli.game, heli = game.heli; return { st: game.state, x: heli.x, y: heli.y, vx: heli.vx, vy: heli.vy, stab: heli.stab, hs: heli.state }; });

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });

  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.goto(URL);
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter'); await page.waitForTimeout(100);
    await page.keyboard.press('Enter'); await page.waitForTimeout(100);
    let gameState = await state(page);
    check(gameState.st === 'play', 'tastiera: dal titolo alla partita (' + gameState.st + ')');
    const isTutorial = await page.evaluate(() => window.__eli.game.L.tutorial);
    check(isTutorial, "tastiera: la prima partita parte dall'addestramento");
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(700);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500);
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowUp');
    await page.keyboard.press('KeyX'); await page.waitForTimeout(300);
    gameState = await state(page);
    check(gameState.stab && gameState.hs === 'fly', 'tastiera: volo e stabilizzatore con X');
    await page.keyboard.down('KeyE'); await page.waitForTimeout(500); await page.keyboard.up('KeyE');
    const ladderLength = await page.evaluate(() => window.__eli.game.heli.ladLen);
    check(ladderLength > 10, 'tastiera: E cala la scaletta (' + ladderLength.toFixed(1) + ' px)');
    await page.keyboard.press('KeyN'); await page.waitForTimeout(100);
    const after = await page.evaluate(() => ({ t: window.__eli.game.L.tutorial, n: window.__eli.game.L.n, st: window.__eli.game.state }));
    check(!after.t && after.n === 1, "tastiera: N salta l'addestramento (livello " + after.n + ', ' + after.st + ')');
    await page.keyboard.press('Enter'); await page.waitForTimeout(100);
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500); await page.keyboard.up('ArrowUp');
    const colorCheck = await onlyBlackWhite(page);
    check(colorCheck.bad === 0 && colorCheck.white > 500, 'canvas reale: solo bianco e nero (' + colorCheck.bad + ' pixel fuori palette, ' + colorCheck.white + ' bianchi)');
    const audioState = await page.evaluate(async () => { const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) return 'assente'; const audioContext = new AudioContextClass(); await audioContext.resume(); return audioContext.state; });
    check(audioState === 'running', 'audio WebAudio disponibile e attivo (' + audioState + ')');
    await page.keyboard.press('KeyM'); await page.waitForTimeout(100);
    await page.keyboard.press('KeyM'); await page.waitForTimeout(100);
    await page.goto(URL + '&livello=2'); await page.waitForTimeout(200);
    await startPlay(page);
    await page.evaluate(() => { window.__eli.game.lightningT = 1; });
    await page.waitForTimeout(40);
    const lightningColorCheck = await onlyBlackWhite(page);
    check(lightningColorCheck.bad === 0, 'lampo (inversione dello schermo): solo bianco e nero');
    await page.evaluate(() => { const game = window.__eli.game, rig = game.L.solids.find(solid => solid.kind === 'rig'); const heli = game.heli; heli.ground = null; heli.x = heli.px = rig.x + 40; heli.y = heli.py = 40; heli.vx = heli.vy = 0; game.camX = rig.x - 100; rig.blood = []; for (let i = 0; i < 20; i++) rig.blood.push(i, 0); game.lightningT = 1; });
    await page.waitForFunction(() => window.__eli.game.flashT > 0, null, { timeout: 2000 }).catch(() => {});
    const bloodCheck = await page.evaluate(() => { const canvas = document.getElementById('game'), pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data; let redCount = 0, cyanCount = 0; for (let i = 0; i < pixels.length; i += 4) { if (pixels[i] === 221 && !pixels[i + 1] && !pixels[i + 2]) redCount++; if (pixels[i] === 34 && pixels[i + 1] === 255 && pixels[i + 2] === 255) cyanCount++; } return { r: redCount, cyan: cyanCount, flash: window.__eli.game.flashT }; });
    check(bloodCheck.r > 0 && bloodCheck.cyan === 0, 'lampo: il sangue resta rosso (' + bloodCheck.r + ' rossi, ' + bloodCheck.cyan + ' azzurri, flash ' + bloodCheck.flash + ')');
    await page.goto(URL + '&livello=5'); await page.waitForTimeout(200);
    await startPlay(page);
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(600); await page.keyboard.up('ArrowUp');
    const night = await page.evaluate(() => window.__eli.game.L.night);
    const nightColorCheck = await onlyBlackWhite(page);
    check(night && nightColorCheck.bad === 0, 'notte (livello 5): buio a retino, solo bianco e nero (' + nightColorCheck.bad + ' fuori palette)');
    await page.keyboard.press('KeyZ'); await page.waitForTimeout(100);
    const buoys = await page.evaluate(() => window.__eli.game.heli.buoys);
    check(buoys === 2, 'tastiera: Z lancia un salvagente (' + buoys + ' rimasti)');
    await page.goto(URL + '&livello=10'); await page.waitForTimeout(200);
    await startPlay(page);
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500); await page.keyboard.up('ArrowUp');
    const fog = await page.evaluate(() => window.__eli.game.L.fog);
    const fogColorCheck = await onlyBlackWhite(page);
    check(fog && fogColorCheck.bad === 0, 'nebbia (livello 10): solo bianco e nero (' + fogColorCheck.bad + ' fuori palette)');
    await page.screenshot({ path: path.join(SHOTS, 'browser_fog.png') });
    await page.goto(URL + '&livello=4'); await page.waitForTimeout(200);
    await page.keyboard.press('Enter'); await page.waitForTimeout(80); await page.keyboard.press('Enter'); await page.waitForTimeout(80);
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(400); await page.keyboard.up('ArrowUp');
    await page.keyboard.press('KeyC'); await page.waitForTimeout(100);
    const bucket = await page.evaluate(() => window.__eli.game.heli.bucket.on);
    check(bucket, 'tastiera: C cala il secchio negli incendi');
    await page.screenshot({ path: path.join(SHOTS, 'browser_night.png') });
    await page.screenshot({ path: path.join(SHOTS, 'browser_desktop.png') });
    check(errors.length === 0, 'nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await page.close();
  }

  {
    const browserContext = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const page = await browserContext.newPage();
    await page.addInitScript(() => { window.__vib = []; navigator.vibrate = duration => { window.__vib.push(duration); return true; }; });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(URL);
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
  }

  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    await page.addInitScript(() => {
      window.__rumble = [];
      window.__pad = { connected: true, axes: [0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
        vibrationActuator: { playEffect: (effectType, options) => { window.__rumble.push(effectType + ':' + options.duration); return Promise.resolve(); } } };
      navigator.getGamepads = () => [window.__pad];
    });
    await page.goto(URL);
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
  }

  {
    const http = require('http'), fs = require('fs');
    const webDirectory = path.join(__dirname, '..', 'dist', 'web');
    const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
    const server = http.createServer((request, response) => {
      let requestPath = decodeURIComponent(request.url.split('?')[0]); if (requestPath.endsWith('/')) requestPath += 'index.html';
      const filePath = path.join(webDirectory, requestPath);
      if (!filePath.startsWith(webDirectory) || !fs.existsSync(filePath)) { response.writeHead(404); response.end(); return; }
      response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
      response.end(fs.readFileSync(filePath));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = 'http://localhost:' + server.address().port + '/';
    const browserContext = await browser.newContext();
    const page = await browserContext.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(baseUrl + '?debug');
    const isServiceWorkerActive = await page.evaluate(async () => { const registration = await Promise.race([navigator.serviceWorker.ready, new Promise(resolve => setTimeout(() => resolve(null), 5000))]); return !!(registration && registration.active); });
    check(isServiceWorkerActive, 'PWA: service worker registrato e attivo');
    const manifestInfo = await page.evaluate(async () => { const manifestLink = document.querySelector('link[rel=manifest]'); const manifest = await (await fetch(manifestLink.href)).json(); const iconsOk = []; for (const icon of manifest.icons) iconsOk.push((await fetch(icon.src)).ok); return { name: manifest.name, display: manifest.display, icons: iconsOk }; });
    check(manifestInfo.name === 'Last Rung' && manifestInfo.icons.length === 3 && manifestInfo.icons.every(Boolean), 'PWA: manifest e icone raggiungibili (' + manifestInfo.display + ')');
    await page.waitForTimeout(500);
    await browserContext.setOffline(true);
    await page.reload();
    await page.waitForTimeout(400);
    const offlineState = await page.evaluate(() => window.__eli && window.__eli.game.state);
    check(offlineState === 'title', 'PWA: senza rete il gioco si apre lo stesso (' + offlineState + ')');
    check(errors.length === 0, 'PWA: nessun errore JavaScript' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await browserContext.close();
    server.close();
  }

  await browser.close();
  console.log(fails ? '\n' + fails + ' controlli falliti' : '\ntutti i controlli nel browser superati');
  process.exit(fails ? 1 : 0);
})();
