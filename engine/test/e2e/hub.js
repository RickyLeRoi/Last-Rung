// engine/test/e2e/hub.js
'use strict';
const fs = require('fs');
const path = require('path');
const { ROOT, SITE_DIR, check, staticServer, collectErrors } = require('./lib');

// Every game built into dist/site must be listed by the hub and reachable from it. The hub itself has no service worker.
module.exports = async (browser, ctx) => {
  const games = fs.readdirSync(path.join(ROOT, 'games'), { withFileTypes: true })
    .filter(entry => entry.isDirectory() && fs.existsSync(path.join(SITE_DIR, entry.name)))
    .map(entry => JSON.parse(fs.readFileSync(path.join(ROOT, 'games', entry.name, 'game.json'), 'utf8')));
  const { baseUrl, close } = await staticServer(SITE_DIR);
  const browserContext = await browser.newContext();
  const page = await browserContext.newPage();
  const errors = collectErrors(page);
  await page.goto(baseUrl);
  const links = await page.evaluate(() => [...document.querySelectorAll('a')].map(link => ({ href: link.getAttribute('href'), text: link.textContent })));
  check(games.length > 0 && games.every(game => links.some(link => link.href === './' + game.id + '/' && link.text.includes(game.title))),
    'hub: un link con titolo per ogni gioco (' + links.map(link => link.href).join(', ') + ')');
  const iconsLoaded = await page.evaluate(() => [...document.querySelectorAll('img')].every(image => image.complete && image.naturalWidth > 0));
  check(iconsLoaded, 'hub: le icone dei giochi si caricano');
  const rootRegistration = await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration('/'); return !!registration; });
  check(!rootRegistration, 'hub: nessun service worker sulla radice');

  for (const game of games) {
    await page.goto(baseUrl);
    await page.click('a[href="./' + game.id + '/"]');
    await page.waitForURL('**/' + game.id + '/**');
    // The debug global exists only with ?debug, so the game being up is checked through its canvas.
    const hasCanvas = await page.evaluate(() => !!document.getElementById('game'));
    check(hasCanvas && errors.length === 0, 'hub: il link di ' + game.id + ' apre il gioco' + (errors.length ? ': ' + errors.join(' | ') : ''));
  }

  // Offline: after a visit the game works from its own cache; the hub does not (it is not cached on purpose).
  if (games.length) {
    const game = games[0];
    await page.goto(baseUrl + game.id + '/?debug');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForTimeout(500);
    await browserContext.setOffline(true);
    await page.reload();
    const offlineState = await page.waitForFunction(name => window[name] && window[name].game.state, game.debugGlobal, { timeout: 3000 }).then(handle => handle.jsonValue()).catch(() => null);
    check(offlineState === 'title', 'hub: senza rete il gioco si apre (' + offlineState + ')');
    const hubOffline = await page.goto(baseUrl).then(response => !!response && response.ok()).catch(() => false);
    check(!hubOffline, "hub: senza rete l'hub non si apre (comportamento atteso)");
  }
  await browserContext.close();
  close();
};
