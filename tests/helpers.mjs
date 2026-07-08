import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.json': 'application/json', '.js': 'text/javascript', '.mjs': 'text/javascript' };

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent(req.url.split('?')[0]);
      const filePath = path.join(ROOT, urlPath === '/' ? '/juice-shop-command-center.html' : urlPath);
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404); res.end('not found'); return;
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

export async function withServer(fn) {
  const server = await startServer();
  const port = server.address().port;
  const baseURL = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    return await fn({ page, baseURL, context });
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));
  }
}

export async function withPage(fn) {
  return withServer(async ({ page, baseURL, context }) => {
    await page.goto(`${baseURL}/juice-shop-command-center.html`);
    await page.waitForSelector('.card');
    return fn(page, baseURL, context);
  });
}

// Minimal assert helpers so tests exit non-zero on failure.
export function assert(cond, msg) { if (!cond) { console.error('FAIL:', msg); process.exitCode = 1; throw new Error(msg); } }
export function ok(msg) { console.log('PASS:', msg); }
