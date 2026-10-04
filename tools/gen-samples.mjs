/* Regenerates the sample paychecks in src/seed.example.js from the pay
   formulas in src/profile.js, so the sample always matches the model and no
   figure is typed by hand. Gross pay, hours, dates and labels are kept; every
   deduction is recomputed for the default setup.

     node tools/gen-samples.mjs        (then: npm run setup && npm test) */
import { readFile, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { defaultSetup, payroll } from "../src/profile.js";

const file = new URL("../src/seed.example.js", import.meta.url);
const { SEED, SALARY_SEED, PAY } = await import(pathToFileURL(new URL("../src/seed.example.js", import.meta.url).pathname).href + "?t=" + Date.now());
const D = defaultSetup(PAY);

const redo = (list) => list.map((e) => {
  if (e.type === "adjustment") return e;
  const p = payroll(e.gross, D, PAY, e.dental);
  const keep = { ...e };
  for (const k of ["taxTotal", "federal", "socSec", "medicare", "state", "benefits", "hsa", "dental", "retirement", "espp", "savings"]) {
    if (k in keep) keep[k] = p[k];
  }
  return keep;
});

let text = await readFile(file, "utf8");
const swap = (name, list) => {
  // Each array is written `const NAME = [ ... ].map(...)`, the .map adding ids.
  // Replace only the [ ... ] part, without the ids.
  const start = text.indexOf(`const ${name} = [`);
  const close = text.indexOf("\n]", start);
  if (start < 0 || close < 0) throw new Error(`can't find ${name}`);
  const plain = list.map(({ id, ...e }) => e);
  text = text.slice(0, start) + `const ${name} = ` + JSON.stringify(plain, null, 1) + text.slice(close + 2);
};
swap("SEED", redo(SEED));
swap("SALARY_SEED", redo(SALARY_SEED));
await writeFile(file, text);
console.log(`regenerated ${SEED.length} hourly and ${SALARY_SEED.length} salaried sample rows`);
