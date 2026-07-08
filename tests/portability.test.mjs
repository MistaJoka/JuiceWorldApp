import { withPage, assert, ok } from './helpers.mjs';

await withPage(async (page) => {
  // Seed a solve, then export.
  await page.click('.card .cbox');
  await page.waitForTimeout(250);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#exportBtn'),
  ]);
  assert(download.suggestedFilename() === 'juiceworld-progress.json', 'export filename is juiceworld-progress.json');
  const stream = await download.createReadStream();
  let buf = ''; for await (const c of stream) buf += c;
  const exported = JSON.parse(buf);
  assert(exported.solved && Object.keys(exported.solved).length === 1, 'exported JSON contains the solve');
  ok('export produces valid progress JSON');

  // Reset, then import the file back.
  page.on('dialog', d => d.accept());
  await page.click('#reset');
  await page.waitForTimeout(250);
  await page.setInputFiles('#importFile', {
    name: 'juiceworld-progress.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.waitForTimeout(300);
  const restored = await page.evaluate(() => document.querySelector('.card').classList.contains('done'));
  assert(restored, 'import restores solved state');
  ok('import restores progress');

  // Malformed import must not corrupt state.
  await page.setInputFiles('#importFile', {
    name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json {'),
  });
  await page.waitForTimeout(300);
  const stillDone = await page.evaluate(() => document.querySelector('.card').classList.contains('done'));
  assert(stillDone, 'malformed import leaves existing state intact');
  ok('malformed import is rejected safely');
});
