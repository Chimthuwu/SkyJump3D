// T-STATIC (node, no browser): build a spec against a mock host, then lint its declared graph, check solid overlaps, reachability and compute its signature.
// This is a NECESSARY check only (structure). Collision/gameplay proof is the browser route test (t-route.cjs).
import { createKit } from '../levels/kit.js';
import { graphSignature, signature, compareLevels } from '../levels/sig.js';
import * as THREE from '../.qa-cache/three/package/build/three.module.js';
const id = process.argv[2] || 'od';
const mod = (await import(`../levels/${id}.js`)).default;
const solids = [];
const host = { THREE, lam: () => ({ dispose() {} }), retroMaterials: new Set(), addSolid: (a, b, c, d, e, f) => { const s = { minx: a, maxx: b, miny: c, maxy: d, minz: e, maxz: f }; solids.push(s); return s; },
  missionRandom: () => () => 0.5, buildSky() {}, toast() {}, showMsg() {}, now: () => 0, scene: { add() {} }, setZone() {}, player: { pos: {}, vel: {} }, setStart() {}, setBounds() {}, complete() {} };
const kit = createKit(host);
const t0 = performance.now(); const res = mod.build(kit); kit.finish(); const ms = performance.now() - t0;
const out = { id, buildMs: Math.round(ms), solids: solids.length };
out.lint = kit.lintGraph(); out.lintCount = out.lint.length;
// overlaps (volume intersections): touching faces are fine
const eps = 0.02; const over = [];
for (let i = 0; i < solids.length; i++) for (let j = i + 1; j < solids.length; j++) {
  const a = solids[i], b = solids[j];
  if (Math.min(a.maxx, b.maxx) - Math.max(a.minx, b.minx) > eps && Math.min(a.maxy, b.maxy) - Math.max(a.miny, b.miny) > eps && Math.min(a.maxz, b.maxz) - Math.max(a.minz, b.minz) > eps) over.push([i, j]);
}
out.overlaps = over.length; out.overlapSamples = over.slice(0, 8).map(([i, j]) => [solids[i], solids[j]].map(s => `x${s.minx.toFixed(1)}..${s.maxx.toFixed(1)} y${s.miny.toFixed(1)}..${s.maxy.toFixed(1)} z${s.minz.toFixed(1)}..${s.maxz.toFixed(1)}`));
// head-room: any solid whose underside is within 1.8 m above another solid's top where xz overlap (player would bonk)
let bonk = 0; const bonkS = [];
for (const a of solids) for (const b of solids) { if (a === b) continue; const xo = Math.min(a.maxx, b.maxx) - Math.max(a.minx, b.minx) > 0.3, zo = Math.min(a.maxz, b.maxz) - Math.max(a.minz, b.minz) > 0.3; if (!xo || !zo) continue; const gap = b.miny - a.maxy; if (gap > 0.02 && gap < 1.9 && a.maxy - a.miny >= 0.3) { bonk++; if (bonkS.length < 6) bonkS.push(`top y${a.maxy.toFixed(1)} under y${b.miny.toFixed(1)} at x${a.minx.toFixed(0)} z${a.minz.toFixed(0)}`); } }
out.headroomViolations = bonk; out.headroomSamples = bonkS;
const g = kit.graph(res.start, res.exit);
{ const und = new Map(g.nodes.map(n => [n.id, []])); for (const e of g.edges) { und.get(e.a).push(e.b); und.get(e.b).push(e.a); } const seen = new Set([res.start]), q = [res.start]; while (q.length) { const u = q.pop(); for (const v of und.get(u)) if (!seen.has(v)) { seen.add(v); q.push(v); } } out.disconnected = g.nodes.filter(n => !seen.has(n.id)).map(n => n.id); } const gs = graphSignature(g); out.graphGaps = gs.gaps.sorted; delete gs.gaps.sorted; out.graph = gs;
const ss = kit.sig(); out.sig = ss;
if (process.argv.includes('--json')) console.log(JSON.stringify(out)); else console.log(JSON.stringify(out, null, 1));
const bad = out.lintCount || out.overlaps || !gs.reachable || out.disconnected.length || out.headroomViolations;
process.exit(bad ? 1 : 0);
