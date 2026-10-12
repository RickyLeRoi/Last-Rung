// test/e2e/devpage.js
'use strict';
const fs = require('fs');
const path = require('path');
const { DEV_HTML, DEV_URL, check, collectErrors, startPlay, state } = require('./lib');

const declaredScripts = () => {
  const html = fs.readFileSync(DEV_HTML, 'utf8');
  const block = html.slice(html.indexOf('<!-- build:js'), html.indexOf('<!-- /build:js -->'));
  return [...block.matchAll(/<script src="([^"]+)"/g)].map(match => match[1]);
};

module.exports = async (browser, ctx) => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errors = collectErrors(page);
  const failedRequests = [];
  page.on('requestfailed', request => failedRequests.push(request.url()));
  await page.goto(DEV_URL);
  await page.waitForFunction(() => window.__eli && window.__eli.game.state === 'title', null, { timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const scripts = declaredScripts();
  const missingFiles = scripts.filter(source => !fs.existsSync(path.join(path.dirname(DEV_HTML), source)));
  const loadedScripts = await page.evaluate(() => document.querySelectorAll('script[src]').length);
  check(scripts.length > 0 && missingFiles.length === 0 && failedRequests.length === 0 && loadedScripts === scripts.length,
    'pagina di sviluppo: ' + scripts.length + ' script caricati dai sorgenti' + (missingFiles.length ? ', mancanti: ' + missingFiles.join(', ') : '') + (failedRequests.length ? ', richieste fallite: ' + failedRequests.join(', ') : ''));
  check(errors.length === 0, 'pagina di sviluppo: nessun errore in 2 s' + (errors.length ? ': ' + errors.join(' | ') : ''));
  const titleState = await page.evaluate(() => window.__eli && window.__eli.game.state);
  check(titleState === 'title', 'pagina di sviluppo: parte dal titolo (' + titleState + ')');
  await startPlay(page);
  const before = await state(page);
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(1000); await page.keyboard.up('ArrowUp');
  const after = await state(page);
  check(before.st === 'play' && after.y < before.y - 5, 'pagina di sviluppo: Invio x2 avvia la partita e la freccia su fa salire (dy ' + (after.y - before.y).toFixed(1) + ')');
  await page.close();
};
