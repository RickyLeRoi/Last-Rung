// test/e2e/pwa.js
'use strict';
const { WEB_DIR, check, staticServer } = require('./lib');

module.exports = async (browser, ctx) => {
  const { baseUrl, close } = await staticServer(WEB_DIR);
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
  close();
};
