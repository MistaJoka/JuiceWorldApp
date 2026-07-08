# JuiceWorld Command Center — Enhancements Design

**Date:** 2026-07-07
**File under change:** `juice-shop-command-center.html` (single file, ~544 lines)
**Repo:** https://github.com/MistaJoka/JuiceWorldApp.git

## Guiding constraint

The app stays a single, zero-dependency, offline-capable HTML file. No build step,
no external libraries, no network required except the opt-in live sync. Every feature
degrades gracefully when its dependency (a running instance, an HTTPS context) is absent.

Work is split into five independent phases. Phase 1 is foundational and lands first;
Phases 2–5 are order-independent once Phase 1 is in place.

---

## Phase 1 — Fix persistence (foundational)

### Problem
`load()` and `save()` call `window.storage.get/set/delete`. `window.storage` is never
defined in the file and does not exist in a normal browser — it only exists inside certain
sandboxed artifact runtimes. Because both calls are wrapped in `try/catch`, every save
silently no-ops when the file is opened standalone or via GitHub Pages. Result: no progress,
notes, or hint-tier state persists, contradicting the README ("Progress persists in the
browser") and the in-app warning that says "(localStorage)".

### Fix
Introduce a small storage adapter that prefers real `localStorage` and falls back to the
artifact `window.storage` shim if it is present, so the app works in both a plain browser
and the artifact runtime:

```js
const storage = (window.storage) ? window.storage : {
  get:   async k => ({ value: localStorage.getItem(k) }),
  set:   async (k,v) => localStorage.setItem(k,v),
  delete: async k => localStorage.removeItem(k),
};
```

- Rewire `load()`, `save()`, and the reset handler to call `storage.*` instead of
  `window.storage.*`.
- Preserve the existing `STATE` shape (`{solved, notes, tier}`) and the 200ms save debounce.
- Adapter methods are async-shaped to match current call sites, so no other logic changes.

### Acceptance
- Open the file directly (`file://`) in a browser: check a challenge, reload → still checked.
- Notes and hint-tier state survive a reload.
- Reset button clears persisted state.
- Still functions inside the artifact runtime (does not throw if `window.storage` exists).

---

## Phase 2 — Progress portability

### Behavior
- **Export** button: serializes `STATE` to `juiceworld-progress.json` and triggers a download
  via a Blob + object URL.
- **Import** button: hidden `<input type="file">`; on file select, parse JSON, validate it has
  the expected keys, replace `STATE`, `save()`, and re-render.

### Notes
- Import replaces (not merges) to keep semantics predictable; a confirm() guards overwrite.
- Malformed/invalid files show a toast error and leave existing state untouched.
- Buttons live in the header or footer next to the existing reset control.

### Acceptance
- Export produces a JSON file matching current progress.
- Importing that file on a fresh browser restores solved/notes/tier state.
- Importing garbage shows an error and does not corrupt state.

---

## Phase 3 — Live Juice Shop sync (local-only, graceful)

### Behavior
- A **Connect** field (default `http://localhost:3000`) plus a status indicator dot
  (idle / connected / error).
- On connect, poll `GET {url}/api/Challenges` every ~15s.
- Match each returned challenge to ours **by name** (canonical names align with the official
  manifest the data was built from). For any returned challenge with `solved === true`,
  set `STATE.solved[id] = true`.
- Auto-solved challenges get a subtle "live" marker distinguishing them from manual checks.
- Live sync only **adds** solves; it never un-checks a manually marked challenge.

### Mixed-content guard
- If `location.protocol === 'https:'` (e.g. GitHub Pages), do not attempt the fetch. Show:
  *"Live sync needs a local (http/file) context — download this file and open it locally to
  enable it."* Manual checkboxes keep working everywhere.
- Fetch failures (instance down, wrong URL) set the status dot to error with a short message;
  they never throw uncaught or wipe state.

### Notes
- Juice Shop serves permissive CORS (`Access-Control-Allow-Origin: *`), so cross-origin
  fetch from `file://` or a local HTTP context succeeds; only the HTTPS→HTTP-localhost
  mixed-content block prevents it on the hosted page.
- Polling stops when disconnected; interval is cleared to avoid leaks.

### Acceptance
- With a local Juice Shop running and the file opened locally, solving a challenge in Juice
  Shop auto-checks it here within one poll cycle.
- On the hosted HTTPS page, the guard message appears instead of a silent failure.
- Manual checks are never overwritten by sync.

---

## Phase 4 — Payload / tooling expansion

### Behavior
Grow the **Toolkit** tab with more click-to-copy content. The existing `copyWire()` global
click handler already copies any clicked `code` element, so new content is mostly static data
blocks — no new copy plumbing.

Content to add:
- Expanded payload library: SQLi, XSS, SSTI, NoSQLi, JWT `alg:none`, path traversal,
  common default credentials.
- A few per-category "attack recipe" snippets.

### Notes
- Purely static content blocks; keeps the app offline and dependency-free.
- Follows the existing accordion/collapsible structure in the Toolkit tab.

### Acceptance
- New payloads render in the Toolkit tab and copy on click (toast confirms).
- No layout regression in existing Toolkit sections.

---

## Phase 5 — UX / data polish

### Behavior
- Solved-by-category and solved-by-difficulty mini-bars, built from pure CSS/divs (no chart
  library), driven by the same counts `updateStats()` already computes.
- Mobile layout pass: filters, tabs, and header stats wrap cleanly at narrow widths.
- Keyboard shortcuts: `/` focuses the search input (and any other cheap, high-value binding).

### Acceptance
- Breakdown bars reflect real solved counts and update on solve/reset.
- Layout is usable at ~375px width with no horizontal overflow.
- `/` focuses search from anywhere not already in a text field.

---

## Out of scope (YAGNI)

- No backend, accounts, or cloud sync.
- No AI/LLM integration.
- No framework or build tooling.
- No write-up/PDF export engine (portability JSON covers backup/sharing for now).

## Sequencing

1. **Phase 1** first — independently valuable, unblocks everything else.
2. **Phases 2–5** in any order afterward; each is small and independently verifiable.
