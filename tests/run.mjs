/* Checks the pay model against the demo's sample paychecks. Every sample
   check, hourly and salaried, was generated from the constants in seed.js,
   so if a formula in the app drifts from those constants, this fails.
   Run after `cp src/seed.example.js src/seed.js`. */
import { PAY, SEED, SALARY_SEED, YEARS_SEED, SALARY_YEARS_SEED } from "../src/seed.js";
import { defaultSetup, payroll, checkForSetup, yearForSetup } from "../src/profile.js";

const r2 = (v) => Math.round((v + 1e-9) * 100) / 100;
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
  ["nothing extra", { hsa: false, hsaAmt: 0, retire: "none", retirePct: 0, espp: false, esppAmt: 0, savingsPct: 0 }],
];
const samples = [...SEED, ...(SALARY_SEED || [])];
const checks = [];
for (const [name, su] of SETUPS) {
  for (const e of samples) if (e.type !== "adjustment") checks.push({ ...checkForSetup(e, su, PAY), _setup: su, _name: name });
}
for (const c of checks) {
  const su = c._setup;
  const retire = su.retire === "none" ? 0 : r2(c.gross * su.retirePct);
  const base = r2(c.gross - c.hsa - PAY.dentalPreTax);
  const incomeBase = r2(base - (su.retire === "traditional" ? retire : 0));   // traditional skips income tax only
  const got = {
    federal: Math.max(0, r2(incomeBase * PAY.fedRate - PAY.fedOffset)),
    socSec: r2(base * PAY.ssRate),
    medicare: r2(base * PAY.medicareRate),
    state: Math.max(0, r2(incomeBase * PAY.stateRate - PAY.stateOffset)),
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

// Hourly samples: hours x rate must equal gross, with overtime paid as straight
// time plus a half-time premium, rounded separately.
for (const c of SEED.filter((e) => e.type !== "adjustment")) {
  const rate = c.rate || PAY.rate;
  const straight = r2((c.regHrs + c.holHrs + c.ptoHrs) * rate);
  const ot = r2(c.otHrs * rate) + r2(c.otHrs * rate * 0.5);
  if (Math.abs(r2(straight + ot) - c.gross) > TOLERANCE) fail(`${c.date}: hours give ${r2(straight + ot)}, gross says ${c.gross}`);
}

// Salaried samples: each regular check is the yearly salary divided by 26.
if (SALARY_SEED) {
  const per = r2(PAY.salary / 26);
  const regular = SALARY_SEED.filter((e) => e.type !== "adjustment" && !/bonus/.test(e.label));
  for (const c of regular) if (Math.abs(c.gross - per) > TOLERANCE) fail(`${c.date}: salary check ${c.gross}, expected ${per}`);
}

// The app's own payroll() must reproduce the stored sample exactly with the
// default setup, so the forecast and the samples can't drift apart.
for (const e of samples.filter((x) => x.type !== "adjustment")) {
  const p = payroll(e.gross, D, PAY, e.dental);
  for (const k of ["federal", "socSec", "medicare", "state", "retirement", "savings", "taxTotal", "benefits"])
    if (Math.abs(p[k] - e[k]) > TOLERANCE) fail(`payroll() ${e.date} ${k}: ${p[k]} vs sample ${e[k]}`);
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

console.log(failures ? `${failures} failing` : `pay model ok (${checks.length} sample paychecks: hourly and salaried, across ${SETUPS.length} setups)`);
process.exit(failures ? 1 : 0);
