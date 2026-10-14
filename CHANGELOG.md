# Changelog

Every published version of the Paycheck Ledger, newest first. The version
number is the one at the bottom of the app's Backup tab. Dates are Central time.

**When you publish a new version, add an entry here.** Say what changed in
plain words, and what someone using the ledger would notice.

No pay figures in this file, so it's safe to keep anywhere.


## Version 23 · October 4, 2026

**Changed**
- **ESPP is worked out from your hours.** It's 10% of everything except
  overtime: regular, holiday, PTO and premium pay. It used to be one flat amount,
  which was only right on a plain 80-hour check. Checked against all 20 paychecks
  of 2026: exact on every one.
- **What if** takes ESPP as a percent and stops at the plan's 10% maximum.

**Added**
- **Checks** flags a paycheck whose ESPP isn't 10% of its non-overtime pay.


## Version 22 · October 4, 2026

**Fixed**
- **The HSA panel and the year-end checklist showed "$NaN".** Paychecks brought
  over by the old CSV import had lost their HSA and dental amounts. The 18
  affected paychecks were repaired.
- **The Tax outlook overstated projected W-2 wages** on those same paychecks,
  because it read the missing HSA as zero.
- **A paycheck typed into the form could break the HSA totals.** Typed amounts
  arrive as text, and the totals glued text together instead of adding it.

**Added**
- **One year at a time.** Totals follow the year of the latest paycheck, so a
  January check starts the new year by itself. Older checks stay in the Log,
  tagged "not in [year] totals".
- **What if** on the Forecast tab: try a different HSA, 401k percent, Roth or
  traditional 401k, ESPP, savings share or rate, side by side per check and per
  year. Shows what per-check HSA amount lands exactly on the yearly limit.
- **Backup reminder** under the tabs when paychecks have changed since the last
  full backup.
- **Benefits add themselves up** from HSA plus dental. New paychecks start with
  the latest HSA and dental filled in.
- **Rate history updates itself** when a raise shows up on a paycheck.
- **Short checks use the IRS bracket method** for federal withholding. Inside
  the 22% bracket the fitted formula still applies; below it, the bracket method
  matches the real stubs within a cent.

**Changed**
- **The tax tables moved to their own file**, `src/tax-tables.js`, so the yearly
  update is one file. The Tax outlook warns when the tables are older than the
  ledger's year.


## Version 21 · September 30, 2026

**Fixed**
- **The week log said zero overtime for weeks that had some.** It showed five
  weeks back with empty boxes and added up the boxes. Weeks whose paycheck is
  already logged are now hidden, and the summary splits "not yet paid" from
  "already banked this year", counted from the paychecks themselves.


## Version 20 · September 30, 2026

**Added**
- **Build stamp** at the bottom of the Backup tab, so you can tell whether your
  phone and PC are showing the same version.


## Repository · October 13, 2026

- `CHANGELOG.md` added, reconstructed back to the first chat in August.
- `CLAUDE.md` added: the rules every Claude session follows in this repo.


## Repository · September 29 – October 1, 2026

Not app versions, but worth recording:
- The source went into a private GitHub repo, with automatic tests on every
  upload (syntax, every tab renders, the pay model still matches real stubs).
- The README documents the pay model and the details that took real debugging.
- The example data file was replaced with invented figures; it had held a real
  paycheck.
- The build tool (esbuild) was updated for a security alert.
- `NOTES-2027.md` added: what to do for the year-end and the 2027 update.


## Versions 1–19 · September 21–29, 2026

The ledger as its own page, published 19 times in nine days. The record keeps
the dates but not which feature went into which version, so they're listed
together, roughly in the order they were built.

**Published on:** Sep 21 (v1, v2) · Sep 22, into the early hours of Sep 23
(v3–v12) · Sep 24 (v13, v14) · Sep 27 (v15–v17) · Sep 29 (v18, v19)

**What went in**
- **The four tax lines backfilled** for every 2026 paycheck from the stubs.
- **Export no longer turns the page white.** The download went through a
  method the page didn't allow; it now saves a real file, with copyable text as
  a fallback and an error screen instead of a blank page.
- **Trends dashboard**: year-end projection, effective rates, 401k and HSA
  pacing, including the employer's yearly HSA deposit.
- **Hours on every paycheck** (regular, overtime, holiday, PTO), overtime pay
  rounded the way payroll does it, two overtime rates, and premium pay. Overtime
  totals feed the federal overtime deduction.
- **Forecast tab**: the next paycheck from hours worked, matching real stubs to
  the cent.
- **Phone and PC see the same ledger.** Entries save to your Claude account
  instead of one browser. Two devices open at once merge instead of
  overwriting each other.
- **Past years** 2022–2025 from W-2s and final stubs, with hourly rate history.
- **Dark mode.**
- **Full backup and restore** of everything, not only paychecks.
- **Tax outlook**: where the year's federal and Kansas taxes are heading,
  including the overtime deduction.
- **Checks** for missing paychecks and rate changes; **what changed** between
  one paycheck and the last.
- **Week log** for overtime as each week closes, feeding the forecast, and
  **forecast accuracy** tracking against the real stubs.


## Before Version 1 · August 25, 2026: built in the chat

The ledger started as a conversation about replacing the Excel log, then ran as
an app inside that chat before it had its own page.

- **The design**: one row per paycheck matching the spreadsheet's columns, with
  the combined tax column split into federal, Social Security, Medicare and
  Kansas, and the combined total kept as a fallback for rows without the split.
- **Payroll checks**: Medicare and Social Security tested against their fixed
  rates, and a reconciliation line that flags when the parts don't add up to the
  stub.
- **CSV export and import** in the spreadsheet's own layout, so a broken app is a
  quick restore instead of a rebuild.
- **Two kinds of entry**: paychecks, and W-2 adjustments (ESPP sales) that count
  toward yearly income but stay out of per-paycheck trends.
- **Your 2026 history loaded**: all 19 rows from the spreadsheet, January to
  August, every one reconciled before it went in.
- **A backfill list** of which paychecks still needed their tax split.
- Findings along the way: the 401k is Roth, not traditional; Social Security's
  wage cap won't be reached; take-home and net pay are different numbers because
  of the savings transfers; and a small gap between taxable wages and gross minus
  benefits, later traced to employer-paid group-term life.
