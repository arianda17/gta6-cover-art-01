import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';

const shots = JSON.parse(readFileSync('/home/hatch/workspace/makefun/gta6-cover-art-01/shots.json', 'utf8'));
const browser = await chromium.launch({
  executablePath: '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
  headless: true,
});
const errors = [];

for (const shot of shots) {
  const page = await browser.newPage();
  const [w, h] = shot.name.includes('portrait') ? [1024, 1280] : shot.name.includes('square') ? [1024, 1024] : [1280, 720];
  await page.setViewportSize({ width: w, height: h });
  page.on('pageerror', (e) => errors.push(shot.name + ' pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(shot.name + ' console: ' + m.text()); });

  await page.goto('http://localhost:8080/' + shot.query, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => window.__shotReady === true, null, { timeout: 120000 });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: '/home/hatch/workspace/makefun/gta6-cover-art-01/screenshots/' + shot.name,
    type: 'jpeg', quality: 88,
  });
  console.log('captured', shot.name);
  await page.close();
}
console.log('page errors:', errors.length ? JSON.stringify(errors) : 'none');
await browser.close();