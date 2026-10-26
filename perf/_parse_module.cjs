// REAL ES-module parse of the game script (vm.SourceTextModule) — catches top-level
// awaits/imports/exports that the new Function probe misses, with accurate line:col.
// run: NODE_OPTIONS=--experimental-vm-modules node perf/_parse_module.cjs
const fs = require('fs');
const vm = require('vm');
const SRC = fs.readFileSync('index.html', 'utf8');
const lines = SRC.split('\n');
let idx = -1;
for (let i = 0; i < lines.length; i++) {
  if (/<script(\s|>)/.test(lines[i]) && /type\s*=\s*["']?module["']?/.test(lines[i])) { idx = i + 1; break; }
}
if (idx < 0) { console.log('no inline module script found'); process.exit(2); }
const end = lines.findIndex((l, i) => i >= idx && /<\/script>/.test(l));
const code = lines.slice(idx, end).join('\n');   // idx: 1-based line OF the tag -> 0-based index of the first code line
console.log('module block: lines ' + idx + '..' + (end + 1) + ' (' + code.split('\n').length + ' lines)');
try {
  new vm.SourceTextModule(code, { identifier: 'game-module' });
  console.log('PARSE OK');
} catch (e) {
  console.log('PARSE ERROR:', e.message);
  const ln = e.lineNumber, col = e.columnNumber;
  if (typeof ln === 'number') {
    console.log('at line ' + (idx + ln + 1) + ' col ' + (col + 1));
    for (let i = Math.max(idx, idx + ln - 4); i <= Math.min(lines.length - 1, idx + ln + 3); i++) {
      console.log((i === idx + ln ? '>> ' : '   ') + (i + 1) + ': ' + lines[i]);
    }
  } else console.log(e.stack || String(e));
  process.exit(1);
}
