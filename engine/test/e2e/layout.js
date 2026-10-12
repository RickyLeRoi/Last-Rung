// test/e2e/layout.js
'use strict';
const { GAME_URL, check, installManualClock, advance, state } = require('./lib');

const DESKTOP_VIEWPORTS = [[1280, 720], [1920, 1080], [800, 600]];
const CANVAS_WIDTH = 384;

const measureCanvas = page => page.evaluate(() => {
  const rect = document.getElementById('game').getBoundingClientRect();
  return { width: rect.width, height: rect.height, left: rect.left, top: rect.top, scrollWidth: document.documentElement.scrollWidth, innerWidth, innerHeight };
});

async function openPhone(browser, width, height) {
  const context = await browser.newContext({ viewport: { width, height }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await context.newPage();
  await installManualClock(page);
  await page.goto(GAME_URL + '&livello=1');
  await advance(page, 2);
  return { context, page };
}
async function tapUntilPlay(page, width, height) {
  for (let i = 0; i < 8 && (await state(page)).st !== 'play'; i++) { await page.touchscreen.tap(width / 2, height / 2); await advance(page, 3); }
}
// 20261013 ** RG #bright_background
// The band where the rotate message is drawn, one sample per frame: a string of '1' (white) and '0', pixel by pixel.
const bandPixels = page => page.evaluate(() => {
  const context = document.getElementById('game').getContext('2d'), frames = [];
  for (let frame = 0; frame < 70; frame++) {
    window.__clock.advance(1);
    const pixels = context.getImageData(0, 128, 384, 24).data;
    let band = '';
    for (let i = 0; i < pixels.length; i += 4) band += pixels[i] === 255 ? '1' : '0';
    frames.push(band);
  }
  return frames;
});
const differingPixels = (first, second) => { let count = 0; for (let i = 0; i < first.length; i++) if (first[i] !== second[i]) count++; return count; };

module.exports = async (browser, ctx) => {
  let resizablePage = null;
  for (const [width, height] of DESKTOP_VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(GAME_URL);
    const box = await measureCanvas(page);
    const scale = box.width / CANVAS_WIDTH;
    const isCentered = Math.abs(box.left + box.width / 2 - box.innerWidth / 2) <= 1 && Math.abs(box.top + box.height / 2 - box.innerHeight / 2) <= 1;
    check(Number.isInteger(scale) && scale >= 1 && box.width <= width && box.height <= height, 'layout ' + width + 'x' + height + ': scala intera ' + scale + 'x (canvas ' + box.width + 'x' + box.height + ')');
    check(isCentered && box.scrollWidth <= box.innerWidth, 'layout ' + width + 'x' + height + ': canvas centrato e senza scroll');
    if (width === 1280) resizablePage = page; else await page.close();
  }

  await resizablePage.setViewportSize({ width: 800, height: 600 });
  const resized = await resizablePage.waitForFunction(() => document.getElementById('game').style.width === '768px', null, { timeout: 2000 }).then(() => true, () => false);
  check(resized, 'layout: ridimensionando la finestra a 800x600 il canvas passa a 768px (evento resize)');
  await resizablePage.close();

  const phone = await openPhone(browser, 844, 390);
  const widthBeforeTouch = (await measureCanvas(phone.page)).width;
  await tapUntilPlay(phone.page, 844, 390);
  const canvasBox = await measureCanvas(phone.page);
  check(widthBeforeTouch >= 600 && canvasBox.width >= 600, 'layout telefono 844x390: canvas ' + widthBeforeTouch + 'px, con i comandi touch ' + canvasBox.width + 'px');
  const overlaps = await phone.page.evaluate(() => {
    const canvasRect = document.getElementById('game').getBoundingClientRect();
    const overlapping = [];
    // Every button group except the centre one (bc, which sits under the canvas) must stay in the side bands.
    for (const group of document.querySelectorAll('.btns:not(.bc)')) {
      const rect = group.getBoundingClientRect();
      if (rect.left < canvasRect.right && canvasRect.left < rect.right && rect.top < canvasRect.bottom && canvasRect.top < rect.bottom) overlapping.push(group.className.replace('btns', '').trim());
    }
    return overlapping;
  });
  check(overlaps.length === 0, 'layout telefono: i gruppi di pulsanti non si sovrappongono al canvas' + (overlaps.length ? ' (' + overlaps.join(', ') + ')' : ''));
  const landscape = await bandPixels(phone.page);
  await phone.context.close();

  const portrait = await openPhone(browser, 390, 844);
  await tapUntilPlay(portrait.page, 390, 844);
  const rotated = await bandPixels(portrait.page);
  await portrait.context.close();
  // The same frames in both orientations, except for the message: on a dark scene it adds white, on a bright one (snow) its black box
  // removes about as much as its text adds, so pixels are compared one by one. It blinks: present in about half of the frames.
  const messageFrames = rotated.filter((band, i) => differingPixels(band, landscape[i]) > 100).length;
  check(messageFrames >= 20 && messageFrames <= 50, 'layout telefono verticale: compare "RUOTA IL TELEFONO" (' + messageFrames + ' frame con il messaggio su 70)');
};
