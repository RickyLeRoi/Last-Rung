// test/e2e/touchui.js
'use strict';
const { GAME_URL, check, installManualClock, advance, state } = require('./lib');

const SELECTORS = {
  'AUDIO': '[data-edge="mute"]',
  'R': '[data-edge="restart"]',
  'II': '[data-edge="pause"]',
  'SALTA': '[data-edge="skip"]',
  '▲': '[data-hold="winch:-1"]',
  '▼': '[data-hold="winch:1"]',
  'SGANCIA': '[data-edge="drop"]',
  'STAB': '[data-edge="stab"]',
  'SALVAGENTE': '[data-edge="buoy"]',
  'SECCHIO': '[data-edge="bucket"]',
  'REPLAY': '[data-edge="replay"]',
  'SFIDA DEL GIORNO': '[data-edge="daily"]',
  'LAMPI': '[data-edge="flash"]',
};

// Derived from the CSS in index.html (data-mode, data-state, data-tut, data-fire): everything not listed must be hidden.
const IN_PLAY = ['AUDIO', 'R', 'II', '▲', '▼', 'SGANCIA', 'STAB', 'SALVAGENTE'];
const EXPECTED = {
  'titolo': ['AUDIO', 'SFIDA DEL GIORNO', 'LAMPI'],
  'intro (addestramento)': ['AUDIO', 'SALTA'],
  'partita (addestramento)': [...IN_PLAY, 'SALTA'],
  'partita (livello 1)': IN_PLAY,
  'partita (livello 4, incendio)': [...IN_PLAY, 'SECCHIO'],
  'pausa': ['AUDIO'],
  'game over': ['AUDIO', 'REPLAY'],
  'missione compiuta': ['AUDIO', 'REPLAY'],
};

const visibleButtons = page => page.evaluate(selectors => {
  const visible = [];
  for (const name in selectors) { const element = document.querySelector(selectors[name]); if (element && element.getClientRects().length > 0) visible.push(name); }
  return visible;
}, SELECTORS);

async function openPhone(browser, query) {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await installManualClock(page);
  await page.goto(GAME_URL + query);
  await advance(page, 2);
  return { context, page };
}
const tap = async page => { await page.touchscreen.tap(420, 200); await advance(page, 3); };
async function tapUntilPlay(page) {
  for (let i = 0; i < 8 && (await state(page)).st !== 'play'; i++) await tap(page);
}

async function verify(page, scenario) {
  await advance(page, 3);
  const visible = await visibleButtons(page);
  const expected = EXPECTED[scenario];
  const unexpectedlyShown = visible.filter(name => !expected.includes(name));
  const unexpectedlyHidden = expected.filter(name => !visible.includes(name));
  const detail = (unexpectedlyShown.length ? ' - da nascondere: ' + unexpectedlyShown.join(', ') : '') + (unexpectedlyHidden.length ? ' - da mostrare: ' + unexpectedlyHidden.join(', ') : '');
  check(!unexpectedlyShown.length && !unexpectedlyHidden.length, 'comandi touch: ' + scenario + ' (' + visible.join(' ') + ')' + detail);
}

module.exports = async (browser, ctx) => {
  {
    const { context, page } = await openPhone(browser, '');
    await page.evaluate(() => document.getElementById('touch').classList.add('on'));
    await verify(page, 'titolo');
    await context.close();
  }
  {
    const { context, page } = await openPhone(browser, '');
    await tap(page);
    await verify(page, 'intro (addestramento)');
    await tap(page);
    await verify(page, 'partita (addestramento)');
    await context.close();
  }
  {
    const { context, page } = await openPhone(browser, '&livello=1');
    await tapUntilPlay(page);
    await verify(page, 'partita (livello 1)');
    await page.keyboard.press('KeyP');
    await verify(page, 'pausa');
    await page.keyboard.press('KeyP');
    await advance(page, 3);
    await page.evaluate(() => { const game = window.__eli.game; game.state = 'over'; game.overT = 0; game.overReason = 'PROVA'; });
    await verify(page, 'game over');
    await page.evaluate(() => { const game = window.__eli.game; game.state = 'done'; game.result = 'win'; game.stars = 2; game.bonus = 0; });
    await verify(page, 'missione compiuta');
    await context.close();
  }
  {
    const { context, page } = await openPhone(browser, '&livello=4');
    await tapUntilPlay(page);
    await verify(page, 'partita (livello 4, incendio)');
    await context.close();
  }
};
