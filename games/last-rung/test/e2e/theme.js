// games/last-rung/test/e2e/theme.js
'use strict';
// Day and night (engine Theme): dark device theme = always night; light device theme = the level decides. By day white background and
// black pixels, the blood stays red; a lightning flash inverts everything, so by day it looks like night.
const { GAME_URL, check, onlyBlackWhite, collectErrors } = require('./lib');

const frameInfo = page => page.evaluate(() => {
  const canvas = document.getElementById('game'), pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let white = 0, red = 0, stripWhite = 0, strip = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const x = (i / 4) % canvas.width, y = Math.floor(i / 4 / canvas.width), isWhite = pixels[i] === 255 && pixels[i + 1] === 255;
    if (isWhite) white++;
    if (pixels[i] === 221 && pixels[i + 1] === 0 && pixels[i + 2] === 0) red++;
    // the scene only: a strip left of the title panel, between the HUD bars
    if (x < 30 && y > 12 && y < canvas.height - 12) { strip++; if (isWhite) stripWhite++; }
  }
  return { theme: document.documentElement.dataset.theme, whiteShare: white / (pixels.length / 4), sceneWhite: stripWhite / strip, red, page: getComputedStyle(document.body).backgroundColor };
});

async function open(browser, colorScheme, query) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, colorScheme });
  const page = await context.newPage();
  const errors = collectErrors(page);
  await page.goto(GAME_URL + query);
  await page.waitForTimeout(400);
  return { context, page, errors };
}

module.exports = async browser => {
  const day = await open(browser, 'light', '');
  let info = await frameInfo(day.page);
  check(info.theme === 'day' && info.whiteShare > 0.5 && info.page === 'rgb(255, 255, 255)', 'tema chiaro, livello di giorno: sfondo bianco, pixel neri, pagina bianca (' + info.theme + ', bianco ' + Math.round(info.whiteShare * 100) + '%, pagina ' + info.page + ')');
  check((await onlyBlackWhite(day.page)).bad === 0, 'di giorno solo bianco, nero e rosso');
  await day.page.evaluate(() => { window.__debug.game.heli.blood = [12, 4, 13, 4, 14, 5]; });
  await day.page.waitForTimeout(100);
  info = await frameInfo(day.page);
  check(info.red >= 3, 'di giorno il sangue resta rosso (' + info.red + ' pixel #d00)');
  await day.page.evaluate(() => { const game = window.__debug.game; game.flashT = 600; game.softFlash = false; });
  await day.page.waitForTimeout(100);
  info = await frameInfo(day.page);
  check(info.sceneWhite < 0.5 && info.red >= 3, 'di giorno il lampo inverte la scena (torna scura) e il rosso resta rosso (bianco nella scena ' + Math.round(info.sceneWhite * 100) + '%, rosso ' + info.red + ')');
  check(day.errors.length === 0, 'giorno: nessun errore JavaScript' + (day.errors.length ? ': ' + day.errors.join(' | ') : ''));
  await day.context.close();

  const night = await open(browser, 'light', '&livello=5');
  info = await frameInfo(night.page);
  check(info.theme === 'night' && info.whiteShare < 0.5, 'tema chiaro, livello di notte: resta nero (' + info.theme + ', bianco ' + Math.round(info.whiteShare * 100) + '%)');
  await night.context.close();

  const dark = await open(browser, 'dark', '');
  info = await frameInfo(dark.page);
  check(info.theme === 'night' && info.whiteShare < 0.5 && info.page === 'rgb(0, 0, 0)', 'tema scuro: sempre notte, anche di giorno (' + info.theme + ', bianco ' + Math.round(info.whiteShare * 100) + '%)');
  await dark.context.close();
};
