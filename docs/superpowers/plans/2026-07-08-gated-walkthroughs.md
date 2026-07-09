# Gated Walkthroughs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-challenge full-solution walkthroughs to the JuiceWorld Command Center, revealed on demand via an always-available button on each challenge card.

**Architecture:** The app is a single HTML file (`juice-shop-command-center.html`) with a data layer (`CH[]` array), a `localStorage`-backed `STATE` object, and a `card(ch)` render function. Walkthroughs add one optional data field (`s`), one state bucket (`STATE.sol`), and one render block + CSS. No new files in the app; one new test file.

**Tech Stack:** Vanilla JS, single HTML file, Playwright test harness (`tests/*.test.mjs`, run via `node`).

## Global Constraints

- **Zero dependencies / single file** — all app code stays in `juice-shop-command-center.html`. No build step, no new runtime deps.
- **No fabricated solutions** — a challenge without an authored `s` array renders **no** reveal button and falls back to the existing official `solution ↗` link. Only hand-verified walkthroughs are authored.
- **No penalty / no tracking / no caution copy** — the reveal is a plain toggle. Do not add integrity metrics, confirmation dialogs, or "earned vs revealed" stats.
- **Always available** — the reveal button appears whenever a card with an authored `s` is open; it is NOT gated behind hint tiers.
- **Persistence contract** — reveal state lives in `STATE.sol` and must: persist to `localStorage` via `save()`, survive reload, round-trip through EXPORT/IMPORT, and clear on RESET.
- **Test command** — `npm test` runs each `tests/*.test.mjs` in sequence via `node`. New test file must be added to the `test` script in `package.json`.

---

## File Structure

- **Modify** `juice-shop-command-center.html`:
  - `CH[]` data array (line ~192) — add `"s"` field to 14 challenges.
  - `CHALLENGES=CH.map(...)` (line 196) — expose `sol`.
  - `STATE` init (line 228), `load()` (line 234), reset handler (line 628), import handler (line 644) — add `sol` bucket.
  - `card(ch)` (lines 280–329) — add `data-id`, render reveal button + solution block.
  - `copyWire()` delegation (line 578) — include `.solution code`.
  - CSS (near `.reveal` at line 56) — add `.solbtn` and `.solution` styles.
- **Create** `tests/walkthrough.test.mjs` — Playwright coverage.
- **Modify** `package.json` — add the new test to the `test` script.

---

### Task 1: Data model — expose `sol` and author the starter set

**Files:**
- Modify: `juice-shop-command-center.html:192` (add `"s"` to 14 `CH` entries), `:196` (`CHALLENGES` map)
- Test: `tests/walkthrough.test.mjs` (create)

**Interfaces:**
- Produces: `window.CHALLENGES[i].sol` — a `string[]` per challenge (empty `[]` when no authored walkthrough). Each string may contain inline `<code>…</code>`. Challenge ids are `"c" + index` into `CH`; e.g. `Login Admin` is `c1`, `Chatbot Prompt Injection` (no walkthrough) is `c0`.

- [ ] **Step 1: Write the failing test**

Create `tests/walkthrough.test.mjs`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/walkthrough.test.mjs`
Expected: FAIL — `sol` is `undefined` (`Cannot read properties of undefined` or the array assertion fails).

- [ ] **Step 3: Expose `sol` in the CHALLENGES map**

Modify line 196. Change:

```js
const CHALLENGES=CH.map((c,i)=>({id:"c"+i,name:c.n,cat:c.c,diff:c.d,goal:c.g,tags:c.t||[],hints:c.h||[],mit:c.m,danger:c.x}));
```

to:

```js
const CHALLENGES=CH.map((c,i)=>({id:"c"+i,name:c.n,cat:c.c,diff:c.d,goal:c.g,tags:c.t||[],hints:c.h||[],mit:c.m,danger:c.x,sol:c.s||[]}));
```

- [ ] **Step 4: Author the `s` field on the 14 starter challenges**

In the `CH=[...]` array (line 192), add an `"s"` key to each of the following challenge objects (match by `"n"` value; insert `"s":[...]` alongside the existing keys, e.g. right after `"m":...`). Do NOT touch any other challenge — they intentionally have no `s`.

**Login Admin** — `"s"`:
```json
["Open the Login screen at #/login.","In the Email field enter <code>' OR 1=1--</code> and type any non-empty password.","The trailing <code>--</code> comments out the password check; the injected <code>OR 1=1</code> makes the WHERE clause always true, so the query returns the first user row — the admin.","Submit. You are now authenticated as <code>admin@juice-sh.op</code>."]
```

**Login Bender** — `"s"`:
```json
["Open #/login.","In the Email field enter <code>bender@juice-sh.op'--</code> and any password.","The quote closes the email string and <code>--</code> comments out the password clause, so authentication succeeds for Bender's account without knowing the password.","Submit to log in as Bender."]
```

**Login Jim** — `"s"`:
```json
["Open #/login.","In the Email field enter <code>jim@juice-sh.op'--</code> and any password.","Same comment-injection as the Bender solve: the password check is commented out, authenticating you as Jim.","Submit to log in as Jim."]
```

**Password Strength** — `"s"`:
```json
["This challenge does not need injection — the admin simply uses a weak, guessable password.","Open #/login.","Email <code>admin@juice-sh.op</code>, password <code>admin123</code>.","Submit. The weak password logs you in as admin and solves the challenge."]
```

**View Basket** — `"s"`:
```json
["Log in as any user, then open your basket.","Open DevTools → Application → Session Storage and find the <code>bid</code> key (your basket id).","Change <code>bid</code> to a different number (e.g. decrement or increment by 1) to point at another user's basket.","Reload the basket view (or re-open #/basket). It now shows another user's basket, solving the challenge."]
```

**Forged Feedback** — `"s"`:
```json
["Log in, then open the Customer Feedback form at #/contact.","The form ties feedback to your own UserId via a hidden field. Open DevTools → Elements and locate the hidden <code>UserId</code> input on the form (it may carry an <code>ng-hide</code>/hidden attribute).","Remove the hidden/disabled attribute so the field is editable, or intercept the POST to <code>/api/Feedbacks</code> and set <code>UserId</code> to another user's id (e.g. <code>2</code>).","Fill in a comment and rating, solve the CAPTCHA, and submit. The feedback is posted under a UserId that is not yours."]
```

**Bonus Payload** — `"s"`:
```json
["Open the Customer Feedback form at #/contact.","Paste the official bonus payload into the Comment field:","<code><iframe width=\"100%\" height=\"166\" scrolling=\"no\" frameborder=\"no\" allow=\"autoplay\" src=\"https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/771984076&color=%23ff5500&auto_play=true\"></iframe></code>","Set a rating, solve the CAPTCHA, and submit. The reflected iframe payload triggers the bonus challenge."]
```

**DOM XSS** — `"s"`:
```json
["Go to the top search bar (the magnifying glass in the header).","Enter the payload <code><iframe src=\"javascript:alert(`xss`)\"></code> and press Enter.","The search term is written to the DOM unsanitized, executing the injected iframe's JavaScript and popping the alert.","The alert firing solves the DOM XSS challenge."]
```

**Reflected XSS** — `"s"`:
```json
["Log in and open an order's tracking page (Orders & Payment → track a delivery), which reflects the <code>id</code> query param.","Replace the tracking id in the URL with the payload: <code>#/track-result?id=<iframe src=\"javascript:alert(`xss`)\"></code>","Load the URL. The <code>id</code> value is reflected into the page without encoding, executing the iframe payload.","The alert firing solves the Reflected XSS challenge."]
```

**Privacy Policy** — `"s"`:
```json
["Log in to your account.","Open the account menu and choose Privacy & Security → Privacy Policy (route <code>#/privacy-security/privacy-policy</code>).","Simply visiting the Privacy Policy page while logged in solves this tutorial challenge."]
```

**Score Board** — `"s"`:
```json
["The Score Board is an undocumented route. Open DevTools and Ctrl/Cmd-F the main JS bundle for <code>score-board</code> to confirm the path.","Navigate directly to <code>#/score-board</code> in the address bar.","The Score Board loads, revealing every challenge and solving this challenge."]
```

**Database Schema** — `"s"`:
```json
["The product search endpoint <code>/rest/products/search?q=</code> is injectable; its underlying query selects 9 columns.","Send a UNION injection that closes the original parentheses and selects the schema DDL from <code>sqlite_master</code>:","<code>/rest/products/search?q=qwert')) UNION SELECT sql,'2','3','4','5','6','7','8','9' FROM sqlite_master--</code>","The response includes the <code>CREATE TABLE</code> statements — the full DB schema — solving the challenge."]
```

**User Credentials** — `"s"`:
```json
["Reuse the injectable product search (9-column UNION).","Exfiltrate id, email, and password-hash columns from the Users table:","<code>/rest/products/search?q=qwert')) UNION SELECT id,email,password,'4','5','6','7','8','9' FROM Users--</code>","The response lists every user's email and password hash, solving the challenge. (Crack a hash with the Toolkit tab for follow-on challenges.)"]
```

**Christmas Special** — `"s"`:
```json
["The Christmas special product is soft-deleted (<code>deletedAt</code> is set), so normal search hides it.","Inject into the product search to bypass the <code>deletedAt IS NULL</code> filter and reveal deleted rows:","<code>/rest/products/search?q=' OR deletedAt IS NOT NULL--</code>","Find the Christmas special's product id in the results, then add that product to your basket via the API (<code>POST /api/BasketItems</code> with the product id) and complete checkout to solve the challenge."]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node tests/walkthrough.test.mjs`
Expected: PASS — both `authored challenge exposes sol steps` and `unauthored challenge exposes empty sol`.

- [ ] **Step 6: Commit**

```bash
git add juice-shop-command-center.html tests/walkthrough.test.mjs
git commit -m "feat: expose sol field + author starter walkthrough set"
```

---

### Task 2: State bucket — persist, export/import, reset

**Files:**
- Modify: `juice-shop-command-center.html:228` (STATE init), `:234` (load), `:628` (reset), `:644` (import)
- Test: `tests/walkthrough.test.mjs`

**Interfaces:**
- Consumes: `window.CHALLENGES[i].sol` from Task 1.
- Produces: `STATE.sol` — an object mapping challenge id → `true` when revealed. Persisted under the existing `localStorage` key `juiceshop:state` via the existing `save()` debounce. Cleared by RESET; carried by EXPORT and rebuilt by IMPORT.

- [ ] **Step 1: Write the failing test**

Append to `tests/walkthrough.test.mjs` (inside a new `withPage` block):

```js
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
```

Note: `save` must be reachable. It is already assigned in Step 3 below (`window.save=save`). `STATE` is already exposed via `window.STATE` (line 230).

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/walkthrough.test.mjs`
Expected: FAIL — `stored.sol` is `undefined` (bucket does not exist yet); `window.save` may also be undefined.

- [ ] **Step 3: Add the `sol` bucket to all four state sites**

At line 228, change:
```js
let STATE={solved:{},notes:{},tier:{}};
```
to:
```js
let STATE={solved:{},notes:{},tier:{},sol:{}};
```

At line 230, the file has `window.syncOnce=syncOnce;window.CHALLENGES=CHALLENGES;window.STATE=STATE;` — append `window.save=save;` so tests (and nothing else) can trigger a persist:
```js
window.syncOnce=syncOnce;window.CHALLENGES=CHALLENGES;window.STATE=STATE;window.save=save;
```

At line 234, change:
```js
  STATE.solved=STATE.solved||{};STATE.notes=STATE.notes||{};STATE.tier=STATE.tier||{};
```
to:
```js
  STATE.solved=STATE.solved||{};STATE.notes=STATE.notes||{};STATE.tier=STATE.tier||{};STATE.sol=STATE.sol||{};
```

At line 628, in the reset handler, change:
```js
STATE={solved:{},notes:{},tier:{}};
```
to:
```js
STATE={solved:{},notes:{},tier:{},sol:{}};
```

At line 644, in the import handler, change:
```js
        STATE={solved:d.solved||{},notes:d.notes||{},tier:d.tier||{}};
```
to:
```js
        STATE={solved:d.solved||{},notes:d.notes||{},tier:d.tier||{},sol:d.sol||{}};
```

(EXPORT at line ~630 serializes the whole `STATE` object, so `sol` is included automatically — no change needed there.)

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/walkthrough.test.mjs`
Expected: PASS — all three of `sol persists to localStorage`, `sol survives reload`, `reset clears sol`, plus Task 1's assertions.

- [ ] **Step 5: Commit**

```bash
git add juice-shop-command-center.html tests/walkthrough.test.mjs
git commit -m "feat: add STATE.sol bucket with persistence, import, reset"
```

---

### Task 3: Reveal gate UI — button, solution block, CSS, copy wiring

**Files:**
- Modify: `juice-shop-command-center.html` — CSS near line 56, `card(ch)` lines 280–329, `copyWire()` line 578
- Test: `tests/walkthrough.test.mjs`

**Interfaces:**
- Consumes: `ch.sol` (Task 1), `STATE.sol` (Task 2), the existing `el(tag,className,html)` helper (sets `innerHTML`), `save()`, and the `card(ch)`→`replaceWith` re-render pattern used by the hint buttons at line 310.
- Produces: DOM contract for tests — each `.card` carries `data-id="<id>"`; a card with authored `sol` renders `.solbtn` (button) and, when revealed, an `ol.solution` containing one `li.solstep` per step. Cards with empty `sol` render neither.

- [ ] **Step 1: Write the failing test**

Append to `tests/walkthrough.test.mjs` (new `withPage` block):

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/walkthrough.test.mjs`
Expected: FAIL — `.card[data-id=...]` selector matches nothing (no `data-id` yet) and `.solbtn` never appears; `waitForSelector` times out.

- [ ] **Step 3: Add CSS for the button and solution block**

Immediately after the `.booklinks` rules (after line 62, before `.notes` at line 63), add:

```css
  .solbtn{margin-top:8px;background:none;border:1px solid var(--line);color:var(--dim);font-family:var(--mono);font-size:11px;padding:4px 10px;border-radius:5px;cursor:pointer}
  .solbtn:hover{border-color:var(--amber);color:var(--amber)}
  .solution{margin:8px 0 0;padding:8px 12px 8px 28px;background:var(--panel2);border-left:2px solid var(--amber);border-radius:0 6px 6px 0;font-size:12px;color:var(--ink)}
  .solution li.solstep{margin:3px 0}
  .solution code{background:#080c0a;border:1px solid var(--line);padding:1px 4px;border-radius:3px;color:var(--amber);font-size:11px;cursor:pointer;transition:background .15s,border-color .15s}
  .solution code:hover{background:#12251a;border-color:var(--green)}
  .solution code.copied{background:#12251a;border-color:var(--green);color:var(--green)}
```

- [ ] **Step 4: Tag each card with its id**

In `card(ch)`, at line 285 where the card element is created:
```js
  const c=el("div","card"+(done?" done":""));
```
add a `data-id` on the next line:
```js
  const c=el("div","card"+(done?" done":""));
  c.dataset.id=ch.id;
```

- [ ] **Step 5: Render the reveal button and solution block**

In `card(ch)`, insert this block AFTER the `booklinks` append (after line 323) and BEFORE the `NOTES` label (line 325):

```js
  // full-solution walkthrough: always available when authored, plain toggle
  if(ch.sol&&ch.sol.length){
    const shown=!!STATE.sol[ch.id];
    const sbtn=el("button","solbtn",shown?"▾ HIDE SOLUTION":"▶ REVEAL FULL SOLUTION");
    sbtn.onclick=()=>{STATE.sol[ch.id]=!shown;save();const nc=card(ch);c.replaceWith(nc);nc.classList.add("open");};
    body.appendChild(sbtn);
    if(shown){
      const ol=el("ol","solution");
      ch.sol.forEach(step=>ol.appendChild(el("li","solstep",step)));
      body.appendChild(ol);
    }
  }
```

Note: the `card(ch)`→`replaceWith`→`add("open")` pattern mirrors the hint buttons at line 310, so re-render keeps the card expanded.

- [ ] **Step 6: Wire solution `<code>` into the copy delegation**

At line 578, change:
```js
    const c=e.target.closest(".doc code, .goal code, .reveal code");
```
to:
```js
    const c=e.target.closest(".doc code, .goal code, .reveal code, .solution code");
```

- [ ] **Step 7: Run test to verify it passes**

Run: `node tests/walkthrough.test.mjs`
Expected: PASS — all five reveal-UI assertions plus every earlier assertion in the file.

- [ ] **Step 8: Run the full suite and register the new test**

Add the new test to `package.json`'s `test` script. Change:
```json
    "test": "node tests/persistence.test.mjs && node tests/portability.test.mjs && node tests/livesync.test.mjs && node tests/toolkit.test.mjs && node tests/polish.test.mjs"
```
to:
```json
    "test": "node tests/persistence.test.mjs && node tests/portability.test.mjs && node tests/livesync.test.mjs && node tests/toolkit.test.mjs && node tests/polish.test.mjs && node tests/walkthrough.test.mjs"
```

Run: `npm test`
Expected: PASS — every existing suite plus `walkthrough.test.mjs`.

- [ ] **Step 9: Commit**

```bash
git add juice-shop-command-center.html package.json tests/walkthrough.test.mjs
git commit -m "feat: gated walkthrough reveal button + solution block UI"
```

---

### Task 4: Documentation

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: shipped feature from Tasks 1–3.

- [ ] **Step 1: Document the feature in the README**

In `README.md`, under the "What it does" list, add a bullet after the tiered-hints bullet:

```markdown
- **Full walkthroughs** — challenges in the tutorial + SQL-injection starter set carry a complete step-by-step solution behind a per-card **REVEAL FULL SOLUTION** toggle; every other challenge falls back to the official solution link. Reveal state persists and travels with EXPORT/IMPORT.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document gated walkthroughs feature"
```

---

## Self-Review

**Spec coverage:**
- Data model (`s` field, optional, mapped to `sol`) → Task 1. ✓
- Reveal gate UI, always available, plain toggle, no caution → Task 3, Step 5. ✓
- Solution block distinct amber-edged style → Task 3, Step 3 CSS. ✓
- `<code>` copy in steps → Task 3, Steps 3 & 6. ✓
- State bucket `STATE.sol`, init/load/reset/import, export via whole-object serialize → Task 2. ✓
- Authored starter set (Tutorial + core SQLi) → Task 1, Step 4 (14 challenges). ✓
- No fabricated solutions / empty → fallback → Task 1 (only 14 get `s`), Task 3 (button gated on `ch.sol.length`). ✓
- Tests (gate visibility, reveal/hide, persistence, export/import/reset, code copy) → `tests/walkthrough.test.mjs` across Tasks 1–3. ✓
- Out-of-scope items (no tracking/stats/markdown) → not implemented. ✓

**Placeholder scan:** No TBD/TODO; every code step shows exact before/after text and exact commands. ✓

**Type consistency:** `sol` used consistently (data `sol`, state `STATE.sol`); DOM classes consistent across render and tests (`.solbtn`, `ol.solution`, `li.solstep`, `data-id`); `window.save` added in Task 2 and relied on in Task 2/3 tests. ✓

**Verification note:** The three UNION-injection payloads (Database Schema, User Credentials, Christmas Special) assume Juice Shop's standard 9-column product-search query. During execution, spot-check them against a running instance (`docker run ... bkimminich/juice-shop`); if a payload needs adjustment, update the `s` array only — no structural change.
