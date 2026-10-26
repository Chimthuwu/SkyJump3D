// bisect the midsDbg line: which half/fragment actually offends? (node --check each candidate)
const fs = require('fs');
const line = fs.readFileSync('.chk_line.mjs', 'utf8').replace(/\r?\n$/, '');
const cands = {
  full: line,
  noGuards: line.replace(/, guards: enemies\.filter\(u => !u\.dead && u\.midGuard\)\.map\(u => [`'][^`']*[`']\)$/, ')'),
  noMid: line.replace(/, mid: commons && commons\.mid \? .*?\)\) : null/, ', mid: null'),
  noObj: 'window.__ng.midsDbg = () => ({ state: 1, mid: null });',
};
for (const [name, txt] of Object.entries(cands)) {
  if (txt === line && name !== 'full') continue;   // replacement didn't hit
  fs.writeFileSync('.chk_frag.mjs', txt + '\n');
  const { status } = require('child_process').spawnSync('node', ['--check', '.chk_frag.mjs'], { encoding: 'utf8' });
  console.log(name + ': ' + (status === 0 ? 'OK' : 'FAIL'));
}
// then split the guards tail itself
const guards = line.match(/guards: enemies\.filter.*/)[0].replace(/\)\);\s*$/, '));');
fs.writeFileSync('.chk_frag.mjs', 'const f = (paused, state) => ' + guards.replace(/^guards/, 'document').replace(/enemies\.filter/, 'document').slice(0, 0) || '');
const guardsExpr = line.match(/enemies\.filter\(u => !u\.dead && u\.midGuard\)\.map\(u => .*\)\) ?;?/);
if (guardsExpr) {
  fs.writeFileSync('.chk_frag.mjs', 'const enemies = []; const f = (enemies) => ({guards: enemies.filter(u => !u.dead && u.midGuard).map(u => `/${u.midGuard}@${Math.round(u.x)}`)});\n');
  const { status } = require('child_process').spawnSync('node', ['--check', '.chk_frag.mjs'], { encoding: 'utf8' });
  console.log('guardsExpr: ' + (status === 0 ? 'OK' : 'FAIL'));
}
