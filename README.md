# Paycheck Ledger Demo

A single-page app for logging paychecks, forecasting the next one, and tracking
where the year's taxes are heading, shown here with **invented data**.

A **setup** panel says how you're paid and what comes out of each check: hourly
or salary; weekly, every two weeks, twice a month or monthly (hourly pay is
weekly or every two weeks); your W-4 filing status; health, dental and vision
premiums; an HSA or not (it needs a high-deductible, or CDHP, health plan); a
Roth, traditional or no 401k, and what percent; an ESPP or not; and what share
of each check goes to savings. Anything you don't have disappears from the app.
While the sample year is showing, it's redone to match whatever you pick.

A first visit opens an empty ledger with the setup showing. **Try the example
year** loads an invented sample to look around in, and **Start my own ledger**
clears it again. If you start
partway through the year, copy the year-to-date column from your last stub into
the **starting totals**, so the totals, projections and tax outlook cover the
whole year.

**Try it:** https://blazinwingz.github.io/paycheck-ledger-demo/

Everything builds into one self-contained HTML file. No server, and no network
requests once it loads.

**Every figure in this repo is made up:** the pay rates, the salary, the
withholding constants, and both sample years. None of it describes a real
person's pay.


## What it does

| Tab | What it does |
|---|---|
| **Log** | Every paycheck: gross, the four tax lines, benefits, retirement, savings. Also W-2 adjustment rows (stock sales) that count as income but carry no deductions. Shows what changed against the previous check. |
| **Forecast** | Predicts the next check. Hourly: from hours worked, with a week-by-week log. Salaried: yearly salary ÷ checks a year, plus any bonus. A **What if** panel tries a different 401k (Roth or traditional, any percent), HSA, ESPP, savings or pay side by side with your setup, per check and per year, and can make it your setup. |
| **Trends** | Year-end projection, effective rates, retirement and HSA pacing, and for hourly pay, hours and overtime. |
| **Checks** | Audit rules over every row: tax lines that don't add up, Social Security or Medicare off their fixed rates, hours × rate that doesn't match gross, retirement off its usual percent, skipped pay periods. |
| **Past years** | Whole-year totals from each year's W-2 and final stub, compared against the current year. |
| **Tax outlook** | Projects the year-end federal and state position from the paychecks, including the federal overtime deduction for hourly pay. |
| **Backup** | Export to JSON or CSV, restore from either, clear the ledger. |


## Getting started

```bash
npm install
npm run setup          # copies src/seed.example.js to src/seed.js, which the build reads
npm test               # syntax, every tab renders, the pay model matches the sample data
npm run build          # writes dist/paycheck-ledger.html
npm run test:ui        # optional: needs `pip install playwright && playwright install chromium`
```

Open `dist/paycheck-ledger.html` in a browser.


## Layout

```
src/app.jsx              the whole app: pay model, audit rules, tabs, charts
src/seed.example.js      the invented demo data and the formula constants
src/profile.js           the setup, tax tables, withholding, pay dates, and the sample redone for any setup
tools/gen-samples.mjs    regenerates the stored sample paychecks from the formulas
src/entry.jsx            mounts the app
src/utils.css            the utility classes app.jsx uses (generated)
tools/build.mjs          bundles everything into one HTML file
tools/gen-css.py         regenerates utils.css after adding class names
tools/render-check.mjs   syntax check plus a server-render of every tab
tests/run.mjs            every sample paycheck against the pay formulas
tests/browser/           clicks every tab in both pay types in a real browser
```


## The pay model

Each paycheck is computed from your setup and a handful of constants in
`src/seed.example.js` (`PAY`). Social Security and Medicare rates are law.
Federal and state withholding work like payroll's **percentage method**: the
check is scaled up to a year, run through the 2026 brackets after the standard
deduction for your W-4 filing status, and divided back down. That holds in every
bracket and at every pay frequency.

| Line | Rule |
|---|---|
| Withholding base | gross − HSA − health premiums (both come off before every tax) |
| Benefits | HSA + health premiums, added up for you |
| Social Security | 6.2% of the base |
| Medicare | 1.45% of the base |
| Income tax base | the withholding base, less a **traditional** 401k (a Roth comes off after tax) |
| Federal | (income tax base × checks a year − standard deduction) through the 2026 brackets, ÷ checks a year |
| State | the same with the example state's deduction, exemption and two brackets |
| 401k | the setup's percent of gross, or none |
| ESPP | the setup's amount per check, or none |
| Savings transfers | the setup's percent of **net** pay, or none |
| Hourly gross | rate × hours, with overtime paid as straight time plus a half-time premium, **rounded separately** |
| Salaried gross | yearly salary ÷ checks a year (52, 26, 24 or 12), plus any bonus |

With no HSA, nothing comes off the top for it, so each check is taxed a little
more. A traditional 401k does the opposite for income tax: it lowers federal and
state withholding and W-2 Box 1, but not Social Security or Medicare.

The state tax tab models a generic **example state** (two brackets, a standard deduction and
an exemption). The tax tables are 2026 figures and need replacing each January.

The federal overtime deduction (tax years 2025–2028) counts only the half-time
premium, which is always one third of overtime pay. It's capped, unavailable when
married filing separately, applies to income tax only, and the example state doesn't follow
it. Salaried pay has no overtime, so the deduction is hidden in salary mode.


## How the demo is published

Every upload runs the tests (`.github/workflows/ci.yml`). When they pass on the
main branch, the built page is published to GitHub Pages, at the link above.
The page is identical to the Claude artifact demo.

The demo is published as a Claude artifact **with no runtime capabilities**: no
account storage, no file downloads. Visitors' entries save to their own browser
only, and Export shows copyable text instead of downloading a file. That's
deliberate, so a shared link never asks a visitor for permissions.

So a visitor's ledger lives in that one browser on that one device. Clearing
browsing data or using a private window loses it, and other devices never see
it. The page says so, and reminds them to back up when anything has changed
since their last backup. A backup restores the whole ledger anywhere.

The code still knows how to use account storage and downloads (the original app
syncs between devices that way). It falls back cleanly when they aren't there.


## Not tax advice

The tax tab estimates a year-end position from paychecks and published tables.
It knows nothing about credits, other income, or anything not on a stub.
