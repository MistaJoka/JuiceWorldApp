import { withPage, assert, ok } from './helpers.mjs';

await withPage(async (page) => {
  await page.click('.tab[data-tab="toolkit"]');
  await page.waitForSelector('#toolkitdoc');

  const text = await page.evaluate(() => document.querySelector('#toolkitdoc').textContent);
  assert(/PAYLOAD LIBRARY — EXTENDED/.test(text), 'extended payload section present');
  // Spot-check a few new payloads exist.
  for (const needle of ['alg', 'file:///etc/passwd', '..%2f', 'admin123']) {
    assert(text.includes(needle), `extended toolkit includes: ${needle}`);
  }
  ok('extended payload content present');

  // Click-to-copy still works on a payload code element.
  const codeCount = await page.evaluate(() => document.querySelectorAll('#toolkitdoc code').length);
  assert(codeCount > 20, 'toolkit has many copyable code entries');
  ok('toolkit copy targets present');
});
