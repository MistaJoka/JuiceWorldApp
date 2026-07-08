import { withPage, assert, ok } from './helpers.mjs';

await withPage(async (page) => {
  // Solve the first challenge by clicking its checkbox.
  await page.click('.card .cbox');
  await assertFirstDone(page, 'checkbox marks card done in-session');

  // Wait for the 200ms save debounce to complete.
  await page.waitForTimeout(250);

  // localStorage should now hold the state (persistence is real, not a no-op).
  const stored = await page.evaluate(() => localStorage.getItem('juiceshop:state'));
  assert(stored && JSON.parse(stored).solved && Object.keys(JSON.parse(stored).solved).length === 1,
    'solved state written to localStorage');
  ok('state persisted to localStorage');

  // Reload: the solve must survive.
  await page.reload();
  await page.waitForSelector('.card');
  await assertFirstDone(page, 'solve survives reload');

  // Reset clears it.
  page.on('dialog', d => d.accept());
  await page.click('#reset');
  await page.waitForTimeout(300);
  const afterReset = await page.evaluate(() => localStorage.getItem('juiceshop:state'));
  const parsed = afterReset ? JSON.parse(afterReset) : { solved: {} };
  assert(Object.keys(parsed.solved || {}).length === 0, 'reset clears persisted solved state');
  ok('reset clears persisted state');
});

async function assertFirstDone(page, msg) {
  const done = await page.evaluate(() => document.querySelector('.card').classList.contains('done'));
  assert(done, msg);
  ok(msg);
}
