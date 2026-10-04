/* What comes out of a paycheck depends on the visitor's setup: whether they
   have an HSA (it takes a high-deductible, CDHP/HDHP, health plan), a 401k and
   which kind, an ESPP, and whether they move part of each check to savings.

   A setup looks like:
     { freq: "biweekly",                    // weekly | biweekly | semimonthly | monthly
       filing: "single",                    // the W-4 filing status: single | mfj | mfs
       hsa: true,  hsaAmt: 100,             // per check
       retire: "roth" | "traditional" | "none", retirePct: 0.20,  // of gross
       espp: true,   esppAmt: 200,          // per check
       savingsPct: 0.20 }                   // of net pay; 0 for none

   Federal and state withholding work like payroll's percentage method: the
   check's taxable pay is scaled up to a year (× checks per year), run through
   the year's brackets after the standard deduction, and divided back down. That
   holds in every bracket and at every pay frequency.

   payroll() is the one place the deductions are worked out. The app's forecast
   and the demo's sample years both go through it, and tests/run.mjs checks
   every rebuilt sample against it. The one rule that differs by 401k type:
   a traditional 401k comes off before federal and state income tax (not before
   Social Security or Medicare); a Roth comes off after all tax. */

const r2 = (v) => Math.round((v + 1e-9) * 100) / 100;

/* 2026 tax tables. Federal from Rev. Proc. 2025-32. The state is a generic
   example: two brackets, a standard deduction and a personal exemption. */
export const FED_2026 = {
  single: { label: "Single", std: 16100, otCap: 12500,
    brackets: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]] },
  mfj: { label: "Married filing jointly", std: 32200, otCap: 25000,
    brackets: [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]] },
  mfs: { label: "Married filing separately", std: 16100, otCap: 0,
    brackets: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [384350, 0.35], [Infinity, 0.37]] },
};
export const STATE_2026 = {
  single: { std: 3605, exemption: 9160, threshold: 23000 },
  mfj: { std: 8240, exemption: 18320, threshold: 46000 },
  mfs: { std: 4120, exemption: 9160, threshold: 23000 },
  perDependent: 2320, low: 0.052, high: 0.0558,
};
export const bracketTax = (income, brackets) => {
  let tax = 0, last = 0;
  for (const [cap, rate] of brackets) {
    if (income <= last) break;
    tax += (Math.min(income, cap) - last) * rate;
    last = cap;
  }
  return Math.max(0, tax);
};
export const marginalRate = (income, brackets) => {
  for (const [cap, rate] of brackets) if (income <= cap) return rate;
  return brackets[brackets.length - 1][1];
};
export const stateTax = (taxable, filing = "single") => {
  const K = STATE_2026[filing] || STATE_2026.single;
  return taxable <= K.threshold ? taxable * STATE_2026.low
    : K.threshold * STATE_2026.low + (taxable - K.threshold) * STATE_2026.high;
};

/* Pay frequency. Hourly pay is weekly or every two weeks (overtime is counted
   by the work week); salary can also be twice a month or monthly. */
export const PERIODS = { weekly: 52, biweekly: 26, semimonthly: 24, monthly: 12 };
export const FREQ_LABEL = { weekly: "Weekly", biweekly: "Every 2 weeks", semimonthly: "Twice a month", monthly: "Monthly" };
export const periodsOf = (s) => PERIODS[(s && s.freq) || "biweekly"] || 26;

/* Withholding for one check from its income-taxed pay (after pre-tax HSA,
   dental and a traditional 401k). */
export function withholding(incomeBase, s) {
  const P = periodsOf(s), filing = FED_2026[s && s.filing] ? s.filing : "single";
  const F = FED_2026[filing], K = STATE_2026[filing];
  const annual = Math.max(0, incomeBase) * P;
  return {
    federal: r2(bracketTax(Math.max(0, annual - F.std), F.brackets) / P),
    state: r2(stateTax(Math.max(0, annual - K.std - K.exemption), filing) / P),
  };
}

/* Pay dates. Twice a month is the 15th and the last day; monthly is the same
   day each month (the last day stays the last day). A date a few days off,
   as when payday moves for a weekend, counts as that pay date. */
const D = (s) => new Date(s + "T12:00:00");
const isoOf = (d) => d.toISOString().slice(0, 10);
const lastDayOf = (y, m) => new Date(y, m + 1, 0, 12).getDate();
const dateOf = (y, m, day) => isoOf(new Date(y, m, Math.min(day, lastDayOf(y, m)), 12));
export function nextPayDate(dateStr, freq) {
  const d = D(dateStr);
  if (Number.isNaN(d.getTime())) return "";              // not a date: no next one
  const y = d.getFullYear(), m = d.getMonth(), day = d.getDate(), last = lastDayOf(y, m);
  if (freq === "weekly") { d.setDate(day + 7); return isoOf(d); }
  if (freq === "semimonthly") {
    if (day <= 3) return dateOf(y, m, 15);                 // a month-end check paid early in the month
    if (day <= 18) return dateOf(y, m, last);              // around the 15th → month end
    if (day >= last - 3) return dateOf(y, m + 1, 15);      // around month end → next 15th
    return dateOf(y, m, last);
  }
  if (freq === "monthly") return day >= last - 3 ? dateOf(y, m + 1, 31) : dateOf(y, m + 1, day);
  d.setDate(day + 14); return isoOf(d);
}
/* Pay dates after `dateStr` through the end of `year`. */
export function payDatesLeft(dateStr, freq, year) {
  const out = [];
  for (let d = nextPayDate(dateStr, freq); d && +d.slice(0, 4) === year && out.length < 60; d = nextPayDate(d, freq)) out.push(d);
  return out;
}

export const defaultSetup = (PAY) => ({
  freq: "biweekly", filing: "single",
  hsa: true, hsaAmt: 100,
  retire: "roth", retirePct: PAY.retirePct,
  espp: true, esppAmt: PAY.espp,
  savingsPct: PAY.savingsPct,
});

// Percents stay between 0 and 100%, amounts at zero or more, so a typo like
// "200" for a 401k percent can't produce negative pay.
const pct01 = (v) => Math.min(1, Math.max(0, +v || 0));
const amt = (v) => Math.max(0, +v || 0);

export function payroll(gross, s, PAY, dental = PAY.dental) {
  const hsa = s.hsa ? r2(amt(s.hsaAmt)) : 0;
  const retirement = s.retire === "none" ? 0 : r2(gross * pct01(s.retirePct));
  const espp = s.espp ? r2(amt(s.esppAmt)) : 0;
  const ficaBase = r2(gross - hsa - PAY.dentalPreTax);
  const incomeBase = r2(ficaBase - (s.retire === "traditional" ? retirement : 0));
  const socSec = r2(ficaBase * PAY.ssRate);
  const medicare = r2(ficaBase * PAY.medicareRate);
  const { federal, state } = withholding(incomeBase, s);
  const taxTotal = r2(socSec + medicare + federal + state);
  const benefits = r2(hsa + dental);
  const netPay = r2(gross - taxTotal - benefits - retirement - espp);
  const savings = r2(Math.max(0, netPay) * pct01(s.savingsPct));
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
    // The extra (or missing) wages are taxed at that year's top federal rate.
    federal: r2((y.federal || 0) + incomeMore * marginalRate(Math.max(0, (y.w2Wages || 0) - FED_2026.single.std), FED_2026.single.brackets)),
    state: r2((y.state || 0) + incomeMore * STATE_2026.high),
    socSec: r2((y.socSec || 0) + ficaMore * PAY.ssRate),
    medicare: r2((y.medicare || 0) + ficaMore * PAY.medicareRate),
  };
}

/* The sample year for a pay frequency. The stored sample is paid every two
   weeks. Weekly splits each check into two, a week apart, with half the hours
   (or half the salary); twice a month and monthly (salary only) lay out the
   year's pay dates and pay salary ÷ checks per year. A bonus stays on the first
   check on or after its date. W-2 adjustments are kept as they are. Deductions
   are filled in afterwards by checkForSetup(). */
const monthOf = (d) => D(d).toLocaleString("en-US", { month: "short" });
const hoursGross = (e, rate) => r2(r2((e.regHrs + e.holHrs + e.ptoHrs) * rate) + r2(e.otHrs * rate) + r2(e.otHrs * rate * 0.5));
export function sampleChecksFor(entries, freq, PAY, salary = PAY.salary) {
  if (!freq || freq === "biweekly") return entries;
  const adjustments = entries.filter((e) => e.type === "adjustment");
  const checks = entries.filter((e) => e.type !== "adjustment");
  const salaried = !checks.some((e) => e.regHrs !== undefined);
  let out = [];
  if (freq === "weekly") {
    for (const e of checks) {
      const halves = [{ date: isoOf(new Date(D(e.date).getTime() - 7 * 86400000)), id: e.id + "-a" }, { date: e.date, id: e.id + "-b" }];
      halves.forEach((h, i) => {
        const c = { ...e, ...h, label: `${monthOf(h.date)} check` };
        if (salaried) {
          const bonus = r2(e.gross - r2(salary / 26));
          c.gross = r2(salary / 52 + (i === 1 && bonus > 0.01 ? bonus : 0));
          if (i === 1 && bonus > 0.01) c.label += " + bonus";
        } else {
          for (const k of ["regHrs", "otHrs", "holHrs", "ptoHrs"]) c[k] = (e[k] || 0) / 2;
          c.gross = hoursGross(c, e.rate || PAY.rate);
        }
        out.push(c);
      });
    }
  } else {
    // Salary only. The year's pay dates up to the sample's last check.
    const first = checks[0], lastDate = checks[checks.length - 1].date, y = +first.date.slice(0, 4);
    const dates = [];
    let d = freq === "semimonthly" ? `${y}-01-15` : dateOf(y, 0, 31);
    for (; d <= lastDate; d = nextPayDate(d, freq)) dates.push(d);
    const per = r2(salary / PERIODS[freq]);
    const bonuses = checks.map((e) => ({ date: e.date, bonus: r2(e.gross - r2(salary / 26)) })).filter((b) => b.bonus > 0.01);
    out = dates.map((date, i) => {
      const b = bonuses.find((x) => x.date <= date && !x.used);
      const c = { ...first, id: `${first.id}-${freq}-${i}`, date, label: `${monthOf(date)} check`, gross: per };
      if (b) { b.used = true; c.gross = r2(per + b.bonus); c.label += " + bonus"; }
      return c;
    });
  }
  return [...out, ...adjustments].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
