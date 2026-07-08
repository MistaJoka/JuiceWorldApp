import { withPage, assert, ok } from './helpers.mjs';

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
