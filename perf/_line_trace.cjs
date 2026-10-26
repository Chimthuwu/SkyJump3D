// print the full push/close event stream for one line of the extracted module
const fs = require('fs');
const lines = fs.readFileSync('.chk_module.mjs', 'utf8').split('\n');
const line = lines[Number(process.argv[2] || 11424) - 1];
const stack = [];
let inStr = null;
let j = 0;
const checks = [];
while (j < line.length) {
  const c = line[j];
  if (inStr) { if (c === '\\') { j += 2; continue; } if (c === inStr) { inStr = null; j++; continue; } j++; continue; }
  if (c === '/' && line[j + 1] === '/') break;
  if (c === '"' || c === "'" || c === '`') { inStr = c; j++; checks.push(j, 'OPEN-STR ' + c); continue; }
  if ('{(['.includes(c)) { stack.push({ ch: c, ctx: line.slice(Math.max(0, j - 12), j + 12) }); checks.push(j, 'PUSH ' + c + ' | ' + line.slice(Math.max(0, j - 12), j + 12)); j++; continue; }
  if ('})]'.includes(c)) {
    const top = stack.pop();
    checks.push(j, 'CLOSE ' + c + ' | top:' + (top ? top.ch + '@…' + top.ctx.slice(-16) : 'EMPTY') + ' | ' + line.slice(Math.max(0, j - 12), j + 12));
    j++; continue;
  }
  j++;
}
console.log(checks.join('\n'));
