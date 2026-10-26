// Syntax-check every <script> block in index.html with node --check.
// JSON (importmap/ld+json) blocks are skipped; type="module" blocks are checked as ESM (.mjs).
const fs = require('fs');
const cp = require('child_process');
const html = fs.readFileSync('index.html', 'utf8');
const declRe = /<script([^>]*)>([\s\S]*?)<\/script>/g;
let n = 0, checked = 0;
let m;
while ((m = declRe.exec(html))) {
  const attrs = m[1], body = m[2];
  if (!body.trim()) continue;
  n++;
  const typeM = attrs.match(/type\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const type = (typeM ? (typeM[1] || typeM[2] || typeM[3] || '') : '').toLowerCase();
  if (/importmap|ld\+json|speculationrules/.test(type)) continue;   // JSON payloads, not scripts
  const isModule = type === 'module';
  const file = isModule ? '.chkj.mjs' : '.chkj.js';
  fs.writeFileSync(file, body);
  checked++;
  try {
    cp.execSync('node --check ' + file, { stdio: 'pipe' });
  } catch (e) {
    console.log('SYNTAX FAIL in script block #' + n + ' (type=' + (type || 'classic') + '):');
    console.log(String(e.stderr).slice(0, 2000));
    process.exit(1);
  } finally {
    try { fs.unlinkSync(file); } catch {}
  }
}
console.log('SYNTAX OK (' + checked + ' checked / ' + n + ' script blocks, JSON skipped)');
