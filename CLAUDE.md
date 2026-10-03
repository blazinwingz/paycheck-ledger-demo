# Working on the Paycheck Ledger Demo

Read this before changing anything. `README.md` explains the app; this file
explains how to work on it.

## What this is

A public-safe **demo** of a personal paycheck ledger. Every figure in it is
invented. Real pay data never belongs here, and any real ledger lives outside
this repo and is **out of scope**: don't open it, change it, or ask for its data.

- **Published demo:** https://claude.ai/artifact/KBkRgpF8eZfsv2gdaqVRHC
- **GitHub Pages copy:** https://blazinwingz.github.io/paycheck-ledger-demo/ —
  published by `.github/workflows/ci.yml` when the tests pass on main. It adds
  the doctype and viewport lines the artifact host would otherwise add.
- **Build stamp:** `BUILD` near the top of `src/app.jsx`, shown at the bottom of
  the Backup tab. Bump `version` and `date` on every publish.

## The one hard rule: invented data only

Never put real pay figures in this repo or the published page: no real rates,
salaries, stub amounts, dates, employer names or payroll codes. If the owner
pastes a real stub to "test something", build an invented case with the same
shape instead, and say why.

Before every publish, look over `src/seed.example.js` and your diff for anything
that reads like a specific person's pay or circumstances. Wording like "your
stub says…" should describe how the app works, not a particular person.

## Build, test, publish

```bash
npm install
npm run setup        # src/seed.example.js -> src/seed.js (the build reads seed.js)
npm test             # must pass: syntax, all 7 tabs render, samples match the formulas in every setup
npm run build        # dist/paycheck-ledger.html
npm run test:ui      # must pass: every tab, every setup choice, starting your own ledger, reload memory
```

Publish `dist/paycheck-ledger.html` to the demo URL above (read the artifact
first, then publish with that `url` so the link stays the same). Publish it with
**no runtime capabilities**. That's deliberate: visitors save to their own
browser and never see a permission prompt. The code falls back cleanly when
`claude.use()` returns null.

If `npm install` can't reach the registry, esbuild, react and react-dom may
already be installed globally; link them into `node_modules`.

## How the pay type works

`PAY_TYPE` ("hourly" or "salary") and `CUR_SALARY` are module-level variables set
by the root component on every render, the same pattern as the theme palette `C`.
Components read them directly. Salary mode:

- `forecast()` gets `payType: "salary"`: gross is `salary / 26 + bonus`, no weeks.
- Hides the week log, hour fields, the earnings rows on the entry form, the hours
  and overtime panels on Trends, the overtime deduction on the tax tab, and the
  pay rate history.
- **Forces qualifying overtime to zero on the tax tab.** It otherwise estimates
  overtime from gross when a check has no hours, which would invent overtime for
  every salaried check.
- Past years shows `salary` instead of `baseRate` through `rateOf(y)`.
- Switching swaps in the other sample year (`SAMPLES`) only if the ledger is still
  the untouched sample. Otherwise it keeps the visitor's entries.

`PAY.payTypeToggle` shows the switch; `PAY.salary` is the default salary.

## How the setup works

The setup (`setup` state, `SETUP` at module level, set by the root on every
render like `PAY_TYPE`) says what comes out of a check: `hsa`/`hsaAmt`,
`retire` ("roth", "traditional" or "none")/`retirePct`, `espp`/`esppAmt`, and
`savingsPct`. `HAS_HSA`, `HAS_RETIRE`, `HAS_ESPP` and `HAS_SAVINGS` hide what a
visitor doesn't have: form fields, Log columns, panels, checklist items, labels.

- `src/profile.js` has `payroll()`, the one place deductions are worked out. The
  forecast uses it, and so does the sample: `sampleFor(payType, setup)` redoes
  the sample paychecks and past years for any setup. With the default setup it
  returns the stored sample unchanged.
- **Traditional 401k** comes off before federal and state income tax only, so it
  lowers those two lines, the tax outlook's wages and the W-2 Box 1 check. Not
  Social Security or Medicare.
- A setup change redoes the sample only while the ledger is the untouched
  sample (`isSample`). Otherwise it keeps the visitor's entries.
- **Start my own ledger** (shown while the sample is up) clears entries, past
  years and the week log, marks the sample years removed, and opens the setup.
- **Starting totals** (`opening`, `OPENING`): a stub's year-to-date figures from
  before the first logged check, for a mid-year start. They're folded into
  `ytd` (`count` includes them), the projection, the 401k/HSA pacing and the tax
  outlook. Savings transfers aren't on a stub, so they're estimated from the setup.
- The pay rate history is built from the ledger's own past years plus the
  current rate, not from a fixed list.
- **What if** (`WhatIfPanel`, Forecast tab): runs `forecast()` with a trial
  setup and pay next to the real one, per check and ×26 per year. Nothing
  changes until "Make this my setup", which calls `changeSetup`. It resyncs to the
  setup whenever the setup or pay changes. Its button groups are labelled
  "What-if 401k" and so on, so tests can tell them from the setup panel's.
- `lastBackup` remembers when a backup was last made and a fingerprint of the
  paychecks, so the page can say when there's work that hasn't been backed up.

## Changing the sample data

The sample paychecks in `src/seed.example.js` were generated from the `PAY`
constants. `tests/run.mjs` recomputes every one, so if you change a constant or
add a check, regenerate the samples from the formulas rather than typing numbers.
The state tax is a generic example state, and the tax tables are 2026 figures.

## Working with the owner

Changes reach GitHub through the web uploader, which ignores `.gitignore` and
puts loose files at the top level. When handing over changed files, say which
folder each one goes in. Keep explanations plain and short.
