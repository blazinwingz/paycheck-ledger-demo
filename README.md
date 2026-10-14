# Paycheck Ledger

A single-page app for logging paychecks, forecasting the next one, and tracking
tax position across years. It reproduces one real payroll run to the cent: the
withholding formulas were reverse-engineered from actual stubs, so a predicted
paycheck matches the real one exactly when the hours are right.

Everything is one self-contained HTML file. No server, no framework at runtime,
no network requests once it loads.

## Before you push this anywhere

`src/seed.js` holds real pay data — gross, taxes, hourly rates, W-2 figures. It
is **git-ignored**. Check that before your first push:

```bash
git status --porcelain --ignored | grep seed.js   # should say "!! src/seed.js"
```

`src/seed.example.js` is entirely invented — round numbers and one synthetic
paycheck, nothing taken from a real stub. New machine:

```bash
cp src/seed.example.js src/seed.js
```

If you want your real figures on more than one machine, move `seed.js` yourself
(a private gist, a password manager, a USB stick) rather than committing it. A
public repo with `seed.js` in it publishes your income history permanently —
deleting it later doesn't remove it from the git history.

## Getting started

```bash
npm install
npm run build          # writes dist/paycheck-ledger.html
npm test               # syntax, every tab renders, pay model still matches
```

Open `dist/paycheck-ledger.html` in a browser, or publish it as a Claude
artifact, where it saves entries to your account instead of one device.

## The seven tabs

| Tab | What it does |
|---|---|
| **Log** | Every paycheck. Gross, the four tax lines, benefits, retirement, hours. Also holds W-2 adjustment rows (ESPP sales), which carry earnings but no deductions. |
| **Forecast** | Predicts the next check from hours worked. Pulls from the week log if it's filled in. Matches the real stub to the cent when the hours are right. A **What if** panel tries a different HSA, 401k (Roth or traditional), ESPP, savings share or rate side by side, per check and per year, and says what per-check HSA amount lands exactly on the yearly limit. |
| **Trends** | Charts and year-to-date totals — gross, taxes, take-home, hours by category, effective rates. |
| **Checks** | Runs every audit rule over every row and shows what's off. The tab label carries the flag count. |
| **Past years** | 2022–2025 from W-2s and final stubs, plus the hourly rate history. A new rate on a paycheck or a past year joins the history by itself. |
| **Tax outlook** | Projects the year-end federal and Kansas position, including the overtime deduction. |
| **Backup** | Export to JSON or CSV, restore from either. A line under the tabs says when paychecks have changed since the last full (JSON) backup. |

**One year at a time.** Every total covers the year of the latest paycheck. Log a
January check and the ledger moves to the new year by itself: last year's rows
stay in the Log (tagged "not in 2027 totals") and on the Checks tab, but out of
the header, trends, forecast and tax outlook. Put the finished year on Past years
from its W-2.

## The audit rules

The Checks tab is where most of the payroll knowledge lives. Each rule reads a
row and flags what doesn't reconcile:

- Tax sub-lines don't add up to the tax total
- Medicare isn't 1.45% of taxable wages, or Social Security isn't 6.2%
- Hours × rate doesn't equal gross — usually a rate change that wasn't recorded
- The implied hourly rate doesn't match the rate on file
- HSA plus dental doesn't match the benefits line
- The stub's own check amount doesn't match what the lines compute to
- Retirement came in at something other than 20%
- An adjustment row has deductions on it, or a paycheck row has none
- A gap in pay dates that looks like a missing paycheck

Flags are `bad` (the math is wrong), `warn` (probably wrong, could be legitimate),
or `info` (something is missing that would unlock more checks).

## Layout

```
CHANGELOG.md           every published version and what changed; add to it when you publish
CLAUDE.md              rules for Claude sessions working on this repo
src/app.jsx            the whole app: model, audit rules, tabs, charts
src/tax-tables.js      the year's federal and Kansas tables, and the IRS bracket method
src/seed.js            your pay data and fitted constants (git-ignored)
src/seed.example.js    placeholder version of the above
src/utils.css          generated; the utility classes app.jsx uses
tools/build.mjs        bundles everything into one HTML file
tools/gen-css.py       regenerates utils.css after adding class names
tools/render-check.mjs syntax check + server-render of every tab
tests/run.mjs          the pay model against known-good paychecks
tests/browser/         Playwright: saving, restore, two devices, dark mode
```

## The pay model

Fitted to 18 real paychecks and checked against four W-2s. All of these are
exact unless noted:

| Line | Rule |
|---|---|
| Withholding base | gross − HSA − $0.93 of the dental premium |
| Social Security | 6.2% of the base |
| Medicare | 1.45% of the base |
| Kansas | 5.58% of the base − $11.10 |
| Federal | 22% of the base − $339.61 |
| Roth 401k | 20% of gross |
| ESPP | 10% of everything **except overtime**: regular, holiday, PTO and premium pay (the plan maximum). Exact on all 20 checks of 2026; flat $243.28 only on a plain 80-hour check |
| Savings transfers | 20% of net pay |
| Overtime | straight time plus a half-time premium, **rounded separately** |

Details that cost real debugging time, kept here so they aren't rediscovered:

- **The $0.93.** Taxable wages sit slightly above gross minus benefits because
  employer-paid group-term life is imputed income, added each period. The W-2's
  reconciliation page names it.
- **Overtime rounding.** Rounding `hours × 1.5 × rate` once gives a different
  cent than rounding the straight-time and half-time parts separately. Payroll
  does the latter.
- **Two overtime rates.** A week containing premium pay (`RgWagePrem`) raises
  that week's regular rate, so the stub shows two overtime lines. Enter the
  combined dollars; the qualifying premium is always overtime pay ÷ 3.
- **The federal offset holds inside the 22% band.** Below roughly $2,653 of
  taxable wages it hasn't been confirmed, and the app says so.
- **January is different.** The first two checks of 2026 withheld more federal
  than the formula gives — a W-4 change taking effect in February.
- **The export goes through the `downloads` capability, deliberately.** An
  ordinary blob download link navigates the sandboxed frame and leaves a white,
  unresponsive page. `app.jsx` calls `claude.use("downloads")` and falls back to
  copyable text when it isn't there. Don't "simplify" this back to an anchor tag.

## The overtime deduction

Federal, from the 2025 law. The app implements all of this; it is written out
here because none of it is obvious from the code alone.

- Only the **half-time premium** is deductible, not the whole overtime check.
  Qualifying premium is always overtime pay ÷ 3.
- Capped at **$12,500 single, $25,000 joint**. Married filing separately gets
  **nothing** — the app zeroes `otCap` for that status.
- It reduces **income tax only**. Social Security and Medicare still apply to
  every dollar of overtime.
- **Kansas doesn't follow it.** The state calculation ignores the deduction.
- It covers **tax years 2025 through 2028** and then sunsets unless extended.
- Employers weren't required to report qualifying overtime on 2025 W-2s, so a
  2025 return may have missed it. 2026 W-2s will have it on its own line.

## When this goes stale

The tax figures live in **`src/tax-tables.js`** (2026: Rev. Proc. 2025-32 and
the Kansas rates). **Replace them each January and bump `TAX_YEAR`.** Until then
the Tax outlook warns that it's using last year's tables.

| Constant | 2026 value |
|---|---|
| Federal standard deduction | $16,100 single / $32,200 joint |
| Kansas standard deduction | $3,605 single |
| Kansas personal exemption | $9,160, plus $2,320 per dependent |
| Kansas brackets | 5.2% to $23,000, then 5.58% |
| Overtime deduction cap | $12,500 single / $25,000 joint |

Two other things drift on a schedule:

- **The fitted federal offset** ($339.61) isn't arbitrary: it's the IRS
  percentage method for a single filer with the standard deduction, inside the
  22% bracket. It works out as `(0.22 × (std deduction + start of the 22% bracket)
  − tax at the start of the 22% bracket) ÷ 26`. For 2026 that's
  `(0.22 × (16,100 + 50,400) − 5,800) ÷ 26 = 339.615`. So for a new year, compute
  it from the new tables, then confirm it against the first two stubs. If they
  don't match, the W-4 changed (as in January 2026).
- **Below the 22% band** (a short check with no overtime) the app uses the IRS
  bracket method (`fedByBrackets` in `tax-tables.js`) instead of the fitted line.
  On the real stubs it lands within a cent of every check; the fitted line is
  exact on all but one.
- **HSA and dental are stored as numbers, and benefits are their sum.** Typed
  form fields arrive as text ("340.00"); adding text to a number glues it on
  instead of adding, which showed up as "$NaN" in the HSA panel. Totals wrap
  every field in `n()`, and `save()` stores HSA and dental as numbers. Rows that
  arrived without HSA and dental (an old CSV) broke the HSA panel the same way;
  that data was repaired in October 2026.
- **The employer HSA deposit** ($500) lands in early December — 12/10 in 2024,
  12/8 in 2025 — and isn't tied to a payroll date. Mark it received when it
  shows up.

## Storage

Published as a Claude artifact, entries save privately to the viewer's account,
so the same ledger opens on a phone and a PC. Opened as a plain file, it falls
back to that browser's storage and says so.

Two devices can both be open. A save re-reads the stored copy and merges per
paycheck and per setting, keeping only what that device changed, so a stale tab
can't overwrite work done elsewhere.

## Tests

`npm test` needs no browser and is the one to run before publishing: it catches
syntax errors, a tab that throws (the white-screen case), and any drift in the
pay model.

`npm run test:ui` needs `pip install playwright && playwright install chromium`
and drives the built page: saving, full backup and restore, two devices editing
at once, dark mode in all four states, and the week log feeding the forecast.

## Not tax advice

The tax tab estimates a year-end position from your own paychecks and published
2026 tables. It knows nothing about credits, other income, or anything not on a
stub. Take it to whoever prepares your return.
