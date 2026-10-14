# Working on the Paycheck Ledger

Read this before changing anything. `README.md` explains the app and the pay
model; `NOTES-2027.md` covers the year-end and the January update; this file is
how to work on it.

## What this is

The owner's **real** paycheck ledger: their actual pay, taxes and benefits.

- **Live app:** https://claude.ai/artifact/FYF745YFRNL9DU8ZewdtcX. Always update
  this one in place. Never publish the ledger to a new link.
- **Their entries** live in the artifact's account storage, not in this repo:
  `ArtifactData` collection `data/users/me`, document `ledger` (paychecks plus
  every setting, with `rev` and `savedAt`).
- **The demo** (`paycheck-ledger-demo`, a separate public repo and link) is out
  of scope here. Never copy anything from this repo into it.

## The hard rules

1. **Never commit `src/seed.js`.** It holds the real pay rate, withholding
   constants and pay history. It's git-ignored; keep it that way. The owner keeps
   it in a `private` folder outside the repo and attaches it when a real build is
   needed.
2. **Keep real pay figures where they already are, and nowhere new.** They
   belong in `seed.js`, not `app.jsx`. This repo is private and holds a few on
   purpose: the README documents the fitted withholding constants, and
   `tests/run.mjs` checks the pay model against three real stubs. Don't add
   more, and never put pay figures in commit messages, `CHANGELOG.md`,
   `NOTES-2027.md`, or anything that could reach the public demo.
   `src/seed.example.js` stays invented.
3. **Read the saved ledger before writing to it**, and pin every write with
   `if_version`. The app also saves from the owner's phone and PC, so a write
   built on a stale read can wipe their entries. Only write when they asked for a
   change to their data, and say exactly what changed.
4. **Never delete their data or change the artifact's capabilities** (`db`,
   `downloads`, `user`, carried forward on every publish).

## Build, test, publish

```bash
npm install            # if the registry is unreachable, link esbuild, react and react-dom from a global install
cp <attached seed.js> src/seed.js   # for a real build; CI uses seed.example.js instead
npm test               # syntax, every tab renders, the pay model matches real stubs
npm run build          # dist/paycheck-ledger.html
```

Before publishing a change that touches totals, also load the **saved ledger**
into the built page with the account storage mocked, open every tab, and check
for "NaN" and for totals that match the stubs. That's how the October 2026 HSA
bug was found; the sample data alone didn't show it.

`tests/browser/` drives the built page in Chromium (saving, restore, two devices
at once, dark mode, the week log). Some scripts there have hardcoded paths from
an earlier session; fix the paths rather than skipping them.

Then:

1. **Bump `BUILD`** near the top of `src/app.jsx` (version and date). It's shown
   at the bottom of the Backup tab and should match the artifact's version
   number.
2. **Add an entry to `CHANGELOG.md`**: what changed, in plain words, with no pay
   figures.
3. **Publish** `dist/paycheck-ledger.html` to the live app URL above.
4. **Commit and push**, then confirm the GitHub Actions run is green.
5. **Tell the owner which files changed.** They keep a copy of the repo in a
   OneDrive folder, and it falls behind when you push.

## Things that took debugging (details in the README)

- **Typed form fields arrive as text** ("100.00"). Wrap raw fields in `n()`
  before adding them up; `+` on text glues it together.
- **Totals cover one year**, the year of the latest paycheck (`LEDGER_YEAR`).
  Pass `yearRows`, not `rows`, to anything that adds things up.
- **Benefits are HSA + dental**, added up in `derive()` and kept in step by
  `save()`. Only an old row with neither part keeps its own total.
- **ESPP is a percent of everything except overtime** (`ESPP_PCT`). Not a flat
  amount.
- **Overtime is straight time plus a half-time premium, rounded separately.**
- **Federal withholding**: the fitted line inside the 22% bracket, the IRS
  bracket method (`fedByBrackets`) below it. Tax tables are in
  `src/tax-tables.js`; update them each January and bump `TAX_YEAR`.
- **Exports go through the `downloads` capability** with copyable text as a
  fallback. A plain download link turns the page white.

## Working with the owner

The owner isn't a developer and uses Windows. Keep explanations plain and short.
They want numbers checked against the real stubs before trusting them, tax
figures framed as estimates rather than advice, and nothing about their data
changed without saying so.
