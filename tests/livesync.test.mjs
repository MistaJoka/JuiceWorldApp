import { withServer, assert, ok } from './helpers.mjs';

await withServer(async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/juice-shop-command-center.html`);
  await page.waitForSelector('.card');

  // Grab a real challenge name from the app so the mock matches by name.
  const firstName = await page.evaluate(() => window.CHALLENGES[0].name);

  // Mock the Juice Shop API the engine will fetch.
  await page.route('**/api/Challenges', route => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ status: 'success', data: [{ name: firstName, solved: true }] }),
  }));

  const res = await page.evaluate(async () => await window.syncOnce('http://juice.test'));
  assert(res.matched === 1, 'syncOnce matches one solved challenge by name');
  assert(res.error === null, 'syncOnce reports no error on success');
  ok('syncOnce auto-solves by name match');

  const done = await page.evaluate(() => document.querySelector('.card').classList.contains('done'));
  assert(done, 'auto-solved challenge renders as done');
  ok('auto-solve reflected in UI');

  // Manual-vs-live: a manual solve must never be un-set by a sync that omits it.
  await page.evaluate(() => { window.STATE.solved['c1'] = true; });
  await page.route('**/api/Challenges', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'success', data: [] }),
  }), { times: 1 });
  await page.evaluate(async () => await window.syncOnce('http://juice.test'));
  const c1Still = await page.evaluate(() => !!window.STATE.solved['c1']);
  assert(c1Still, 'sync never un-sets a manual solve');
  ok('sync is additive only');

  // Network failure is handled, not thrown.
  await page.route('**/api/Challenges', route => route.abort());
  const failRes = await page.evaluate(async () => await window.syncOnce('http://juice.test'));
  assert(failRes.error && failRes.matched === 0, 'syncOnce returns an error object on network failure');
  ok('syncOnce handles fetch failure gracefully');
});
