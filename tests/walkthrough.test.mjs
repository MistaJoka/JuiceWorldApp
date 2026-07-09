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
