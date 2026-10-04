#!/usr/bin/env node
/*
 * Render the README screenshots from tools/preview.html.
 *
 * Usage (from the repository root, after tools/build.py):
 *   npm install --no-save playwright && npx playwright install chromium
 *   node tools/screenshots.js
 *   python tools/make_docs.py
 *
 * Animations are paused and stepped by hand, so every frame is exactly where it should be.
 */
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const FRAMES = path.join(ROOT, 'docs', 'frames');

// [file, faceplate, state, width, local time (Brisbane), animation time in ms]
const SHOTS = [
  ['idle-white.png', 'white', 'idle', 520, '21:30', 0],
  ['waiting-midnight-silver.png', 'midnight_silver_metallic', 'waiting', 520, '21:30', 100],
  ['charging-deep-blue.png', 'deep_blue_metallic', 'charging', 520, '01:30', 900],
  ['complete-red.png', 'red_multi_coat', 'complete', 520, '06:10', 0],
  ['phone-solid-black.png', 'solid_black', 'charging', 360, '01:30', 600],
  ['three-phase-white.png', 'white', 'three', 520, '01:30', 900],
  ['three-phase-one-solid-black.png', 'solid_black', 'oneofthree', 520, '01:30', 900],
];

async function open(browser, faceplate, state, width, time, scale) {
  const ctx = await browser.newContext({ viewport: { width: width + 40, height: 600 }, deviceScaleFactor: scale,
                                         timezoneId: 'Australia/Brisbane' });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(`2026-10-05T${time}:00+10:00`));
  await page.goto(`file://${ROOT}/tools/preview.html?faceplate=${faceplate}&state=${state}&width=${width}`);
  await page.waitForTimeout(400);
  return { ctx, page, card: page.locator('#card') };
}

// Seek every animation to the same moment. The offset is a whole number of every loop (1.6 s, 2.2 s,
// 2.5 s, 3.2 s), so each one is well past its start delay and at the same point in its cycle.
const LOOP = 880000;
const seek = (page, ms) => page.evaluate((t) => {
  const anims = document.getElementById('card').shadowRoot.getAnimations();
  anims.forEach((a) => { a.pause(); a.currentTime = t; });
}, LOOP + ms);

(async () => {
  fs.mkdirSync(FRAMES, { recursive: true });
  const browser = await chromium.launch();
  for (const [file, fp, state, width, time, t] of SHOTS) {
    const { ctx, page, card } = await open(browser, fp, state, width, time, 2);
    await seek(page, t);
    await card.screenshot({ path: path.join(DOCS, file) });
    await ctx.close();
    console.log('docs/' + file);
  }
  // charging.gif: one 3.2 s loop (the light bar streams every 1.6 s, the glow breathes every 3.2 s)
  const { ctx, page, card } = await open(browser, 'midnight_silver_metallic', 'charging', 600, '01:30', 1);
  for (let i = 0; i < 32; i++) {
    await seek(page, i * 100);
    await card.screenshot({ path: path.join(FRAMES, `${String(i).padStart(2, '0')}.png`) });
  }
  await ctx.close();
  console.log('docs/frames/ (32 frames)');
  await browser.close();
})();
