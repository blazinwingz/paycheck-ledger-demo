/* Checks the pay model against the demo's sample paychecks. Every sample
   check, hourly and salaried, was generated from the constants in seed.js,
   so if a formula in the app drifts from those constants, this fails.
   Run after `cp src/seed.example.js src/seed.js`. */
import { PAY, SEED, SALARY_SEED, YEARS_SEED, SALARY_YEARS_SEED } from "../src/seed.js";
import { defaultSetup, payroll, checkForSetup, yearForSetup, sampleChecksFor, FED_2026, STATE_2026, PERIODS } from "../src/profile.js";

const r2 = (v) => Math.round((v + 1e-9) * 100) / 100;

// Withholding written out independently of src/profile.js (only the tax
// tables, which are data, are shared): annualize, take off the standard
// deduction, run the brackets, divide back down.
const brackets = (income, list) => {
  let tax = 0, prev = 0;
  for (const [cap, rate] of list) { if (income > prev) tax += (Math.min(income, cap) - prev) * rate; prev = cap; }
  return tax;
};
const fedWithheld = (base, P, filing) => {
  const F = FED_2026[filing];
  return r2(brackets(Math.max(0, base * P - F.std), F.brackets) / P);
};
const stateWithheld = (base, P, filing) => {
  const K = STATE_2026[filing], t = Math.max(0, base * P - K.std - K.exemption);
  const tax = t <= K.threshold ? t * STATE_2026.low : K.threshold * STATE_2026.low + (t - K.threshold) * STATE_2026.high;
  return r2(tax / P);
};
const TOLERANCE = 0.005;
let failures = 0;
const fail = (msg) => { console.error(msg); failures++; };

// The setups a visitor can pick. The demo rebuilds its sample year for each one
// at runtime, so every rebuilt check goes through the same formulas below.
const D = defaultSetup(PAY);
const SETUPS = [
  ["default", D],
  ["no HSA", { ...D, hsa: false }],
  ["traditional 401k", { ...D, retire: "traditional" }],
  ["traditional 6%, no HSA", { ...D, retire: "traditional", retirePct: 0.06, hsa: false }],
  ["no 401k", { ...D, retire: "none" }],
  ["no ESPP, no savings", { ...D, espp: false, savingsPct: 0 }],
  ["nothing extra", { ...D, hsa: false, hsaAmt: 0, retire: "none", retirePct: 0, espp: false, esppAmt: 0, savingsPct: 0 }],
  ["married filing jointly", { ...D, filing: "mfj" }],
  ["weekly", { ...D, freq: "weekly" }],
  ["weekly, traditional", { ...D, freq: "weekly", retire: "traditional" }],
];
// Twice a month and monthly are salary only.
const SALARY_SETUPS = [
  ["twice a month", { ...D, freq: "semimonthly" }],
  ["monthly, married, traditional", { ...D, freq: "monthly", filing: "mfj", retire: "traditional" }],
];
const samples = [...SEED, ...(SALARY_SEED || [])];
const checks = [];
const add = (name, su, list, kind) => {
  for (const e of sampleChecksFor(list, su.freq, PAY))
    if (e.type !== "adjustment") checks.push({ ...checkForSetup(e, su, PAY), _setup: su, _name: name, _kind: kind });
};
for (const [name, su] of SETUPS) { add(name, su, SEED, "hourly"); add(name, su, SALARY_SEED || [], "salary"); }
for (const [name, su] of SALARY_SETUPS) add(name, su, SALARY_SEED || [], "salary");
for (const c of checks) {
  const su = c._setup;
  const retire = su.retire === "none" ? 0 : r2(c.gross * su.retirePct);
  const base = r2(c.gross - c.hsa - PAY.dentalPreTax);
  const incomeBase = r2(base - (su.retire === "traditional" ? retire : 0));   // traditional skips income tax only
  const P = PERIODS[su.freq];
  const got = {
    federal: fedWithheld(incomeBase, P, su.filing),
    socSec: r2(base * PAY.ssRate),
    medicare: r2(base * PAY.medicareRate),
    state: stateWithheld(incomeBase, P, su.filing),
    retirement: retire,
    hsa: su.hsa ? su.hsaAmt : 0,
    espp: su.espp ? su.esppAmt : 0,
  };
  for (const k of Object.keys(got)) {
    if (Math.abs(got[k] - c[k]) > TOLERANCE) fail(`${c._name} ${c.date} ${k}: model gives ${got[k]}, sample says ${c[k]}`);
  }
  const tax = r2(c.federal + c.socSec + c.medicare + c.state);
  if (Math.abs(tax - c.taxTotal) > TOLERANCE) fail(`${c.date}: tax lines add to ${tax}, total says ${c.taxTotal}`);
  const net = r2(c.gross - c.taxTotal - c.benefits - c.retirement - c.espp);
  if (Math.abs(r2(net * su.savingsPct) - c.savings) > TOLERANCE) fail(`${c._name} ${c.date}: savings is not ${su.savingsPct * 100}% of net`);
}

// Hourly samples (every frequency): hours x rate must equal gross, with overtime
// paid as straight time plus a half-time premium, rounded separately.
for (const c of [...SEED, ...checks.filter((x) => x._kind === "hourly")].filter((e) => e.type !== "adjustment")) {
  const rate = c.rate || PAY.rate;
  const straight = r2((c.regHrs + c.holHrs + c.ptoHrs) * rate);
  const ot = r2(c.otHrs * rate) + r2(c.otHrs * rate * 0.5);
  if (Math.abs(r2(straight + ot) - c.gross) > TOLERANCE) fail(`${c.date}: hours give ${r2(straight + ot)}, gross says ${c.gross}`);
}

// Salaried samples: each regular check is the yearly salary divided by the
// checks in a year, and the year's bonus total is the same at every frequency.
if (SALARY_SEED) {
  for (const freq of Object.keys(PERIODS)) {
    const list = sampleChecksFor(SALARY_SEED, freq, PAY).filter((e) => e.type !== "adjustment");
    const per = r2(PAY.salary / PERIODS[freq]);
    for (const c of list.filter((e) => !/bonus/.test(e.label)))
      if (Math.abs(c.gross - per) > TOLERANCE) fail(`${freq} ${c.date}: salary check ${c.gross}, expected ${per}`);
    const bonus = list.filter((e) => /bonus/.test(e.label)).reduce((t, e) => t + e.gross - per, 0);
    const want = SALARY_SEED.filter((e) => /bonus/.test(e.label)).reduce((t, e) => t + e.gross - r2(PAY.salary / 26), 0);
    if (Math.abs(bonus - want) > 0.05) fail(`${freq}: bonus total ${bonus.toFixed(2)}, expected ${want.toFixed(2)}`);
  }
}

// Weekly pay is the same year as every-two-weeks pay, just split: gross and
// withholding over a year come out within a few dollars.
{
  const year = (freq) => {
    // Per-check HSA and ESPP scale with the frequency, as the setup does.
    const k = 26 / PERIODS[freq];
    const su = { ...D, freq, hsaAmt: D.hsaAmt * k, esppAmt: D.esppAmt * k };
    return sampleChecksFor(SEED, freq, PAY).filter((e) => e.type !== "adjustment")
      .map((e) => checkForSetup(e, su, PAY)).reduce((t, c) => ({ gross: t.gross + c.gross, federal: t.federal + c.federal }), { gross: 0, federal: 0 });
  };
  const a = year("biweekly"), b = year("weekly");
  if (Math.abs(a.gross - b.gross) > 1) fail(`weekly gross ${b.gross.toFixed(2)} vs every-two-weeks ${a.gross.toFixed(2)}`);
  if (Math.abs(a.federal - b.federal) > 5) fail(`weekly federal ${b.federal.toFixed(2)} vs every-two-weeks ${a.federal.toFixed(2)}`);
}

// Higher brackets: a big check is withheld at 24% and up, not a flat 22%.
{
  const p = payroll(9000, { ...D, hsa: false, retire: "none", espp: false }, PAY, 0);
  const want = fedWithheld(9000 - PAY.dentalPreTax, 26, "single");
  if (Math.abs(p.federal - want) > TOLERANCE) fail(`big check federal ${p.federal}, expected ${want}`);
  if (!(p.federal > (9000 - PAY.dentalPreTax) * 0.18)) fail(`big check withheld too little: ${p.federal}`);
}

// The app's own payroll() must reproduce the stored sample exactly with the
// default setup, so the forecast and the samples can't drift apart.
for (const e of samples.filter((x) => x.type !== "adjustment")) {
  const p = payroll(e.gross, D, PAY, e.dental);
  for (const k of ["federal", "socSec", "medicare", "state", "retirement", "savings", "taxTotal", "benefits"])
    if (Math.abs(p[k] - e[k]) > TOLERANCE) fail(`payroll() ${e.date} ${k}: ${p[k]} vs sample ${e[k]}`);
}

// Typos can't produce nonsense: a percent over 100% counts as 100%, a
// negative one as 0, and savings never come out of a negative net.
{
  const p = payroll(2000, { ...D, retirePct: 2, savingsPct: -1, hsaAmt: -50 }, PAY);
  if (p.retirement !== 2000) fail(`401k over 100% should cap at gross, got ${p.retirement}`);
  if (p.savings !== 0) fail(`negative savings percent should be 0, got ${p.savings}`);
  if (p.hsa !== 0) fail(`negative HSA should be 0, got ${p.hsa}`);
}

// Past years: dropping the HSA moves it into taxed wages; a traditional 401k
// moves the contributions out of income-taxed wages (not FICA).
for (const y of [...(YEARS_SEED || []), ...(SALARY_YEARS_SEED || [])]) {
  const z = yearForSetup(y, { ...D, hsa: false }, PAY);
  if (z.hsa || z.hsaEmployer) fail(`${y.year}: no-HSA year still has HSA`);
  if (Math.abs(z.w2Wages - (y.w2Wages + (y.hsa || 0))) > TOLERANCE) fail(`${y.year}: no-HSA W-2 wages off`);
  const t = yearForSetup(y, { ...D, retire: "traditional" }, PAY);
  if (Math.abs(t.w2Wages - (y.w2Wages - t.retirement)) > TOLERANCE) fail(`${y.year}: traditional W-2 wages off`);
  if (!(t.federal < y.federal) || Math.abs(t.socSec - y.socSec) > TOLERANCE) fail(`${y.year}: traditional should cut income tax only`);
  const none = yearForSetup(y, { ...D, retire: "none", espp: false }, PAY);
  if (none.retirement || none.espp) fail(`${y.year}: no-401k, no-ESPP year still has them`);
}

// The qualifying premium for the overtime deduction is a third of overtime pay.
const otPay = r2(10 * 25) + r2(10 * 25 * 0.5);
if (Math.abs(otPay / 3 - 125) > 0.001) fail("overtime premium rule");

// The version shown in the app matches package.json, and reads major.minor.patch.
{
  const { readFileSync } = await import("node:fs");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
  const m = readFileSync(new URL("../src/app.jsx", import.meta.url), "utf8").match(/const BUILD = \{ version: "([^"]+)"/);
  const app = m && m[1];
  if (!/^\d+\.\d+\.\d+$/.test(app || "")) fail(`app version "${app}" isn't major.minor.patch`);
  if (app !== pkg) fail(`app version ${app} doesn't match package.json ${pkg}`);
}

console.log(failures ? `${failures} failing` : `pay model ok (${checks.length} sample paychecks: hourly and salaried, ${SETUPS.length + SALARY_SETUPS.length} setups, every pay frequency)`);
process.exit(failures ? 1 : 0);
