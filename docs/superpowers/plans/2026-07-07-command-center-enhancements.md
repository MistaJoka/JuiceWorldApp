# JuiceWorld Command Center Enhancements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken progress persistence and add four enhancement layers (JSON export/import, local-only live Juice Shop sync, expanded payload toolkit, UX/data polish) to the single-file `juice-shop-command-center.html`.

**Architecture:** All product code lives in one standalone HTML file that must stay zero-dependency and offline-capable. A dev-only Playwright harness under `tests/` (never shipped, not referenced by the HTML) drives the real page in a headless browser and asserts behavior. Each feature is a self-contained edit to the single file plus a behavioral test.

**Tech Stack:** Vanilla HTML/CSS/JS (ES2019, no framework, no bundler). Dev-only: Node 18+, Playwright (chromium).

## Global Constraints

- The shipped `juice-shop-command-center.html` MUST remain a single file with **zero runtime dependencies**, no build step, and no external network calls except the opt-in live sync. Copy this constraint into every task.
- Do NOT add `<script src=...>`, CDN links, or npm runtime deps to the HTML file. Test tooling lives only under `tests/` and `package.json` devDependencies.
- Preserve the existing `STATE` shape exactly: `{solved:{}, notes:{}, tier:{}}` where each is an id→value map (`solved`/`tier` keyed by challenge id like `"c0"`, `notes` keyed by id→string).
- Preserve the existing 200ms debounce in `save()`.
- Challenge ids are `"c"+index` assigned at load (`CHALLENGES=CH.map((c,i)=>({id:"c"+i,...}))`). Challenge display names are `ch.name`.
- The file's giant data literal is on physical line 161 (`const CH=[...]`); it is ~40k tokens. NEVER read or rewrite that line. Make all edits by anchoring on unique nearby strings with the Edit tool, never by rewriting the whole file.
- Match the existing code style: terse, semicolon-dense, `var(--token)` CSS colors, `el(tag,cls,html)` and `$(sel)` helpers already defined in the file.

---

## File Structure

- **Modify:** `juice-shop-command-center.html` — the single product file. All feature code goes here.
- **Create:** `package.json` — dev-only, declares Playwright devDependency and a `test` script. Not shipped.
- **Create:** `tests/helpers.mjs` — shared harness: starts a static file server over the repo root and opens a Playwright page.
- **Create:** `tests/persistence.test.mjs` — Phase 1 behavioral test.
- **Create:** `tests/portability.test.mjs` — Phase 2 test.
- **Create:** `tests/livesync.test.mjs` — Phase 3 test (mocks `/api/Challenges`).
- **Create:** `tests/toolkit.test.mjs` — Phase 4 test.
- **Create:** `tests/polish.test.mjs` — Phase 5 test.
- **Create:** `.gitignore` — ignore `node_modules/`.

Each `*.test.mjs` is runnable standalone (`node tests/x.test.mjs`) and exits non-zero on failure.

---

## Task 1: Test harness + persistence fix (foundational)

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tests/helpers.mjs`
- Create: `tests/persistence.test.mjs`
- Modify: `juice-shop-command-center.html` (storage adapter + `load`/`save`/reset rewire)

**Interfaces:**
- Produces: `tests/helpers.mjs` exports `async function withPage(fn)` — starts an HTTP static server rooted at the repo directory on an ephemeral port, launches headless chromium, opens `http://127.0.0.1:PORT/juice-shop-command-center.html`, calls `await fn(page, baseURL)`, then tears both down. Also exports `async function withServer(fn)` returning `{page, baseURL, context}` for tests needing custom setup (used by live sync). Rethrows any error from `fn` after cleanup.
- Produces (in HTML): a global `const storage` object with async methods `get(k) → {value:string|null}`, `set(k,v) → void`, `delete(k) → void`. Later tasks rely on `storage` existing.

- [ ] **Step 1: Create `.gitignore`**

Create `/Users/andraewilliams/JSapp/files/.gitignore`:

```
node_modules/
```

- [ ] **Step 2: Create `package.json`**

Create `/Users/andraewilliams/JSapp/files/package.json`:

```json
{
  "name": "juiceworld-command-center-tests",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node tests/persistence.test.mjs && node tests/portability.test.mjs && node tests/livesync.test.mjs && node tests/toolkit.test.mjs && node tests/polish.test.mjs"
  },
  "devDependencies": {
    "playwright": "^1.44.0"
  }
}
```

- [ ] **Step 3: Install Playwright**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && npm install && npx playwright install chromium
```
Expected: installs playwright into `node_modules/` and downloads the chromium browser. No errors.

- [ ] **Step 4: Create the shared test harness**

Create `/Users/andraewilliams/JSapp/files/tests/helpers.mjs`:

```js
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
```

- [ ] **Step 5: Write the failing persistence test**

Create `/Users/andraewilliams/JSapp/files/tests/persistence.test.mjs`:

```js
import { withPage, assert, ok } from './helpers.mjs';

await withPage(async (page) => {
  // Solve the first challenge by clicking its checkbox.
  await page.click('.card .cbox');
  await assertFirstDone(page, 'checkbox marks card done in-session');

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
```

- [ ] **Step 6: Run the test to verify it FAILS**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/persistence.test.mjs
```
Expected: FAIL. With the current `window.storage` code, `localStorage` is never written, so the "state written to localStorage" assertion fails (and/or the reload assertion fails). Exit code non-zero.

- [ ] **Step 7: Add the storage adapter**

In `juice-shop-command-center.html`, find this exact line:

```js
const KEY="juiceshop:state";
```

Replace it with:

```js
const KEY="juiceshop:state";
const storage=(typeof window!=="undefined"&&window.storage)?window.storage:{
  get:async k=>({value:localStorage.getItem(k)}),
  set:async(k,v)=>{localStorage.setItem(k,v);},
  delete:async k=>{localStorage.removeItem(k);}
};
```

- [ ] **Step 8: Rewire `load()`**

Find:
```js
  try{const r=await window.storage.get(KEY);if(r&&r.value)STATE=JSON.parse(r.value);}catch(e){}
```
Replace with:
```js
  try{const r=await storage.get(KEY);if(r&&r.value)STATE=JSON.parse(r.value);}catch(e){}
```

- [ ] **Step 9: Rewire `save()`**

Find:
```js
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{try{await window.storage.set(KEY,JSON.stringify(STATE));}catch(e){}},200);}
```
Replace with:
```js
function save(){clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{try{await storage.set(KEY,JSON.stringify(STATE));}catch(e){}},200);}
```

- [ ] **Step 10: Rewire the reset handler**

Find:
```js
  $("#reset").onclick=async()=>{if(!confirm("wipe all progress, notes, and hint state?"))return;STATE={solved:{},notes:{},tier:{}};try{await window.storage.delete(KEY);}catch(e){}save();renderList();};
```
Replace with:
```js
  $("#reset").onclick=async()=>{if(!confirm("wipe all progress, notes, and hint state?"))return;STATE={solved:{},notes:{},tier:{}};try{await storage.delete(KEY);}catch(e){}save();renderList();};
```

- [ ] **Step 11: Confirm no `window.storage` call sites remain**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && grep -n "window.storage" juice-shop-command-center.html
```
Expected: exactly ONE match — the adapter definition line (`window.storage)?window.storage:`). No `window.storage.get/set/delete` call sites.

- [ ] **Step 12: Run the test to verify it PASSES**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/persistence.test.mjs
```
Expected: all PASS lines, exit code 0.

- [ ] **Step 13: Commit**

```bash
cd /Users/andraewilliams/JSapp/files && git add .gitignore package.json tests/helpers.mjs tests/persistence.test.mjs juice-shop-command-center.html && git commit -m "fix: real localStorage persistence + Playwright test harness"
```

---

## Task 2: Progress export / import

**Files:**
- Modify: `juice-shop-command-center.html` (footer buttons + handlers)
- Create: `tests/portability.test.mjs`

**Interfaces:**
- Consumes: `STATE` shape `{solved,notes,tier}`; `save()`, `renderList()`, `toast(msg)` (existing global, shows a transient message); `$` selector helper.
- Produces: two buttons `#exportBtn` and `#importBtn` and a hidden `#importFile` input in the footer. A download named `juiceworld-progress.json`.

- [ ] **Step 1: Write the failing test**

Create `/Users/andraewilliams/JSapp/files/tests/portability.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/portability.test.mjs
```
Expected: FAIL — `#exportBtn` does not exist, click times out.

- [ ] **Step 3: Add the footer buttons**

In `juice-shop-command-center.html` find:
```html
    progress persists locally &middot; click any <code style="cursor:default">command</code> to copy &middot; <button class="reset" id="reset">RESET ALL PROGRESS</button>
```
Replace with:
```html
    progress persists locally &middot; click any <code style="cursor:default">command</code> to copy &middot; <button class="reset" id="exportBtn">EXPORT</button> <button class="reset" id="importBtn">IMPORT</button> <button class="reset" id="reset">RESET ALL PROGRESS</button>
    <input type="file" id="importFile" accept="application/json" class="hidden">
```

- [ ] **Step 4: Add export/import handlers**

In `juice-shop-command-center.html` find the reset handler line (already rewired in Task 1):
```js
  $("#reset").onclick=async()=>{if(!confirm("wipe all progress, notes, and hint state?"))return;STATE={solved:{},notes:{},tier:{}};try{await storage.delete(KEY);}catch(e){}save();renderList();};
```
Add these lines immediately AFTER it:
```js
  $("#exportBtn").onclick=()=>{
    const blob=new Blob([JSON.stringify(STATE,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");
    a.href=url;a.download="juiceworld-progress.json";document.body.appendChild(a);a.click();
    a.remove();URL.revokeObjectURL(url);toast("progress exported");
  };
  $("#importBtn").onclick=()=>$("#importFile").click();
  $("#importFile").onchange=e=>{
    const f=e.target.files[0];if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{
      try{
        const d=JSON.parse(rd.result);
        if(!d||typeof d!=="object"||typeof d.solved!=="object")throw 0;
        if(!confirm("replace current progress with the imported file?")){e.target.value="";return;}
        STATE={solved:d.solved||{},notes:d.notes||{},tier:d.tier||{}};
        save();renderList();toast("progress imported");
      }catch(_){toast("invalid progress file");}
      e.target.value="";
    };
    rd.readAsText(f);
  };
```

- [ ] **Step 5: Run the test to verify it PASSES**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/portability.test.mjs
```
Expected: all PASS, exit 0.

- [ ] **Step 6: Commit**

```bash
cd /Users/andraewilliams/JSapp/files && git add tests/portability.test.mjs juice-shop-command-center.html && git commit -m "feat: export/import progress as JSON"
```

---

## Task 3: Live Juice Shop sync engine

**Files:**
- Modify: `juice-shop-command-center.html` (sync engine functions + name index)
- Create: `tests/livesync.test.mjs`

**Interfaces:**
- Consumes: `CHALLENGES` (array of `{id,name,...}`), `STATE.solved`, `save()`, `renderList()`.
- Produces (globals in HTML):
  - `const NAME2ID` — a `Map` from lowercased challenge name → id, built once.
  - `let LIVE={url:"",timer:null,ids:new Set(),status:"idle"}` — sync state. `status` ∈ `"idle"|"connected"|"error"|"blocked"`. `LIVE.ids` holds ids auto-solved by sync.
  - `async function syncOnce(url)` → resolves to `{matched:number,error:string|null}`. Fetches `url + "/api/Challenges"`, reads `json.data` (array of `{name,solved}`), and for each with `solved===true` whose name maps via `NAME2ID`, sets `STATE.solved[id]=true` and adds id to `LIVE.ids`. Never un-sets a solve. Calls `save()` + `renderList()` if anything changed. On fetch/parse failure returns `{matched:0,error:"<message>"}` and does not throw.
  - `function isBlocked()` → `true` when `location.protocol==="https:"` (mixed-content will block http-localhost). Used by the UI task.

- [ ] **Step 1: Write the failing test (mocked Juice Shop API)**

Create `/Users/andraewilliams/JSapp/files/tests/livesync.test.mjs`:

```js
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
```

Note: this test calls `window.syncOnce`, `window.CHALLENGES`, `window.STATE`. Those are top-level `const`/`let` in the file's single script, which are NOT automatically on `window`. Step 3 explicitly exposes them.

- [ ] **Step 2: Run the test to verify it FAILS**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/livesync.test.mjs
```
Expected: FAIL — `window.syncOnce is not a function`.

- [ ] **Step 3: Add the sync engine**

In `juice-shop-command-center.html` find (added in Task 1):
```js
const storage=(typeof window!=="undefined"&&window.storage)?window.storage:{
  get:async k=>({value:localStorage.getItem(k)}),
  set:async(k,v)=>{localStorage.setItem(k,v);},
  delete:async k=>{localStorage.removeItem(k);}
};
```
Add immediately AFTER it:
```js
const NAME2ID=new Map();CHALLENGES.forEach(c=>NAME2ID.set(c.name.toLowerCase(),c.id));
let LIVE={url:"",timer:null,ids:new Set(),status:"idle"};
function isBlocked(){return typeof location!=="undefined"&&location.protocol==="https:";}
async function syncOnce(url){
  let matched=0;
  try{
    const r=await fetch(url.replace(/\/+$/,"")+"/api/Challenges",{cache:"no-store"});
    if(!r.ok)return{matched:0,error:"HTTP "+r.status};
    const j=await r.json();const data=(j&&j.data)||[];
    let changed=false;
    data.forEach(row=>{
      if(!row||row.solved!==true)return;
      const id=NAME2ID.get(String(row.name||"").toLowerCase());
      if(id&&!STATE.solved[id]){STATE.solved[id]=true;LIVE.ids.add(id);changed=true;}
      if(id)matched++;
    });
    if(changed){save();renderList();}
    return{matched,error:null};
  }catch(e){return{matched:0,error:(e&&e.message)||"fetch failed"};}
}
window.syncOnce=syncOnce;window.CHALLENGES=CHALLENGES;window.STATE=STATE;
```

Note on the last line: exposing these on `window` is required for the tests to reach them and is harmless in production (no behavior change). Keep it.

- [ ] **Step 4: Run the test to verify it PASSES**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/livesync.test.mjs
```
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/andraewilliams/JSapp/files && git add tests/livesync.test.mjs juice-shop-command-center.html && git commit -m "feat: live Juice Shop sync engine (name-match, additive)"
```

---

## Task 4: Live sync UI + mixed-content guard + live badge

**Files:**
- Modify: `juice-shop-command-center.html` (connect UI in header, status dot styling, poll wiring, live badge on cards)
- Modify: `tests/livesync.test.mjs` (append UI assertions)

**Interfaces:**
- Consumes: `syncOnce`, `LIVE`, `isBlocked`, `toast`, `$`, `el`, `renderList`, `card()` render path.
- Produces: header controls `#liveUrl` (input), `#liveConnect` (button), `#liveDot` (status indicator with class `idle|connected|error|blocked`), `#liveMsg` (text). Cards auto-solved via sync get a `.bdg.live` badge reading `LIVE`.

- [ ] **Step 1: Append the failing UI test**

Append to `/Users/andraewilliams/JSapp/files/tests/livesync.test.mjs` (before the file ends, add a second `withServer` block):

```js
await withServer(async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/juice-shop-command-center.html`);
  await page.waitForSelector('.card');

  // The connect UI exists.
  assert(await page.$('#liveUrl'), 'live URL input present');
  assert(await page.$('#liveConnect'), 'connect button present');
  ok('live sync UI rendered');

  const firstName = await page.evaluate(() => window.CHALLENGES[0].name);
  await page.route('**/api/Challenges', route => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'success', data: [{ name: firstName, solved: true }] }),
  }));

  await page.fill('#liveUrl', 'http://juice.test');
  await page.click('#liveConnect');
  await page.waitForTimeout(400);

  const dotClass = await page.evaluate(() => document.querySelector('#liveDot').className);
  assert(/connected/.test(dotClass), 'status dot shows connected after successful sync');
  const hasLiveBadge = await page.evaluate(() => !!document.querySelector('.card.done .bdg.live'));
  assert(hasLiveBadge, 'auto-solved card shows a LIVE badge');
  ok('connect flow updates status + tags live solves');
});
```

- [ ] **Step 2: Run the test to verify the new block FAILS**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/livesync.test.mjs
```
Expected: FAIL — `#liveUrl` not found.

- [ ] **Step 3: Add status-dot + live-badge CSS**

In `juice-shop-command-center.html` find:
```css
  .hidden{display:none!important}
```
Add BEFORE it:
```css
  .live{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;font-size:11px}
  .live input{background:var(--panel);border:1px solid var(--line);color:var(--ink);padding:5px 8px;border-radius:6px;font-family:var(--mono);font-size:11px;min-width:180px}
  .live button{background:var(--panel2);border:1px solid var(--line);color:var(--cyan);padding:5px 10px;border-radius:6px;cursor:pointer;font-family:var(--mono);font-size:11px}
  #liveDot{width:9px;height:9px;border-radius:50%;background:var(--dim);flex:0 0 auto}
  #liveDot.connected{background:var(--green)}
  #liveDot.error{background:var(--red)}
  #liveDot.blocked{background:var(--amber)}
  #liveMsg{color:var(--dim)}
  .bdg.live{color:var(--green);border-color:var(--green)}
```

- [ ] **Step 4: Add the connect UI to the header**

In `juice-shop-command-center.html` find:
```html
      <span id="bycat"></span>
      <span id="bydiff"></span>
    </div>
  </header>
```
Replace with:
```html
      <span id="bycat"></span>
      <span id="bydiff"></span>
    </div>
    <div class="live">
      <span id="liveDot" class="idle"></span>
      <input id="liveUrl" value="http://localhost:3000" placeholder="http://localhost:3000">
      <button id="liveConnect">CONNECT LIVE</button>
      <span id="liveMsg">manual mode &middot; connect a local instance to auto-detect solves</span>
    </div>
  </header>
```

- [ ] **Step 5: Wire the connect button + polling**

In `juice-shop-command-center.html` find the export handler block added in Task 2 and add these lines immediately AFTER the `$("#importFile").onchange=...` handler closes (i.e., after its final `};`):

```js
  function setLive(status,msg){LIVE.status=status;$("#liveDot").className=status;if(msg!=null)$("#liveMsg").textContent=msg;}
  async function livePoll(url){
    const r=await syncOnce(url);
    if(r.error){setLive("error","sync error: "+r.error);}
    else{setLive("connected","live · "+r.matched+" solved on instance · polling every 15s");}
  }
  $("#liveConnect").onclick=async()=>{
    if(LIVE.timer){clearInterval(LIVE.timer);LIVE.timer=null;LIVE.url="";setLive("idle","manual mode · connect a local instance to auto-detect solves");$("#liveConnect").textContent="CONNECT LIVE";return;}
    if(isBlocked()){setLive("blocked","live sync needs a local (http/file) context — download this file and open it locally to enable it");return;}
    const url=$("#liveUrl").value.trim();if(!url)return;
    LIVE.url=url;$("#liveConnect").textContent="DISCONNECT";
    await livePoll(url);
    LIVE.timer=setInterval(()=>livePoll(url),15000);
  };
```

- [ ] **Step 6: Render the LIVE badge on auto-solved cards**

In `juice-shop-command-center.html` find the `card(ch)` function's badge construction. Locate this exact line inside `card()`:
```js
  const done=!!STATE.solved[ch.id];
```
Add immediately AFTER it:
```js
  const isLive=LIVE.ids.has(ch.id);
```
Then find, later in `card()`, the badges assembly. The badges container is the variable `bwrap`. Find this exact line:
```js
  ch.tags.filter(t=>SHOW_BADGE.has(t)).forEach(t=>{bwrap.appendChild(el("span","bdg "+(TAGCLS[t]||""),t));});
```
Add immediately AFTER it:
```js
  if(isLive)bwrap.appendChild(el("span","bdg live","LIVE"));
```

- [ ] **Step 7: Run the test to verify it PASSES**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/livesync.test.mjs
```
Expected: all PASS (both blocks), exit 0.

- [ ] **Step 8: Manually verify the mixed-content guard message wording**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && grep -c "download this file and open it locally" juice-shop-command-center.html
```
Expected: `1` — the guard message is present.

- [ ] **Step 9: Commit**

```bash
cd /Users/andraewilliams/JSapp/files && git add tests/livesync.test.mjs juice-shop-command-center.html && git commit -m "feat: live sync UI, status dot, mixed-content guard, LIVE badge"
```

---

## Task 5: Expand payload / toolkit content

**Files:**
- Modify: `juice-shop-command-center.html` (append to the Toolkit `PAYLOAD LIBRARY` content)
- Create: `tests/toolkit.test.mjs`

**Interfaces:**
- Consumes: existing `copyWire()` global click-to-copy handler (copies text of any clicked `code` element and toasts); the Toolkit tab render.
- Produces: additional `code` payload entries under a new `<h3>PAYLOAD LIBRARY — EXTENDED</h3>` block inside `#toolkitdoc`.

- [ ] **Step 1: Write the failing test**

Create `/Users/andraewilliams/JSapp/files/tests/toolkit.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/toolkit.test.mjs
```
Expected: FAIL — "PAYLOAD LIBRARY — EXTENDED" not found.

- [ ] **Step 3: Append the extended payload block**

In `juice-shop-command-center.html` find the end of the existing JWT section inside `#toolkitdoc`. Locate this exact line:
```html
    <h3>JWT ATTACKS (the app runs on JWT)</h3>
```
Add immediately BEFORE it:
```html
    <h3>PAYLOAD LIBRARY — EXTENDED</h3>
    <div class="kv">
      <div class="k">SQLi login (users)</div><div><code>admin@juice-sh.op'--</code> · <code>' UNION SELECT 1--</code></div>
      <div class="k">SQLi order-by probe</div><div><code>?order=id)) ORDER BY 1--</code> (find column count)</div>
      <div class="k">NoSQLi regex</div><div><code>{"email":{"$regex":".*"},"password":{"$gt":""}}</code></div>
      <div class="k">SSTI (email/reviews)</div><div><code>#{7*7}</code> · <code>{{7*7}}</code> · <code>&lt;%= 7*7 %&gt;</code></div>
      <div class="k">stored XSS (name)</div><div><code>&lt;img src=x onerror=alert(1)&gt;</code></div>
      <div class="k">path traversal</div><div><code>../../../etc/passwd</code> · <code>..%2f..%2f..%2fetc%2fpasswd</code></div>
      <div class="k">JWT none-alg</div><div>header <code>{"alg":"none","typ":"JWT"}</code>, drop signature</div>
      <div class="k">open redirect</div><div><code>?to=https://evil.example</code> · <code>redirect?to=//evil.example</code></div>
      <div class="k">default creds</div><div><code>admin@juice-sh.op</code> / <code>admin123</code> · <code>password</code></div>
      <div class="k">deserialization</div><div>Node <code>_$$ND_FUNC$$_</code> gadget in a serialized field</div>
    </div>

    <h3>ATTACK RECIPES (per category)</h3>
    <ul>
      <li><b>Broken Access Control</b> — log in low-priv → capture a request → swap your id/BasketId/role → replay in Burp Repeater</li>
      <li><b>Injection</b> — find a filter/search/order param → break the query with a quote → rebuild with <code>UNION SELECT</code> matching column count</li>
      <li><b>Sensitive Data Exposure</b> — hit <code>/ftp</code>, <code>/support/logs</code>, source maps, and error stack traces before touching auth</li>
      <li><b>Crypto</b> — decode every token/hash you see (jwt.io, CyberChef); weak = HS256 brute or MD5 crack</li>
    </ul>
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/toolkit.test.mjs
```
Expected: all PASS, exit 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/andraewilliams/JSapp/files && git add tests/toolkit.test.mjs juice-shop-command-center.html && git commit -m "feat: extended payload library + per-category attack recipes"
```

---

## Task 6: Solved-by-category / difficulty breakdown bars

**Files:**
- Modify: `juice-shop-command-center.html` (breakdown container + render in `updateStats()`)
- Create: `tests/polish.test.mjs`

**Interfaces:**
- Consumes: `CHALLENGES`, `STATE.solved`, `updateStats()` (called on every render), `el`, `$`.
- Produces: a `#breakdown` container in the header populated by `renderBreakdown()`, called from the end of `updateStats()`. Each row: label + a `.mini` bar whose width is the solved percentage.

- [ ] **Step 1: Write the failing test**

Create `/Users/andraewilliams/JSapp/files/tests/polish.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the test to verify it FAILS**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/polish.test.mjs
```
Expected: FAIL — `#breakdown` not found.

- [ ] **Step 3: Add breakdown + mini-bar CSS**

In `juice-shop-command-center.html` find:
```css
  .live{display:flex;gap:8px;align-items:center;margin-top:10px;flex-wrap:wrap;font-size:11px}
```
Add BEFORE it:
```css
  #breakdown{margin-top:10px;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:4px 14px}
  .brow{display:grid;grid-template-columns:88px 1fr 34px;gap:8px;align-items:center;font-size:10px;color:var(--dim)}
  .mini{height:6px;background:#0a100c;border:1px solid var(--line);border-radius:4px;overflow:hidden}
  .mini > i{display:block;height:100%;background:linear-gradient(90deg,var(--green),var(--cyan));width:0%}
  .brow .n{text-align:right;color:var(--ink)}
```

- [ ] **Step 4: Add the breakdown container to the header**

In `juice-shop-command-center.html` find (added in Task 4):
```html
    <div class="live">
      <span id="liveDot" class="idle"></span>
```
Add BEFORE the `<div class="live">` line:
```html
    <div id="breakdown"></div>
```

- [ ] **Step 5: Add `renderBreakdown()` and call it from `updateStats()`**

In `juice-shop-command-center.html` find the end of `updateStats()`:
```js
  const dz=CHALLENGES.filter(c=>c.danger);const dzDone=dz.filter(c=>STATE.solved[c.id]).length;
  $("#bydiff").textContent="· danger zone "+dzDone+"/"+dz.length;
}
```
Replace with:
```js
  const dz=CHALLENGES.filter(c=>c.danger);const dzDone=dz.filter(c=>STATE.solved[c.id]).length;
  $("#bydiff").textContent="· danger zone "+dzDone+"/"+dz.length;
  renderBreakdown();
}
function renderBreakdown(){
  const box=$("#breakdown");if(!box)return;box.innerHTML="";
  const byCat={};CHALLENGES.forEach(c=>{const m=byCat[c.cat]=byCat[c.cat]||[0,0];m[1]++;if(STATE.solved[c.id])m[0]++;});
  const cats=CAT_ORDER.filter(c=>byCat[c]).concat(Object.keys(byCat).filter(c=>!CAT_ORDER.includes(c)));
  cats.forEach(cat=>{const[d,t]=byCat[cat];box.appendChild(bar(cat,d,t));});
  const byDiff={};CHALLENGES.forEach(c=>{const m=byDiff[c.diff]=byDiff[c.diff]||[0,0];m[1]++;if(STATE.solved[c.id])m[0]++;});
  Object.keys(byDiff).sort().forEach(d=>{const[s,t]=byDiff[d];box.appendChild(bar(stars(+d),s,t));});
}
function bar(label,done,total){
  const pct=total?Math.round(done/total*100):0;
  const row=el("div","brow");
  row.appendChild(el("span",null,label));
  const m=el("div","mini");const i=el("i");i.style.width=pct+"%";m.appendChild(i);row.appendChild(m);
  row.appendChild(el("span","n",done+"/"+total));
  return row;
}
```

- [ ] **Step 6: Add the `/` keyboard shortcut**

In `juice-shop-command-center.html` find the last line of `wire()` — the tag-select population line:
```js
  const st=$("#ftag");[...new Set(CHALLENGES.flatMap(c=>c.tags))].sort().forEach(t=>{const o=el("option");o.value=t;o.textContent=t;st.appendChild(o);});
```
Add immediately AFTER it (still inside `wire()`):
```js
  document.addEventListener("keydown",e=>{
    if(e.key==="/"&&!/^(input|textarea|select)$/i.test((e.target.tagName||""))){e.preventDefault();const s=$("#search");if(s){document.querySelector('.tab[data-tab="challenges"]').click();s.focus();}}
  });
```

- [ ] **Step 7: Run the test to verify it PASSES**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/polish.test.mjs
```
Expected: all PASS, exit 0.

- [ ] **Step 8: Run the full suite**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && npm test
```
Expected: all five test files PASS, exit 0.

- [ ] **Step 9: Commit**

```bash
cd /Users/andraewilliams/JSapp/files && git add tests/polish.test.mjs juice-shop-command-center.html && git commit -m "feat: category/difficulty breakdown bars + '/' search shortcut"
```

---

## Task 7: Mobile layout pass + README correction

**Files:**
- Modify: `juice-shop-command-center.html` (responsive CSS)
- Modify: `README.md` (fix the `index.html` vs actual filename mismatch and persistence claim)

**Interfaces:**
- Consumes: existing layout classes `.wrap`, `.filters`, `.tabs`, `.live`, `.brow`, `.kv`.
- Produces: a `@media (max-width:520px)` block; corrected README run instructions.

- [ ] **Step 1: Append the failing mobile assertion**

Append to `/Users/andraewilliams/JSapp/files/tests/polish.test.mjs` a new block at the end:

```js
import { withServer } from './helpers.mjs';
await withServer(async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto(`${baseURL}/juice-shop-command-center.html`);
  await page.waitForSelector('.card');
  // No horizontal overflow at mobile width.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 2, `no horizontal overflow at 375px (got ${overflow}px)`);
  ok('no horizontal overflow on mobile');
  // The .kv grids collapse to a single column on mobile.
  await page.click('.tab[data-tab="toolkit"]');
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('#toolkitdoc .kv')).gridTemplateColumns);
  assert(!/\s/.test(cols.trim()), `kv grid is single-column on mobile (got "${cols}")`);
  ok('kv grid collapses on mobile');
});
```

Note: `assert`/`ok` are already imported at the top of `polish.test.mjs` from Task 6; add only the `withServer` import if it is not already imported there. If `withServer` is already imported, do not duplicate the import — move the existing import line to cover both.

- [ ] **Step 2: Run the test to verify it FAILS**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/polish.test.mjs
```
Expected: FAIL — either horizontal overflow > 2px or the `.kv` grid still shows two columns (`130px 1fr`) at 375px.

- [ ] **Step 3: Add the responsive block**

In `juice-shop-command-center.html` find:
```css
  .hidden{display:none!important}
```
Add BEFORE it:
```css
  @media (max-width:520px){
    .wrap{padding:12px 10px 48px}
    .kv{grid-template-columns:1fr}
    .kv .k{color:var(--cyan)}
    .stats{gap:8px}
    .live input{min-width:0;flex:1 1 140px}
    .brow{grid-template-columns:70px 1fr 30px}
    .title{font-size:14px}
  }
```

- [ ] **Step 4: Run the test to verify it PASSES**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && node tests/polish.test.mjs
```
Expected: all PASS, exit 0.

- [ ] **Step 5: Fix the README run instructions**

In `README.md` find:
```markdown
Just open `index.html` in a browser — no build step.
```
Replace with:
```markdown
Just open `juice-shop-command-center.html` in a browser — no build step. Progress (solved state, notes, hint tiers) is saved in the browser via `localStorage`; use **EXPORT/IMPORT** in the footer to back it up or move it between machines.
```

- [ ] **Step 6: Run the full suite to confirm no regressions**

Run:
```bash
cd /Users/andraewilliams/JSapp/files && npm test
```
Expected: all five test files PASS, exit 0.

- [ ] **Step 7: Commit**

```bash
cd /Users/andraewilliams/JSapp/files && git add tests/polish.test.mjs juice-shop-command-center.html README.md && git commit -m "feat: mobile layout pass; fix README run/persistence instructions"
```

---

## Self-Review Notes

**Spec coverage:**
- Phase 1 (persistence) → Task 1. ✓
- Phase 2 (export/import) → Task 2. ✓
- Phase 3 (live sync, local-only, graceful, name-match, additive, mixed-content guard) → Tasks 3 (engine) + 4 (UI/guard/badge). ✓
- Phase 4 (payload/recipe expansion) → Task 5. ✓
- Phase 5 (breakdown bars, mobile, `/` shortcut) → Tasks 6 + 7. ✓
- Spec's out-of-scope items (backend, AI, framework, PDF) are not introduced. ✓
- Bonus: README `index.html` mismatch (surfaced earlier) folded into Task 7 since we're touching run instructions anyway.

**Type/name consistency:** `storage` adapter (Task 1) consumed by Tasks 2–3; `syncOnce`/`LIVE`/`isBlocked`/`NAME2ID` (Task 3) consumed by Task 4; `renderBreakdown`/`bar` (Task 6) self-contained; `withPage`/`withServer`/`assert`/`ok` (Task 1) consumed by all test files. Names are consistent across tasks.

**Placeholder scan:** No TBD/TODO; all code blocks are complete. Task 4 Step 6's badges-container variable was verified against the source — it is `bwrap` — and the anchor line is exact.
