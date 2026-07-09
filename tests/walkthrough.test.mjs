import { withPage, assert, ok } from './helpers.mjs';

await withPage(async (page) => {
  // Authored challenge exposes a non-empty solution array.
  const authored = await page.evaluate(() =>
    window.CHALLENGES.find(c => c.name === 'Login Admin').sol);
  assert(Array.isArray(authored) && authored.length > 0, 'Login Admin has authored sol steps');
  ok('authored challenge exposes sol steps');

  // Mechanism: a challenge with an empty sol array renders NO reveal button;
  // one with steps renders the button. Tested synthetically via window.card so it
  // holds regardless of how many real challenges have been authored.
  const noBtn = await page.evaluate(() => {
    const el = window.card({ id: 'ctest0', name: 'Synthetic Empty', cat: 'x', diff: 1, goal: 'g', tags: [], hints: [], sol: [], solVerified: false });
    return el.querySelector('.solbtn') === null;
  });
  assert(noBtn, 'empty sol renders no reveal button');
  ok('empty sol: no reveal button');

  const hasBtn = await page.evaluate(() => {
    const el = window.card({ id: 'ctest1', name: 'Synthetic Filled', cat: 'x', diff: 1, goal: 'g', tags: [], hints: [], sol: ['step one'], solVerified: false });
    return el.querySelector('.solbtn') !== null;
  });
  assert(hasBtn, 'non-empty sol renders a reveal button');
  ok('non-empty sol: reveal button present');
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

  // <code> inside a step copies on click (reuses the app's copy delegation).
  await page.click(`${sel} ol.solution li.solstep code`);
  await page.waitForSelector(`${sel} ol.solution li.solstep code.copied`);
  ok('code inside a solution step copies on click');
});

await withPage(async (page) => {
  const sel = '.card[data-id="c52"]'; // DOM XSS — payload must render as text, not a live element
  await page.click(`${sel} .chead`);
  await page.click(`${sel} .solbtn`);
  await page.waitForSelector(`${sel} ol.solution li.solstep code`);
  const codeText = await page.$$eval(`${sel} ol.solution li.solstep code`, els => els.map(e => e.textContent).join('|'));
  assert(codeText.includes('<iframe'), 'XSS payload renders as literal text, not a parsed element');
  ok('XSS payload displayed as text');
  // And no live iframe was injected into the solution block.
  const iframes = await page.$$eval(`${sel} ol.solution iframe`, els => els.length);
  assert(iframes === 0, 'no live iframe injected by a walkthrough step');
  ok('no live iframe injected');
});

await withPage(async (page) => {
  // Verified walkthrough (Login Admin, sv:1) shows NO "unverified" note.
  const v = '.card[data-id="c1"]';
  await page.click(`${v} .chead`);
  await page.click(`${v} .solbtn`);
  await page.waitForSelector(`${v} ol.solution li.solstep`);
  const vNote = await page.$(`${v} ol.solution li.solnote`);
  assert(vNote === null, 'verified walkthrough shows no unverified note');
  ok('verified walkthrough: no unverified note');

  // Unverified walkthrough (Bonus Payload, no sv) shows the "unverified" note.
  const u = '.card[data-id="c51"]';
  await page.click(`${u} .chead`);
  await page.click(`${u} .solbtn`);
  await page.waitForSelector(`${u} ol.solution li.solnote`);
  const uText = await page.$eval(`${u} ol.solution li.solnote`, e => e.textContent);
  assert(/unverified/i.test(uText), 'unverified walkthrough shows the unverified note');
  ok('unverified walkthrough: note shown');
});

await withPage(async (page) => {
  const payload = JSON.stringify({ solved:{}, notes:{}, tier:{}, sol:{ c1:true } });
  page.on('dialog', d => d.accept());
  await page.setInputFiles('#importFile', { name:'progress.json', mimeType:'application/json', buffer: Buffer.from(payload) });
  await page.waitForTimeout(200);
  const imported = await page.evaluate(() => window.STATE.sol && window.STATE.sol.c1 === true);
  assert(imported, 'sol reconstructed from IMPORT');
  ok('sol round-trips through IMPORT');
});
