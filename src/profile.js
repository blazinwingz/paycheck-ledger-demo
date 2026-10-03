/* What comes out of a paycheck depends on the visitor's setup: whether they
   have an HSA (it takes a high-deductible, CDHP/HDHP, health plan), a 401k and
   which kind, an ESPP, and whether they move part of each check to savings.

   A setup looks like:
     { hsa: true,  hsaAmt: 100,             // per check
       retire: "roth" | "traditional" | "none", retirePct: 0.20,  // of gross
       espp: true,   esppAmt: 200,          // per check
       savingsPct: 0.20 }                   // of net pay; 0 for none

   payroll() is the one place the deductions are worked out. The app's forecast
   and the demo's sample years both go through it, and tests/run.mjs checks
   every rebuilt sample against it. The one rule that differs by 401k type:
   a traditional 401k comes off before federal and state income tax (not before
   Social Security or Medicare); a Roth comes off after all tax. */

const r2 = (v) => Math.round((v + 1e-9) * 100) / 100;

export const defaultSetup = (PAY) => ({
  hsa: true, hsaAmt: 100,
  retire: "roth", retirePct: PAY.retirePct,
  espp: true, esppAmt: PAY.espp,
  savingsPct: PAY.savingsPct,
});

export function payroll(gross, s, PAY, dental = PAY.dental) {
  const hsa = s.hsa ? r2(s.hsaAmt) : 0;
  const retirement = s.retire === "none" ? 0 : r2(gross * s.retirePct);
  const espp = s.espp ? r2(s.esppAmt) : 0;
  const ficaBase = r2(gross - hsa - PAY.dentalPreTax);
  const incomeBase = r2(ficaBase - (s.retire === "traditional" ? retirement : 0));
  const socSec = r2(ficaBase * PAY.ssRate);
  const medicare = r2(ficaBase * PAY.medicareRate);
  const federal = Math.max(0, r2(incomeBase * PAY.fedRate - PAY.fedOffset));
  const state = Math.max(0, r2(incomeBase * PAY.stateRate - PAY.stateOffset));
  const taxTotal = r2(socSec + medicare + federal + state);
  const benefits = r2(hsa + dental);
  const netPay = r2(gross - taxTotal - benefits - retirement - espp);
  const savings = r2(netPay * s.savingsPct);
  return { hsa, dental, benefits, retirement, espp, ficaBase, incomeBase, socSec, medicare,
           federal, state, taxTotal, netPay, savings, takeHome: r2(netPay - savings) };
}

const sameSetup = (a, b) => Object.keys(b).every((k) => a[k] === b[k]);

/* One sample paycheck, redone for a setup. Gross and hours stay the same. */
export function checkForSetup(e, s, PAY) {
  if (e.type === "adjustment" || sameSetup(s, defaultSetup(PAY))) return e;
  const p = payroll(e.gross, s, PAY, e.dental);
  return { ...e, hsa: p.hsa, benefits: p.benefits, retirement: p.retirement, espp: p.espp,
           federal: p.federal, socSec: p.socSec, medicare: p.medicare, state: p.state,
           taxTotal: p.taxTotal, savings: p.savings };
}

/* One sample past year, redone for a setup. The year totals were made with the
   default setup, so this moves the difference in each deduction into or out of
   the taxed wages. */
export function yearForSetup(y, s, PAY) {
  const d = defaultSetup(PAY);
  if (sameSetup(s, d)) return y;
  const checks = y.checks || 26;
  const hsa = s.hsa ? r2(s.hsaAmt * checks) : 0;
  const retirement = s.retire === "none" ? 0 : r2(y.gross * s.retirePct);
  const espp = s.espp ? r2(s.esppAmt * checks) : 0;
  const ficaMore = (y.hsa || 0) - hsa;                                     // less HSA → more taxed
  const incomeMore = ficaMore - (s.retire === "traditional" ? retirement : 0);
  return {
    ...y, hsa, retirement, espp,
    hsaEmployer: s.hsa ? y.hsaEmployer : 0,
    w2Wages: r2((y.w2Wages || 0) + incomeMore),
    federal: r2((y.federal || 0) + incomeMore * PAY.fedRate),
    state: r2((y.state || 0) + incomeMore * PAY.stateRate),
    socSec: r2((y.socSec || 0) + ficaMore * PAY.ssRate),
    medicare: r2((y.medicare || 0) + ficaMore * PAY.medicareRate),
  };
}
