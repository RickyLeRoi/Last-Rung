// test/e2e/visual.js
'use strict';
const { check, openWithClock, enterPlay, hold, advance, onlyBlackWhite } = require('./lib');

// Samples the canvas every `every` frames and sums the pixels outside the palette (#fff, #000, blood red).
async function pixelsOutsidePalette(page, samples, every) {
  let bad = 0, white = 0;
  for (let i = 0; i < samples; i++) {
    await advance(page, every);
    const result = await onlyBlackWhite(page);
    bad += result.bad; white += result.white;
  }
  return { bad, white };
}
const report = (name, result) => check(result.bad === 0 && result.white > 0, 'palette: ' + name + ' (' + result.bad + ' pixel fuori palette)');

module.exports = async (browser, ctx) => {
  {
    const { page } = await openWithClock(browser, '');
    report('titolo', await pixelsOutsidePalette(page, 8, 8));
    await page.close();
  }
  {
    const { page } = await openWithClock(browser, '&livello=1');
    await enterPlay(page);
    await hold(page, 'ArrowUp', 70);
    await hold(page, 'KeyE', 150);
    await page.keyboard.down('ArrowRight');
    const result = await pixelsOutsidePalette(page, 12, 8);
    await page.keyboard.up('ArrowRight');
    report('scaletta lunga in oscillazione', result);
    await page.close();
  }
  {
    const { page } = await openWithClock(browser, '&livello=4');
    await enterPlay(page);
    await hold(page, 'ArrowUp', 30);
    await page.keyboard.press('KeyC'); await advance(page, 2);
    await page.evaluate(() => {
      const game = window.__debug.game, heli = game.heli, fire = game.L.fires[0];
      heli.ground = null; heli.vx = heli.vy = 0; heli.x = heli.px = fire.x; heli.y = heli.py = fire.y - 70;
      heli.bucket.fill = 1;
      game.camX = Math.max(0, fire.x - 190);
    });
    await advance(page, 2);
    await page.keyboard.press('KeyC');
    report('secchio che svuota sul fuoco', await pixelsOutsidePalette(page, 12, 5));
    await page.close();
  }
  {
    const { page } = await openWithClock(browser, '&livello=1');
    await enterPlay(page);
    await hold(page, 'ArrowUp', 60);
    await page.evaluate(() => { const heli = window.__debug.game.heli; heli.ground = null; heli.vy = 12; heli.vx = 4; });
    const exploded = await page.evaluate(() => { const game = window.__debug.game; return window.__clock.until(() => game.heli.state === 'dead', 300); });
    const result = await pixelsOutsidePalette(page, 12, 6);
    check(exploded >= 0, 'palette: l\'elicottero esplode nel test (' + exploded + ' frame)');
    report('esplosione e detriti', result);
    await page.close();
  }
  {
    const { page } = await openWithClock(browser, '&livello=1');
    await enterPlay(page);
    await page.evaluate(() => { const game = window.__debug.game; game.state = 'done'; game.result = 'win'; game.stars = 3; game.bonus = 500; });
    report('pannello missione compiuta con le stelle', await pixelsOutsidePalette(page, 10, 8));
    await page.close();
  }
};
