/* Bundles the app into one self-contained HTML file in dist/.
   No network requests at runtime: React and the CSS are inlined. */
import { build } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";

await mkdir("dist", { recursive: true });
const out = await build({
  entryPoints: ["src/entry.jsx"],
  bundle: true, minify: true, write: false,
  loader: { ".jsx": "jsx" },
  define: { "process.env.NODE_ENV": '"production"' },
});
const js = out.outputFiles[0].text.replaceAll("</script", "<\\/script");
const css = await readFile("src/utils.css", "utf8");

const html = `<title>Paycheck Ledger Demo</title>
<style>
  :root { --ground: #F1F3F2; --ink: #16211F; --focus: #0B6B5C; }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --ground: #111817; --ink: #E7EEEB; --focus: #59C9B1; }
  }
  :root[data-theme="dark"] { --ground: #111817; --ink: #E7EEEB; --focus: #59C9B1; }
  html, body { background: var(--ground); }
  body { margin: 0; color: var(--ink); color-scheme: light dark; line-height: 1.5; -webkit-text-size-adjust: 100%; }
  input:focus-visible, button:focus-visible, select:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
  table { font-variant-numeric: tabular-nums; }
  @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
${css}
</style>
<div id="root"></div>
<script>${js}</script>
`;
await writeFile("dist/paycheck-ledger.html", html);
console.log(`built dist/paycheck-ledger.html (${(html.length / 1024).toFixed(0)} KB)`);
