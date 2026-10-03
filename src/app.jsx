/* Personal data and pay-model constants live in seed.js, which is git-ignored.
   Copy seed.example.js to seed.js to start from placeholder figures. */
import { SEED, YEARS_SEED, RATE_HISTORY, PAY, WEEKLOG_SEED, SALARY_SEED, SALARY_YEARS_SEED } from "./seed.js";

import { defaultSetup, payroll, checkForSetup, yearForSetup } from "./profile.js";
import React, { useState, useEffect, useMemo, useRef } from "react";

/* Build stamp. Bump VERSION whenever you publish; DATE is what tells you
   whether two devices are showing the same build. */
/* Demo only: hourly or salaried. Set by the root on every render, like the theme,
   so every component reads the current choice without threading a prop. */
let PAY_TYPE = "hourly";
let CUR_SALARY = 0;
const rateOf = (y) => (PAY_TYPE === "salary" ? n(y.salary) : n(y["baseRate"]));
let CUR_RATE = 0;
const curRate = () => (PAY_TYPE === "salary" ? CUR_SALARY : (CUR_RATE || PAY.rate));
const SAMPLES = {
  hourly: { entries: SEED, years: YEARS_SEED },
  salary: { entries: SALARY_SEED, years: SALARY_YEARS_SEED },
};
/* The visitor's setup: what comes out of their checks (src/profile.js). Set by
   the root on every render, like PAY_TYPE. Anything they don't have is hidden:
   no HSA (it takes a CDHP/HDHP health plan), no 401k, no ESPP, no savings. */
let SETUP = defaultSetup(PAY);
let HAS_HSA = true, HAS_RETIRE = true, HAS_ESPP = true, HAS_SAVINGS = true;
const retireLabel = () => (SETUP.retire === "traditional" ? "Traditional 401k" : "Roth 401k");
const pctLabel = (v) => `${+(v * 100).toFixed(2)}%`;
/* Money paid in before the year's first logged check, copied from a stub's
   year-to-date column. Set by the root; zero when the whole year is logged. */
let OPENING = null;
const SAMPLE_CACHE = {};
const sampleFor = (type, setup) => {
  const s = SAMPLES[type];
  if (!s.entries) return s;
  const key = type + JSON.stringify(setup);
  return SAMPLE_CACHE[key] || (SAMPLE_CACHE[key] = {
    entries: s.entries.map((e) => checkForSetup(e, setup, PAY)),
    years: s.years.map((y) => yearForSetup(y, setup, PAY)),
  });
};

const BUILD = { version: 9, date: "2026-10-03" };

/* ---------------------------------------------------------------
   Palette + type. Cool ink-on-paper, drawn from the pay stub itself:
   ruled lines, tabular figures, right-aligned money.
----------------------------------------------------------------*/
/* Two palettes, one shape. C is swapped in place when the viewer's theme
   changes, so every component reads the right colors on the next render. */
const LIGHT = {
  paper: "#F1F3F2", card: "#FFFFFF", ink: "#16211F", muted: "#6C7C79", rule: "#D6DCDA",
  accent: "#0B6B5C", accentSoft: "#E3EFEC",
  red: "#A32B22", redSoft: "#F6E4E2",
  green: "#1F6B41", greenSoft: "#E2F0E8",
  amber: "#8A6410", amberSoft: "#F6EEDC",
  s1: "#A32B22", s2: "#4A6FA5", s3: "#8A6410", s4: "#6B4A85", s5: "#1F6B41", s6: "#0B6B5C",
  barMuted: "#D6DCDA",
};
const DARK = {
  paper: "#111817", card: "#1A2321", ink: "#E7EEEB", muted: "#93A6A1", rule: "#2E3B38",
  accent: "#59C9B1", accentSoft: "#15302B",
  red: "#F08C7F", redSoft: "#38211E",
  green: "#79D8A2", greenSoft: "#153020",
  amber: "#E0B76A", amberSoft: "#332912",
  s1: "#E8796B", s2: "#7EA6DD", s3: "#DFB262", s4: "#B69AD8", s5: "#79D8A2", s6: "#59C9B1",
  barMuted: "#3A4946",
};
const C = { ...LIGHT };
const applyTheme = (dark) => Object.assign(C, dark ? DARK : LIGHT);
const prefersDark = () => {
  try {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "dark") return true;
    if (attr === "light") return false;
    return !!(window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches);
  } catch { return false; }
};
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';
const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

const STORE_KEY = "paycheck_ledger_2026";

/* --- Category definitions: one source of truth ------------------ */
const CATS = [
  { key: "taxTotal",   label: "Taxes",      ck: "s1" },
  { key: "benefits",   label: "Benefits",   ck: "s3" },
  { key: "retirement", label: "Retirement", ck: "s6" },
  { key: "espp",       label: "ESPP",       ck: "s2" },
  { key: "savings",    label: "Savings",    ck: "s4" },
  { key: "takeHome",   label: "Take home",  ck: "s5" },
];

const TAX_PARTS = [
  { key: "federal",  label: "Federal" },
  { key: "socSec",   label: "Social Security" },
  { key: "medicare", label: "Medicare" },
  { key: "state",    label: "State" },
];

const SS_RATE = 0.062;
const MEDI_RATE = 0.0145;
const TOL = 0.15; // dollars — payroll rounds, so don't cry wolf over pennies


/* --- helpers ---------------------------------------------------- */
const n = (v) => {
  const x = parseFloat(String(v ?? "").replace(/[$,\s]/g, ""));
  return Number.isFinite(x) ? x : 0;
};
const has = (v) => v !== undefined && v !== null && String(v).trim() !== "";
const money = (v) =>
  (v < 0 ? "-" : "") +
  "$" + Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (part, whole) => (whole ? (part / whole) * 100 : 0);
const pctS = (v) => v.toFixed(2) + "%";

const derive = (e) => {
  const gross = n(e.gross);
  const taxTotal = n(e.taxTotal);
  const benefits = n(e.benefits);
  const retirement = n(e.retirement);
  const espp = n(e.espp);
  const savings = n(e.savings);
  const netPay = gross - taxTotal - benefits - retirement - espp;
  const takeHome = netPay - savings;
  const splitSum = TAX_PARTS.reduce((s, p) => s + n(e[p.key]), 0);
  const hasSplit = TAX_PARTS.some((p) => has(e[p.key]));
  const taxableWages = gross - benefits; // benefits are the pre-tax lines
  const hasBenSplit = has(e.hsa) || has(e.dental);
  const benSum = n(e.hsa) + n(e.dental);
  const isAdj = e.type === "adjustment";
  // Hours, when entered. Overtime is paid as straight time plus a half-time premium,
  // rounded separately — and that half-time premium is what the federal overtime
  // deduction counts, not the full 1.5x.
  // Numeric copies get their own names so the raw form fields stay untouched.
  const payRate = n(e.rate) || CUR_RATE || PAY.rate;
  const regH = n(e.regHrs), otH = n(e.otHrs), holH = n(e.holHrs), ptoH = n(e.ptoHrs);
  const hasHours = [e.regHrs, e.otHrs, e.holHrs, e.ptoHrs].some(has);
  const rnd = (v) => Math.round(v * 100) / 100;
  // Some stubs pay overtime at more than one rate (the FLSA regular rate rises in a
  // week with premium pay), and add premium pay lines. When the stub's
  // overtime dollars are entered, use them; the qualified half-time premium is then
  // exactly one third of overtime pay, whatever the rate.
  const premH = n(e.premHrs), premPay = n(e.premPay);
  const hasOtPay = has(e.otPayAmt);
  const otPay = hasOtPay ? n(e.otPayAmt) : rnd(rnd(otH * payRate) + rnd(otH * payRate * 0.5));
  const otPremium = hasOtPay ? rnd(otPay / 3) : rnd(otH * payRate * 0.5);
  const hoursGross = rnd(rnd(regH * payRate) + rnd(holH * payRate) + rnd(ptoH * payRate)
    + otPay + premPay);
  const hasHoursAny = hasHours || has(e.premHrs) || has(e.premPay) || hasOtPay;
  return { ...e, type: e.type || "paycheck", isAdj, gross, taxTotal, benefits, retirement, espp,
           savings, netPay, takeHome, splitSum, hasSplit, taxableWages,
           hasBenSplit, benSum, payRate, regH, otH, holH, ptoH, premH, premPayN: premPay,
           straightHours: regH + holH + ptoH,
           hasHours: hasHoursAny, otPremium, otPay, hoursGross };
};

/* Starting totals from a stub's year-to-date column, as numbers. The stub
   doesn't show savings transfers, so those are estimated from the setup. */
const OPENING_FIELDS = [
  ["checks", "Paychecks already paid"], ["gross", "Gross pay"], ["federal", "Federal tax"],
  ["socSec", "Social Security"], ["medicare", "Medicare"], ["state", "State tax"],
  ["hsa", "HSA"], ["dental", "Dental"], ["retirement", "401k"], ["espp", "ESPP"], ["otPay", "Overtime pay"],
];
const openingTotals = (o) => {
  if (!o || !n(o.gross)) return null;
  const v = Object.fromEntries(OPENING_FIELDS.map(([k]) => [k, n(o[k])]));
  if (!HAS_HSA) v.hsa = 0;
  if (!HAS_RETIRE) v.retirement = 0;
  if (!HAS_ESPP) v.espp = 0;
  if (PAY_TYPE === "salary") v.otPay = 0;
  v.taxTotal = v.federal + v.socSec + v.medicare + v.state;
  v.benefits = v.hsa + v.dental;
  v.netPay = v.gross - v.taxTotal - v.benefits - v.retirement - v.espp;
  v.savings = Math.round(v.netPay * SETUP.savingsPct * 100) / 100;
  v.takeHome = v.netPay - v.savings;
  v.otPremium = v.otPay / 3;
  return v;
};

/* Paychecks come every 14 days. A longer gap means one hasn't been logged. */
const missingPaychecks = (checks) => {
  const out = [];
  for (let i = 1; i < checks.length; i++) {
    const gap = daysBetween(checks[i - 1].date, checks[i].date);
    if (gap > 15 && gap < 400) {
      for (let d = 14; d < gap - 1; d += 14) out.push({
        expected: addDays(checks[i - 1].date, d),
        after: checks[i - 1].label, before: checks[i].label,
      });
    }
  }
  return out;
};

/* Every rule the app knows how to check, in one place. */
const auditRow = (d) => {
  const flags = [];
  if (d.gross <= 0) return flags;

  // A W-2 adjustment is paper income with no cash movement, so nothing to
  // reconcile. Only worth flagging if deductions were entered by mistake.
  if (d.isAdj) {
    const deducted = d.taxTotal + d.benefits + d.retirement + d.espp + d.savings;
    if (deducted > 0.005)
      flags.push({ level: "warn", msg: "Adjustments normally carry no deductions. Check the statement, or switch this row to a paycheck." });
    return flags;
  }

  const incomplete = d.taxTotal === 0 && d.retirement === 0 && d.benefits === 0;
  if (incomplete) {
    flags.push({ level: "warn", msg: "Gross only — no deductions logged. Add them, or switch this row to a W-2 adjustment." });
    return flags;
  }
  if (d.hasSplit && Math.abs(d.splitSum - d.taxTotal) > 0.01) {
    flags.push({ level: "bad", msg: `Tax split adds to ${money(d.splitSum)} but the total says ${money(d.taxTotal)} — off by ${money(d.splitSum - d.taxTotal)}.` });
  }
  if (d.hasHours && d.straightHours > 0) {
    const impliedRate = (d.gross - d.otPay - n(d.premPay)) / d.straightHours;
    if (Math.abs(impliedRate - d.payRate) > 0.005 && Math.abs(d.hoursGross - d.gross) > 0.02)
      flags.push({ level: "warn", msg: `These hours work out to ${money(impliedRate)} an hour, not ${money(d.payRate)}. If your rate changed, set it on this paycheck.` });
  }
  if (d.hasHours && Math.abs(d.hoursGross - d.gross) > 0.02) {
    flags.push({ level: "bad", msg: `Hours at ${money(d.payRate)}/hr come to ${money(d.hoursGross)}, but gross says ${money(d.gross)} — off by ${money(d.hoursGross - d.gross)}. Check the hours against the stub's earnings section.` });
  }
  if (d.hasBenSplit && Math.abs(d.benSum - d.benefits) > 0.01) {
    flags.push({ level: "bad", msg: `${HAS_HSA ? "HSA plus dental" : "Dental"} is ${money(d.benSum)}, but the benefits line says ${money(d.benefits)}.` });
  }
  if (has(d.medicare)) {
    const exp = d.taxableWages * MEDI_RATE;
    if (Math.abs(n(d.medicare) - exp) > TOL)
      flags.push({ level: "bad", msg: `Medicare is ${money(n(d.medicare))}; 1.45% of ${money(d.taxableWages)} is ${money(exp)}. Off by ${money(n(d.medicare) - exp)}.` });
  }
  if (has(d.socSec)) {
    const exp = d.taxableWages * SS_RATE;
    if (Math.abs(n(d.socSec) - exp) > TOL)
      flags.push({ level: "bad", msg: `Social Security is ${money(n(d.socSec))}; 6.2% of ${money(d.taxableWages)} is ${money(exp)}. Off by ${money(n(d.socSec) - exp)}.` });
  }
  if (!d.hasSplit) {
    flags.push({ level: "info", msg: "Tax total only. Add the four sub-lines from the stub to unlock the rate checks." });
  }
  if (has(d.stubCheck) && Math.abs(n(d.stubCheck) - d.takeHome) > 0.01) {
    flags.push({ level: "bad", msg: `Stub check says ${money(n(d.stubCheck))}, the lines compute to ${money(d.takeHome)}.` });
  }
  const rp = pct(d.retirement, d.gross), want = SETUP.retirePct * 100;
  if (HAS_RETIRE && Math.abs(rp - want) > 0.15)
    flags.push({ level: "warn", msg: `401k came in at ${pctS(rp)}, not your setup's ${pctS(want)}.` });
  return flags;
};

/* Proper CSV quoting: wrap when needed, and double any internal quote.
   JSON escaping is not the same thing and Excel reads it wrong. */
const DQ = String.fromCharCode(34);
const csvQuote = (v) => {
  const needs = v.indexOf(",") >= 0 || v.indexOf(DQ) >= 0 || v.indexOf("\n") >= 0;
  return needs ? DQ + v.split(DQ).join(DQ + DQ) + DQ : v;
};
const stripQuotes = (v) => {
  let out = v.trim();
  if (out.length > 1 && out[0] === DQ && out[out.length - 1] === DQ) {
    out = out.slice(1, -1).split(DQ + DQ).join(DQ);
  }
  return out;
};

/* Quote-aware single-line CSV split — handles "1,234.56" style cells. */
function splitCSVLine(line) {
  const out = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; }
      else q = !q;
    } else if (ch === "," && !q) { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}


/* ---------------------------------------------------------------
   Pay model, fitted to the 17 logged paychecks. State withholding
   reproduces exactly; federal lands within a few dollars because the
   real tables are piecewise, not a straight line.
----------------------------------------------------------------*/


const r2 = (v) => Math.round(v * 100) / 100;

/* Two Sunday–Saturday weeks, the later one ending 6 days before payday.
   For example, a Friday paycheck covers the two Sunday-to-Saturday weeks ending 6 and 13 days earlier. */
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (dateStr, n) => { const d = new Date(dateStr + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
/* A week is Sunday–Saturday and is paid the Friday six days after it ends. */
const weekEndingsFor = (payDate) => payDate ? [addDays(payDate, -13), addDays(payDate, -6)] : ["", ""];
/* Weeks pair into fortnightly periods: the first week of a pair is paid 13 days
   after it ends, the second 6. Which one a week is depends on the pay calendar,
   so this measures against a known pay date. */
const daysBetween = (a, b) =>
  Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);
const payDateForWeek = (weekEnd, anchorPayDate) => {
  if (!anchorPayDate) return addDays(weekEnd, 6);
  const weeksOff = Math.round(daysBetween(addDays(anchorPayDate, -6), weekEnd) / 7);
  const isSecondWeek = ((weeksOff % 2) + 2) % 2 === 0;
  return addDays(weekEnd, isSecondWeek ? 6 : 13);
};
const weekLabel = (weekEnd) => {
  if (!weekEnd) return "";
  const fmt = (ds) => new Date(ds + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(addDays(weekEnd, -6))} – ${fmt(weekEnd)}`;
};
/* The Saturday that ends the week containing a date. */
const saturdayOf = (dateStr) => {
  const d = new Date(dateStr + "T12:00:00");
  return iso(new Date(d.getTime() + (6 - d.getDay()) * 86400000));
};
const BLANK_WEEK = { reg: 40, ot: "", hol: 0, pto: 0 };

const weekRanges = (payDate) => {
  if (!payDate) return ["", ""];
  const end2 = new Date(payDate + "T12:00:00");
  end2.setDate(end2.getDate() - 6);
  const fmt = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const out = [];
  for (const back of [13, 6]) {
    const a = new Date(end2); a.setDate(a.getDate() - back);
    const b = new Date(a); b.setDate(b.getDate() + 6);
    out.push(`${fmt(a)} – ${fmt(b)}`);
  }
  return out;
};

const forecast = (inp) => {
  const rate = n(inp.rate) || PAY.rate;
  const weeks = (inp.payType === "salary" ? [] : (inp.weeks || [])).map((w) => {
    const reg = Math.min(n(w.reg), PAY.weeklyHours);
    const ot = n(w.ot), hol = n(w.hol), pto = n(w.pto);
    // Payroll rounds overtime in two pieces — the straight-time portion and the
    // half-time premium — which lands a cent off from rounding a 1.5x rate once.
    return {
      reg, ot, hol, pto,
      straight: r2((reg + hol + pto) * rate),
      premium: r2(ot * rate) + r2(ot * rate * (PAY.otMultiplier - 1)),
      paidHours: reg + hol + pto + ot,
    };
  });
  const premPay = n(inp.premPay);
  const salaryPay = inp.payType === "salary" ? r2(n(inp.salary) / 26) : 0;
  const gross = r2(weeks.reduce((s, w) => s + w.straight + w.premium, 0) + salaryPay + premPay);
  // Deductions follow the visitor's setup (see src/profile.js). The withholding
  // base is not gross minus the benefits line — see PAY.dentalPreTax.
  const setup = { ...(inp.setup || SETUP), hsaAmt: n(inp.hsa), esppAmt: n(inp.espp) };
  const { hsa, dental, benefits, socSec, medicare, federal, state, taxTotal, retirement, espp,
          netPay, savings, takeHome, ficaBase: taxable, incomeBase } = payroll(gross, setup, PAY, n(inp.dental));
  const otHours = weeks.reduce((s, w) => s + w.ot, 0);
  return {
    weeks, salaryPay, salary: n(inp.salary), gross, premPay, premHrs: n(inp.premHrs), benefits, hsa, dental, taxable, socSec, medicare, federal, state,
    taxTotal, retirement, espp, netPay, savings, takeHome, otHours, rate,
    incomeBase, belowFedBand: gross > 0 && incomeBase < PAY.fedFloor,
  };
};


/* 2026 tax tables. Federal from Rev. Proc. 2025-32. The state is a generic
   example: two brackets, a standard deduction and a personal exemption. */
const FED_2026 = {
  single: { label: "Single", std: 16100, otCap: 12500,
    brackets: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]] },
  mfj: { label: "Married filing jointly", std: 32200, otCap: 25000,
    brackets: [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]] },
  mfs: { label: "Married filing separately", std: 16100, otCap: 0,
    brackets: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [384350, 0.35], [Infinity, 0.37]] },
};
const STATE_2026 = {
  single: { std: 3605, exemption: 9160, threshold: 23000 },
  mfj: { std: 8240, exemption: 18320, threshold: 46000 },
  mfs: { std: 4120, exemption: 9160, threshold: 23000 },
  perDependent: 2320, low: 0.052, high: 0.0558,
};
const bracketTax = (income, brackets) => {
  let tax = 0, last = 0;
  for (const [cap, rate] of brackets) {
    if (income <= last) break;
    tax += (Math.min(income, cap) - last) * rate;
    last = cap;
  }
  return Math.max(0, tax);
};
const marginalRate = (income, brackets) => {
  for (const [cap, rate] of brackets) if (income <= cap) return rate;
  return brackets[brackets.length - 1][1];
};

const CSV_COLS = [
  ["date", "Date"], ["label", "Label"], ["type", "Type"], ["gross", "Gross"],
  ["taxTotal", "Tax Total"], ["federal", "Federal"], ["socSec", "Social Security"],
  ["medicare", "Medicare"], ["state", "State"], ["benefits", "Benefits"], ["hsa", "HSA"], ["dental", "Dental"],
  ["rate", "Rate"], ["regHrs", "Regular Hrs"], ["otHrs", "Overtime Hrs"],
  ["holHrs", "Holiday Hrs"], ["ptoHrs", "PTO Hrs"], ["otPayAmt", "Overtime Pay"],
  ["premHrs", "Premium Hrs"], ["premPay", "Premium Pay"],
  ["retirement", "Retirement"], ["espp", "ESPP"], ["savings", "Savings"],
  ["stubCheck", "Stub Check"], ["note", "Note"],
];

/* ================================================================ */
/* A blank page is the worst possible failure for something holding your records.
   If anything throws during render, show that the data is still in storage. */
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ background: C.paper, color: C.ink, fontFamily: SANS, minHeight: "100%" }} className="p-6">
        <div className="max-w-xl mx-auto rounded p-5" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <div className="text-lg" style={{ fontWeight: 700 }}>Something broke while drawing the page</div>
          <p className="text-sm mt-2" style={{ color: C.muted }}>
            Your paychecks are safe. They're written to storage every time you save, not when
            the page renders, so nothing was lost. Refresh and it should come back.
          </p>
          <p className="text-sm mt-2" style={{ color: C.muted }}>
            If it keeps happening, send Claude the message below and it can be fixed.
          </p>
          <pre className="mt-3 p-2 rounded text-xs" style={{ background: C.paper, whiteSpace: "pre-wrap", fontFamily: MONO }}>
            {String(this.state.err && this.state.err.message || this.state.err)}
          </pre>
          <button onClick={() => this.setState({ err: null })} className="mt-3 px-4 py-2 rounded text-sm"
            style={{ background: C.ink, color: C.card, fontWeight: 600 }}>Try again</button>
        </div>
      </div>
    );
  }
}

export default function PaycheckLedgerApp() {
  return <Boundary><PaycheckLedger /></Boundary>;
}

function PaycheckLedger() {
  const [dark, setDark] = useState(prefersDark);
  applyTheme(dark);   // before children render, so they read the right palette
  useEffect(() => {
    const sync = () => setDark(prefersDark());
    const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    if (mq) mq.addEventListener ? mq.addEventListener("change", sync) : mq.addListener(sync);
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class"] });
    return () => {
      if (mq) mq.removeEventListener ? mq.removeEventListener("change", sync) : mq.removeListener(sync);
      mo.disconnect();
    };
  }, []);

  const [entries, setEntries] = useState([]);
  const [limit, setLimit] = useState(24500);
  const [hsaLimit, setHsaLimit] = useState(4400);
  const [hsaEmployer, setHsaEmployer] = useState(500);
  const [hsaEmpPaid, setHsaEmpPaid] = useState(false);
  // Employer HSA deposits often land once a year rather than per paycheck.
  const [hsaEmpDate, setHsaEmpDate] = useState("2026-12-15");
  const [status, setStatus] = useState("Loading your ledger…");
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState("log");
  const [editing, setEditing] = useState(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [backupText, setBackupText] = useState("");
  const [years, setYears] = useState(YEARS_SEED);
  // Swaps in the matching sample year only while the ledger is still the
  // untouched sample; otherwise the visitor's entries stay as they are.
  const swapSample = (t, su) => {
    const from = sampleFor(payType, setup), to = sampleFor(t, su);
    const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
    const untouched = to.entries && same(entries, from.entries) && same(years, from.years);
    if (untouched) { setEntries(to.entries); setYears(to.years); }
    return untouched;
  };
  const switchPayType = (t) => {
    if (t === payType) return;
    const untouched = swapSample(t, setup);
    setPayType(t);
    if (untouched) {
      setStatus(t === "salary" ? "Switched to salary, with a salaried sample year." : "Switched to hourly, with an hourly sample year.");
    } else {
      setStatus(t === "salary" ? "Switched to salary. Your entries are kept; hours and overtime are hidden." : "Switched to hourly. Hours and overtime are back.");
    }
  };
  // A setup change. While the ledger is still the sample, the sample year is
  // redone to match, so the demo shows what that setup does to a paycheck.
  const changeSetup = (patch) => {
    const next = { ...setup, ...patch };
    const untouched = swapSample(payType, next);
    setSetup(next);
    setFc((f) => ({ ...f, hsa: next.hsa ? next.hsaAmt : f.hsa, espp: next.espp ? next.esppAmt : f.espp }));
    if (untouched) setStatus("The sample year now follows this setup.");
  };
  // Start a ledger of your own: the sample goes, the setup opens.
  const startOwn = () => {
    setEntries([]);
    setYears([]);
    setRemovedYears([...new Set([...YEARS_SEED, ...(SALARY_YEARS_SEED || [])].map((y) => y.id))]);
    setWeekLog({});
    setForecasts({});
    setEditing(null);
    setOpening({});
    setSetupOpen(true);
    setStatus("Sample cleared. Set up what comes out of your checks, then log your first paycheck.");
  };
  const [removedYears, setRemovedYears] = useState([]);
  const [tax, setTax] = useState({ status: "single", dependents: "", otherIncome: "", otherWithheld: "" });
  // Hours logged week by week, keyed by the Saturday the week ends on. The
  // forecast reads these, so a week entered here is a week already forecast.
  const [weekLog, setWeekLog] = useState(WEEKLOG_SEED);
  // A forecast saved on the day, so the app can mark its own homework later.
  const [forecasts, setForecasts] = useState({});
  const [payType, setPayType] = useState("hourly");
  const [setup, setSetup] = useState(() => defaultSetup(PAY));
  const [setupOpen, setSetupOpen] = useState(false);
  // Year-to-date figures from the last stub before the first logged check.
  const [opening, setOpening] = useState({});
  const [lastBackup, setLastBackup] = useState(null);   // { at, count }
  const [fc, setFc] = useState({
    payDate: "2026-10-02", rate: PAY.rate, salary: PAY.salary || 0, hsa: 100, dental: PAY.dental, espp: PAY.espp,
    weeks: [{ reg: 40, ot: 6, hol: 0, pto: 0 }, { reg: 40, ot: "", hol: 0, pto: 0 }],
  });
  PAY_TYPE = payType;
  SETUP = setup;
  HAS_HSA = setup.hsa;
  HAS_RETIRE = setup.retire !== "none";
  HAS_ESPP = setup.espp;
  HAS_SAVINGS = setup.savingsPct > 0;
  OPENING = openingTotals(opening);
  CUR_SALARY = n(fc.salary) || PAY.salary || 0;
  CUR_RATE = n(fc.rate) || PAY.rate;

  /* --- storage --------------------------------------------------
     Saved privately to the viewer's Claude account (db, under their own
     data/users/<id>/ subtree), so the ledger follows them between phone and
     PC. If that isn't available, fall back to this browser only and say so.

     Two devices can hold the page open at once, and either can be stale. So a
     save never writes this device's whole copy blindly: it re-reads the
     account copy, and if another device saved since, merges three ways —
     per paycheck, and per setting — keeping only what THIS device changed. */
  const docRef = useRef(null);
  const base = useRef(null);        // last copy known to match the account (the common ancestor)
  const lastSaved = useRef("");
  const justLoaded = useRef(false);
  const [syncMode, setSyncMode] = useState("connecting"); // account | device | connecting
  const syncModeRef = useRef("connecting");
  syncModeRef.current = syncMode;
  const LOCAL_KEY = STORE_KEY;
  const SETTINGS = ["limit", "hsaLimit", "hsaEmployer", "hsaEmpPaid", "hsaEmpDate", "fc", "years", "removedYears", "tax", "weekLog", "forecasts", "payType", "setup", "opening", "lastBackup"];

  // Key-order-independent JSON, so the same data read back from the store compares equal.
  const canon = (v) => {
    if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
    if (v && typeof v === "object")
      return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort()
        .map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
    return JSON.stringify(v === undefined ? null : v);
  };
  const strip = (p) => { if (!p) return p; const { rev, savedAt, ...rest } = p; return rest; };

  const merge3 = (b0, ours, theirs) => {
    const byId = (p) => new Map(((p && p.entries) || []).map((e) => [e.id, e]));
    const B = byId(b0), O = byId(ours), T = byId(theirs);
    const ids = []; const seen = new Set();
    for (const m of [T, O]) for (const id of m.keys()) if (!seen.has(id)) { seen.add(id); ids.push(id); }
    const entries = [];
    for (const id of ids) {
      const bv = B.get(id), ov = O.get(id), tv = T.get(id);
      const pick = canon(ov) === canon(bv) ? tv : ov;   // untouched here -> take theirs
      if (pick) entries.push(pick);
    }
    const out = { entries };
    for (const k of SETTINGS) {
      const bv = b0 ? b0[k] : undefined, ov = ours[k], tv = theirs ? theirs[k] : undefined;
      out[k] = canon(ov) === canon(bv) && tv !== undefined ? tv : ov;
    }
    return out;
  };

  const applyState = (p) => {
    justLoaded.current = true;
    setEntries(p.entries || []);
    if (p.limit) setLimit(p.limit);
    if (p.hsaLimit) setHsaLimit(p.hsaLimit);
    if (p.hsaEmployer !== undefined) setHsaEmployer(p.hsaEmployer);
    if (p.hsaEmpPaid !== undefined) setHsaEmpPaid(p.hsaEmpPaid);
    if (p.hsaEmpDate) setHsaEmpDate(p.hsaEmpDate);
    if (p.fc) setFc(p.fc);
    if (p.payType) setPayType(p.payType);
    if (p.setup) setSetup({ ...defaultSetup(PAY), ...p.setup });
    else if (p.hasHsa === false) setSetup({ ...defaultSetup(PAY), hsa: false });   // saved by version 6
    if (p.opening) setOpening(p.opening);
    if (p.lastBackup) setLastBackup(p.lastBackup);
    // Prior-year rows this page knows about are added if they aren't saved yet,
    // so a ledger saved before a year existed still picks it up — unless it was deleted.
    const gone = p.removedYears || [];
    const have = new Set((p.years || []).map((y) => y.id));
    const missing = YEARS_SEED.filter((y) => !have.has(y.id) && !gone.includes(y.id));
    if (p.years) setYears([...p.years, ...missing]);
    setRemovedYears(gone);
    if (p.tax) setTax(p.tax);
    if (p.weekLog) setWeekLog(p.weekLog);
    if (p.forecasts) setForecasts(p.forecasts);
    // Ledgers saved before the week log existed keep their forecast hours.
    else if (p.fc && p.fc.weeks) {
      const [w1, w2] = weekEndingsFor(p.fc.payDate);
      const moved = {};
      if (w1) moved[w1] = p.fc.weeks[0] || BLANK_WEEK;
      if (w2) moved[w2] = p.fc.weeks[1] || BLANK_WEEK;
      setWeekLog(moved);
    }
  };

  const current = useRef(null);     // this device's live copy, readable from callbacks
  current.current = { entries, limit, hsaLimit, hsaEmployer, hsaEmpPaid, hsaEmpDate, fc, years, removedYears, tax, weekLog, forecasts, payType, setup, opening, lastBackup };
  const hasLocalChanges = () => base.current && canon(strip(base.current)) !== canon(current.current)
    && canon(current.current) !== lastSaved.current;

  useEffect(() => {
    let unsub = null, cancelled = false;
    const startFresh = () => {
      justLoaded.current = true;
      base.current = null;
      setEntries(SEED);
      setStatus("This is a sample year of invented paychecks. Change the setup, log one, or try the forecast. Start my own ledger clears it when you're ready.");
      setReady(true);
    };
    const fromDevice = () => {
      setSyncMode("device");
      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw) { const p = JSON.parse(raw); base.current = p; applyState(p); setStatus(""); setReady(true); return; }
      } catch {}
      startFresh();
    };
    (async () => {
      const use = window.claude && window.claude.use ? window.claude.use.bind(window.claude) : null;
      let db = null, uid = null;
      try {
        if (use) {
          const [d, u] = await Promise.all([use("db"), use("user")]);
          db = d; uid = u ? await u.id() : null;
        }
      } catch {}
      if (cancelled) return;
      if (!db || !uid) return fromDevice();
      const ref = db.doc(`data/users/${uid}/ledger`);
      docRef.current = ref;
      let first = true;
      unsub = ref.onSnapshot((snap) => {
        if (snap.metadata && snap.metadata.hasPendingWrites) return;
        if (first) {
          first = false;
          setSyncMode("account");
          if (!snap.exists) return startFresh();
          base.current = snap.data();
          applyState(base.current); setStatus(""); setReady(true);
          return;
        }
        // Another device saved. Adopt it unless this device has an edit on the way —
        // then the upcoming save merges the two instead.
        if (!snap.exists) return;
        const body = snap.data();
        if (base.current && body.rev && body.rev === base.current.rev) return;
        if (hasLocalChanges()) return;
        if (canon(strip(body)) === canon(current.current)) { base.current = body; return; }
        base.current = body;
        applyState(body);
        setStatus("Updated with changes from your other device.");
      }, () => { if (first) { first = false; fromDevice(); } else setSyncMode("device"); });
    })();
    return () => { cancelled = true; if (unsub) unsub(); };
  }, []);

  /* --- save: only on a real change, one write at a time, after a pause --- */
  const saving = useRef(false);
  const pending = useRef(false);
  const flush = async () => {
    if (saving.current || !pending.current) return;
    pending.current = false;
    saving.current = true;
    const ours = current.current;
    try {
      if (syncModeRef.current === "account" && docRef.current) {
        const snap = await docRef.current.get();
        const theirs = snap.exists ? snap.data() : null;
        const stale = theirs && (!base.current || theirs.rev !== base.current.rev);
        const merged = stale ? merge3(strip(base.current), ours, strip(theirs)) : ours;
        const body = { ...merged, rev: Math.random().toString(36).slice(2, 10), savedAt: new Date().toISOString() };
        await docRef.current.set(body);
        base.current = body;
        lastSaved.current = canon(merged);
        if (stale && canon(merged) !== canon(ours)) {
          applyState(merged);
          setStatus("Merged with changes from your other device.");
        }
      } else {
        const raw = JSON.stringify(ours);
        try { localStorage.setItem(LOCAL_KEY, raw); } catch {}
        base.current = ours;
        lastSaved.current = canon(ours);
      }
    } catch (e) {
      pending.current = true;   // keep it queued; the next change retries
      setStatus(e && e.code === "quota_exceeded"
        ? "Your account storage for this page is full. Export a CSV so nothing is lost."
        : "Couldn't save just now. Your change is still on screen — export a CSV to be safe.");
    } finally {
      saving.current = false;
      if (pending.current && canon(current.current) !== lastSaved.current) setTimeout(flush, 400);
    }
  };

  useEffect(() => {
    if (!ready) return;
    const c = canon(current.current);
    if (justLoaded.current) { justLoaded.current = false; lastSaved.current = c; return; }
    if (c === lastSaved.current) return;
    const t = setTimeout(() => { pending.current = true; flush(); }, 700);
    return () => clearTimeout(t);
  }, [entries, limit, hsaLimit, hsaEmployer, hsaEmpPaid, hsaEmpDate, fc, years, removedYears, tax, weekLog, forecasts, payType, setup, opening, lastBackup, ready]);

  const rows = useMemo(
    () => entries.map(derive).sort((a, b) =>
      a.date === b.date ? (a.isAdj ? 1 : -1) : (a.date < b.date ? -1 : 1)),
    [entries]
  );
  // Paychecks drive per-check trends and pacing. Adjustments are W-2 income
  // with no cash movement — they belong in annual gross, nowhere else.
  const checks = rows.filter((r) => !r.isAdj && r.gross > 0 && !(r.taxTotal === 0 && r.retirement === 0));
  const adjustments = rows.filter((r) => r.isAdj && r.gross > 0);
  const real = checks;

  const ytd = useMemo(() => {
    // Starting totals, when the visitor began logging partway through the year.
    const o = OPENING || {};
    const sum = (k) => checks.reduce((s, r) => s + r[k], 0) + (o[k] || 0);
    const adjGross = adjustments.reduce((s, r) => s + r.gross, 0);
    const gross = sum("gross");
    return {
      gross, taxTotal: sum("taxTotal"), benefits: sum("benefits"),
      retirement: sum("retirement"), espp: sum("espp"), savings: sum("savings"),
      hsa: sum("hsa"), dental: sum("dental"),
      otHrs: sum("otH"), otPremium: sum("otPremium"), otPay: sum("otPay"),
      regHrs: sum("regH"), holHrs: sum("holH"), ptoHrs: sum("ptoH"),
      hoursLogged: checks.filter((r) => r.hasHours).length,
      netPay: sum("netPay"), takeHome: sum("takeHome"), count: checks.length + (o.checks || 0),
      logged: checks.length, openingChecks: o.checks || 0,
      adjGross, adjCount: adjustments.length, w2Gross: gross + adjGross,
    };
  }, [rows, opening, setup]);

  /* Remaining biweekly pay dates in the year, from your first paycheck. */
  const remaining = useMemo(() => {
    if (!checks.length) return 0;
    const anchor = new Date(checks[0].date + "T12:00:00");
    const last = new Date(checks[checks.length - 1].date + "T12:00:00");
    let count = 0;
    for (let d = new Date(anchor); d.getFullYear() === anchor.getFullYear(); d.setDate(d.getDate() + 14)) {
      if (d > last) count++;
    }
    return count;
  }, [rows]);

  /* Next pay date on the biweekly cycle, so logging a check is one field fewer. */
  const nextPayDate = useMemo(() => {
    if (!checks.length) return "";
    const last = new Date(checks[checks.length - 1].date + "T12:00:00");
    last.setDate(last.getDate() + 14);
    return last.toISOString().slice(0, 10);
  }, [rows]);

  // Still the untouched sample year? Then the demo banner shows, and setup
  // changes redo the sample instead of leaving the visitor's entries alone.
  const isSample = useMemo(() => JSON.stringify(entries) === JSON.stringify(sampleFor(payType, setup).entries),
    [entries, payType, setup]);

  const avgRet = ytd.count ? ytd.retirement / ytd.count : 0;
  const projRet = ytd.retirement + avgRet * remaining;
  const flagCount = rows.reduce((s, r) => s + auditRow(r).filter((f) => f.level !== "info").length, 0);

  /* --- CSV ----------------------------------------------------- */
  const buildCSV = () => {
    const head = CSV_COLS.map(([, h]) => h).concat(
      ["Net Pay", "Take Home", "Tax %", "Benefits %", "Retirement %", "ESPP %", "Take Home %", "Savings %"]
    );
    const lines = [head.join(",")];
    rows.forEach((r) => {
      const base = CSV_COLS.map(([k]) => {
        const v = r[k];
        if (v === undefined || v === null) return "";
        if (typeof v !== "string") return v;
        return csvQuote(v);
      });
      const extra = [
        r.netPay.toFixed(2), r.takeHome.toFixed(2),
        pct(r.taxTotal, r.gross).toFixed(2), pct(r.benefits, r.gross).toFixed(2),
        pct(r.retirement, r.gross).toFixed(2), pct(r.espp, r.gross).toFixed(2),
        pct(r.takeHome, r.gross).toFixed(2), pct(r.savings, r.gross).toFixed(2),
      ];
      lines.push(base.concat(extra).join(","));
    });
    return lines.join("\n");
  };

  // Show the text first — that path always works. The file download is a bonus
  // attempt: this page runs in a sandboxed frame, and a blob link there can
  // navigate the frame instead of downloading, which blanks the app.
  const exportCSV = () => {
    let text = "";
    try {
      text = buildCSV();
      setCsvText(text);
    } catch (err) {
      setStatus("Couldn't build the export. Tell Claude what the ledger looks like.");
      return;
    }
    (async () => {
      try {
        const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
        if (!dl) { setStatus("Copy the text below into a spreadsheet — it's your backup file."); return; }
        await dl.save({ filename: `paycheck-ledger-${new Date().toISOString().slice(0, 10)}.csv`, data: text });
        setStatus(`Exported ${rows.length} rows.`);
      } catch (e) {
        setStatus(e && e.code === "declined"
          ? "Download cancelled. The same data is in the text below if you'd rather copy it."
          : "The download didn't go through here. Copy the text below instead — it's the same file.");
      }
    })();
  };

  /* A CSV holds paychecks only. This is everything: paychecks, past years and
     every setting — the file to keep if you want the whole ledger back. */
  const buildBackup = () => JSON.stringify({
    app: "paycheck-ledger", version: 1, savedAt: new Date().toISOString(),
    data: { entries, limit, hsaLimit, hsaEmployer, hsaEmpPaid, hsaEmpDate, fc, years, removedYears, tax, weekLog, forecasts, payType, setup, opening, lastBackup },
  }, null, 2);

  const downloadBackup = async () => {
    const text = buildBackup();
    setCsvText("");
    setLastBackup({ at: iso(new Date()), sig: ledgerSig(entries) });
    try {
      const dl = window.claude && window.claude.use ? await window.claude.use("downloads") : null;
      if (!dl) { setBackupText(text); setStatus("Copy the text below and save it as a .json file."); return; }
      await dl.save({ filename: `paycheck-ledger-backup-${new Date().toISOString().slice(0, 10)}.json`, data: text });
      setStatus(`Backed up ${entries.length} paychecks and ${years.length} past years.`);
    } catch (e) {
      setBackupText(text);
      setStatus(e && e.code === "declined"
        ? "Download cancelled. The same backup is in the text below."
        : "The download didn't go through. Copy the text below and save it as a .json file.");
    }
  };

  const restoreBackup = (text) => {
    let parsed;
    try { parsed = JSON.parse(text); } catch { setStatus("That doesn't look like a backup file."); return; }
    const d = parsed && parsed.data ? parsed.data : parsed;
    if (!d || !Array.isArray(d.entries)) { setStatus("That file has no paychecks in it."); return; }
    setEntries(d.entries);
    if (d.limit) setLimit(d.limit);
    if (d.hsaLimit) setHsaLimit(d.hsaLimit);
    if (d.hsaEmployer !== undefined) setHsaEmployer(d.hsaEmployer);
    if (d.hsaEmpPaid !== undefined) setHsaEmpPaid(d.hsaEmpPaid);
    if (d.hsaEmpDate) setHsaEmpDate(d.hsaEmpDate);
    if (d.fc) setFc(d.fc);
    if (d.payType) setPayType(d.payType);
    if (d.setup) setSetup({ ...defaultSetup(PAY), ...d.setup });
    else if (d.hasHsa === false) setSetup({ ...defaultSetup(PAY), hsa: false });
    if (d.opening) setOpening(d.opening);
    if (Array.isArray(d.years)) setYears(d.years);
    if (Array.isArray(d.removedYears)) setRemovedYears(d.removedYears);
    if (d.tax) setTax(d.tax);
    if (d.weekLog) setWeekLog(d.weekLog);
    if (d.forecasts) setForecasts(d.forecasts);
    setStatus(`Restored ${d.entries.length} paychecks`
      + (Array.isArray(d.years) ? `, ${d.years.length} past years` : "")
      + " and your settings.");
  };

  const importCSV = (text, mode) => {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) { setStatus("That file had no rows in it."); return; }
    const heads = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = {};
    CSV_COLS.forEach(([k, h]) => { idx[k] = heads.indexOf(h.toLowerCase()); });
    if (idx.date < 0 || idx.gross < 0) {
      setStatus("Needs at least a Date and Gross column. Export one first to see the format.");
      return;
    }
    const parsed = [];
    for (let i = 1; i < lines.length; i++) {
      const cells = splitCSVLine(lines[i]);
      if (!cells.length || !cells[idx.date]) continue;
      const o = { id: `imp-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}` };
      CSV_COLS.forEach(([k]) => {
        if (idx[k] < 0) return;
        const raw = stripQuotes(cells[idx[k]] || "").trim();
        if (raw === "") return;
        const TEXT = ["date", "label", "note", "type"];
        o[k] = TEXT.includes(k) ? raw : n(raw);
      });
      if (o.type && o.type !== "adjustment") o.type = "paycheck";
      if (o.date) parsed.push(o);
    }
    if (!parsed.length) { setStatus("Couldn't read any rows out of that file."); return; }
    if (mode === "replace") {
      setEntries(parsed);
      setStatus(`Replaced the ledger with ${parsed.length} rows.`);
    } else {
      const key = (e) => `${e.date}|${e.type || "paycheck"}`;
      const seen = new Set(entries.map(key));
      const added = parsed.filter((p) => !seen.has(key(p)));
      setEntries([...entries, ...added]);
      setStatus(`Added ${added.length} rows, skipped ${parsed.length - added.length} already logged.`);
    }
  };

  const save = (raw) => {
    // Rows handed to the form carry computed fields; don't persist those.
    const { netPay, takeHome, splitSum, hasSplit, taxableWages, isAdj, hasBenSplit, benSum,
      payRate, regH, otH, holH, ptoH, premH, premPayN, hasHours, otPremium, otPay, hoursGross,
      ...e } = raw;
    setEntries((prev) => {
      const i = prev.findIndex((p) => p.id === e.id);
      if (i === -1) return [...prev, e];
      const c = [...prev]; c[i] = e; return c;
    });
    setEditing(null);
    setStatus("Saved.");
  };
  const remove = (id) => { setEntries((p) => p.filter((e) => e.id !== id)); setEditing(null); };

  /* ============================================================== */
  return (
    <div style={{ background: C.paper, color: C.ink, fontFamily: SANS, minHeight: "100%" }} className="p-4 sm:p-6">
      <div className="max-w-6xl mx-auto">

        <Header ytd={ytd} remaining={remaining} flagCount={flagCount} />

        <nav className="flex flex-wrap gap-1 mt-6 mb-4">
          {[["log", "Log"], ["forecast", "Forecast"], ["trends", "Trends"],
            ["checks", `Checks${flagCount ? ` (${flagCount})` : ""}`], ["years", "Past years"], ["tax", "Tax outlook"], ["data", "Backup"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className="px-4 py-2 text-sm rounded-t"
              style={{
                fontWeight: tab === k ? 600 : 400,
                color: tab === k ? C.card : C.muted,
                background: tab === k ? C.ink : "transparent",
              }}>{l}</button>
          ))}
        </nav>

        <SetupBar payType={payType} fc={fc} open={setupOpen} setOpen={setSetupOpen} />
        {setupOpen && (
          <SetupPanel payType={payType} switchPayType={switchPayType} setup={setup} changeSetup={changeSetup}
            fc={fc} setFc={setFc} opening={opening} setOpening={setOpening} onClose={() => setSetupOpen(false)} />
        )}
        <SaveNote syncMode={syncMode} isSample={isSample} entries={entries} lastBackup={lastBackup}
          startOwn={startOwn} goBackup={() => setTab("data")} />
        {status && (
          <div className="mb-4 px-3 py-2 text-sm rounded flex items-start justify-between gap-3"
            style={{ background: C.accentSoft, color: C.accent }}>
            <span>{status}</span>
            <button onClick={() => setStatus("")} style={{ color: C.accent }} className="shrink-0">×</button>
          </div>
        )}

        {tab === "log" && (
          <LogTab rows={rows} editing={editing} setEditing={setEditing} save={save} remove={remove}
            nextPayDate={nextPayDate} />
        )}
        {tab === "forecast" && (
          <ForecastTab fc={fc} setFc={setFc} changeSetup={changeSetup} rows={rows} weekLog={weekLog} setWeekLog={setWeekLog}
            forecasts={forecasts} setForecasts={setForecasts}
            onLog={(entry) => { setEditing(entry); setTab("log"); }} />
        )}
        {tab === "trends" && (
          <TrendsTab rows={real} ytd={ytd} limit={limit} setLimit={setLimit}
            hsaLimit={hsaLimit} setHsaLimit={setHsaLimit}
            hsaEmployer={hsaEmployer} setHsaEmployer={setHsaEmployer}
            hsaEmpPaid={hsaEmpPaid} setHsaEmpPaid={setHsaEmpPaid}
            hsaEmpDate={hsaEmpDate} setHsaEmpDate={setHsaEmpDate}
            projRet={projRet} remaining={remaining} />
        )}
        {tab === "checks" && <ChecksTab rows={rows} />}
        {tab === "tax" && (
          <TaxOutlookTab rows={rows} ytd={ytd} remaining={remaining} fc={fc} tax={tax} setTax={setTax}
            limit={limit} hsaLimit={hsaLimit} hsaEmployer={hsaEmployer}
            hsaEmpPaid={hsaEmpPaid} hsaEmpDate={hsaEmpDate} />
        )}
        {tab === "years" && <PastYearsTab years={years} setYears={setYears} setRemovedYears={setRemovedYears} ytd={ytd} />}
        {tab === "data" && (
          <DataTab rows={rows} exportCSV={exportCSV} importCSV={importCSV}
            csvText={csvText} setCsvText={setCsvText}
            years={years} downloadBackup={downloadBackup} restoreBackup={restoreBackup}
            backupText={backupText} setBackupText={setBackupText}
            confirmReset={confirmReset} setConfirmReset={setConfirmReset}
            reset={() => { setEntries([]); setConfirmReset(false); setStatus("Ledger cleared."); }}
            reseed={() => { const sm = sampleFor(payType, setup); setEntries(sm.entries); setYears(sm.years); setRemovedYears([]); setConfirmReset(false); setStatus("Reloaded the sample year."); }} />
        )}
      </div>
    </div>
  );
}

/* ---------------- header ---------------------------------------- */
function Header({ ytd, remaining, flagCount }) {
  const stat = (label, val, sub) => (
    <div className="px-4 py-3" style={{ borderLeft: `1px solid ${C.rule}` }}>
      <div className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>{label}</div>
      <div className="text-lg mt-1" style={{ fontFamily: MONO, fontWeight: 600 }}>{val}</div>
      {sub && <div className="text-xs mt-0.5" style={{ color: C.muted }}>{sub}</div>}
    </div>
  );
  return (
    <div>
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="text-2xl" style={{ fontWeight: 700, letterSpacing: "-0.02em" }}>Paycheck ledger <span style={{ fontSize: "0.6em", fontWeight: 600, color: C.accent }}>demo</span></h1>
        <div className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>
          2026 · {ytd.count} paycheck{ytd.count === 1 ? "" : "s"} · {remaining} to go
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 mt-4 rounded"
        style={{ background: C.card, border: `1px solid ${C.rule}` }}>
        {stat("Payroll gross YTD", money(ytd.gross), `${ytd.count} paycheck${ytd.count === 1 ? "" : "s"}`)}
        {stat("Taxes YTD", money(ytd.taxTotal), pctS(pct(ytd.taxTotal, ytd.gross)) + " effective")}
        {HAS_RETIRE ? stat("Retirement YTD", money(ytd.retirement), pctS(pct(ytd.retirement, ytd.gross)) + " of gross")
          : stat("Net pay YTD", money(ytd.netPay), "after taxes and benefits")}
        {stat("Take home YTD", money(ytd.takeHome), pctS(pct(ytd.takeHome, ytd.gross)) + " of payroll gross")}
      </div>
      {ytd.adjGross > 0 && (
        <div className="mt-2 rounded px-4 py-3 flex flex-wrap items-baseline gap-x-6 gap-y-1"
          style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <div>
            <span className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>W-2 gross YTD </span>
            <span style={{ fontFamily: MONO, fontWeight: 600 }}>{money(ytd.w2Gross)}</span>
          </div>
          <div className="text-sm" style={{ color: C.muted }}>
            Payroll {money(ytd.gross)} plus {money(ytd.adjGross)} in ESPP adjustments
            {ytd.adjCount > 1 ? ` (${ytd.adjCount} of them)` : ""} — income with no withholding against it.
          </div>
        </div>
      )}
      {flagCount > 0 && (
        <div className="mt-2 text-sm px-3 py-2 rounded" style={{ background: C.redSoft, color: C.red }}>
          {flagCount} {flagCount === 1 ? "row needs" : "rows need"} a look — see Checks.
        </div>
      )}
    </div>
  );
}

/* ---------------- log tab --------------------------------------- */
/* Why this paycheck differs from the one before it, biggest cause first. */
function PaycheckDiff({ rows }) {
  const checks = rows.filter((r) => !r.isAdj && r.gross > 0);
  if (checks.length < 2) return null;
  const now = checks[checks.length - 1], prev = checks[checks.length - 2];
  const lines = [
    ["Gross pay", now.gross - prev.gross, PAY_TYPE === "salary" ? "a raise, or extra pay" : "hours worked, or a rate change"],
    ["Taxes", -(now.taxTotal - prev.taxTotal), "withholding follows gross"],
    ["Benefits", -(now.benefits - prev.benefits), HAS_HSA ? "HSA or dental changed" : "dental changed"],
    [retireLabel(), -(now.retirement - prev.retirement), `${pctLabel(SETUP.retirePct)} of gross`],
    ["ESPP", -(now.espp - prev.espp), "stock contribution"],
    ["Savings transfers", -(now.savings - prev.savings), `${pctLabel(SETUP.savingsPct)} of net pay`],
  ].filter(([, v]) => Math.abs(v) >= 0.01);
  const diff = now.takeHome - prev.takeHome;
  if (!lines.length) return null;
  const biggest = [...lines].sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];

  return (
    <Panel title={`What changed on ${now.label}`}
      note={`Against ${prev.label}, the paycheck before it.`}>
      <div className="px-3 py-2 rounded mb-3" style={{ background: diff >= 0 ? C.greenSoft : C.amberSoft }}>
        <span style={{ color: diff >= 0 ? C.green : C.amber, fontWeight: 600 }}>
          {money(Math.abs(diff))} {diff >= 0 ? "more" : "less"} in checking
        </span>
        <span className="text-sm" style={{ color: diff >= 0 ? C.green : C.amber }}>
          {" "}— mostly {biggest[0].toLowerCase()}, {biggest[1] >= 0 ? "up" : "down"} {money(Math.abs(biggest[1]))} ({biggest[2]})
        </span>
      </div>
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <tbody>
          {lines.map(([label, v, why]) => (
            <tr key={label} style={{ borderBottom: `1px solid ${C.rule}` }}>
              <td className="py-1.5">{label}<div className="text-xs" style={{ color: C.muted }}>{why}</div></td>
              <td className="py-1.5 text-right" style={{ fontFamily: MONO, color: v >= 0 ? C.green : C.red }}>
                {v >= 0 ? "+" : "−"}{money(Math.abs(v))}
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-2" style={{ fontWeight: 700 }}>Landed in checking</td>
            <td className="py-2 text-right" style={{ fontFamily: MONO, fontWeight: 700, color: diff >= 0 ? C.green : C.red }}>
              {diff >= 0 ? "+" : "−"}{money(Math.abs(diff))}
            </td>
          </tr>
        </tbody>
      </table>
    </Panel>
  );
}

function LogTab({ rows, editing, setEditing, save, remove, nextPayDate }) {
  const blank = (type) => ({
    id: `e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, type, date: type === "paycheck" ? (nextPayDate || "") : "",
    label: "", gross: "", taxTotal: "",
    federal: "", socSec: "", medicare: "", state: "",
    // Prefilled from the setup: dental, plus the HSA and ESPP if they have them.
    benefits: type === "adjustment" ? "" : (n(PAY.dental) + (HAS_HSA ? SETUP.hsaAmt : 0)).toFixed(2),
    ...(type === "adjustment" ? {} : { hsa: HAS_HSA ? SETUP.hsaAmt.toFixed(2) : "", dental: n(PAY.dental).toFixed(2) }),
    retirement: "", espp: type !== "adjustment" && HAS_ESPP ? SETUP.esppAmt.toFixed(2) : "", savings: "",
  });
  return (
    <div>
      {editing ? (
        <EntryForm key={editing.id} entry={editing} onSave={save} onCancel={() => setEditing(null)}
          onDelete={rows.some((r) => r.id === editing.id) ? () => remove(editing.id) : null} />
      ) : (
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setEditing(blank("paycheck"))} className="px-4 py-2 rounded text-sm"
            style={{ background: C.ink, color: C.card, fontWeight: 600 }}>
            + Log a paycheck{nextPayDate ? ` — ${nextPayDate}` : ""}
          </button>
          <button onClick={() => setEditing(blank("adjustment"))} className="px-4 py-2 rounded text-sm"
            style={{ border: `1px solid ${C.rule}`, color: C.ink }}>
            + Log a W-2 adjustment
          </button>
        </div>
      )}
      <div className="mb-4"><PaycheckDiff rows={rows} /></div>
      <LedgerTable rows={rows} onEdit={setEditing} />
    </div>
  );
}

/* The signature piece: gross decomposed as you type, with a balance
   readout that lands on zero when every line is accounted for. */
function ReconStrip({ d }) {
  const parts = CATS.map((c) => ({ ...c, val: c.key === "takeHome" ? d.takeHome : d[c.key] }))
    .filter((p) => p.val > 0);
  const total = parts.reduce((s, p) => s + p.val, 0);
  const bal = d.gross - total;
  const ok = Math.abs(bal) < 0.005;
  if (!d.gross) return null;
  return (
    <div className="mt-4">
      <div className="flex h-7 rounded overflow-hidden" style={{ border: `1px solid ${C.rule}` }}>
        {parts.map((p) => (
          <div key={p.key} title={`${p.label} ${money(p.val)}`}
            style={{ width: `${(p.val / d.gross) * 100}%`, background: C[p.ck] }} />
        ))}
        {bal > 0.005 && <div style={{ width: `${(bal / d.gross) * 100}%`, background: C.rule }} />}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: C.muted }}>
        {parts.map((p) => (
          <span key={p.key} className="flex items-center gap-1.5">
            <span style={{ width: 9, height: 9, background: C[p.ck], borderRadius: 2, display: "inline-block" }} />
            {p.label} <span style={{ fontFamily: MONO, color: C.ink }}>{money(p.val)}</span>
            <span>{pctS(pct(p.val, d.gross))}</span>
          </span>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between px-3 py-2 rounded text-sm"
        style={{ background: ok ? C.greenSoft : C.redSoft, color: ok ? C.green : C.red }}>
        <span style={{ fontWeight: 600 }}>
          {ok ? "Balances — every dollar of gross is accounted for" : "Unaccounted"}
        </span>
        <span style={{ fontFamily: MONO }}>{ok ? money(0) : money(bal)}</span>
      </div>
    </div>
  );
}

/* What if: try a different 401k, HSA, ESPP, savings or pay, and see what it
   does to a check and to the year, side by side with today's setup. Nothing
   changes until "Make this my setup". Most useful on salary, where every
   regular check is the same and the question is what a change would do. */
function WhatIfPanel({ fcCalc, f, changeSetup, setFc }) {
  const salaried = PAY_TYPE === "salary";
  const mine = () => ({
    pay: salaried ? n(fcCalc.salary) : n(fcCalc.rate) || curRate(),
    retire: SETUP.retire, retirePct: SETUP.retirePct,
    hsa: SETUP.hsa, hsaAmt: SETUP.hsaAmt, espp: SETUP.espp, esppAmt: SETUP.esppAmt,
    savingsPct: SETUP.savingsPct,
  });
  const [wi, setWi] = useState(mine);
  const set = (patch) => setWi((w) => ({ ...w, ...patch }));
  // When the setup or pay changes elsewhere (or is applied from here), start over from it.
  const mineKey = JSON.stringify(mine());
  useEffect(() => { setWi(mine()); }, [mineKey]);

  const t = forecast({
    ...fcCalc,
    ...(salaried ? { salary: wi.pay } : { rate: wi.pay }),
    hsa: wi.hsa ? wi.hsaAmt : 0, espp: wi.espp ? wi.esppAmt : 0,
    setup: { hsa: wi.hsa, hsaAmt: wi.hsaAmt, retire: wi.retire, retirePct: wi.retirePct,
             espp: wi.espp, esppAmt: wi.esppAmt, savingsPct: wi.savingsPct },
  });
  const incomeTax = (x) => x.federal + x.state;
  const fica = (x) => x.socSec + x.medicare;
  // Gross, income tax and checking always show; the rest only when either
  // side has some (no point showing an HSA row of zeros).
  const lines = [
    ["Gross pay", (x) => x.gross, true],
    ["Income tax (federal + state)", incomeTax, true],
    ["Social Security + Medicare", fica, true],
    ["401k", (x) => x.retirement],
    ["HSA", (x) => x.hsa],
    ["ESPP", (x) => x.espp],
    ["Savings transfers", (x) => x.savings],
    ["Lands in checking", (x) => x.takeHome, true],
  ].filter(([, fn, always]) => always || [f, t].some((x) => Math.abs(fn(x)) > 0.004));
  const changed = JSON.stringify(wi) !== JSON.stringify(mine());
  const d = (fn) => fn(t) - fn(f);
  const word = (v, more, less) => `${money(Math.abs(v))} ${v >= 0 ? more : less}`;
  const notes = [];
  if (Math.abs(d((x) => x.gross)) > 0.004) notes.push(word(d((x) => x.gross), "more gross pay", "less gross pay"));
  if (Math.abs(d((x) => x.retirement)) > 0.004) notes.push(word(d((x) => x.retirement), "more into your 401k", "less into your 401k"));
  if (Math.abs(d((x) => x.hsa)) > 0.004) notes.push(word(d((x) => x.hsa), "more into your HSA", "less into your HSA"));
  if (Math.abs(d(incomeTax)) > 0.004) notes.push(word(d(incomeTax), "more income tax", "less income tax"));
  if (Math.abs(d(fica)) > 0.004) notes.push(word(d(fica), "more Social Security and Medicare", "less Social Security and Medicare"));
  if (Math.abs(d((x) => x.savings)) > 0.004) notes.push(word(d((x) => x.savings), "more to savings", "less to savings"));
  const dCheck = d((x) => x.takeHome);

  const apply = () => {
    changeSetup({ retire: wi.retire, retirePct: wi.retirePct, hsa: wi.hsa, hsaAmt: wi.hsaAmt,
                  espp: wi.espp, esppAmt: wi.esppAmt, savingsPct: wi.savingsPct });
    setFc((x) => ({ ...x, ...(salaried ? { salary: wi.pay } : { rate: wi.pay }) }));
  };
  const field = (label, child) => (
    <div className="space-y-1">
      <div className="text-xs" style={{ color: C.muted }}>{label}</div>
      <div className="flex flex-wrap items-end gap-2">{child}</div>
    </div>
  );

  return (
    <Panel title="What if"
      note={salaried
        ? "Your regular checks are all the same, so the useful question is what a change would do. Try one here; your setup stays as it is until you apply it."
        : "Try a different 401k, HSA, savings or rate, with the same hours as the forecast above. Your setup stays as it is until you apply it."}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {field(salaried ? "Yearly salary $" : "Hourly rate $",
          <div className="w-32"><NumField label="" value={wi.pay} onChange={(v) => set({ pay: v })} /></div>)}
        {field("401k",
          <>
            <Choice label="What-if 401k" options={[["none", "None"], ["roth", "Roth"], ["traditional", "Traditional"]]}
              value={wi.retire} onPick={(v) => set({ retire: v })} />
            {wi.retire !== "none" && <div className="w-24"><NumField label="% of gross" scale={100} value={wi.retirePct} onChange={(v) => set({ retirePct: v })} /></div>}
          </>)}
        {field("HSA",
          <>
            <Choice label="What-if HSA" options={[[true, "Have one"], [false, "None"]]} value={wi.hsa} onPick={(v) => set({ hsa: v })} />
            {wi.hsa && <div className="w-24"><NumField label="Per check $" value={wi.hsaAmt} onChange={(v) => set({ hsaAmt: v })} /></div>}
          </>)}
        {field("ESPP",
          <>
            <Choice label="What-if ESPP" options={[[true, "Have one"], [false, "None"]]} value={wi.espp} onPick={(v) => set({ espp: v })} />
            {wi.espp && <div className="w-24"><NumField label="Per check $" value={wi.esppAmt} onChange={(v) => set({ esppAmt: v })} /></div>}
          </>)}
        {field("Savings transfers",
          <div className="w-24"><NumField label="% of net pay" scale={100} value={wi.savingsPct} onChange={(v) => set({ savingsPct: v })} /></div>)}
      </div>

      <div className="overflow-x-auto mt-4">
        <table className="w-full text-xs sm:text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
              {["Per check", "Now", "What if", "Change", "Per year"].map((c, i) => (
                <th key={c} className={`py-2 text-xs uppercase tracking-wider whitespace-nowrap ${i ? "text-right pl-2" : "text-left"}${i === 4 ? " hidden sm:table-cell" : ""}`} style={{ color: C.muted }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map(([label, fn]) => {
              const delta = fn(t) - fn(f);
              return (
                <tr key={label} style={{ borderBottom: `1px solid ${C.rule}` }}>
                  <td className="py-1.5" style={{ fontWeight: label === "Lands in checking" ? 700 : 400 }}>{label}</td>
                  <td className="py-1.5 pl-2 text-right whitespace-nowrap" style={{ fontFamily: MONO }}>{money(fn(f))}</td>
                  <td className="py-1.5 pl-2 text-right whitespace-nowrap" style={{ fontFamily: MONO, fontWeight: 600 }}>{money(fn(t))}</td>
                  <td className="py-1.5 pl-2 text-right whitespace-nowrap" style={{ fontFamily: MONO, color: Math.abs(delta) < 0.005 ? C.muted : C.ink }}>
                    {Math.abs(delta) < 0.005 ? "—" : `${delta > 0 ? "+" : "−"}${money(Math.abs(delta))}`}
                  </td>
                  <td className="py-1.5 pl-2 text-right whitespace-nowrap hidden sm:table-cell" style={{ fontFamily: MONO, color: C.muted }}>
                    {Math.abs(delta) < 0.005 ? "—" : `${delta > 0 ? "+" : "−"}${money(Math.abs(delta * 26))}`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="text-sm mt-3 px-3 py-2 rounded" style={{ background: changed ? C.accentSoft : C.paper, color: changed ? C.accent : C.muted }}>
        {!changed ? "Change anything above to compare it with your setup."
          : Math.abs(dCheck) < 0.005 && !notes.length ? "No difference to a regular check."
          : <>Each check: {word(dCheck, "more", "less")} in checking{notes.length ? `, with ${notes.join(", ")}` : ""}.
              {" "}Over a year of 26 checks, that's {word(dCheck * 26, "more", "less")} landing in checking.
              {wi.retire === "traditional" && SETUP.retire !== "traditional" && " A traditional 401k is taxed when you take it out in retirement; a Roth isn't."}</>}
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={apply} disabled={!changed} className="px-4 py-2 rounded text-sm"
          style={{ background: changed ? C.ink : C.rule, color: changed ? C.card : C.muted, fontWeight: 600 }}>
          Make this my setup
        </button>
        <button onClick={() => setWi(mine())} disabled={!changed} className="px-3 py-2 rounded text-sm"
          style={{ border: `1px solid ${C.rule}`, color: C.muted }}>Back to my setup</button>
      </div>
    </Panel>
  );
}

/* A short fingerprint of the paychecks, so the app can tell whether anything
   changed since the last backup. */
const ledgerSig = (entries) => {
  const t = JSON.stringify(entries);
  let h = 5381;
  for (let i = 0; i < t.length; i++) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
  return `${entries.length}:${h.toString(36)}`;
};

/* One line saying what this ledger assumes comes out of each check. */
function SetupBar({ payType, fc, open, setOpen }) {
  const parts = [
    payType === "salary" ? `Salary ${money(n(fc.salary))} a year` : `Hourly ${money(curRate())}`,
    HAS_HSA ? `HSA ${money(SETUP.hsaAmt)}` : "No HSA",
    HAS_RETIRE ? `${retireLabel()} ${pctLabel(SETUP.retirePct)}` : "No 401k",
    HAS_ESPP ? `ESPP ${money(SETUP.esppAmt)}` : "No ESPP",
    HAS_SAVINGS ? `Savings ${pctLabel(SETUP.savingsPct)} of net` : "No savings transfers",
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-sm">
      <span style={{ color: C.muted }}>Your setup:</span>
      <span>{parts.join(" · ")}</span>
      <button onClick={() => setOpen(!open)} className="px-3 py-1 rounded text-sm"
        style={{ border: `1px solid ${C.accent}`, color: C.accent, fontWeight: 600 }}>
        {open ? "Close setup" : "Change setup"}
      </button>
    </div>
  );
}

/* A number field that keeps what's typed ("6." on the way to "6.5") and only
   hands back a number. `scale` turns a percent on screen into a fraction. */
function NumField({ label, hint, value, onChange, scale = 1 }) {
  const shown = (v) => String(+(v * scale).toFixed(4));
  const [draft, setDraft] = useState(shown(value));
  useEffect(() => { if (n(draft) / scale !== value) setDraft(shown(value)); }, [value]);
  return <MoneyField label={label} hint={hint} value={draft}
    onChange={(e) => { setDraft(e.target.value); onChange(n(e.target.value) / scale); }} />;
}

function Choice({ label, options, value, onPick }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-2">
      {options.map(([k, l]) => (
        <button key={l} onClick={() => onPick(k)} aria-pressed={value === k}
          className="px-3 py-1 rounded text-sm"
          style={{
            background: value === k ? C.accentSoft : "transparent",
            color: value === k ? C.accent : C.muted,
            border: `1px solid ${value === k ? C.accent : C.rule}`,
            fontWeight: value === k ? 600 : 400,
          }}>{l}</button>
      ))}
    </div>
  );
}

/* First-time setup, and the place to change it later: how you're paid and what
   comes out of each check. Anything you don't have disappears from the app. */
function SetupPanel({ payType, switchPayType, setup, changeSetup, fc, setFc, opening, setOpening, onClose }) {
  // A plain function, not a component, so the fields inside keep focus while typing.
  const section = (title, hint, children) => (
    <div className="py-3" style={{ borderTop: `1px solid ${C.rule}` }}>
      <div className="text-sm" style={{ fontWeight: 600 }}>{title}</div>
      {hint && <div className="text-xs mb-2" style={{ color: C.muted }}>{hint}</div>}
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </div>
  );
  const [showOpening, setShowOpening] = useState(!!n(opening.gross));
  const setOpen = (k) => (e) => setOpening({ ...opening, [k]: e.target.value });
  const openingShown = OPENING_FIELDS.filter(([k]) =>
    !(k === "hsa" && !HAS_HSA) && !(k === "retirement" && !HAS_RETIRE) &&
    !(k === "espp" && !HAS_ESPP) && !(k === "otPay" && payType === "salary"));
  return (
    <div className="mb-4 rounded p-4" style={{ background: C.card, border: `1px solid ${C.accent}` }}>
      <div className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>Set up your ledger</div>
      <div className="text-sm mt-1 mb-2" style={{ color: C.muted }}>
        Match this to your pay stub. Anything you don't have is hidden from the rest of the app.
      </div>

      {section("How you're paid", null, <>
        <Choice label="Paid by" options={[["hourly", "Hourly"], ["salary", "Salary"]]} value={payType} onPick={switchPayType} />
        <div className="w-32">
          {payType === "salary"
            ? <NumField label="Yearly salary $" value={n(fc.salary)} onChange={(v) => setFc((f) => ({ ...f, salary: v }))} />
            : <NumField label="Hourly rate $" value={n(fc.rate)} onChange={(v) => setFc((f) => ({ ...f, rate: v }))} />}
        </div>
      </>)}

      {section("HSA", "Only possible with a high-deductible (CDHP/HDHP) health plan. Comes out before all tax.", <>
        <Choice label="HSA" options={[[true, "Have one"], [false, "None"]]} value={setup.hsa} onPick={(v) => changeSetup({ hsa: v })} />
        {setup.hsa && <div className="w-32"><NumField label="Per check $" value={setup.hsaAmt} onChange={(v) => changeSetup({ hsaAmt: v })} /></div>}
      </>)}

      {section("401k", setup.retire === "traditional"
          ? "Traditional: comes out before federal and state income tax, so less is withheld. Social Security and Medicare still apply."
          : setup.retire === "roth" ? "Roth: comes out after tax. Nothing withheld changes, but withdrawals in retirement are tax-free."
          : "No retirement contribution from your checks.", <>
        <Choice label="401k" options={[["none", "None"], ["roth", "Roth"], ["traditional", "Traditional"]]}
          value={setup.retire} onPick={(v) => changeSetup({ retire: v })} />
        {setup.retire !== "none" && <div className="w-32"><NumField label="% of gross" scale={100} value={setup.retirePct} onChange={(v) => changeSetup({ retirePct: v })} /></div>}
      </>)}

      {section("ESPP", "An employee stock purchase plan: a set amount from each check, after tax.", <>
        <Choice label="ESPP" options={[[true, "Have one"], [false, "None"]]} value={setup.espp} onPick={(v) => changeSetup({ espp: v })} />
        {setup.espp && <div className="w-32"><NumField label="Per check $" value={setup.esppAmt} onChange={(v) => changeSetup({ esppAmt: v })} /></div>}
      </>)}

      {section("Savings transfers", "Part of each check sent straight to savings. 0 if you don't.", <>
        <div className="w-32"><NumField label="% of net pay" scale={100} value={setup.savingsPct} onChange={(v) => changeSetup({ savingsPct: v })} /></div>
      </>)}

      <div className="py-3" style={{ borderTop: `1px solid ${C.rule}` }}>
        <button onClick={() => setShowOpening(!showOpening)} className="text-sm underline" style={{ color: C.accent }}>
          {showOpening ? "Hide starting totals" : "Starting partway through the year?"}
        </button>
        {showOpening && (
          <div className="mt-2">
            <div className="text-xs mb-2" style={{ color: C.muted }}>
              Copy the year-to-date (YTD) column from the last stub <em>before</em> the first paycheck you log here.
              The totals, year-end projection and tax outlook then count the whole year, not just what you've logged.
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {openingShown.map(([k, l]) => (
                <MoneyField key={k} label={l} value={opening[k]} onChange={setOpen(k)} />
              ))}
            </div>
            {n(opening.gross) > 0 && (
              <button onClick={() => setOpening({})} className="mt-2 text-xs underline" style={{ color: C.muted }}>
                Clear starting totals
              </button>
            )}
          </div>
        )}
      </div>

      <button onClick={onClose} className="mt-2 px-4 py-2 rounded text-sm"
        style={{ background: C.ink, color: C.card, fontWeight: 600 }}>Done</button>
    </div>
  );
}

/* Where the ledger is saved, said plainly, and a nudge when there's work that
   hasn't been backed up. */
function SaveNote({ syncMode, isSample, entries, lastBackup, startOwn, goBackup }) {
  const [confirm, setConfirm] = useState(false);
  if (syncMode === "connecting") return <div className="mb-3 text-xs" style={{ color: C.muted }}>Connecting…</div>;
  if (syncMode === "account") return (
    <div className="mb-3 text-xs" style={{ color: C.green }}>Saved to your Claude account — same ledger on your phone and PC.</div>
  );
  const unsaved = !isSample && entries.length > 0 && (!lastBackup || lastBackup.sig !== ledgerSig(entries));
  return (
    <div className="mb-3 text-xs space-y-1" style={{ color: C.muted }}>
      {isSample && (
        <div className="flex flex-wrap items-center gap-2">
          <span>Demo: every figure here is invented. Try anything.</span>
          {!confirm
            ? <button onClick={() => setConfirm(true)} className="underline" style={{ color: C.accent }}>Start my own ledger</button>
            : <>
                <span style={{ color: C.ink }}>This clears the sample year.</span>
                <button onClick={() => { setConfirm(false); startOwn(); }} className="px-2 py-0.5 rounded"
                  style={{ background: C.ink, color: C.card, fontWeight: 600 }}>Clear it and set up</button>
                <button onClick={() => setConfirm(false)} className="underline">Keep the sample</button>
              </>}
        </div>
      )}
      <div>
        Saved in this browser only, on this device. Clearing browsing data or a private window loses it,
        and your other devices won't see it. A backup from the Backup tab can bring it back anywhere.
      </div>
      {unsaved && (
        <div className="flex flex-wrap items-center gap-2 px-2 py-1 rounded" style={{ background: C.amberSoft, color: C.amber }}>
          <span>{lastBackup ? `Changed since your last backup on ${lastBackup.at}.` : "Not backed up yet."}</span>
          <button onClick={goBackup} className="underline" style={{ fontWeight: 600 }}>Back up now</button>
        </div>
      )}
    </div>
  );
}

function MoneyField({ label, hint, value, onChange }) {
  return (
    <label>
      <div className="text-xs mb-1" style={{ color: C.muted }}>{label}</div>
      <input value={value ?? ""} onChange={onChange} inputMode="decimal"
        className="w-full px-2 py-1.5 rounded text-sm"
        style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }} />
      {hint && <div className="text-xs mt-0.5" style={{ color: C.muted }}>{hint}</div>}
    </label>
  );
}

/* Hours entry laid out like the stub's earnings section: one row per line,
   hours on the left, dollars on the right. Straight-time dollars are worked out;
   overtime and premium dollars can be typed straight from the stub. */
function EarningsRows({ f, setF, d }) {
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const rnd = (v) => Math.round(v * 100) / 100;
  const inp = (k, ph) => (
    <input value={f[k] ?? ""} onChange={set(k)} inputMode="decimal" placeholder={ph}
      className="w-full px-2 py-1.5 rounded text-sm text-right"
      style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }} />
  );
  const shown = (v) => (
    <div className="px-2 py-1.5 text-sm text-right" style={{ fontFamily: MONO, color: v ? C.ink : C.muted }}>
      {v ? money(v) : "—"}
    </div>
  );
  const autoOt = rnd(rnd(d.otH * d.payRate) + rnd(d.otH * d.payRate * 0.5));
  const rows = [
    { label: "Regular", hrs: "regHrs", pay: shown(rnd(d.regH * d.payRate)) },
    { label: "Overtime", hrs: "otHrs", pay: inp("otPayAmt", "blank = one rate"),
      note: "Two overtime rates on the stub? Add both lines' hours, and type both lines' dollars added together." },
    { label: "Holiday", hrs: "holHrs", pay: shown(rnd(d.holH * d.payRate)) },
    { label: "PTO", hrs: "ptoHrs", pay: shown(rnd(d.ptoH * d.payRate)) },
    { label: "Premium", hrs: "premHrs", pay: inp("premPay", "stub $"),
      note: "Extra premium lines on a stub — type the dollars." },
  ];

  // Say which box is causing a mismatch rather than just that there is one.
  const gap = rnd(d.gross - d.hoursGross);
  const hints = [];
  if (has(f.premHrs) && !has(f.premPay)) hints.push("Premium hours are filled in but Premium pay $ is empty.");
  if (!has(f.otPayAmt) && d.otH > 0)
    hints.push(`Overtime is being worked out at one rate: ${money(autoOt)}. If your stub shows two overtime rates, type both lines' dollars added together in the overtime Pay box.`);
  if (has(f.otPayAmt) && !has(f.otHrs)) hints.push("Overtime pay is filled in but Overtime hours are empty — they don't change the dollars, but they count toward your hours.");
  const ok = Math.abs(gap) <= 0.02;

  return (
    <div>
      <div className="grid gap-2 items-center" style={{ gridTemplateColumns: "minmax(80px,1fr) minmax(80px,1fr) minmax(100px,1.3fr)" }}>
        <div className="text-xs" style={{ color: C.muted }}>Line</div>
        <div className="text-xs text-right" style={{ color: C.muted }}>Hours</div>
        <div className="text-xs text-right" style={{ color: C.muted }}>Pay</div>
        {rows.map((r) => (
          <React.Fragment key={r.label}>
            <div className="text-sm">{r.label}</div>
            {inp(r.hrs, "0")}
            {r.pay}
            {r.note && (
              <div className="text-xs -mt-1 mb-1" style={{ gridColumn: "1 / -1", color: C.muted }}>{r.note}</div>
            )}
          </React.Fragment>
        ))}
        <div className="text-sm pt-2" style={{ fontWeight: 700, borderTop: `1px solid ${C.rule}` }}>Total</div>
        <div className="text-sm text-right pt-2" style={{ fontFamily: MONO, borderTop: `1px solid ${C.rule}` }}>
          {(d.regH + d.otH + d.holH + d.ptoH + d.premH).toFixed(2)}
        </div>
        <div className="text-sm text-right pt-2 px-2" style={{ fontFamily: MONO, fontWeight: 700, borderTop: `1px solid ${C.rule}` }}>
          {money(d.hoursGross)}
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 text-xs" style={{ color: C.muted }}>
        <span>Hourly rate</span>
        <div style={{ width: 110 }}>{inp("rate", curRate().toFixed(2))}</div>
        <span>leave blank for {curRate().toFixed(2)}</span>
      </div>
      {d.hasHours && n(f.gross) > 0 && (
        <div className="mt-2 px-3 py-2 rounded text-sm"
          style={{ background: ok ? C.greenSoft : C.redSoft, color: ok ? C.green : C.red }}>
          {ok
            ? `Matches gross ${money(d.gross)} ✓`
            : `${money(Math.abs(gap))} ${gap > 0 ? "short of" : "over"} gross ${money(d.gross)}.`}
          {!ok && hints.map((h, i) => <div key={i} className="mt-1">{h}</div>)}
          {d.otPay > 0 && <div className="mt-1" style={{ opacity: 0.85 }}>Qualified overtime premium for the tax deduction: {money(d.otPremium)}</div>}
        </div>
      )}
    </div>
  );
}

function EntryForm({ entry, onSave, onCancel, onDelete }) {
  const [f, setF] = useState(entry);
  const set = (k) => (ev) => setF({ ...f, [k]: ev.target.value });
  const d = derive(f);
  const flags = auditRow(d);

  const autoLabel = () => {
    if (!f.date) return;
    const dt = new Date(f.date + "T12:00:00");
    const m = dt.toLocaleString("en-US", { month: "short" });
    return f.type === "adjustment" ? `${m} adjustment` : `${m} check`;
  };

  // Plain helper, not a nested component — a nested component would be a new
  // function identity each render and React would remount the input mid-keystroke.
  const field = (k, label, hint) => (
    <MoneyField key={k} label={label} hint={hint} value={f[k] ?? ""} onChange={set(k)} />
  );

  const splitSum = d.splitSum;
  const splitOff = d.hasSplit && Math.abs(splitSum - d.taxTotal) > 0.01;

  const isAdj = d.isAdj;

  return (
    <div className="rounded p-4 mb-6" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
      <div className="flex flex-wrap gap-2 mb-4">
        {[["paycheck", "Paycheck"], ["adjustment", "W-2 adjustment"]].map(([k, l]) => (
          <button key={k} onClick={() => setF({ ...f, type: k })}
            className="px-3 py-1.5 rounded text-sm"
            style={{
              background: (f.type || "paycheck") === k ? C.accentSoft : "transparent",
              color: (f.type || "paycheck") === k ? C.accent : C.muted,
              border: `1px solid ${(f.type || "paycheck") === k ? C.accent : C.rule}`,
              fontWeight: (f.type || "paycheck") === k ? 600 : 400,
            }}>{l}</button>
        ))}
        <span className="text-xs self-center" style={{ color: C.muted }}>
          {isAdj
            ? "Income booked to your W-2 with no cash moving — counts in annual gross, stays out of the paycheck trends."
            : "A regular statement with deductions and a net check."}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label>
          <div className="text-xs mb-1" style={{ color: C.muted }}>{isAdj ? "Statement date" : "Pay date"}</div>
          <input type="date" value={f.date || ""} onChange={set("date")}
            className="w-full px-2 py-1.5 rounded text-sm"
            style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }} />
        </label>
        <label>
          <div className="text-xs mb-1" style={{ color: C.muted }}>Label</div>
          <input value={f.label ?? ""} onChange={set("label")}
            placeholder={isAdj ? "ESPP adjustment" : (autoLabel() || "Sep check")}
            className="w-full px-2 py-1.5 rounded text-sm"
            style={{ border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }} />
        </label>
        {field("gross", isAdj ? "Earnings amount" : "Gross pay")}
        {!isAdj && field("benefits", "Benefits total", HAS_HSA ? "HSA + dental" : "Dental")}
      </div>

      {isAdj && (
        <label className="block mt-3">
          <div className="text-xs mb-1" style={{ color: C.muted }}>Note</div>
          <input value={f.note ?? ""} onChange={set("note")}
            placeholder="What this was — e.g. a stock sale"
            className="w-full px-2 py-1.5 rounded text-sm"
            style={{ border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }} />
        </label>
      )}

      {!isAdj && (
      <>
      {PAY_TYPE !== "salary" && (
      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.rule}` }}>
        <div className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>
          Earnings <span style={{ textTransform: "none", letterSpacing: 0 }}>— copy each line from the stub, optional</span>
        </div>
        <EarningsRows f={f} setF={setF} d={d} />
      </div>
      )}

      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.rule}` }}>
        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>Statutory</div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {field("taxTotal", "Tax total")}
          {TAX_PARTS.map((p) => field(p.key, p.label))}
        </div>
        {d.hasSplit && (
          <div className="mt-2 text-xs" style={{ color: splitOff ? C.red : C.green, fontFamily: MONO }}>
            Split adds to {money(splitSum)}{splitOff ? ` — total says ${money(d.taxTotal)}` : " ✓"}
          </div>
        )}
        {!d.hasSplit && d.taxTotal > 0 && (
          <div className="mt-2 text-xs" style={{ color: C.muted }}>
            The four sub-lines are optional. Fill them in and the app checks Medicare and Social Security against the stub for you.
          </div>
        )}
      </div>

      <div className="mt-5 pt-4" style={{ borderTop: `1px solid ${C.rule}` }}>
        <div className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>Other deductions and routing</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {HAS_HSA && field("hsa", "HSA", "Pre-tax, skips FICA too")}
          {field("dental", "Dental premium")}
          {HAS_RETIRE && field("retirement", retireLabel())}
          {HAS_ESPP && field("espp", "ESPP stock")}
          {HAS_SAVINGS && field("savings", "Savings transfers", "Moved to savings")}
          {field("stubCheck", "Check per stub", "Optional cross-check")}
        </div>
      </div>
      </>
      )}

      {!isAdj && <ReconStrip d={d} />}

      {flags.length > 0 && (
        <div className="mt-3 space-y-1">
          {flags.map((fl, i) => (
            <div key={i} className="text-xs px-2 py-1.5 rounded"
              style={{
                background: fl.level === "bad" ? C.redSoft : fl.level === "warn" ? C.amberSoft : C.paper,
                color: fl.level === "bad" ? C.red : fl.level === "warn" ? C.amber : C.muted,
              }}>{fl.msg}</div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button onClick={() => onSave({ ...f, label: f.label || autoLabel() || "Paycheck" })}
          disabled={!f.date || !n(f.gross)}
          className="px-4 py-2 rounded text-sm"
          style={{
            background: !f.date || !n(f.gross) ? C.rule : C.ink,
            color: !f.date || !n(f.gross) ? C.muted : C.card, fontWeight: 600,
          }}>Save paycheck</button>
        <button onClick={onCancel} className="px-4 py-2 rounded text-sm"
          style={{ border: `1px solid ${C.rule}`, color: C.ink }}>Cancel</button>
        {onDelete && (
          <button onClick={onDelete} className="px-4 py-2 rounded text-sm ml-auto"
            style={{ color: C.red }}>Delete</button>
        )}
      </div>
    </div>
  );
}

function LedgerTable({ rows, onEdit }) {
  if (!rows.length) {
    return (
      <div className="rounded p-8 text-center" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
        <div style={{ fontWeight: 600 }}>No paychecks logged yet</div>
        <div className="text-sm mt-1" style={{ color: C.muted }}>
          Log one above, or restore a CSV from the Backup tab.
        </div>
      </div>
    );
  }
  // Columns for what this setup has; no 401k, ESPP or savings means no column.
  const money7 = [["Gross", "gross"], ["Taxes", "taxTotal"], ["Benefits", "benefits"], ["Retirement", "retirement"],
    ["ESPP", "espp"], ["Savings", "savings"], ["Take home", "takeHome"]]
    .filter(([, k]) => !(k === "retirement" && !HAS_RETIRE) && !(k === "espp" && !HAS_ESPP) && !(k === "savings" && !HAS_SAVINGS));
  const cols = [...money7.map(([c]) => c), "Tax %", "TH %"];
  return (
    <div className="rounded overflow-x-auto" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
      <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
            <th className="text-left px-3 py-2 text-xs uppercase tracking-wider" style={{ color: C.muted }}>Paycheck</th>
            {cols.map((c) => (
              <th key={c} className="text-right px-3 py-2 text-xs uppercase tracking-wider whitespace-nowrap"
                style={{ color: C.muted }}>{c}</th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const flags = auditRow(r).filter((f) => f.level !== "info");
            return (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.rule}` }}>
                <td className="px-3 py-2 whitespace-nowrap">
                  <div style={{ fontWeight: 600 }}>
                    {r.label}
                    {r.isAdj && (
                      <span className="ml-2 text-xs px-1.5 py-0.5 rounded align-middle"
                        style={{ background: C.amberSoft, color: C.amber, fontWeight: 600 }}>W-2 adj</span>
                    )}
                  </div>
                  <div className="text-xs" style={{ color: C.muted, fontFamily: MONO }}>{r.date}</div>
                </td>
                {money7.map(([, k]) => r[k]).map((v, i) => (
                  <td key={i} className="text-right px-3 py-2 whitespace-nowrap" style={{ fontFamily: MONO }}>
                    {r.isAdj && i > 0 ? <span style={{ color: C.rule }}>—</span> : money(v)}
                  </td>
                ))}
                <td className="text-right px-3 py-2" style={{ fontFamily: MONO, color: C.muted }}>
                  {r.isAdj ? "—" : pctS(pct(r.taxTotal, r.gross))}
                </td>
                <td className="text-right px-3 py-2" style={{ fontFamily: MONO, color: C.muted }}>
                  {r.isAdj ? "—" : pctS(pct(r.takeHome, r.gross))}
                </td>
                <td className="px-2 py-2 text-right whitespace-nowrap">
                  {flags.length > 0 && (
                    <span title={flags.map((f) => f.msg).join("\n")}
                      className="text-xs px-1.5 py-0.5 rounded mr-1"
                      style={{ background: C.redSoft, color: C.red }}>!</span>
                  )}
                  <button onClick={() => onEdit(r)} className="text-xs underline" style={{ color: C.accent }}>edit</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- trends ---------------------------------------- */
function TrendsTab({ rows, ytd, limit, setLimit, hsaLimit, setHsaLimit,
                    hsaEmployer, setHsaEmployer, hsaEmpPaid, setHsaEmpPaid,
                    hsaEmpDate, setHsaEmpDate, projRet, remaining }) {
  const data = rows.map((r) => ({
    name: r.label.replace(" Pay", " P"),
    gross: +r.gross.toFixed(2),
    takeHome: +r.takeHome.toFixed(2),
    taxPct: +pct(r.taxTotal, r.gross).toFixed(2),
    thPct: +pct(r.takeHome, r.gross).toFixed(2),
    taxes: +r.taxTotal.toFixed(2),
    retirement: +r.retirement.toFixed(2),
    savings: +r.savings.toFixed(2),
    espp: +r.espp.toFixed(2),
  }));
  const over = projRet > limit;

  if (!rows.length) return <Empty />;

  return (
    <div className="space-y-4">
      <Projection rows={rows} ytd={ytd} remaining={remaining} />

      {HAS_RETIRE && <Panel title={`${retireLabel()} pacing`}
        note="Roth and traditional contributions both count against the annual elective deferral limit. Check this year's figure and set it here.">
        <div className="flex flex-wrap items-end gap-6">
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>Contributed</div>
            <div className="text-2xl" style={{ fontFamily: MONO, fontWeight: 600 }}>{money(ytd.retirement)}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>
              Projected ({remaining} checks left)
            </div>
            <div className="text-2xl" style={{ fontFamily: MONO, fontWeight: 600, color: over ? C.red : C.ink }}>
              {money(projRet)}
            </div>
          </div>
          <label>
            <div className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Annual limit</div>
            <input value={limit} onChange={(e) => setLimit(n(e.target.value))}
              className="px-2 py-1.5 rounded text-sm w-32"
              style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper }} />
          </label>
        </div>
        <div className="mt-4 h-4 rounded overflow-hidden" style={{ background: C.rule }}>
          <div style={{ width: `${Math.min(100, (ytd.retirement / limit) * 100)}%`, background: C.accent, height: "100%", float: "left" }} />
          <div style={{ width: `${Math.min(100 - (ytd.retirement / limit) * 100, ((projRet - ytd.retirement) / limit) * 100)}%`, background: C.accentSoft, height: "100%", float: "left" }} />
        </div>
        <div className="text-sm mt-2" style={{ color: over ? C.red : C.muted }}>
          {over
            ? `On pace to exceed the limit by ${money(projRet - limit)}. Payroll usually caps this automatically, but worth confirming.`
            : `Room to spare: ${money(limit - projRet)} under the limit at your current rate.`}
        </div>
      </Panel>}

      {HAS_HSA && <HsaPanel ytd={ytd} remaining={remaining} hsaLimit={hsaLimit} setHsaLimit={setHsaLimit}
        hsaEmployer={hsaEmployer} setHsaEmployer={setHsaEmployer}
        hsaEmpPaid={hsaEmpPaid} setHsaEmpPaid={setHsaEmpPaid}
        hsaEmpDate={hsaEmpDate} setHsaEmpDate={setHsaEmpDate} />}

      <Panel title="Gross vs. what lands in checking">
        <SvgBars data={data} series={[["gross", "Gross", C.barMuted], ["takeHome", "Take home", C.green]]}
          fmt={(v) => `$${(v / 1000).toFixed(1)}k`} tip={money} />
      </Panel>

      <Panel title="Effective tax rate by paycheck"
        note="This moves with gross, since withholding is calculated as if every check repeated all year.">
        <SvgLines data={data} series={[["taxPct", "Tax %", C.red], ["thPct", "Take home %", C.green]]}
          refLine={+pct(ytd.taxTotal, ytd.gross).toFixed(2)} refLabel="YTD avg tax" />
      </Panel>

      {PAY_TYPE !== "salary" && <HoursPanel rows={rows} />}

      {PAY_TYPE !== "salary" && <OvertimePanel rows={rows} ytd={ytd} remaining={remaining} />}

      <TaxMix rows={rows} ytd={ytd} />

      <Panel title="Where the year has gone">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ["Gross", ytd.gross], ["Taxes", ytd.taxTotal], ["Benefits", ytd.benefits],
            ["Retirement", ytd.retirement], ["ESPP", ytd.espp], ["Savings", ytd.savings],
            ["Net pay", ytd.netPay], ["Take home", ytd.takeHome],
          ].filter(([l]) => !(l === "Retirement" && !HAS_RETIRE) && !(l === "ESPP" && !HAS_ESPP) && !(l === "Savings" && !HAS_SAVINGS)).map(([l, v]) => (
            <div key={l} className="px-3 py-2 rounded" style={{ background: C.paper }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>{l}</div>
              <div style={{ fontFamily: MONO, fontWeight: 600 }}>{money(v)}</div>
              <div className="text-xs" style={{ color: C.muted, fontFamily: MONO }}>
                {l === "Gross" ? "—" : pctS(pct(v, ytd.gross))}
              </div>
            </div>
          ))}
        </div>
        <div className="text-sm mt-3 space-y-2" style={{ color: C.muted }}>
          <p>Net pay is everything left after deductions.{HAS_SAVINGS
            ? <> Take home is what reaches checking after your savings transfers — {money(ytd.savings)} of it has been routed away so far.</>
            : " With no savings transfers, it all reaches checking."}</p>
          {ytd.adjGross > 0 && (
            <p>Every figure on this tab covers payroll only. The {money(ytd.adjGross)} of ESPP adjustment income
            sits outside it — taxable on your W-2, but never a paycheck and never withheld against.</p>
          )}
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- checks ---------------------------------------- */
/* Only meaningful once the four sub-lines are filled in — until then the app
   has a tax total and nothing to break it into. */
/* Straight-line projection: average what's happened so far, apply it to the
   checks still to come. Honest about being an average, not a forecast. */
function Projection({ rows, ytd, remaining }) {
  if (!rows.length) return null;
  const logged = ytd.count;   // includes paychecks covered by starting totals
  const total = logged + remaining;
  const avg = (k) => ytd[k] / logged;
  const proj = (k) => ytd[k] + avg(k) * remaining;

  const gs = rows.map((r) => r.gross).sort((a, b) => a - b);
  const mid = Math.floor(gs.length / 2);
  const median = gs.length % 2 ? gs[mid] : (gs[mid - 1] + gs[mid]) / 2;
  const spread = gs[gs.length - 1] - gs[0];
  const lowest = rows.find((r) => r.gross === gs[0]);
  const highest = rows.find((r) => r.gross === gs[gs.length - 1]);

  const lines = [
    ["Payroll gross", "gross", true],
    ["Taxes", "taxTotal", false],
    ["Benefits", "benefits", false],
    [retireLabel(), "retirement", false],
    ["ESPP", "espp", false],
    ["Savings", "savings", false],
    ["Take home", "takeHome", true],
  ].filter(([, k]) => !(k === "retirement" && !HAS_RETIRE) && !(k === "espp" && !HAS_ESPP) && !(k === "savings" && !HAS_SAVINGS));

  const projGross = proj("gross");
  const projW2 = projGross + ytd.adjGross;
  const building = proj("retirement") + proj("espp") + proj("savings");

  return (
    <>
      <Panel title="Year-end projection"
        note={`Each remaining check assumed to match your average so far. ${logged} of ${total} pay periods are in.`}>
        <div className="h-2 rounded mb-4 overflow-hidden" style={{ background: C.rule }}>
          <div style={{ width: `${(logged / total) * 100}%`, background: C.accent, height: "100%" }} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
                <th className="text-left py-2 text-xs uppercase tracking-wider" style={{ color: C.muted }}>Line</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider" style={{ color: C.muted }}>Per check</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider" style={{ color: C.muted }}>So far</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider" style={{ color: C.muted }}>Still to come</th>
                <th className="text-right py-2 text-xs uppercase tracking-wider" style={{ color: C.muted }}>Full year</th>
              </tr>
            </thead>
            <tbody>
              {lines.map(([label, k, bold]) => (
                <tr key={k} style={{ borderBottom: `1px solid ${C.rule}` }}>
                  <td className="py-2" style={{ fontWeight: bold ? 700 : 400 }}>{label}</td>
                  <td className="py-2 text-right" style={{ fontFamily: MONO, color: C.muted }}>{money(avg(k))}</td>
                  <td className="py-2 text-right" style={{ fontFamily: MONO }}>{money(ytd[k])}</td>
                  <td className="py-2 text-right" style={{ fontFamily: MONO, color: C.muted }}>
                    {money(avg(k) * remaining)}
                  </td>
                  <td className="py-2 text-right" style={{ fontFamily: MONO, fontWeight: bold ? 700 : 600 }}>
                    {money(proj(k))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {ytd.adjGross > 0 && (
          <div className="mt-3 px-3 py-2 rounded text-sm" style={{ background: C.amberSoft, color: C.amber }}>
            Projected W-2 gross <strong style={{ fontFamily: MONO }}>{money(projW2)}</strong> — payroll plus
            {" "}{money(ytd.adjGross)} of ESPP income that had nothing withheld against it.
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <Stat label="Set aside: savings, stock and retirement" value={money(building)}
            sub={`${pctS(pct(building, projGross))} of projected gross`} />
          <Stat label="Projected effective tax rate" value={pctS(pct(proj("taxTotal"), projGross))}
            sub="Payroll withholding only" />
          <Stat label="Projected take home" value={money(proj("takeHome"))}
            sub={`${money(proj("takeHome") / 12)} a month`} />
        </div>
      </Panel>

      <Panel title="How much your checks move"
        note="Gross swings with your Regular / Holiday / PTO hour mix, which is why the tax rate moves too.">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="Average" value={money(avg("gross"))} />
          <Stat label="Median" value={money(median)} />
          <Stat label="Lowest" value={money(gs[0])} sub={lowest ? lowest.label : ""} />
          <Stat label="Highest" value={money(gs[gs.length - 1])} sub={highest ? highest.label : ""} />
        </div>
        <div className="text-sm mt-3" style={{ color: C.muted }}>
          {money(spread)} between your smallest and largest check — {pctS(pct(spread, avg("gross")))} of
          an average one. Withholding is calculated as though every check repeated all year, so a big
          check is taxed at a higher rate than your actual annual income warrants, and a small one lower.
          It evens out at filing.
        </div>
      </Panel>
    </>
  );
}

function Stat({ label, value, sub }) {
  return (
    <div className="px-3 py-2 rounded" style={{ background: C.paper }}>
      <div className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>{label}</div>
      <div className="text-lg" style={{ fontFamily: MONO, fontWeight: 600 }}>{value}</div>
      {sub && <div className="text-xs" style={{ color: C.muted }}>{sub}</div>}
    </div>
  );
}

/* The HSA is the only line here that escapes income tax AND FICA, which makes
   it behave differently from the Roth 401k sitting next to it on the stub. */
function HsaPanel({ ytd, remaining, hsaLimit, setHsaLimit, hsaEmployer, setHsaEmployer,
                    hsaEmpPaid, setHsaEmpPaid, hsaEmpDate, setHsaEmpDate }) {
  if (!ytd.count || ytd.hsa <= 0) return null;
  const perCheck = ytd.hsa / ytd.count;
  const projMine = ytd.hsa + perCheck * remaining;
  const employer = n(hsaEmployer);
  const projTotal = projMine + employer;
  const room = hsaLimit - projTotal;
  const over = room < 0;
  const ficaSaved = projMine * 0.0765; // only your own payroll contributions dodge FICA
  const barW = (v) => `${Math.max(0, Math.min(100, (v / hsaLimit) * 100))}%`;
  const today = new Date().toISOString().slice(0, 10);
  const overdue = !hsaEmpPaid && hsaEmpDate && today > hsaEmpDate;
  // Only warn about the late deposit when the cap is actually in reach.
  const near = projTotal > hsaLimit * 0.85;
  const periods = ytd.count + remaining;
  const capPerCheck = periods ? (hsaLimit - employer) / periods : 0;
  const roomLeft = hsaLimit - employer - ytd.hsa;

  return (
    <Panel title="HSA pacing"
      note="Your payroll contributions avoid federal, state, Social Security and Medicare. Your employer's contribution counts against the same annual cap, so it's included here.">
      <div className="flex flex-wrap items-end gap-4">
        <Stat label="Yours so far this year" value={money(ytd.hsa)} sub={`${money(perCheck)} per check`} />
        <Stat label="Employer" value={money(employer)}
          sub={hsaEmpPaid ? "Deposited" : (hsaEmpDate ? `Expected ${hsaEmpDate}` : "Not deposited yet")} />
        <Stat label={`Projected total (${remaining} checks left)`} value={money(projTotal)} />
        <label>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Annual limit</div>
          <input value={hsaLimit} onChange={(e) => setHsaLimit(n(e.target.value))}
            className="px-2 py-1.5 rounded text-sm w-28"
            style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper }} />
        </label>
        <label>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Employer adds</div>
          <input value={hsaEmployer} onChange={(e) => setHsaEmployer(n(e.target.value))}
            className="px-2 py-1.5 rounded text-sm w-28"
            style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper }} />
        </label>
        <label>
          <div className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Expected</div>
          <input type="date" value={hsaEmpDate || ""} onChange={(e) => setHsaEmpDate(e.target.value)}
            className="px-2 py-1.5 rounded text-sm"
            style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper }} />
        </label>
        <button onClick={() => setHsaEmpPaid(!hsaEmpPaid)} className="px-3 py-1.5 rounded text-sm"
          style={{
            border: `1px solid ${hsaEmpPaid ? C.green : C.rule}`,
            background: hsaEmpPaid ? C.greenSoft : "transparent",
            color: hsaEmpPaid ? C.green : C.muted, fontWeight: 600,
          }}>
          {hsaEmpPaid ? "Employer deposit received" : "Mark employer deposit received"}
        </button>
      </div>

      <div className="mt-4 flex h-5 rounded overflow-hidden" style={{ background: C.rule }}>
        <div title={`Yours so far ${money(ytd.hsa)}`} style={{ width: barW(ytd.hsa), background: C.accent }} />
        <div title={`Still to come ${money(projMine - ytd.hsa)}`} style={{ width: barW(projMine - ytd.hsa), background: C.accentSoft }} />
        <div title={`Employer ${money(employer)}`} style={{ width: barW(employer), background: C.amber }} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs" style={{ color: C.muted }}>
        <span><span style={{ width: 9, height: 9, background: C.accent, borderRadius: 2, display: "inline-block", marginRight: 5 }} />Contributed</span>
        <span><span style={{ width: 9, height: 9, background: C.accentSoft, borderRadius: 2, display: "inline-block", marginRight: 5 }} />Still to come</span>
        <span><span style={{ width: 9, height: 9, background: C.amber, borderRadius: 2, display: "inline-block", marginRight: 5 }} />Employer</span>
      </div>

      <div className="text-sm mt-3" style={{ color: over ? C.red : C.muted }}>
        {over
          ? `On pace to exceed the cap by ${money(-room)} once the employer's ${money(employer)} is counted. Excess contributions carry a penalty unless they're withdrawn in time.`
          : `${money(room)} of room left after counting the employer's ${money(employer)} — ${pctS(pct(projTotal, hsaLimit))} of the cap used.`}
      </div>
      <div className="text-sm mt-3 px-3 py-2 rounded" style={{ background: C.paper, color: C.muted }}>
        These are this year's contributions, not your account balance. An HSA carries over, so the
        balance includes prior years and money your employer deposited last December — none of which
        counts against this year's cap. Compare against your custodian's year-to-date contribution
        figure, not the balance.
      </div>

      {roomLeft > 0 && remaining > 0 && (
        <CatchUp roomLeft={roomLeft} remaining={remaining} perCheck={perCheck} />
      )}

      {overdue && (
        <div className="text-sm mt-3 px-3 py-2 rounded" style={{ background: C.amberSoft, color: C.amber }}>
          The employer deposit was expected by {hsaEmpDate} and isn't marked received. Worth checking
          your HSA statement — if it didn't land, that's {money(employer)} you're owed.
        </div>
      )}
      {!hsaEmpPaid && employer > 0 && !over && near && (
        <div className="text-sm mt-3 px-3 py-2 rounded" style={{ background: C.amberSoft, color: C.amber }}>
          You're close to the cap and the employer's {money(employer)} hasn't landed yet, so your
          account balance reads {money(employer)} lower than the cap math above. Leave that much room
          or the deposit pushes you over.
        </div>
      )}
      {!over && !near && (
        <div className="text-sm mt-3" style={{ color: C.muted }}>
          No risk of overshooting at this rate. Hitting the cap would take about {money(capPerCheck)} per
          check across {periods} pay periods, after allowing for the employer's {money(employer)}.
        </div>
      )}
      <div className="text-sm mt-3 px-3 py-2 rounded" style={{ background: C.accentSoft, color: C.accent }}>
        Payroll HSA contributions skip Social Security and Medicare as well as income tax — about
        {" "}{money(ficaSaved)} of FICA avoided on your {money(projMine)}.{SETUP.retire === "roth" ? " Your Roth 401k gets neither break; it's post-tax going in."
          : SETUP.retire === "traditional" ? " Your traditional 401k skips income tax but not Social Security or Medicare." : ""}
      </div>
    </Panel>
  );
}

/* The later a contribution change takes effect, the fewer checks are left to
   spread it over — so the per-check number climbs fast. Worth seeing before
   committing to a date. */
function CatchUp({ roomLeft, remaining, perCheck }) {
  const [applies, setApplies] = useState(remaining);
  const atOld = Math.max(0, remaining - applies);
  const needed = applies > 0 ? (roomLeft - perCheck * atOld) / applies : 0;
  const hit = needed - perCheck;

  return (
    <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.rule}` }}>
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>
        If you want to use the full cap
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label>
          <div className="text-xs mb-1" style={{ color: C.muted }}>New amount applies to</div>
          <select value={applies} onChange={(e) => setApplies(parseInt(e.target.value, 10))}
            className="px-2 py-1.5 rounded text-sm"
            style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }}>
            {Array.from({ length: remaining }, (_, i) => remaining - i).map((v) => (
              <option key={v} value={v}>{v} {v === 1 ? "check" : "checks"}</option>
            ))}
          </select>
        </label>
        <Stat label="Needed per check" value={money(needed)}
          sub={atOld > 0 ? `${atOld} still at ${money(perCheck)}` : "starting with your next check"} />
        <Stat label="Take-home impact" value={`-${money(hit)}`} sub="per check, before tax savings" />
      </div>
      <div className="text-sm mt-3" style={{ color: needed > 800 ? C.red : C.muted }}>
        {needed > 800
          ? "That's a steep per-check amount. Check whether your plan allows a one-off lump contribution instead — though money added outside payroll misses the FICA break."
          : `Every pay period you wait pushes this number up, since the same ${money(roomLeft)} has fewer checks to spread across.`}
      </div>
    </div>
  );
}

function HoursField({ label, value, onChange, hint }) {
  return (
    <label>
      <div className="text-xs mb-1" style={{ color: C.muted }}>{label}</div>
      <input value={value ?? ""} onChange={onChange} inputMode="decimal" placeholder="0"
        className="w-full px-2 py-1.5 rounded text-sm"
        style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }} />
      {hint && <div className="text-xs mt-0.5" style={{ color: C.muted }}>{hint}</div>}
    </label>
  );
}

/* The signature of this tab: a predicted stub laid out the way the real one
   is, so it can be read side by side against the statement when it arrives. */
function PredictedStub({ f }) {
  const line = (label, amount, opts = {}) => (
    <div className="flex justify-between py-1" style={opts.rule ? { borderTop: `1px solid ${C.rule}` } : {}}>
      <span style={{ color: opts.dim ? C.muted : C.ink, paddingLeft: opts.indent ? 12 : 0 }}>{label}</span>
      <span style={{ fontFamily: MONO, fontWeight: opts.bold ? 700 : 400 }}>
        {opts.neg ? `-${money(amount)}` : money(amount)}
      </span>
    </div>
  );
  return (
    <div className="text-sm">
      <div className="text-xs uppercase tracking-wider mb-1" style={{ color: C.muted }}>Earnings</div>
      {f.weeks.map((w, i) => (
        <React.Fragment key={i}>
          {w.reg + w.hol + w.pto > 0 &&
            line(`Week ${i + 1} straight · ${(w.reg + w.hol + w.pto).toFixed(2)} hrs`, w.straight, { indent: true, dim: true })}
          {w.ot > 0 &&
            line(`Week ${i + 1} overtime · ${w.ot.toFixed(2)} hrs @ 1.5x`, w.premium, { indent: true, dim: true })}
        </React.Fragment>
      ))}
      {f.salaryPay > 0 &&
        line(`Salary · ${money(f.salary)} a year ÷ 26`, f.salaryPay, { indent: true, dim: true })}
      {f.premPay > 0 &&
        line(`${PAY_TYPE === "salary" ? "Bonus or extra pay" : "Premium pay"}${PAY_TYPE !== "salary" && f.premHrs ? ` · ${f.premHrs.toFixed(2)} hrs` : ""}`, f.premPay, { indent: true, dim: true })}
      {line("Gross pay", f.gross, { bold: true, rule: true })}

      <div className="text-xs uppercase tracking-wider mt-4 mb-1" style={{ color: C.muted }}>Statutory</div>
      {line("Federal income tax", f.federal, { indent: true, neg: true })}
      {line("Social Security", f.socSec, { indent: true, neg: true })}
      {line("Medicare", f.medicare, { indent: true, neg: true })}
      {line("State income tax", f.state, { indent: true, neg: true })}

      <div className="text-xs uppercase tracking-wider mt-4 mb-1" style={{ color: C.muted }}>Other</div>
      {line("Dental", f.dental, { indent: true, neg: true })}
      {HAS_HSA && line("HSA", f.hsa, { indent: true, neg: true })}
      {HAS_RETIRE && line(retireLabel(), f.retirement, { indent: true, neg: true })}
      {HAS_ESPP && line("ESPP stock", f.espp, { indent: true, neg: true })}

      {line("Net pay", f.netPay, { bold: true, rule: true })}
      {HAS_SAVINGS && line("Savings transfers", f.savings, { indent: true, neg: true, dim: true })}
      {line("Lands in checking", f.takeHome, { bold: true, rule: true })}
    </div>
  );
}

/* Jot overtime as each week closes. Every week names the paycheck it lands on,
   so the forecast is already current by the time payday arrives. */
function WeekLogPanel({ weekLog, setWeekLog, payDate, rate, rows }) {
  const today = iso(new Date());
  const thisSat = saturdayOf(today);
  const forecastKeys = weekEndingsFor(payDate);

  /* Once a paycheck is logged it IS the record for its two weeks — the stub
     gives period totals, so re-typing the weeks adds nothing and the blank
     boxes used to report zero overtime for weeks that plainly had some.
     Show a week only while its paycheck is still outstanding. */
  const paidDates = new Set(rows.filter((r) => !r.isAdj && r.gross > 0).map((r) => r.date));
  const candidates = [];
  for (let i = 5; i >= -1; i--) candidates.push(addDays(thisSat, -7 * i));
  const weeks = candidates.filter((w) => {
    if (forecastKeys.includes(w)) return true;            // always show the forecast's own weeks
    return !paidDates.has(payDateForWeek(w, payDate));    // otherwise only if still unpaid
  });
  const hiddenCount = candidates.length - weeks.length;

  /* Overtime already banked, read from the paychecks themselves. */
  const logged = rows.filter((r) => !r.isAdj);
  const loggedOtHours = logged.reduce((s, r) => s + n(r.otH), 0);
  const loggedOtPay = logged.reduce((s, r) => s + n(r.otPay), 0);
  const loggedPremium = logged.reduce((s, r) => s + n(r.otPremium), 0);

  const setField = (key, k) => (e) =>
    setWeekLog({ ...weekLog, [key]: { ...(weekLog[key] || BLANK_WEEK), [k]: e.target.value } });

  const cell = (key, k, ph) => (
    <input value={(weekLog[key] || {})[k] ?? ""} onChange={setField(key, k)} inputMode="decimal" placeholder={ph}
      className="w-full px-2 py-1 rounded text-sm text-right"
      style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }} />
  );

  const otTotal = weeks.reduce((sum, w) => sum + n((weekLog[w] || {}).ot), 0);
  const premium = Math.round(otTotal * n(rate) * 0.5 * 100) / 100;

  return (
    <Panel title="Week log"
      note="Sunday to Saturday. Fill in a week when it closes and the forecast below updates itself.">
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
              {["Week", "Paid on", "Regular", "Overtime", "Holiday", "PTO"].map((c, i) => (
                <th key={c} className={`py-2 text-xs uppercase tracking-wider ${i > 1 ? "text-right" : "text-left"}`}
                  style={{ color: C.muted }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((w) => {
              const inForecast = forecastKeys.includes(w);
              const future = w > thisSat;
              const pd = payDateForWeek(w, payDate);
              return (
                <tr key={w} style={{
                  borderBottom: `1px solid ${C.rule}`,
                  background: inForecast ? C.accentSoft : "transparent",
                }}>
                  <td className="py-1.5 whitespace-nowrap">
                    {weekLabel(w)}
                    {future && <span className="text-xs" style={{ color: C.muted }}> · not yet</span>}
                    {w === thisSat && <span className="text-xs" style={{ color: C.muted }}> · this week</span>}
                  </td>
                  <td className="py-1.5 text-xs whitespace-nowrap" style={{ color: inForecast ? C.accent : C.muted, fontFamily: MONO }}>
                    {pd}{inForecast ? " ←" : ""}
                  </td>
                  <td className="py-1.5 pl-2" style={{ width: 84 }}>{cell(w, "reg", "40")}</td>
                  <td className="py-1.5 pl-2" style={{ width: 84 }}>{cell(w, "ot", "0")}</td>
                  <td className="py-1.5 pl-2" style={{ width: 84 }}>{cell(w, "hol", "0")}</td>
                  <td className="py-1.5 pl-2" style={{ width: 84 }}>{cell(w, "pto", "0")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 text-sm space-y-1" style={{ color: C.muted }}>
        <div>
          <span style={{ color: C.ink, fontWeight: 600 }}>Not yet paid:</span>{" "}
          {otTotal.toFixed(2)} overtime hours · {money(otTotal * n(rate) * 1.5)} of overtime pay
          · {money(premium)} qualifying
        </div>
        <div>
          <span style={{ color: C.ink, fontWeight: 600 }}>Already banked this year:</span>{" "}
          {loggedOtHours.toFixed(2)} overtime hours · {money(loggedOtPay)} of overtime pay
          · {money(loggedPremium)} qualifying
          <span className="text-xs"> (from {logged.length} logged paychecks)</span>
        </div>
      </div>
      <div className="text-xs mt-2" style={{ color: C.accent }}>
        Shaded weeks are the two on the {payDate} paycheck below.
        {hiddenCount > 0 && ` ${hiddenCount} earlier ${hiddenCount === 1 ? "week is" : "weeks are"} hidden — those paychecks are already logged, and the stub is the better record.`}
      </div>
    </Panel>
  );
}

function ForecastTab({ fc, setFc, changeSetup, rows, onLog, weekLog, setWeekLog, forecasts, setForecasts }) {
  const weekKeys = weekEndingsFor(fc.payDate);
  const weeks = weekKeys.map((k) => weekLog[k] || BLANK_WEEK);
  fc = { ...fc, weeks, payType: PAY_TYPE, salary: fc.salary ?? PAY.salary ?? 0 };
  const fcCalc = HAS_HSA ? fc : { ...fc, hsa: 0 };   // no HSA: nothing comes off for it
  const f = forecast(fcCalc);
  const ranges = weekRanges(fc.payDate);
  const setTop = (k) => (e) => setFc({ ...fc, [k]: e.target.value });
  const setWeek = (i, k) => (e) => {
    const key = weekKeys[i];
    if (!key) return;
    setWeekLog({ ...weekLog, [key]: { ...(weekLog[key] || BLANK_WEEK), [k]: e.target.value } });
  };

  // What one more overtime hour is actually worth, run through the whole stack.
  const bump = PAY_TYPE === "salary"
    ? forecast({ ...fcCalc, salary: n(fc.salary) + 1000 })
    : forecast({ ...fcCalc, weeks: weeks.map((w, j) =>
      j === 1 ? { ...w, ot: n(w.ot) + 1 } : w) });
  const dGross = bump.gross - f.gross;
  const dCheck = bump.takeHome - f.takeHome;
  const dRetire = bump.retirement - f.retirement;
  const dSavings = bump.savings - f.savings;
  const dTax = bump.taxTotal - f.taxTotal;

  const recent = rows.filter((r) => !r.isAdj && r.gross > 0).slice(-6);
  const avg = recent.length ? recent.reduce((s, r) => s + r.gross, 0) / recent.length : 0;

  const logIt = () => onLog({
    id: `e-${Date.now()}-fc`, type: "paycheck", date: fc.payDate,
    label: new Date(fc.payDate + "T12:00:00").toLocaleString("en-US", { month: "short" }) + " check",
    gross: f.gross.toFixed(2), taxTotal: f.taxTotal.toFixed(2),
    federal: f.federal.toFixed(2), socSec: f.socSec.toFixed(2),
    medicare: f.medicare.toFixed(2), state: f.state.toFixed(2),
    benefits: f.benefits.toFixed(2), hsa: f.hsa.toFixed(2), dental: n(fc.dental).toFixed(2),
    retirement: f.retirement.toFixed(2), espp: f.espp.toFixed(2), savings: f.savings.toFixed(2),
    ...(PAY_TYPE === "salary" ? {} : {
      rate: String(f.rate),
      regHrs: String(f.weeks.reduce((s, w) => s + w.reg, 0)),
      otHrs: String(r2(f.weeks.reduce((s, w) => s + w.ot, 0))),
      holHrs: String(f.weeks.reduce((s, w) => s + w.hol, 0)),
      ptoHrs: String(f.weeks.reduce((s, w) => s + w.pto, 0)),
    }),
  });

  return (
    <div className="space-y-4">
      {PAY_TYPE !== "salary" && <WeekLogPanel weekLog={weekLog} setWeekLog={setWeekLog} payDate={fc.payDate} rate={fc.rate} rows={rows} />}

      <Panel title={PAY_TYPE === "salary" ? "Pay for this period" : "Hours for this pay period"}
        note={PAY_TYPE === "salary"
          ? "Each check is your yearly salary divided by 26. Add a bonus below if this one has one."
          : "The same two weeks as the shaded rows above — edit in either place."}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <label>
            <div className="text-xs mb-1" style={{ color: C.muted }}>Pay date</div>
            <input type="date" value={fc.payDate || ""} onChange={setTop("payDate")}
              className="w-full px-2 py-1.5 rounded text-sm"
              style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }} />
          </label>
          {PAY_TYPE === "salary"
            ? <MoneyField label="Yearly salary" value={fc.salary} onChange={setTop("salary")} hint="÷ 26 per check" />
            : <HoursField label="Hourly rate" value={fc.rate} onChange={setTop("rate")} />}
          {HAS_HSA && <MoneyField label="HSA" value={fc.hsa} onChange={setTop("hsa")} hint="" />}
          {HAS_ESPP && <MoneyField label="ESPP" value={fc.espp} onChange={setTop("espp")} />}
          {PAY_TYPE !== "salary" && <HoursField label="Premium hours" value={fc.premHrs} onChange={setTop("premHrs")} hint="premium lines, if any" />}
          <MoneyField label={PAY_TYPE === "salary" ? "Bonus or extra pay $" : "Premium pay $"} value={fc.premPay} onChange={setTop("premPay")} />
        </div>

        {PAY_TYPE !== "salary" && (<>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {weeks.map((w, i) => {
            const wk = f.weeks[i];
            return (
              <div key={i} className="rounded p-3" style={{ background: C.paper }}>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>Week {i + 1}</span>
                  <span className="text-xs" style={{ color: C.muted, fontFamily: MONO }}>{ranges[i]}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <HoursField label="Regular" value={w.reg} onChange={setWeek(i, "reg")} />
                  <HoursField label="Overtime" value={w.ot} onChange={setWeek(i, "ot")} />
                  <HoursField label="Holiday" value={w.hol} onChange={setWeek(i, "hol")} />
                  <HoursField label="PTO" value={w.pto} onChange={setWeek(i, "pto")} />
                </div>
                <div className="text-xs mt-2 pt-2 flex justify-between"
                  style={{ borderTop: `1px solid ${C.rule}`, color: C.muted }}>
                  <span>{wk.paidHours.toFixed(2)} paid hours</span>
                  <span style={{ fontFamily: MONO, color: C.ink }}>{money(wk.straight + wk.premium)}</span>
                </div>
              </div>
            );
          })}
        </div>
        {n(weeks[1].ot) === 0 && (
          <div className="text-sm mt-3 px-3 py-2 rounded" style={{ background: C.amberSoft, color: C.amber }}>
            Week 2 has no overtime entered yet. The figures below assume none — fill it in once {ranges[1].split("–")[1]} closes out.
          </div>
        )}
        </>)}
      </Panel>

      <Panel title={`Predicted paycheck · ${fc.payDate}`}
        note="Built from the formulas this ledger uses: the tax rates, benefits, and the 401k and savings percentages.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <PredictedStub f={f} />
          <div>
            <div className="rounded p-4 mb-3" style={{ background: C.greenSoft }}>
              <div className="text-xs uppercase tracking-wider" style={{ color: C.green }}>Lands in checking</div>
              <div className="text-3xl mt-1" style={{ fontFamily: MONO, fontWeight: 700, color: C.green }}>
                {money(f.takeHome)}
              </div>
              <div className="text-sm mt-1" style={{ color: C.green }}>
                on {money(f.gross)} gross{PAY_TYPE === "salary" ? "" : ` · ${f.otHours.toFixed(2)} overtime hours`}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {HAS_RETIRE && <Stat label="Into your 401k" value={money(f.retirement)} />}
              {HAS_SAVINGS && <Stat label="Into savings" value={money(f.savings)} />}
              {HAS_HSA ? <Stat label="Into HSA" value={money(f.hsa)} /> : <Stat label="Into dental" value={money(f.dental)} />}
              <Stat label="Effective tax rate" value={pctS(pct(f.taxTotal, f.gross))} />
            </div>
            {avg > 0 && (
              <div className="text-sm mt-3" style={{ color: C.muted }}>
                Your last {recent.length} paychecks averaged {money(avg)} gross, so this one runs
                {" "}{money(Math.abs(f.gross - avg))} {f.gross >= avg ? "above" : "below"} that.
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 pt-4" style={{ borderTop: `1px solid ${C.rule}` }}>
          <div className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>
            {PAY_TYPE === "salary" ? "What a $1,000 raise adds to each check" : "What one more overtime hour is worth"}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="Gross" value={money(dGross)} />
            <Stat label="Tax" value={`-${money(dTax)}`} />
            <Stat label="401k" value={money(dRetire)} />
            <Stat label="Savings" value={money(dSavings)} />
            <Stat label="Checking" value={money(dCheck)} />
          </div>
          <div className="text-sm mt-3" style={{ color: C.muted }}>
            {PAY_TYPE === "salary" ? "A $1,000 raise adds" : "An overtime hour bills"} {money(dGross)}{PAY_TYPE === "salary" ? " to each check" : ""} but only {money(dCheck)} reaches checking. The rest
            isn't lost — {money(dRetire + dSavings)} of it goes to your 401k and savings, and
            {" "}{money(dTax)} is withholding.
          </div>
        </div>

        {f.belowFedBand && (
          <div className="text-sm mt-3 px-3 py-2 rounded" style={{ background: C.amberSoft, color: C.amber }}>
            Taxable wages of {money(f.incomeBase)} fall below every paycheck the federal formula was
            checked against, so this check may sit in a lower withholding bracket. Social Security,
            Medicare and state are still exact — treat only the federal line as approximate, and
            expect the real figure to come in lower rather than higher.
          </div>
        )}

        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={() => setForecasts({ ...forecasts, [fc.payDate]: {
              gross: f.gross, taxTotal: f.taxTotal, takeHome: f.takeHome,
              otHours: f.otHours, savedAt: new Date().toISOString().slice(0, 10) } })}
            disabled={!f.gross || !fc.payDate} className="px-4 py-2 rounded text-sm"
            style={{ border: `1px solid ${C.accent}`, color: C.accent, fontWeight: 600 }}>
            {forecasts[fc.payDate] ? "Update the saved forecast" : "Save this forecast"}
          </button>
        </div>
        <div className="text-sm mt-2" style={{ color: C.muted }}>
          Saving it lets the app compare itself against the real stub once you log that paycheck.
        </div>

        <button onClick={logIt} disabled={!f.gross} className="mt-4 px-4 py-2 rounded text-sm"
          style={{ background: f.gross ? C.ink : C.rule, color: f.gross ? C.card : C.muted, fontWeight: 600 }}>
          Open as a paycheck entry
        </button>
        <div className="text-sm mt-2" style={{ color: C.muted }}>
          Once the real stub arrives, use this to prefill the log, then correct any line that differs.
        </div>
      </Panel>

      <WhatIfPanel fcCalc={fcCalc} f={f} changeSetup={changeSetup} setFc={setFc} />

      <ForecastAccuracy forecasts={forecasts} rows={rows} setForecasts={setForecasts} />

      <Panel title="How the prediction is built"
        note="These are the rules this ledger applies. In your own copy you would fit the two offsets to your own stubs.">
        <ul className="text-sm space-y-1" style={{ color: C.muted }}>
          <li>· {PAY_TYPE === "salary" ? "Gross = yearly salary ÷ 26, plus any bonus" : "Gross = rate × (regular + holiday + PTO), plus overtime paid as straight time and a half-time premium, rounded separately"}</li>
          <li>· Withholding base = gross{HAS_HSA ? " − HSA" : ""} − {money(PAY.dentalPreTax)} (only part of the dental premium comes off)</li>
          <li>· Social Security 6.2% and Medicare 1.45% of that base — exact</li>
          <li>· State 5.58% of the base less {money(PAY.stateOffset)}</li>
          <li>· Federal 22% of the base less {money(PAY.fedOffset)}</li>
          {SETUP.retire === "traditional" && <li>· Federal and state use that base less the traditional 401k</li>}
          <li>· {HAS_RETIRE ? `${retireLabel()} ${pctLabel(SETUP.retirePct)} of gross` : "No 401k"}; {HAS_SAVINGS ? `savings transfers ${pctLabel(SETUP.savingsPct)} of net pay` : "no savings transfers"}</li>
        </ul>
      </Panel>
    </div>
  );
}

/* Federal overtime deduction (tax years 2025–2028): only the half-time premium
   counts, capped at $12,500 for a single filer. Payroll doesn't withhold with it
   in mind, so the benefit shows up at filing. */
const OT_CAP_SINGLE = 12500;

/* Pay rates and the periods they applied to. Dates through 2023 come from the
   HR record; the later ones are the rates seen on stubs, with start dates that
   haven't been confirmed. */


/* Prior years, one row per year from that year's final stub (its year-to-date
   column). Kept out of the 2026 totals on purpose. */


/* Hours by type, from the stubs' earnings sections. Only paychecks with hours
   entered count — nothing here is estimated. */
function HoursPanel({ rows }) {
  const checks = rows.filter((r) => !r.isAdj && r.gross > 0);
  const withHours = checks.filter((r) => r.hasHours);
  const missing = checks.length - withHours.length;
  const r2h = (v) => Math.round(v * 100) / 100;

  if (!withHours.length) {
    return (
      <Panel title="Hours worked">
        <div className="text-sm" style={{ color: C.muted }}>
          No hours entered yet. Open a paycheck in the Log and fill in the Hours section from its
          stub — regular, overtime, holiday and PTO totals will build up here.
        </div>
      </Panel>
    );
  }

  const types = [
    { key: "regH", label: "Regular", pay: (r) => r2h(r.regH * r.payRate) },
    { key: "otH", label: "Overtime", pay: (r) => r.otPay },
    { key: "holH", label: "Holiday", pay: (r) => r2h(r.holH * r.payRate) },
    { key: "ptoH", label: "PTO", pay: (r) => r2h(r.ptoH * r.payRate) },
    { key: "premH", label: "Premium", pay: (r) => r.premPayN },
  ].map((t) => ({
    ...t,
    hrs: withHours.reduce((s, r) => s + r[t.key], 0),
    dollars: withHours.reduce((s, r) => s + t.pay(r), 0),
  }));
  const totalHrs = types.reduce((s, t) => s + t.hrs, 0);
  const totalPay = types.reduce((s, t) => s + t.dollars, 0);
  const h = (v) => (v ? v.toFixed(2) : "—");

  return (
    <Panel title="Hours worked"
      note={missing
        ? `Totals from the ${withHours.length} of ${checks.length} paychecks with hours entered. ${missing} still to fill in.`
        : `Every paycheck this year, from the stubs' earnings sections.`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
              {["Type", "Hours", "Per check", "Share", "Paid"].map((c, i) => (
                <th key={c} className={`py-2 text-xs uppercase tracking-wider ${i ? "text-right" : "text-left"}`}
                  style={{ color: C.muted }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.key} style={{ borderBottom: `1px solid ${C.rule}` }}>
                <td className="py-2">{t.label}</td>
                <td className="py-2 text-right" style={{ fontFamily: MONO }}>{t.hrs.toFixed(2)}</td>
                <td className="py-2 text-right" style={{ fontFamily: MONO, color: C.muted }}>
                  {(t.hrs / withHours.length).toFixed(2)}
                </td>
                <td className="py-2 text-right" style={{ fontFamily: MONO, color: C.muted }}>
                  {pctS(pct(t.hrs, totalHrs))}
                </td>
                <td className="py-2 text-right" style={{ fontFamily: MONO }}>{money(t.dollars)}</td>
              </tr>
            ))}
            <tr>
              <td className="py-2" style={{ fontWeight: 700 }}>Total paid</td>
              <td className="py-2 text-right" style={{ fontFamily: MONO, fontWeight: 700 }}>{totalHrs.toFixed(2)}</td>
              <td className="py-2 text-right" style={{ fontFamily: MONO, color: C.muted }}>
                {(totalHrs / withHours.length).toFixed(2)}
              </td>
              <td />
              <td className="py-2 text-right" style={{ fontFamily: MONO, fontWeight: 700 }}>{money(totalPay)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="text-xs uppercase tracking-wider mt-5 mb-2" style={{ color: C.muted }}>By paycheck</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${C.ink}` }}>
              {["Paycheck", "Regular", "Overtime", "Holiday", "PTO", "Premium", "Total"].map((c, i) => (
                <th key={c} className={`py-1.5 text-xs uppercase tracking-wider ${i ? "text-right" : "text-left"}`}
                  style={{ color: C.muted }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {checks.map((r) => (
              <tr key={r.id} style={{ borderBottom: `1px solid ${C.rule}`, color: r.hasHours ? C.ink : C.muted }}>
                <td className="py-1.5 whitespace-nowrap">{r.label}</td>
                {r.hasHours
                  ? [r.regH, r.otH, r.holH, r.ptoH, r.premH, r.regH + r.otH + r.holH + r.ptoH + r.premH].map((v, i) => (
                      <td key={i} className="py-1.5 text-right" style={{ fontFamily: MONO, fontWeight: i === 5 ? 600 : 400 }}>{h(v)}</td>
                    ))
                  : <td colSpan={6} className="py-1.5 text-right text-xs">not entered</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function OvertimePanel({ rows, ytd, remaining }) {
  const checks = rows.filter((r) => !r.isAdj && r.gross > 0);
  if (!checks.length) return null;

  // Checks without hours get an estimate: anything past 80 straight hours read as overtime.
  // Rough: a period can carry more than 80 straight hours with no overtime.
  const perCheck = checks.map((r) => {
    if (r.hasHours) return { r, hrs: r.otH, prem: r.otPremium, est: false };
    const hrs = Math.max(0, (r.gross - 80 * r.payRate) / (1.5 * r.payRate));
    return { r, hrs, prem: Math.round(hrs * r.payRate * 50) / 100, est: true };
  });
  const logged = perCheck.filter((x) => !x.est);
  const estimated = perCheck.filter((x) => x.est);
  const hrsTotal = perCheck.reduce((s, x) => s + x.hrs, 0);
  const premTotal = perCheck.reduce((s, x) => s + x.prem, 0);
  const avgPrem = premTotal / perCheck.length;
  const projPrem = premTotal + avgPrem * remaining;
  const deductible = Math.min(projPrem, OT_CAP_SINGLE);
  const fedSaved = deductible * 0.22;
  const maxHrs = Math.max(...perCheck.map((x) => x.hrs), 1);

  return (
    <Panel title="Overtime and the federal overtime deduction"
      note={`Only the half-time premium counts toward the deduction — at ${money(curRate())} an hour, that's ${money(curRate() * (PAY.otMultiplier - 1))} of every overtime hour, not the full ${money(curRate() * PAY.otMultiplier)}.`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Overtime hours" value={hrsTotal.toFixed(2)}
          sub={estimated.length ? `${estimated.length} checks estimated` : "all from your stubs"} />
        <Stat label="Qualified premium" value={money(premTotal)} sub="so far this year" />
        <Stat label="Projected for the year" value={money(projPrem)}
          sub={`${pctS(pct(projPrem, OT_CAP_SINGLE))} of the ${money(OT_CAP_SINGLE)} cap`} />
        <Stat label="Est. federal tax saved" value={money(fedSaved)} sub="at your 22% bracket" />
      </div>

      <div className="mt-4 space-y-1">
        {perCheck.map((x) => (
          <div key={x.r.id} className="flex items-center gap-2 text-xs">
            <span className="w-20 shrink-0" style={{ color: C.muted }}>{x.r.label}</span>
            <div className="flex-1 h-3 rounded" style={{ background: C.paper }}>
              <div style={{
                width: `${(x.hrs / maxHrs) * 100}%`, height: "100%", borderRadius: 3,
                background: x.est ? "transparent" : C.accent,
                border: x.est ? `1px dashed ${C.accent}` : "none",
              }} />
            </div>
            <span className="w-24 text-right shrink-0" style={{ fontFamily: MONO, color: x.est ? C.muted : C.ink }}>
              {x.est ? "~" : ""}{x.hrs.toFixed(2)} hrs
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-2 text-xs" style={{ color: C.muted }}>
        <span><span style={{ display: "inline-block", width: 10, height: 8, background: C.accent, borderRadius: 2, marginRight: 5 }} />From your stub</span>
        <span><span style={{ display: "inline-block", width: 10, height: 8, border: `1px dashed ${C.accent}`, borderRadius: 2, marginRight: 5 }} />Estimated from gross</span>
      </div>

      {estimated.length > 0 && (
        <div className="text-sm mt-3 px-3 py-2 rounded" style={{ background: C.amberSoft, color: C.amber }}>
          {estimated.length} of {checks.length} paychecks have no hours yet, so their overtime is guessed
          from gross. Open each one in the Log and enter the hours from its earnings section — the app
          checks them against gross, so a typo gets caught.
        </div>
      )}

      <div className="text-sm mt-3 space-y-2" style={{ color: C.muted }}>
        <p>This is a federal income tax deduction only. Social Security and Medicare still apply to every
          overtime dollar, and the example state may not follow the federal rule.</p>
        <p>Your withholding doesn't account for it, so the saving arrives as a larger refund (or smaller
          balance due) when you file — not in your paychecks.</p>
        <p>Married filing separately can't claim it. If you're married, it has to be a joint return.</p>
        <p>Your 2026 W-2 will report qualified overtime on its own line. Compare it against the premium
          total here in January — this is your check that payroll counted every hour.</p>
      </div>
    </Panel>
  );
}

/* Small hand-drawn charts — one scale per chart, labels in theme colors. */
function useWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    if (!ref.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((es) => setW(Math.max(280, es[0].contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function ChartLegend({ series }) {
  return (
    <div className="flex flex-wrap gap-4 mt-1 text-xs" style={{ color: C.muted }}>
      {series.map(([k, l, c]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span style={{ width: 10, height: 10, background: c, borderRadius: 2, display: "inline-block" }} />{l}
        </span>
      ))}
    </div>
  );
}

function SvgBars({ data, series, fmt, tip }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState(null);
  const H = 230, L = 46, R = 8, T = 8, B = 46;
  const max = Math.max(1, ...data.flatMap((d) => series.map(([k]) => d[k])));
  const step = Math.pow(10, Math.floor(Math.log10(max))) / 2;
  const top = Math.ceil(max / step) * step;
  const ticks = [0, 1, 2, 3, 4].map((i) => (top * i) / 4);
  const pw = W - L - R, ph = H - T - B;
  const gw = pw / Math.max(1, data.length);
  const bw = Math.max(2, (gw * 0.7) / series.length);
  const y = (v) => T + ph - (v / top) * ph;
  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={W} height={H} role="img" aria-label="Gross and take-home by paycheck">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={C.rule} strokeDasharray="2 4" />
            <text x={L - 6} y={y(t) + 3} fontSize="10" textAnchor="end" fill={C.muted}>{fmt(t)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = L + i * gw + (gw - bw * series.length) / 2;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={L + i * gw} y={T} width={gw} height={ph} fill="transparent" />
              {series.map(([k, , c], j) => (
                <rect key={k} x={x0 + j * bw} y={y(d[k])} width={bw - 1} height={Math.max(0, T + ph - y(d[k]))}
                  fill={c} opacity={hover === null || hover === i ? 1 : 0.45} />
              ))}
              <text x={L + i * gw + gw / 2} y={H - B + 12} fontSize="9" fill={C.muted}
                textAnchor="end" transform={`rotate(-45 ${L + i * gw + gw / 2} ${H - B + 12})`}>{d.name}</text>
            </g>
          );
        })}
      </svg>
      <div className="text-xs" style={{ fontFamily: MONO, color: C.ink, minHeight: 18 }}>
        {hover !== null ? `${data[hover].name} · ` + series.map(([k, l]) => `${l} ${tip(data[hover][k])}`).join(" · ") : ""}
      </div>
      <ChartLegend series={series} />
    </div>
  );
}

function SvgLines({ data, series, refLine, refLabel }) {
  const [ref, W] = useWidth();
  const [hover, setHover] = useState(null);
  const H = 210, L = 40, R = 8, T = 10, B = 46;
  const vals = data.flatMap((d) => series.map(([k]) => d[k])).concat(refLine ?? []);
  const lo = Math.floor(Math.min(...vals) / 5) * 5, hi = Math.ceil(Math.max(...vals) / 5) * 5 || 5;
  const ticks = []; for (let v = lo; v <= hi; v += 5) ticks.push(v);
  const pw = W - L - R, ph = H - T - B;
  const x = (i) => L + (data.length > 1 ? (i / (data.length - 1)) * pw : pw / 2);
  const y = (v) => T + ph - ((v - lo) / Math.max(1, hi - lo)) * ph;
  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={W} height={H} role="img" aria-label="Tax and take-home share by paycheck">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={C.rule} strokeDasharray="2 4" />
            <text x={L - 6} y={y(t) + 3} fontSize="10" textAnchor="end" fill={C.muted}>{t}%</text>
          </g>
        ))}
        {refLine != null && (
          <g>
            <line x1={L} x2={W - R} y1={y(refLine)} y2={y(refLine)} stroke={C.muted} strokeDasharray="4 4" />
            <text x={W - R} y={y(refLine) - 4} fontSize="10" textAnchor="end" fill={C.muted}>{refLabel} {refLine}%</text>
          </g>
        )}
        {series.map(([k, , c]) => (
          <g key={k}>
            <polyline fill="none" stroke={c} strokeWidth="2"
              points={data.map((d, i) => `${x(i)},${y(d[k])}`).join(" ")} />
            {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d[k])} r={hover === i ? 4 : 2.5} fill={c} />)}
          </g>
        ))}
        {data.map((d, i) => (
          <g key={i}>
            <rect x={x(i) - pw / Math.max(2, data.length) / 2} y={T} width={pw / Math.max(2, data.length)} height={ph}
              fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
            <text x={x(i)} y={H - B + 12} fontSize="9" fill={C.muted} textAnchor="end"
              transform={`rotate(-45 ${x(i)} ${H - B + 12})`}>{d.name}</text>
          </g>
        ))}
      </svg>
      <div className="text-xs" style={{ fontFamily: MONO, color: C.ink, minHeight: 18 }}>
        {hover !== null ? `${data[hover].name} · ` + series.map(([k, l]) => `${l} ${data[hover][k]}%`).join(" · ") : ""}
      </div>
      <ChartLegend series={series} />
    </div>
  );
}

/* A year summarised from its final stub. Everything here is derived from the
   figures typed in, so a year with a line missing simply shows less. */
const deriveYear = (y) => {
  const num = (k) => n(y[k]);
  const gross = num("gross");
  const taxTotal = num("federal") + num("socSec") + num("medicare") + num("state");
  const benefits = num("dental") + num("hsa");
  const retirement = num("retirement"), espp = num("espp");
  const netPay = gross - taxTotal - benefits - retirement - espp - n(y.other);
  const savings = Math.round(netPay * SETUP.savingsPct * 100) / 100;
  const otPay = num("otPay");
  // Time-and-a-half is base plus a half-time premium, so the premium is a third.
  const qualifiedOt = Math.round((otPay / 3) * 100) / 100;
  const deductible = Math.min(qualifiedOt, OT_CAP_SINGLE);
  const otHours = num("otRate") ? otPay / num("otRate") : 0;
  const w2Wages = num("w2Wages"), gtl = num("gtl"), ficaWages = num("ficaWages"), other = num("other");
  // Box 1 = gross, plus imputed group-term life, less the pre-tax cafeteria lines
  // and, for a traditional 401k, the contributions.
  const w2Expected = Math.round((gross + gtl - benefits - (SETUP.retire === "traditional" ? retirement : 0)) * 100) / 100;
  const w2Ok = w2Wages > 0 && Math.abs(w2Expected - w2Wages) < 0.02;
  return { ...y, gross, taxTotal, benefits, retirement, espp, netPay, savings, w2Wages, gtl,
    ficaWages, other, w2Expected, w2Ok,
    takeHome: netPay - savings, otPay, qualifiedOt, deductible, otHours,
    hsaTotal: num("hsa") + num("hsaEmployer") };
};

const yearFieldShown = (k) => !(k.startsWith("hsa") && !HAS_HSA) && !(k === "retirement" && !HAS_RETIRE) && !(k === "espp" && !HAS_ESPP);
const YEAR_FIELDS = [
  ["gross", "Gross pay"], ["federal", "Federal tax"], ["socSec", "Social Security"],
  ["medicare", "Medicare"], ["state", "State tax"], ["dental", "Dental"],
  ["hsa", "HSA (yours)"], ["hsaEmployer", "HSA (employer)"], ["retirement", "401k"],
  ["espp", "ESPP"], ["otPay", "Overtime pay"], ["baseRate", "Base rate"], ["otRate", "Overtime rate"],
  ["w2Wages", "W-2 wages (Box 1)"], ["ficaWages", "FICA wages (Box 3)"],
  ["gtl", "Group-term life (Box 12 C)"], ["other", "Other deductions"], ["checks", "Paychecks in the year"],
  ["priorRate", "Earlier rate that year"],
];

/* Where 2026 is heading: projects W-2 wages and withholding from the ledger,
   works out the tax actually due, and shows the difference. An estimate, and
   deliberately explicit about every assumption behind it. */
function TaxOutlookTab({ rows, ytd, remaining, fc, tax, setTax, limit, hsaLimit, hsaEmployer, hsaEmpPaid, hsaEmpDate }) {
  const checks = rows.filter((r) => !r.isAdj && r.gross > 0);
  const adjustments = rows.filter((r) => r.isAdj && r.gross > 0);
  const set = (k) => (e) => setTax({ ...tax, [k]: e.target.value });
  const status = FED_2026[tax.status] ? tax.status : "single";
  const F = FED_2026[status], K = STATE_2026[status];

  // Wages as the W-2 will report them: gross, less pre-tax HSA, the part of
  // the dental premium that comes off and any traditional 401k, plus ESPP income
  // that had nothing withheld. Starting totals cover checks before the log began.
  const trad = SETUP.retire === "traditional";
  const o = OPENING || { gross: 0, hsa: 0, retirement: 0, checks: 0, federal: 0, state: 0, otPremium: 0 };
  const wagesOf = (r) => r.gross - n(r.hsa) - PAY.dentalPreTax - (trad ? r.retirement : 0);
  const wagesYTD = checks.reduce((s, r) => s + wagesOf(r), 0)
    + adjustments.reduce((s, r) => s + r.gross, 0)
    + (o.gross - o.hsa - PAY.dentalPreTax * o.checks - (trad ? o.retirement : 0));
  const avgGross = checks.length ? checks.reduce((s, r) => s + r.gross, 0) / checks.length
    : (o.checks ? o.gross / o.checks : 0);
  const futureHsa = HAS_HSA ? (n(fc.hsa) || 80) : 0;
  const futureWage = Math.max(0, avgGross - futureHsa - PAY.dentalPreTax
    - (trad ? avgGross * SETUP.retirePct : 0));
  const wagesProjected = wagesYTD + futureWage * remaining;

  // Withholding: what's been taken, plus the same formula payroll uses.
  const fedPerCheck = Math.max(0, futureWage * PAY.fedRate - PAY.fedOffset);
  const stPerCheck = Math.max(0, futureWage * PAY.stateRate - PAY.stateOffset);
  const fedYTD = checks.reduce((s, r) => s + n(r.federal), 0) + o.federal;
  const stYTD = checks.reduce((s, r) => s + n(r.state), 0) + o.state;
  const fedProjected = fedYTD + fedPerCheck * remaining + n(tax.otherWithheld);
  const stProjected = stYTD + stPerCheck * remaining;

  // Qualifying overtime: from hours where entered, estimated from gross otherwise.
  const otPremium = PAY_TYPE === "salary" ? 0 : checks.reduce((s, r) => {
    if (r.hasHours) return s + r.otPremium;
    const hrs = Math.max(0, (r.gross - 80 * r.payRate) / (1.5 * r.payRate));
    return s + hrs * r.payRate * 0.5;
  }, 0);
  const otProjected = otPremium + o.otPremium
    + (checks.length ? (otPremium / checks.length) * remaining : 0);
  const otDeduction = Math.min(otProjected, F.otCap);

  const otherIncome = n(tax.otherIncome);
  const agi = wagesProjected + otherIncome;
  const taxableIncome = Math.max(0, agi - F.std - otDeduction);
  const fedTax = bracketTax(taxableIncome, F.brackets);
  const fedDiff = fedProjected - fedTax;

  const deps = n(tax.dependents);
  const stTaxable = Math.max(0, agi - K.std - K.exemption - deps * STATE_2026.perDependent);
  const stTax = stTaxable <= K.threshold
    ? stTaxable * STATE_2026.low
    : K.threshold * STATE_2026.low + (stTaxable - K.threshold) * STATE_2026.high;
  const stDiff = stProjected - stTax;

  const total = fedDiff + stDiff;
  const good = total >= 0;

  const Row = ({ label, value, sub, strong, negative }) => (
    <tr style={{ borderBottom: `1px solid ${C.rule}` }}>
      <td className="py-2">
        <span style={{ fontWeight: strong ? 700 : 400 }}>{label}</span>
        {sub && <div className="text-xs" style={{ color: C.muted }}>{sub}</div>}
      </td>
      <td className="py-2 text-right" style={{ fontFamily: MONO, fontWeight: strong ? 700 : 400 }}>
        {negative ? `− ${money(Math.abs(value))}` : money(value)}
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <Panel title="Where 2026 lands"
        note="Projected from your logged paychecks: what your W-2 will show, what tax is actually due, and what payroll will have withheld by then.">
        <div className="rounded p-4" style={{ background: good ? C.greenSoft : C.amberSoft }}>
          <div className="text-xs uppercase tracking-wider" style={{ color: good ? C.green : C.amber }}>
            {good ? "On track for a refund of about" : "On track to owe about"}
          </div>
          <div className="text-3xl mt-1" style={{ fontFamily: MONO, fontWeight: 700, color: good ? C.green : C.amber }}>
            {money(Math.abs(total))}
          </div>
          <div className="text-sm mt-1" style={{ color: good ? C.green : C.amber }}>
            Federal {fedDiff >= 0 ? "refund" : "owed"} {money(Math.abs(fedDiff))} ·
            {" "}State {stDiff >= 0 ? "refund" : "owed"} {money(Math.abs(stDiff))}
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <Stat label="Projected W-2 wages" value={money(wagesProjected)} sub="Box 1" />
          {PAY_TYPE !== "salary" && <Stat label="Overtime deduction" value={money(otDeduction)}
            sub={F.otCap ? `cap ${money(F.otCap)}` : "not available on this filing status"} />}
          <Stat label="Taxable income" value={money(taxableIncome)}
            sub={`top rate ${(marginalRate(taxableIncome, F.brackets) * 100).toFixed(0)}%`} />
          <Stat label="Federal withheld" value={money(fedProjected)}
            sub={`${money(fedYTD)} so far`} />
        </div>
      </Panel>

      <Panel title="Your situation"
        note="Only what the ledger can't know. Everything else comes from your paychecks.">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <label>
            <div className="text-xs mb-1" style={{ color: C.muted }}>Filing status</div>
            <select value={status} onChange={set("status")}
              className="w-full px-2 py-1.5 rounded text-sm"
              style={{ border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }}>
              {Object.entries(FED_2026).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <MoneyField label="Dependents" value={tax.dependents} onChange={set("dependents")} hint="State exemptions" />
          <MoneyField label="Other income" value={tax.otherIncome} onChange={set("otherIncome")} hint="Interest, a second job" />
          <MoneyField label="Other withholding" value={tax.otherWithheld} onChange={set("otherWithheld")} hint="Federal, from elsewhere" />
        </div>
        {status === "mfs" && PAY_TYPE !== "salary" && (
          <div className="text-sm mt-3 px-3 py-2 rounded" style={{ background: C.amberSoft, color: C.amber }}>
            Married filing separately can't claim the overtime deduction, so it's set to zero above.
            Filing jointly would put {money(Math.min(otProjected, FED_2026.mfj.otCap))} of overtime back in play.
          </div>
        )}
      </Panel>

      <Panel title="Federal, line by line">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <Row label="Projected W-2 wages" value={wagesProjected}
              sub={`${checks.length} paychecks logged${o.checks ? `, ${o.checks} from starting totals` : ""}, ${remaining} to come${adjustments.length ? `, plus ${money(adjustments.reduce((s, r) => s + r.gross, 0))} of ESPP income` : ""}`} />
            {otherIncome > 0 && <Row label="Other income" value={otherIncome} />}
            <Row label="Standard deduction" value={F.std} negative sub={F.label} />
            {PAY_TYPE !== "salary" && <Row label="Overtime deduction" value={otDeduction} negative
              sub="the half-time premium, projected to year end" />}
            <Row label="Taxable income" value={taxableIncome} strong />
            <Row label="Tax on that" value={fedTax} strong />
            <Row label="Withheld by payroll" value={fedProjected} negative
              sub={`${money(fedYTD)} so far, about ${money(fedPerCheck)} per remaining check`} />
            <Row label={fedDiff >= 0 ? "Refund" : "Amount owed"} value={Math.abs(fedDiff)} strong />
          </tbody>
        </table>
      </Panel>

      <Panel title="State, line by line"
        note="The example state starts from your federal income and doesn't follow the federal overtime deduction, so that break is federal only.">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <tbody>
            <Row label="Projected state wages" value={agi} />
            <Row label="Standard deduction" value={K.std} negative />
            <Row label="Personal exemption" value={K.exemption + deps * STATE_2026.perDependent} negative
              sub={deps ? `includes ${deps} dependent${deps === 1 ? "" : "s"}` : undefined} />
            <Row label="State taxable income" value={stTaxable} strong />
            <Row label="State tax" value={stTax} strong sub="5.2% to $23,000, then 5.58%" />
            <Row label="Withheld by payroll" value={stProjected} negative />
            <Row label={stDiff >= 0 ? "Refund" : "Amount owed"} value={Math.abs(stDiff)} strong />
          </tbody>
        </table>
      </Panel>

      <YearEndChecklist ytd={ytd} rows={rows} remaining={remaining} limit={limit} hsaLimit={hsaLimit}
        hsaEmployer={hsaEmployer} hsaEmpPaid={hsaEmpPaid} hsaEmpDate={hsaEmpDate} otDeduction={otDeduction} />

      <Panel title="What this assumes">
        <ul className="text-sm space-y-1" style={{ color: C.muted }}>
          <li>· Your remaining {remaining} paychecks look like your average so far{HAS_HSA ? <>, with HSA at {money(futureHsa)}</> : ", with no HSA"}</li>
          {PAY_TYPE !== "salary" && <li>· Overtime keeps running at this year's pace — the biggest source of error here</li>}
          <li>· You take the standard deduction and have no credits</li>
          <li>· 2026 figures: federal standard deduction {money(F.std)}, state {money(K.std)} plus a {money(K.exemption)} exemption</li>
        </ul>
        <div className="text-sm mt-3" style={{ color: C.muted }}>
          This is an estimate from your own paychecks, not tax advice. A real return brings in
          credits, other income and deductions this page never sees — take it to whoever prepares
          your taxes before acting on it.
        </div>
      </Panel>
    </div>
  );
}

/* Every saved forecast against the paycheck that followed it. The app's own
   track record, rather than a claim about accuracy. */
function ForecastAccuracy({ forecasts, rows, setForecasts }) {
  const byDate = {};
  rows.filter((r) => !r.isAdj && r.gross > 0).forEach((r) => { byDate[r.date] = r; });
  const pairs = Object.entries(forecasts)
    .map(([date, f]) => ({ date, f, actual: byDate[date] }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (!pairs.length) return null;
  const done = pairs.filter((p) => p.actual);
  const avg = done.length
    ? done.reduce((s, p) => s + Math.abs(p.f.takeHome - p.actual.takeHome), 0) / done.length : 0;

  return (
    <Panel title="How the forecast has done"
      note={done.length
        ? `Average miss on take-home across ${done.length} paycheck${done.length === 1 ? "" : "s"}: ${money(avg)}.`
        : "Nothing to compare yet — log the paycheck for a saved forecast and it appears here."}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
              {["Pay date", "Forecast", "Actual", "Out by", ""].map((c, i) => (
                <th key={c} className={`py-2 text-xs uppercase tracking-wider ${i ? "text-right" : "text-left"}`}
                  style={{ color: C.muted }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pairs.map(({ date, f, actual }) => {
              const diff = actual ? actual.takeHome - f.takeHome : null;
              const close = diff !== null && Math.abs(diff) < 1;
              return (
                <tr key={date} style={{ borderBottom: `1px solid ${C.rule}` }}>
                  <td className="py-1.5" style={{ fontFamily: MONO }}>{date}</td>
                  <td className="py-1.5 text-right" style={{ fontFamily: MONO }}>{money(f.takeHome)}</td>
                  <td className="py-1.5 text-right" style={{ fontFamily: MONO }}>
                    {actual ? money(actual.takeHome) : <span style={{ color: C.muted }}>not logged yet</span>}
                  </td>
                  <td className="py-1.5 text-right" style={{ fontFamily: MONO, color: diff === null ? C.muted : close ? C.green : C.amber }}>
                    {diff === null ? "—" : `${diff >= 0 ? "+" : "−"}${money(Math.abs(diff))}`}
                  </td>
                  <td className="py-1.5 text-right">
                    <button onClick={() => { const c = { ...forecasts }; delete c[date]; setForecasts(c); }}
                      className="text-xs underline" style={{ color: C.muted }}>remove</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {done.length > 0 && (
        <div className="text-sm mt-3" style={{ color: C.muted }}>
          A miss here is usually hours, not the formulas — the tax lines are exact once gross is right.
        </div>
      )}
    </Panel>
  );
}

/* The handful of things worth confirming before the year closes and again when
   the W-2 arrives — each one already answerable from the ledger. */
function YearEndChecklist({ ytd, rows, remaining, limit, hsaLimit, hsaEmployer, hsaEmpPaid, hsaEmpDate, otDeduction }) {
  const checks = rows.filter((r) => !r.isAdj && r.gross > 0);
  const perCheck = (k) => (ytd.count ? ytd[k] / ytd.count : 0);
  const projRet = ytd.retirement + perCheck("retirement") * remaining;
  const projHsa = ytd.hsa + perCheck("hsa") * remaining + n(hsaEmployer);
  const adjustments = rows.filter((r) => r.isAdj && r.gross > 0);
  const missingSplit = checks.filter((r) => !r.hasSplit).length;
  const today = iso(new Date());

  const items = [
    ...(HAS_RETIRE ? [{ done: projRet <= limit, label: "401k stays under the annual limit",
      detail: `On pace for ${money(projRet)} against ${money(limit)}.` }] : []),
    ...(HAS_HSA ? [
    { done: projHsa <= hsaLimit, label: "HSA stays under the cap",
      detail: `On pace for ${money(projHsa)} including the employer's ${money(n(hsaEmployer))}, against ${money(hsaLimit)}.` },
    { done: hsaEmpPaid, label: "Employer HSA deposit received",
      detail: hsaEmpPaid ? "Marked as received." : `Expected around ${hsaEmpDate}. Mark it on the Trends tab once it lands.`,
      pending: !hsaEmpPaid && today < hsaEmpDate },
    ] : []),
    { done: missingSplit === 0, label: "Every paycheck has its four tax lines",
      detail: missingSplit ? `${missingSplit} still showing a total only.` : "All logged from your stubs." },
    ...(!HAS_ESPP && !adjustments.length ? [] : [{ done: adjustments.length === 0 || adjustments.every((a) => a.note),
      label: "ESPP income noted", pending: true,
      detail: adjustments.length
        ? `${money(adjustments.reduce((s, a) => s + a.gross, 0))} of ESPP income this year with nothing withheld — it belongs on your return.`
        : "None this year." }]),
    { done: false, pending: true, label: "In January: check the W-2 against this ledger",
      detail: `Box 1 should be close to ${money(ytd.gross - ytd.hsa - PAY.dentalPreTax * ytd.count - (SETUP.retire === "traditional" ? ytd.retirement : 0) + ytd.adjGross)} plus the rest of the year.${otDeduction > 0 ? ` Qualifying overtime should be near ${money(otDeduction)}.` : ""}` },
  ];

  return (
    <Panel title="Year-end checklist"
      note="What to confirm before December closes, and what to check when the W-2 arrives.">
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex gap-3 px-3 py-2 rounded"
            style={{ background: it.done ? C.greenSoft : it.pending ? C.paper : C.amberSoft }}>
            <span style={{ color: it.done ? C.green : it.pending ? C.muted : C.amber, fontWeight: 700 }}>
              {it.done ? "✓" : it.pending ? "•" : "!"}
            </span>
            <span>
              <span style={{ color: it.done ? C.green : it.pending ? C.ink : C.amber, fontWeight: 600 }}>{it.label}</span>
              <div className="text-sm" style={{ color: C.muted }}>{it.detail}</div>
            </span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function PastYearsTab({ years, setYears, setRemovedYears, ytd }) {
  const [editing, setEditing] = useState(null);
  const rows = years.map(deriveYear).sort((a, b) => b.year - a.year);

  const saveYear = (y) => {
    setYears((prev) => {
      const i = prev.findIndex((p) => p.id === y.id);
      if (i === -1) return [...prev, y];
      const c = [...prev]; c[i] = y; return c;
    });
    setEditing(null);
  };

  // Each past year's base rate, then today's. Built from the years on this
  // ledger, so a fresh ledger shows only its own. Dates come from RATE_HISTORY
  // when it has them.
  const rateHistory = [
    ...years.filter((y) => n(y.baseRate) > 0).sort((a, b) => n(a.year) - n(b.year))
      .map((y) => RATE_HISTORY.find((r) => r.year === n(y.year) && r.rate === n(y.baseRate)) || { rate: n(y.baseRate), year: n(y.year) }),
    { ...(RATE_HISTORY.find((r) => r.current && r.rate === curRate()) || {}), rate: curRate(), year: new Date().getFullYear(), current: true },
  ];

  return (
    <div className="space-y-4">
      <Panel title="Why this is separate"
        note="These are whole-year totals from each year's final stub, so they stay out of your 2026 figures, projections and pacing.">
        <div className="text-sm" style={{ color: C.muted }}>
          One stub covers a whole year: its year-to-date column already totals every paycheck.
          Add more years with the button below.
        </div>
      </Panel>

      {PAY_TYPE !== "salary" && rateHistory.length > 1 && (
      <Panel title="Pay rate history"
        note="What you earned per hour, and when each rate took effect.">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
                {["Rate", "Change", "Overtime", "In effect"].map((c, i) => (
                  <th key={c} className={`py-2 text-xs uppercase tracking-wider ${i ? "text-right" : "text-left"}`}
                    style={{ color: C.muted }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rateHistory.map((r, i) => {
                const prev = i > 0 ? rateHistory[i - 1].rate : null;
                return (
                  <tr key={r.rate} style={{ borderBottom: `1px solid ${C.rule}` }}>
                    <td className="py-1.5" style={{ fontFamily: MONO, fontWeight: r.current ? 700 : 400 }}>
                      {money(r.rate)}{r.current ? " (now)" : ""}
                    </td>
                    <td className="py-1.5 text-right" style={{ fontFamily: MONO, color: C.muted }}>
                      {prev ? `${r.rate >= prev ? "+" : ""}${((r.rate / prev - 1) * 100).toFixed(1)}%` : "—"}
                    </td>
                    <td className="py-1.5 text-right" style={{ fontFamily: MONO, color: C.muted }}>
                      {money(Math.round(r.rate * 150) / 100)}
                    </td>
                    <td className="py-1.5 text-right" style={{ color: r.from ? C.ink : C.muted }}>
                      {r.from ? `${r.from} – ${r.to}` : `${r.year}${r.current ? " onward" : ""}, start date not recorded`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="text-sm mt-3" style={{ color: C.muted }}>
          {money(rateHistory[0].rate)} to {money(rateHistory[rateHistory.length - 1].rate)} is
          {" "}{(((rateHistory[rateHistory.length - 1].rate / rateHistory[0].rate) - 1) * 100).toFixed(1)}%
          {" "}across the years shown.
        </div>
      </Panel>
      )}

      {editing ? (
        <YearForm entry={editing} onSave={saveYear} onCancel={() => setEditing(null)}
          onDelete={years.some((y) => y.id === editing.id)
            ? () => {
                setYears((p) => p.filter((y) => y.id !== editing.id));
                setRemovedYears((p) => (p.includes(editing.id) ? p : [...p, editing.id]));
                setEditing(null);
              } : null} />
      ) : (
        <button onClick={() => setEditing({ id: `y-${Date.now()}`, year: "", note: "" })}
          className="px-4 py-2 rounded text-sm"
          style={{ background: C.ink, color: C.card, fontWeight: 600 }}>+ Add a year</button>
      )}

      {rows.map((y) => (
        <Panel key={y.id} title={`${y.year}`} note={y.note || undefined}>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Gross pay" value={money(y.gross)}
              sub={n(y.checks) ? `${n(y.checks)} paychecks · ${money(y.gross / n(y.checks))} average` : undefined} />
            <Stat label="Taxes" value={money(y.taxTotal)} sub={pctS(pct(y.taxTotal, y.gross)) + " effective"} />
            {HAS_RETIRE && <Stat label={retireLabel()} value={money(y.retirement)} sub={pctS(pct(y.retirement, y.gross)) + " of gross"} />}
            <Stat label="Landed in checking" value={money(y.takeHome)} sub={pctS(pct(y.takeHome, y.gross)) + " of gross"} />
            {rateOf(y) > 0 && (
              <Stat label={PAY_TYPE === "salary" ? "Salary" : "Hourly rate"} value={money(rateOf(y))}
                sub={n(y.priorRate)
                  ? `up from ${money(n(y.priorRate))}${y.rateChanged ? ` on ${y.rateChanged}` : ""}`
                  : (n(y.otRate) ? `overtime ${money(n(y.otRate))}` : undefined)} />
            )}
          </div>

          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <tbody>
                {[["Federal tax", n(y.federal)], ["Social Security", n(y.socSec)], ["Medicare", n(y.medicare)],
                  ["State tax", n(y.state)], [HAS_HSA ? "Benefits (HSA + dental)" : "Benefits (dental)", y.benefits],
                  [retireLabel(), y.retirement], ["ESPP", y.espp], ["Savings transfers", y.savings]]
                  .filter(([l]) => !(l === retireLabel() && !HAS_RETIRE) && !(l === "ESPP" && !HAS_ESPP) && !(l === "Savings transfers" && !HAS_SAVINGS))
                  .map(([l, v]) => (
                  <tr key={l} style={{ borderBottom: `1px solid ${C.rule}` }}>
                    <td className="py-1.5">{l}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: MONO }}>{money(v)}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: MONO, color: C.muted }}>{pctS(pct(v, y.gross))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {y.w2Wages > 0 && (
            <div className="mt-3 px-3 py-2 rounded text-sm"
              style={{ background: y.w2Ok ? C.greenSoft : C.redSoft, color: y.w2Ok ? C.green : C.red }}>
              W-2 wages {money(y.w2Wages)} — gross {money(y.gross)} plus {money(y.gtl)} group-term life,
              less {money(y.benefits)} of pre-tax {HAS_HSA ? "HSA and dental" : "dental"}
              {SETUP.retire === "traditional" ? ` and ${money(y.retirement)} of traditional 401k` : ""}
              {y.w2Ok ? " ✓" : ` — that comes to ${money(y.w2Expected)}, so a figure is off`}
            </div>
          )}
          {(() => {
            const gaps = [];
            if (!n(y.state)) gaps.push("State withholding (Box 17 on the W-2)");
            if (HAS_ESPP && !n(y.espp)) gaps.push("ESPP (the final stub's year-to-date figure)");
            if (!gaps.length) return null;
            return (
              <div className="mt-2 px-3 py-2 rounded text-sm" style={{ background: C.amberSoft, color: C.amber }}>
                Still missing: {gaps.join(" and ")}. Anything left out is treated as zero, so the totals
                above understate it.
              </div>
            );
          })()}

          {y.otPay > 0 && (
            <div className="mt-4 px-3 py-3 rounded" style={{ background: C.accentSoft }}>
              <div className="text-xs uppercase tracking-wider mb-2" style={{ color: C.accent }}>Overtime deduction</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Overtime pay" value={money(y.otPay)}
                  sub={y.otHours ? `about ${y.otHours.toFixed(0)} hours` : undefined} />
                <Stat label="Qualifying premium" value={money(y.qualifiedOt)} sub="overtime pay ÷ 3" />
                <Stat label="Under the cap" value={money(OT_CAP_SINGLE - y.deductible)}
                  sub={`${pctS(pct(y.deductible, OT_CAP_SINGLE))} of it used`} />
                <Stat label="Federal tax it saves" value={money(y.deductible * 0.22)} sub="at a 22% bracket" />
              </div>
              {y.otPartial && (
                <div className="text-sm mt-3 px-3 py-2 rounded" style={{ background: C.amberSoft, color: C.amber }}>
                  This overtime total came from a stub that wasn't the last one of the year, so the real
                  figure is higher. Replace it with the year-to-date overtime from the final stub.
                </div>
              )}
              <div className="text-sm mt-3" style={{ color: C.accent }}>
                {y.year <= 2024
                  ? "The overtime deduction starts with tax year 2025, so this year doesn't qualify — the figures are here for comparison only."
                  : "Worth checking whether your return for this year claimed it. Employers weren't required to report qualifying overtime on 2025 W-2s, so it's easy to have been missed."}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-4 mt-3 text-sm" style={{ color: C.muted }}>
            {HAS_HSA && <span>HSA {money(y.hsaTotal)} {n(y.hsaEmployer) ? `(yours ${money(n(y.hsa))} + employer ${money(n(y.hsaEmployer))})` : ""}</span>}

          </div>

          <button onClick={() => setEditing(years.find((x) => x.id === y.id))}
            className="mt-3 text-xs underline" style={{ color: C.accent }}>edit {y.year}</button>
        </Panel>
      ))}

      {rows.length > 0 && ytd.gross > 0 && (
        <Panel title="Against 2026 so far"
          note="2026 is still part-way through, so compare the rates rather than the totals.">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${C.ink}` }}>
                  {["Year", PAY_TYPE === "salary" ? "Salary" : "Hourly rate", "Gross", "Tax rate", "401k rate", "Take home rate"].map((c, i) => (
                    <th key={c} className={`py-2 text-xs uppercase tracking-wider ${i ? "text-right" : "text-left"}`}
                      style={{ color: C.muted }}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((y) => (
                  <tr key={y.id} style={{ borderBottom: `1px solid ${C.rule}` }}>
                    <td className="py-1.5">{y.year}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: MONO }}>
                      {rateOf(y) ? money(rateOf(y)) : "—"}
                      {(() => {
                        const prev = rows.find((r) => r.year === y.year - 1);
                        const from = prev && rateOf(prev) ? rateOf(prev) : n(y.priorRate);
                        if (!from || !rateOf(y) || from === rateOf(y)) return null;
                        const ch = (rateOf(y) / from - 1) * 100;
                        return <span style={{ color: C.muted }}>{` +${ch.toFixed(1)}%`}</span>;
                      })()}
                    </td>
                    <td className="py-1.5 text-right" style={{ fontFamily: MONO }}>{money(y.gross)}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: MONO }}>{pctS(pct(y.taxTotal, y.gross))}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: MONO }}>{pctS(pct(y.retirement, y.gross))}</td>
                    <td className="py-1.5 text-right" style={{ fontFamily: MONO }}>{pctS(pct(y.takeHome, y.gross))}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-1.5" style={{ fontWeight: 700 }}>2026 so far</td>
                  <td className="py-1.5 text-right" style={{ fontFamily: MONO, fontWeight: 700 }}>
                    {money(curRate())}
                    {(() => {
                      const prev = rows.find((r) => r.year === 2025);
                      if (!prev || !rateOf(prev)) return null;
                      const ch = (curRate() / rateOf(prev) - 1) * 100;
                      return <span style={{ fontWeight: 400, color: C.muted }}>{` +${ch.toFixed(1)}%`}</span>;
                    })()}
                  </td>
                  <td className="py-1.5 text-right" style={{ fontFamily: MONO, fontWeight: 700 }}>{money(ytd.gross)}</td>
                  <td className="py-1.5 text-right" style={{ fontFamily: MONO, fontWeight: 700 }}>{pctS(pct(ytd.taxTotal, ytd.gross))}</td>
                  <td className="py-1.5 text-right" style={{ fontFamily: MONO, fontWeight: 700 }}>{pctS(pct(ytd.retirement, ytd.gross))}</td>
                  <td className="py-1.5 text-right" style={{ fontFamily: MONO, fontWeight: 700 }}>{pctS(pct(ytd.takeHome, ytd.gross))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

function YearForm({ entry, onSave, onCancel, onDelete }) {
  const [f, setF] = useState(entry);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const d = deriveYear(f);
  return (
    <div className="rounded p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
      <div className="text-xs uppercase tracking-wider mb-2" style={{ color: C.muted }}>
        Year-to-date column of that year's final stub
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MoneyField label="Year" value={f.year ?? ""} onChange={set("year")} hint="e.g. 2024" />
        {YEAR_FIELDS.filter(([k]) => yearFieldShown(k)).map(([k, l]) => (
          <MoneyField key={k} label={l} value={f[k] ?? ""} onChange={set(k)} />
        ))}
      </div>
      <label className="block mt-3">
        <div className="text-xs mb-1" style={{ color: C.muted }}>Note</div>
        <input value={f.note ?? ""} onChange={set("note")} placeholder="Where these figures came from"
          className="w-full px-2 py-1.5 rounded text-sm"
          style={{ border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }} />
      </label>
      {d.gross > 0 && (
        <div className="mt-3 px-3 py-2 rounded text-sm" style={{ background: C.paper, color: C.muted }}>
          Taxes {money(d.taxTotal)} · {pctS(pct(d.taxTotal, d.gross))} of gross · landed in checking {money(d.takeHome)}
          {d.otPay > 0 ? ` · qualifying overtime ${money(d.qualifiedOt)}` : ""}
        </div>
      )}
      <div className="flex gap-2 mt-4">
        <button onClick={() => onSave({ ...f, year: n(f.year) || f.year })} disabled={!n(f.year) || !n(f.gross)}
          className="px-4 py-2 rounded text-sm"
          style={{ background: !n(f.year) || !n(f.gross) ? C.rule : C.ink,
            color: !n(f.year) || !n(f.gross) ? C.muted : C.card, fontWeight: 600 }}>Save year</button>
        <button onClick={onCancel} className="px-4 py-2 rounded text-sm"
          style={{ border: `1px solid ${C.rule}`, color: C.ink }}>Cancel</button>
        {onDelete && <button onClick={onDelete} className="px-4 py-2 rounded text-sm ml-auto" style={{ color: C.red }}>Delete</button>}
      </div>
    </div>
  );
}

function TaxMix({ rows, ytd }) {
  const full = rows.filter((r) => r.hasSplit);
  if (!full.length) return null;
  const sum = (k) => full.reduce((s, r) => s + n(r[k]), 0);
  const parts = [
    { key: "federal", label: "Federal", ck: "s1", note: "The only one your W-4 controls" },
    { key: "socSec", label: "Social Security", ck: "s2", note: "Flat 6.2% of taxable wages" },
    { key: "state", label: "State", ck: "s3", note: "State withholding" },
    { key: "medicare", label: "Medicare", ck: "s4", note: "Flat 1.45%, no cap" },
  ].map((p) => ({ ...p, val: sum(p.key) }));
  const total = parts.reduce((s, p) => s + p.val, 0);
  const gross = full.reduce((s, r) => s + r.gross, 0);
  const partial = full.length < ytd.count;

  return (
    <Panel title="What the tax bite is made of"
      note={partial
        ? `Based on the ${full.length} of ${ytd.count} paychecks with a full breakdown.`
        : "Every paycheck this year, broken into its four statutory lines."}>
      <div className="flex h-8 rounded overflow-hidden mb-3" style={{ border: `1px solid ${C.rule}` }}>
        {parts.map((p) => (
          <div key={p.key} title={`${p.label} ${money(p.val)}`}
            style={{ width: `${(p.val / total) * 100}%`, background: C[p.ck] }} />
        ))}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {parts.map((p) => (
            <tr key={p.key} style={{ borderBottom: `1px solid ${C.rule}` }}>
              <td className="py-2 pr-2">
                <span style={{ width: 10, height: 10, background: C[p.ck], borderRadius: 2, display: "inline-block", marginRight: 8 }} />
                <span style={{ fontWeight: 600 }}>{p.label}</span>
                <div className="text-xs ml-4" style={{ color: C.muted }}>{p.note}</div>
              </td>
              <td className="py-2 text-right" style={{ fontFamily: MONO }}>{money(p.val)}</td>
              <td className="py-2 text-right" style={{ fontFamily: MONO, color: C.muted }}>
                {pctS(pct(p.val, gross))} of gross
              </td>
              <td className="py-2 text-right" style={{ fontFamily: MONO, color: C.muted }}>
                {pctS(pct(p.val, total))} of tax
              </td>
            </tr>
          ))}
          <tr>
            <td className="py-2" style={{ fontWeight: 700 }}>Total</td>
            <td className="py-2 text-right" style={{ fontFamily: MONO, fontWeight: 700 }}>{money(total)}</td>
            <td className="py-2 text-right" style={{ fontFamily: MONO, fontWeight: 700 }}>{pctS(pct(total, gross))}</td>
            <td />
          </tr>
        </tbody>
      </table>
      <div className="text-sm mt-3" style={{ color: C.muted }}>
        Social Security and Medicare are fixed rates you can't change. Federal and state
        are withholding estimates, and they're the part that settles up at filing.
      </div>
    </Panel>
  );
}

function ChecksTab({ rows }) {
  const paychecks = rows.filter((r) => !r.isAdj && r.gross > 0);
  const gaps = missingPaychecks(paychecks);
  const withFlags = rows.map((r) => ({ r, flags: auditRow(r) })).filter((x) => x.flags.length);
  const serious = withFlags.filter((x) => x.flags.some((f) => f.level !== "info"));
  const missing = rows.filter((r) => !r.isAdj && !r.hasSplit && r.gross > 0);

  return (
    <div className="space-y-4">
      <Panel title="What gets checked">
        <ul className="text-sm space-y-1" style={{ color: C.muted }}>
          <li>· Medicare should be exactly 1.45% of gross minus pre-tax benefits</li>
          <li>· Social Security should be exactly 6.2% of the same figure</li>
          <li>· The four tax sub-lines should add up to the tax total</li>
          <li>· Every dollar of gross should land in a category</li>
          <li>· Retirement should hold at 20.00% of gross</li>
          {PAY_TYPE !== "salary" && <li>· When hours are entered, hours × rate should equal gross, at the rate on that paycheck</li>}
          <li>· Paychecks should arrive every 14 days with none skipped</li>
        </ul>
        <div className="text-sm mt-3" style={{ color: C.muted }}>
          W-2 adjustments skip all of this. Nothing was withheld and no cash moved, so there is nothing to reconcile.
        </div>
        <div className="text-xs mt-2" style={{ color: C.muted }}>
          Rate checks allow {money(TOL)} of slack, since payroll rounds each line.
        </div>
      </Panel>

      {gaps.length > 0 && (
        <Panel title={`${gaps.length} paycheck${gaps.length === 1 ? "" : "s"} missing`}
          note="Your pay lands every 14 days, and these dates have nothing logged.">
          <div className="space-y-1">
            {gaps.map((g) => (
              <div key={g.expected} className="text-sm px-2 py-1.5 rounded"
                style={{ background: C.amberSoft, color: C.amber, fontFamily: MONO }}>
                {g.expected} — between {g.after} and {g.before}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {serious.length === 0 && gaps.length === 0 && (
        <div className="rounded px-4 py-3 text-sm" style={{ background: C.greenSoft, color: C.green }}>
          Nothing looks wrong. Every logged paycheck balances.
        </div>
      )}

      {withFlags.map(({ r, flags }) => (
        <div key={r.id} className="rounded p-3" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <div className="flex justify-between items-baseline">
            <div style={{ fontWeight: 600 }}>{r.label}</div>
            <div className="text-xs" style={{ color: C.muted, fontFamily: MONO }}>{r.date} · {money(r.gross)}</div>
          </div>
          <div className="mt-2 space-y-1">
            {flags.map((f, i) => (
              <div key={i} className="text-sm px-2 py-1.5 rounded"
                style={{
                  background: f.level === "bad" ? C.redSoft : f.level === "warn" ? C.amberSoft : C.paper,
                  color: f.level === "bad" ? C.red : f.level === "warn" ? C.amber : C.muted,
                }}>{f.msg}</div>
            ))}
          </div>
        </div>
      ))}

      {missing.length > 0 && (
        <Panel title={`Backfill queue — ${missing.length} paychecks`}
          note="These have a tax total but no breakdown. Open each stub and fill in the four lines.">
          <div className="flex flex-wrap gap-2">
            {missing.map((r) => (
              <span key={r.id} className="text-xs px-2 py-1 rounded"
                style={{ background: C.paper, fontFamily: MONO }}>{r.label}</span>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ---------------- backup ---------------------------------------- */
function DataTab({ rows, exportCSV, importCSV, csvText, setCsvText, years, downloadBackup, restoreBackup,
                   backupText, setBackupText, confirmReset, setConfirmReset, reset, reseed }) {
  const [copied, setCopied] = useState(false);
  const [pendingRestore, setPendingRestore] = useState("");
  const restoreRef = useRef(null);
  const fileRef = useRef(null);
  const [paste, setPaste] = useState("");
  const [mode, setMode] = useState("merge");

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = new FileReader();
    r.onload = () => importCSV(String(r.result), mode);
    r.readAsText(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-4">
      <Panel title="Full backup"
        note="Everything: paychecks, past years and your settings. This is the file to keep.">
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadBackup} className="px-4 py-2 rounded text-sm"
            style={{ background: C.ink, color: C.card, fontWeight: 600 }}>
            Download backup ({rows.length} paychecks, {years.length} years)
          </button>
          <button onClick={() => restoreRef.current && restoreRef.current.click()} className="px-4 py-2 rounded text-sm"
            style={{ border: `1px solid ${C.rule}`, fontWeight: 600 }}>Restore from a backup file</button>
          <input ref={restoreRef} type="file" accept=".json,application/json" className="hidden"
            onChange={(e) => {
              const file = e.target.files && e.target.files[0];
              e.target.value = "";
              if (!file) return;
              const r = new FileReader();
              r.onload = () => setPendingRestore(String(r.result));
              r.readAsText(file);
            }} />
        </div>

        {pendingRestore && (
          <div className="mt-3 px-3 py-2 rounded text-sm" style={{ background: C.redSoft, color: C.red }}>
            <div>Restoring replaces everything in the ledger, on every device. Download a backup first if you haven't.</div>
            <div className="flex flex-wrap gap-2 mt-2">
              <button onClick={() => { restoreBackup(pendingRestore); setPendingRestore(""); }}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: C.red, color: C.card, fontWeight: 600 }}>Restore and replace</button>
              <button onClick={() => setPendingRestore("")} className="px-3 py-1.5 rounded text-sm"
                style={{ border: `1px solid ${C.rule}`, color: C.ink }}>Cancel</button>
            </div>
          </div>
        )}

        {backupText && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <button onClick={() => { const t = document.getElementById("backup-text"); if (t) { t.focus(); t.select(); } }}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: C.accentSoft, color: C.accent, fontWeight: 600 }}>Select all</button>
              <button onClick={() => setBackupText("")} className="px-3 py-1.5 rounded text-sm"
                style={{ border: `1px solid ${C.rule}`, color: C.muted }}>Hide</button>
              <span className="text-xs" style={{ color: C.muted }}>Save it as a file ending in .json</span>
            </div>
            <textarea id="backup-text" readOnly value={backupText} rows={6}
              className="w-full px-2 py-1.5 rounded text-xs"
              style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper, color: C.ink }} />
          </div>
        )}

        <div className="text-sm mt-3" style={{ color: C.muted }}>
          Do this after each paycheck. It takes a few seconds, and it's the copy that doesn't depend on this page.
        </div>
      </Panel>

      <Panel title="Paychecks as a spreadsheet"
        note="A CSV of this year's paychecks for Excel — your columns plus the percentage rows. It does not carry past years or settings, so it isn't a full backup.">
        <button onClick={exportCSV} className="px-4 py-2 rounded text-sm"
          style={{ background: C.ink, color: C.card, fontWeight: 600 }}>
          Export {rows.length} rows
        </button>
        <div className="text-sm mt-2" style={{ color: C.muted }}>
          Do this after each entry, not quarterly. It takes five seconds and it's the copy nobody can take away from you.
        </div>
        {csvText && (
          <div className="mt-3">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(csvText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  } catch {
                    // Clipboard blocked here: select the text so a long-press or Ctrl+C copies it.
                    const ta = document.getElementById("csv-export-text");
                    if (ta) { ta.focus(); ta.select(); }
                    setCopied("manual");
                  }
                }}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: copied ? C.greenSoft : C.accentSoft, color: copied ? C.green : C.accent, fontWeight: 600 }}>
                {copied === "manual" ? "Selected — now press Ctrl+C (or long-press → Copy)" : copied ? "Copied" : "Copy all to clipboard"}
              </button>
              <button onClick={() => setCsvText("")} className="px-3 py-1.5 rounded text-sm"
                style={{ border: `1px solid ${C.rule}`, color: C.muted }}>Hide</button>
              <span className="text-xs" style={{ color: C.muted }}>
                Paste into a blank sheet, or save as a .csv file.
              </span>
            </div>
            <textarea id="csv-export-text" readOnly value={csvText} rows={8}
              onFocus={(e) => e.target.select()}
              className="w-full px-2 py-1.5 rounded text-xs"
              style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper, whiteSpace: "pre" }} />
          </div>
        )}
      </Panel>

      <Panel title="Restore from CSV"
        note="Reads paychecks back from a CSV. For everything at once, use the full backup above.">
        <div className="flex gap-2 mb-3">
          {[["merge", "Add new rows only"], ["replace", "Replace everything"]].map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className="px-3 py-1.5 rounded text-xs"
              style={{
                background: mode === k ? C.accentSoft : "transparent",
                color: mode === k ? C.accent : C.muted,
                border: `1px solid ${mode === k ? C.accent : C.rule}`,
                fontWeight: mode === k ? 600 : 400,
              }}>{l}</button>
          ))}
        </div>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded text-sm"
          style={{ border: `1px solid ${C.rule}`, fontWeight: 600 }}>Choose a CSV file</button>
        <div className="mt-3">
          <div className="text-xs mb-1" style={{ color: C.muted }}>Or paste CSV text</div>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={4}
            placeholder="Date,Label,Gross,Tax Total,…"
            className="w-full px-2 py-1.5 rounded text-xs"
            style={{ fontFamily: MONO, border: `1px solid ${C.rule}`, background: C.paper }} />
          <button onClick={() => { importCSV(paste, mode); setPaste(""); }}
            disabled={!paste.trim()} className="mt-2 px-3 py-1.5 rounded text-sm"
            style={{ background: paste.trim() ? C.ink : C.rule, color: paste.trim() ? C.card : C.muted }}>
            Import pasted rows
          </button>
        </div>
      </Panel>

      <Panel title="Start over">
        {confirmReset ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm" style={{ color: C.red }}>
              {confirmReset === "reseed"
                ? `This replaces all ${rows.length} rows with the invented sample year. Back up first if you want to keep them.`
                : `This erases all ${rows.length} paychecks, on every device. Export first if you haven't.`}
            </span>
            <button onClick={confirmReset === "reseed" ? reseed : reset} className="px-3 py-1.5 rounded text-sm"
              style={{ background: C.red, color: C.card, fontWeight: 600 }}>
              {confirmReset === "reseed" ? "Replace with the sample year" : "Erase everything"}</button>
            <button onClick={() => setConfirmReset(false)} className="px-3 py-1.5 rounded text-sm"
              style={{ border: `1px solid ${C.rule}` }}>Keep my data</button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setConfirmReset(true)} className="px-3 py-1.5 rounded text-sm"
              style={{ border: `1px solid ${C.rule}`, color: C.red }}>Clear the ledger</button>
            <button onClick={() => setConfirmReset("reseed")} className="px-3 py-1.5 rounded text-sm"
              style={{ border: `1px solid ${C.rule}` }}>Reload the sample year</button>
          </div>
        )}
      </Panel>

      <Panel title="Where this data lives">
        <div className="text-sm space-y-2" style={{ color: C.muted }}>
          <p>Entries are saved privately to your Claude account — only you can see them, and they're the same wherever you open this page. Nothing here connects to your bank or payroll; every figure is one you typed.</p>
          <p>Keep exporting a CSV now and then anyway. It's the copy that doesn't depend on this page.</p>
          <p>Keep account numbers and your SSN out of it. The math doesn't need them.</p>
        </div>
      </Panel>

      <Panel title="This build">
        <div className="text-sm" style={{ color: C.muted }}>
          <span style={{ fontFamily: MONO, color: C.ink, fontWeight: 600 }}>
            Version {BUILD.version}
          </span>
          {" · published "}{BUILD.date}
          <p className="mt-2">If your phone and your computer show different numbers here, one of them is
          running an older copy — reload that page and it'll catch up.</p>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------- shared bits ----------------------------------- */
function Panel({ title, note, children }) {
  return (
    <div className="rounded p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
      <div className="text-xs uppercase tracking-wider" style={{ color: C.muted }}>{title}</div>
      {note && <div className="text-sm mt-1 mb-3" style={{ color: C.muted }}>{note}</div>}
      <div className={note ? "" : "mt-3"}>{children}</div>
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded p-8 text-center" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
      <div style={{ fontWeight: 600 }}>Nothing to chart yet</div>
      <div className="text-sm mt-1" style={{ color: C.muted }}>Log a paycheck and the trends fill in.</div>
    </div>
  );
}
