# Gated Walkthroughs — Design

**Date:** 2026-07-08
**Component:** JuiceWorld Command Center (`juice-shop-command-center.html`)
**Status:** Approved

## Summary

Add per-challenge **full solution walkthroughs**, revealed on demand via an explicit
button on each challenge card. This is a tool, not a game: no penalty, no caution
copy, no "earned vs revealed" tracking. The button is available whenever a card is
open — it does not require exhausting the hint tiers first.

Most challenges ship with **no** authored walkthrough and fall back to the existing
official `solution ↗` link. A verified starter set (Tutorial on-ramp + core SQL
injection) is hand-authored now. The structure supports filling in the rest later.

## Data model

Each entry in the `CH[]` array gains one optional field:

```js
{ "n": "Login Admin", "c": "Injection", ..., "s": [
    "Open the Login form and intercept the request in Burp (or just use DevTools).",
    "In the email field, submit `' OR 1=1--` with any password.",
    "The `--` comments out the password check; the query returns the first user (admin).",
    "You're now logged in as `admin@juice-sh.op`."
] }
```

- `s` — array of walkthrough step strings. Steps may contain `<code>…</code>`,
  which gets the same click-to-copy behavior hints and goals already have.
- Field is **optional**. Absent or empty `s` ⇒ no walkthrough block is rendered;
  the card behaves exactly as today (official book/solution links remain the fallback).
- Mapped through the existing `CHALLENGES=CH.map(...)` transform as `sol: c.s || []`.

## UI: the reveal gate

Rendered in `card(ch)`, placed **directly below the `booklinks` row**, only when
`ch.sol.length > 0`:

- **Collapsed state:** a single dim button labelled `▶ REVEAL FULL SOLUTION`.
  Always present when the card is open (no hint-tier unlock condition).
- **Clicking** flips `STATE.sol[ch.id] = true`, re-renders the card (same
  `card(ch)` → `replaceWith` pattern the hint buttons use), keeping it open.
- **Revealed state:** the steps render as an ordered list in a distinct block —
  a `.solution` style: a variant of `.reveal` with an amber/red left edge so it
  reads visually as "the answer is open." Button label flips to `▾ HIDE SOLUTION`
  and toggles the flag back off.
- `<code>` inside steps participates in the existing copy-on-click delegation.

No integrity metric, no stats change, no confirmation dialog.

## State & persistence

- New state bucket: `STATE.sol = {}` (challenge id → `true`).
- Initialized in `load()` alongside the others:
  `STATE.sol = STATE.sol || {}`.
- Included in the reset wipe (`STATE={solved:{},notes:{},tier:{},sol:{}}`) in
  both the reset handler and any other place STATE is reconstructed.
- Included in IMPORT reconstruction: `sol: d.sol || {}`.
- EXPORT already serializes the whole `STATE` object, so reveal state is carried
  automatically once the bucket exists.
- Persists across reload via the existing `save()` / `localStorage` path.

## Authored content (starter set)

Hand-authored `s` walkthroughs now (union of Tutorial tag + core SQL injection),
~14 challenges:

**Tutorial on-ramp:** Login Admin, Login Bender, Login Jim, Password Strength,
View Basket, Forged Feedback, Bonus Payload, DOM XSS, Reflected XSS,
Privacy Policy, Score Board.

**Core SQL injection (beyond the tutorial ones above):** Database Schema,
Christmas Special, User Credentials.

Every other challenge: no `s` ⇒ official-link fallback. No fabricated solutions ship.

## Testing

New `tests/walkthrough.test.mjs`, following the existing Playwright harness in
`tests/`:

1. A challenge with authored `s` shows the `▶ REVEAL FULL SOLUTION` button when
   its card is open, without touching any hint tier.
2. Clicking reveals the ordered step list; button flips to hide; clicking hides again.
3. A challenge with no `s` renders **no** reveal button.
4. Reveal state persists across reload.
5. Reveal state survives EXPORT → IMPORT round-trip and is cleared by reset.
6. `<code>` inside a step copies to clipboard on click (reuses existing copy test pattern).

## Out of scope (YAGNI)

- Tracking / displaying which challenges were revealed.
- Authoring walkthroughs beyond the starter set.
- Rich markdown/media in steps (plain strings + inline `<code>` only).
- Any change to the hint-tier or scoring behavior.
