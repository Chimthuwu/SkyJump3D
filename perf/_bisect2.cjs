// shrink the mid: expression
const fs = require('fs');
const { execFileSync } = require('child_process');
const line = fs.readFileSync('.chk_line.mjs', 'utf8').replace(/\r?\n$/, '');
const midSpan = line.match(/mid: .*(?=: null, guards)/)[0];
console.log('mid span:', midSpan);

const objs = [
  ['obj-full', "{ x: Math.round(s.x), z: Math.round(s.z), y: Math.round(s.y), woken: !!s.woken, guardCd: +(+s.guardCd).toFixed(2), waves: s.waves, bossSpawned: !!s.bossSpawned, bossDead: !!s.bossDead }"],
  ['obj-guardcd', "{ guardCd: +(+s.guardCd).toFixed(2) }"],
  ['obj-rounds', "{ x: Math.round(s.x) }"],
  ['obj-none', "{}"],
];
for (const [name, objTxt] of objs) {
  const cand = `const commons = { mid: {} }; const s = commons.mid.k; const f = (commons) => commons && commons.mid ? Object.fromEntries(['nest'].map(k => { const s = commons.mid[k]; return [k, s ? ${objTxt} : null; }])) : null;`;
  fs.writeFileSync('.chk_frag.mjs', cand + '\n');
  try { execFileSync('node', ['--check', '.chk_frag.mjs'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); console.log(name + ': OK'); }
  catch (e) { console.log(name + ': FAIL | ' + (e.stderr || '').split('\n').slice(0, 4).join(' | ')); }
}
