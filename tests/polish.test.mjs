import { withPage, withServer, assert, ok } from './helpers.mjs';

await withPage(async (page) => {
  // Breakdown container exists and has category rows.
  assert(await page.$('#breakdown'), 'breakdown container present');
  const rowsBefore = await page.evaluate(() => document.querySelectorAll('#breakdown .mini').length);
  assert(rowsBefore > 0, 'breakdown renders category/difficulty rows');
  ok('breakdown rendered');

  // Solving a challenge widens at least one bar (percentage increases).
  const before = await page.evaluate(() => document.querySelector('#breakdown .mini > i').style.width);
  await page.click('.card .cbox');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => {
    const bars = [...document.querySelectorAll('#breakdown .mini > i')].map(b => parseFloat(b.style.width) || 0);
    return Math.max(...bars);
  });
  assert(after > (parseFloat(before) || 0), 'solving a challenge widens a breakdown bar');
  ok('breakdown reacts to solves');

  // Keyboard shortcut: "/" focuses search.
  await page.click('body');
  await page.keyboard.press('/');
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.id);
  assert(focused === 'search', '"/" focuses the search input');
  ok('slash focuses search');
});

await withServer(async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`${baseURL}/juice-shop-command-center.html`);
  await page.waitForSelector('.card');
  // No horizontal overflow at mobile width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 2, `no horizontal overflow at 375px (got ${overflow}px)`);
  ok('no horizontal overflow on mobile');
  // The .kv grids collapse to a single column on mobile.
  await page.click('.tab[data-tab="toolkit"]');
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('#toolkitdoc .kv')).gridTemplateColumns);
  assert(!/\s/.test(cols.trim()), `kv grid is single-column on mobile (got "${cols}")`);
  ok('kv grid collapses on mobile');
});
