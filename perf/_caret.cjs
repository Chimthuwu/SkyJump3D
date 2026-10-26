// compute exact caret column of node --check for .chk_line.mjs and show chars around it
const fs = require('fs');
const { execFileSync } = require('child_process');
try { execFileSync('node', ['--check', '.chk_line.mjs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); console.log('OK?!'); }
catch (e) {
  const err = e.stderr || '';
  console.log(err.split('\n').slice(0, 2).join('\n').replace(/\r/g, '\\r').slice(-80));
  const lines = err.split('\n');
  // find caret line AFTER the source line
  const srcLineIdx = lines.findIndex(l => l.startsWith('  window.__ng.midsDbg'));
  const caretIdx = lines.findIndex((l, i) => i > srcLineIdx && l.includes('^'));
  if (caretIdx >= 0) {
    const src = lines[srcLineIdx];
    const caretLine = lines[caretIdx];
    const col = caretLine.indexOf('^');
    console.log('caret column (0-based):', col);
    console.log('char at col:', JSON.stringify(src[col]), '| prev 10:', JSON.stringify(src.slice(Math.max(0, col - 10), col)), '| next 12:', JSON.stringify(src.slice(col, col + 12)));
  } else console.log('no caret line found. raw:\n' + err);
}
