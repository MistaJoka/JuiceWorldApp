# JuiceWorld — OWASP Juice Shop Command Center

A single-file, offline-capable **adversarial ops console** for working through all 113 [OWASP Juice Shop](https://owasp.org/www-project-juice-shop/) challenges. Built as a hacking companion: track progress, escalate hints without spoiling yourself, and turn every solve into a portfolio write-up.

**Live:** https://mistajoka.github.io/JuiceWorldApp/

> Zero dependencies. One HTML file. Progress persists in the browser.

---

## What it does

- **113 canonical challenges** — names, categories, difficulty, and hints pulled from the official Juice Shop manifest, not hand-curated
- **Tiered hints** — official progressive `HINT 1..N` per challenge, revealed on demand so you only spoil as much as you need. Deepest tier unlocks official book + solution links as a last resort
- **Full walkthroughs** — every one of the 113 challenges carries a complete step-by-step solution behind a per-card **REVEAL FULL SOLUTION** toggle. 95 are **verified end-to-end against a live Juice Shop v20 instance** (the solve was actually run and the challenge confirmed solved); the ~18 that can't be verified over HTTP (browser-only detection, DoS payloads, on-chain Web3, LLM, OSINT) are authored from expertise and carry a **⚠ unverified** marker. Reveal state persists and travels with EXPORT/IMPORT.
- **Per-challenge fix links** — 80 challenges carry their exact OWASP Cheat Sheet URL, for the remediation half of a real write-up
- **Tag-aware** — `Danger Zone`, `Prerequisite`, `Brute Force`, `Tutorial`, `Code Analysis`, OSINT, AI/LLM, Web3 badges + filter
- **Guided workflow** — sort by difficulty, filter by tag/category/status, or hit **start here** for the Tutorial on-ramp
- **Working bench** — Methodology, Toolkit (Docker/Burp/DevTools setup, payload library, JWT attacks, cracking tools), and Resources tabs; click any command or payload to copy it
- **Portfolio pipeline** — per-challenge notes + fix links feed a `vuln → find → exploit → impact → fix` write-up flow

## Run it

Just open `juice-shop-command-center.html` in a browser — no build step. Progress (solved state, notes, hint tiers) is saved in the browser via `localStorage`; use **EXPORT/IMPORT** in the footer to back it up or move it between machines.

To attack a local Juice Shop instance:

```bash
docker run -d -p 3000:3000 --name juice bkimminich/juice-shop
```

To enable the destructive challenges (XXE, stored XSS, SSTi, deserialization, some NoSQLi) that Docker disables by default:

```bash
docker rm -f juice
docker run -d -e "NODE_ENV=unsafe" -p 3000:3000 --name juice bkimminich/juice-shop
```

## Ethics

This tool tracks and hints; it does not dump solutions. Juice Shop is meant to be attacked **black-box** — the design keeps you from spoiling challenges you haven't earned. Only attack instances you own or are authorized to test.

## Architecture

Single file, three layers — data (canonical challenge JSON) / state (localStorage-backed) / render. Adding a challenge is one row of data; the engine derives the rest.

## Credits

Challenge data © the [OWASP Juice Shop](https://github.com/juice-shop/juice-shop) project (MIT). This tool is an independent companion, not affiliated with OWASP.

## License

MIT — see [LICENSE](LICENSE).
