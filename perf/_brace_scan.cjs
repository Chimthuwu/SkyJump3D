// brace/paren balance scanner for the extracted game module (diagnostic only)
// handles: strings, template literals, // comments, regex literals (heuristic)
const fs = require('fs');
const s = fs.readFileSync('.chk_module.mjs', 'utf8');
const lines = s.split('\n');
const stack = [];
let inStr = null;
const RE_PREV = /[({,;=:!&|?+\-*%<>~^[]$/;   // a '/' is regex-ish when preceded by these (or line start)
const KW = /(^|[^\w.])(return|typeof|case|in|of|new|delete|void|do|else|yield|await)$/;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let j = 0;
  let prev = '';                                  // last significant code char (before current)
  while (j < line.length) {
    const c = line[j];
    if (inStr) {
      if (c === '\\') { j += 2; continue; }
      if (c === inStr) inStr = null;
      if (c) prev = c === '\\' ? c : c;
      j++;
      continue;
    }
    if (c === '/' && line[j + 1] === '/') break;
    if (c === '/' && line[j + 1] === '*') { const e = line.indexOf('*/', j + 2); j = e < 0 ? line.length : e + 2; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; j++; continue; }
    if (c === '/') {
      const sofar = line.slice(0, j);
      if (RE_PREV.test(prev) || KW.test(sofar)) {          // regex literal: scan to unescaped '/', respecting char classes
        let k = j + 1, inCls = false;
        while (k < line.length) {
          const r = line[k];
          if (r === '\\') { k += 2; continue; }
          if (r === '[') inCls = true; else if (r === ']') inCls = false;
          else if (r === '/' && !inCls) break;
          k++;
        }
        if (k >= line.length) { console.log('REGEX ran off line at', i + 1, '|', line.slice(0, 160)); }
        j = Math.min(k + 1, line.length);
        prev = 'x';
        continue;
      }
    }
    if (c === '{' || c === '(' || c === '[') { stack.push({ ch: c, line: i + 1, txt: line.slice(0, 80) }); prev = c; j++; continue; }
    if (c === '}' || c === ')' || c === ']') {
      const top = stack.pop();
      if (!top) { console.log('EXTRA CLOSE', c, 'at module line', i + 1, '|', line.slice(0, 160)); process.exit(2); }
      const want = c === '}' ? '{' : c === ')' ? '(' : '[';
      if (top.ch !== want) { console.log('MISMATCH: opened', top.ch, 'at line', top.line, '|', top.txt, '\n  closed by', c, 'at line', i + 1, '|', line.slice(0, 160)); process.exit(2); }
      prev = c; j++;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    j++;
  }
  inStr = null; // template literals spanning lines are a known blind spot of this line scanner
}
if (stack.length) console.log('UNCLOSED:', stack.length, JSON.stringify(stack.slice(-10), null, 1));
else console.log('BALANCED');
