// Builds the whole app into one self-contained HTML page (for hosts that serve a single file).
// Usage: node scripts/build-single.mjs <out.html>
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.resolve(process.argv[2] || path.join(root, 'dist-single.html'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gag-single-'));

await build({
  root,
  logLevel: 'warn',
  build: { outDir: tmp, emptyOutDir: true, modulePreload: false, cssCodeSplit: false, rollupOptions: { output: { inlineDynamicImports: true } } }
});

const assets = path.join(tmp, 'assets');
const files = fs.readdirSync(assets);
const css = files.filter((f) => f.endsWith('.css')).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n');
const js = files.filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(path.join(assets, f), 'utf8')).join('\n').replace(/<\/script/gi, '<\\/script');

const page = `<title>המשחקייה על הגג</title>
<meta name="description" content="משחקי מסיבה בעברית בהשראת פינות מהפודקאסט — לא רשמי." />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;700;900&family=Secular+One&display=swap" rel="stylesheet" />
<style>${css}</style>
<div id="root" lang="he" dir="rtl"></div>
<script>document.documentElement.lang = 'he'; document.documentElement.dir = 'rtl';</script>
<script type="module">${js}</script>
`;
fs.writeFileSync(out, page);
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`wrote ${out} (${(page.length / 1024).toFixed(0)} KB)`);
