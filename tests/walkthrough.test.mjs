import { withPage, assert, ok } from './helpers.mjs';

await withPage(async (page) => {
  // Authored challenge exposes a non-empty solution array.
  const authored = await page.evaluate(() =>
    window.CHALLENGES.find(c => c.name === 'Login Admin').sol);
  assert(Array.isArray(authored) && authored.length > 0, 'Login Admin has authored sol steps');
  ok('authored challenge exposes sol steps');

  // Unauthored challenge exposes an empty solution array (not undefined).
  const unauthored = await page.evaluate(() =>
    window.CHALLENGES.find(c => c.name === 'Chatbot Prompt Injection').sol);
  assert(Array.isArray(unauthored) && unauthored.length === 0, 'Chatbot Prompt Injection has empty sol');
  ok('unauthored challenge exposes empty sol');
});

await withPage(async (page) => {
  // Set a reveal flag directly on STATE and persist it.
  await page.evaluate(() => { window.STATE.sol['c1'] = true; window.save(); });
  await page.waitForTimeout(250);
  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem('juiceshop:state')));
  assert(stored.sol && stored.sol.c1 === true, 'sol flag written to localStorage');
  ok('sol persists to localStorage');

  // Survives reload.
  await page.reload();
  await page.waitForSelector('.card');
  const afterReload = await page.evaluate(() => window.STATE.sol && window.STATE.sol.c1);
  assert(afterReload === true, 'sol flag survives reload');
  ok('sol survives reload');

  // Reset clears it.
  page.on('dialog', d => d.accept());
  await page.click('#reset');
  await page.waitForTimeout(300);
  const afterReset = await page.evaluate(() => window.STATE.sol && Object.keys(window.STATE.sol).length);
  assert(!afterReset, 'reset clears sol');
  ok('reset clears sol');
});
