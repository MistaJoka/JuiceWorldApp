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

await withPage(async (page) => {
  // Open the Login Admin card (authored). Cards carry data-id; Login Admin is c1.
  const sel = '.card[data-id="c1"]';
  await page.click(`${sel} .chead`);

  // Reveal button is present without touching any hint tier.
  await page.waitForSelector(`${sel} .solbtn`);
  let stepsVisible = await page.$(`${sel} ol.solution`);
  assert(!stepsVisible, 'solution steps hidden before reveal');
  ok('reveal button present, steps hidden initially');

  // Click reveals the ordered step list.
  await page.click(`${sel} .solbtn`);
  await page.waitForSelector(`${sel} ol.solution li.solstep`);
  const count = await page.$$eval(`${sel} ol.solution li.solstep`, els => els.length);
  assert(count > 0, 'solution steps render after reveal');
  ok('reveal shows step list');

  // Persists across reload (card must be re-opened; reveal state stays true).
  // save() debounces its localStorage write by 200ms (see save() in the app), so
  // give it time to flush before navigating away, same as the Task 2 persistence test.
  await page.waitForTimeout(250);
  await page.reload();
  await page.waitForSelector('.card');
  await page.click(`${sel} .chead`);
  await page.waitForSelector(`${sel} ol.solution li.solstep`);
  ok('reveal persists across reload');

  // A card with no authored solution shows no reveal button. Chatbot Prompt Injection is c0.
  const noSel = '.card[data-id="c0"]';
  await page.click(`${noSel} .chead`);
  const noBtn = await page.$(`${noSel} .solbtn`);
  assert(!noBtn, 'unauthored challenge has no reveal button');
  ok('unauthored challenge shows no reveal button');

  // <code> inside a step copies on click (reuses the app's copy delegation).
  await page.click(`${sel} ol.solution li.solstep code`);
  await page.waitForSelector(`${sel} ol.solution li.solstep code.copied`);
  ok('code inside a solution step copies on click');
});
