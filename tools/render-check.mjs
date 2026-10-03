/* Type-free syntax check plus a server-side render of every tab, using a stub
   for the browser APIs. Catches "white screen" bugs without a browser. */
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const React = require("react");
const { renderToString } = require("react-dom/server");
const APP = new URL("../src/app.jsx", import.meta.url).pathname;
const src = readFileSync(APP, "utf8");

const diag = ts.transpileModule(src, {
  reportDiagnostics: true, fileName: "app.jsx",
  compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
});
if (diag.diagnostics?.length) {
  for (const d of diag.diagnostics) {
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    console.error(`app.jsx:${line + 1}  ${ts.flattenDiagnosticMessageText(d.messageText, "\n")}`);
  }
  process.exit(1);
}
console.log("syntax ok");

globalThis.window = { storage: undefined, matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }) };
globalThis.document = { documentElement: { getAttribute: () => null } };
globalThis.MutationObserver = class { observe() {} disconnect() {} };

const TABS = ["log", "forecast", "trends", "checks", "years", "tax", "data"];
let failed = false;
for (const tab of TABS) {
  const patched = src
    .replace('const [entries, setEntries] = useState([]);', 'const [entries, setEntries] = useState(SEED);')
    .replace('const [tab, setTab] = useState("log");', `const [tab, setTab] = useState(${JSON.stringify(tab)});`);
  const js = ts.transpileModule(patched, { compilerOptions: { jsx: ts.JsxEmit.React, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const m = new Module(APP);
  m.filename = APP;
  m.paths = Module._nodeModulePaths(new URL("../src", import.meta.url).pathname);
  try {
    m._compile(js, APP);
    const html = renderToString(React.createElement(m.exports.default));
    if (html.includes("Something broke while drawing")) throw new Error("error boundary tripped");
    console.log(`  ${tab.padEnd(9)} rendered ${html.length} chars`);
  } catch (e) {
    failed = true;
    console.error(`  ${tab.padEnd(9)} FAILED: ${e.message}`);
  }
}
process.exit(failed ? 1 : 0);
