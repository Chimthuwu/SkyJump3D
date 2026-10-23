// Structural signature + geometry hash for levels/arenas. Pure functions (no DOM, no THREE): shared by the in-page kit and the Node QA tools.
// A "box" is {minx,maxx,miny,maxy,minz,maxz}. Platform-like boxes are the ones with a usable top face (cx/cz/top/hw/hd set, or derived).

const r2 = v => Math.round(v * 100) / 100;

export function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return ('00000000' + h.toString(16)).slice(-8);
}

// Order-independent geometry hash: rounded boxes, sorted. Anything that changes collision geometry changes the hash.
export function geometryHash(boxes, extra = []) {
  const rows = boxes.map(b => [r2(b.minx), r2(b.maxx), r2(b.miny), r2(b.maxy), r2(b.minz), r2(b.maxz), b.bounce ? 1 : 0, b.checkpoint ? 1 : 0].join(','));
  rows.sort();
  return fnv1a(rows.join('|') + '#' + extra.map(e => [r2(e.x), r2(e.y), r2(e.z), e.k || ''].join(',')).sort().join('|'));
}

const pct = (sorted, p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] : 0;

// platforms = boxes with a walkable top. opts.bins = elevation bins (normalised to the level's own height range so shape, not scale, is compared).
export function signature(boxes, opts = {}) {
  const bins = opts.bins || 20;
  const plat = boxes.filter(b => b.top !== undefined || (b.maxy !== undefined && (b.maxx - b.minx) >= 1 && (b.maxz - b.minz) >= 1));
  const tops = plat.map(b => b.top !== undefined ? b.top : b.maxy);
  const hws = plat.map(b => Math.min((b.maxx - b.minx), (b.maxz - b.minz)) / 2).sort((a, b) => a - b);
  const all = boxes.length ? boxes : [{ minx: 0, maxx: 0, miny: 0, maxy: 0, minz: 0, maxz: 0 }];
  const bb = {
    minx: Math.min(...all.map(b => b.minx)), maxx: Math.max(...all.map(b => b.maxx)),
    miny: Math.min(...all.map(b => b.miny)), maxy: Math.max(...all.map(b => b.maxy)),
    minz: Math.min(...all.map(b => b.minz)), maxz: Math.max(...all.map(b => b.maxz)),
  };
  const lo = tops.length ? Math.min(...tops) : 0, hi = tops.length ? Math.max(...tops) : 1, span = Math.max(1e-6, hi - lo);
  const hist = new Array(bins).fill(0);
  for (const t of tops) hist[Math.min(bins - 1, Math.floor((t - lo) / span * bins))]++;
  const total = Math.max(1, tops.length);
  const abs100 = {}; for (const t of tops) { const k = Math.floor(t / 100) * 100; abs100[k] = (abs100[k] || 0) + 1; }
  const sizeHist = { '<2': 0, '2-4': 0, '4-8': 0, '8-16': 0, '16+': 0 };
  for (const w of hws) sizeHist[w < 2 ? '<2' : w < 4 ? '2-4' : w < 8 ? '4-8' : w < 16 ? '8-16' : '16+']++;
  return {
    solids: boxes.length, platforms: plat.length,
    bbox: { x: [r2(bb.minx), r2(bb.maxx)], y: [r2(bb.miny), r2(bb.maxy)], z: [r2(bb.minz), r2(bb.maxz)] },
    footprint: { w: r2(bb.maxx - bb.minx), d: r2(bb.maxz - bb.minz), area: r2((bb.maxx - bb.minx) * (bb.maxz - bb.minz)) },
    elevation: { min: r2(lo), max: r2(hi), span: r2(span), histNorm: hist.map(c => r2(c / total)), abs100 },
    sizes: { median: r2(pct(hws, 0.5)), p90: r2(pct(hws, 0.9)), hist: sizeHist },
    hash: geometryHash(boxes),
  };
}

// Graph metrics from a declared traversal graph: nodes [{id,x,y,z}], edges [{a,b,kind,gap,dy,main?}], start/exit node ids.
export function graphSignature(g) {
  const { nodes, edges, start, exit } = g;
  const adj = new Map(); for (const n of nodes) adj.set(n.id, []);
  for (const e of edges) { adj.get(e.a).push(e.b); if (!e.oneWay) adj.get(e.b).push(e.a); }
  // undirected view for cycle counting
  const und = new Map(); for (const n of nodes) und.set(n.id, new Set());
  for (const e of edges) { und.get(e.a).add(e.b); und.get(e.b).add(e.a); }
  const V = nodes.length, E = new Set(edges.map(e => [e.a, e.b].sort().join('~'))).size;
  // connected components via BFS
  const seen = new Set(); let comps = 0;
  for (const n of nodes) { if (seen.has(n.id)) continue; comps++; const q = [n.id]; seen.add(n.id); while (q.length) { const u = q.pop(); for (const v of und.get(u)) if (!seen.has(v)) { seen.add(v); q.push(v); } } }
  const loops = E - V + comps;                                   // cyclomatic number = independent cycles
  const branchNodes = [...und.values()].filter(s => s.size >= 3).length;   // junctions with >=3 ways out
  // shortest route start->exit (BFS by hops on directed adjacency, then length in metres)
  const byId = new Map(nodes.map(n => [n.id, n])); const prev = new Map([[start, null]]); const q = [start];
  while (q.length) { const u = q.shift(); if (u === exit) break; for (const v of adj.get(u)) if (!prev.has(v)) { prev.set(v, u); q.push(v); } }
  let route = [], len = 0;
  if (prev.has(exit)) { for (let c = exit; c !== null; c = prev.get(c)) route.push(c); route.reverse(); for (let i = 1; i < route.length; i++) { const a = byId.get(route[i - 1]), b = byId.get(route[i]); len += Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z); } }
  const s0 = byId.get(start), s1 = byId.get(exit);
  const gaps = []; for (let i = 1; i < route.length; i++) { const e = edges.find(e => (e.a === route[i - 1] && e.b === route[i]) || (!e.oneWay && e.a === route[i] && e.b === route[i - 1])); if (e) gaps.push(e.gap || 0); }
  gaps.sort((a, b) => a - b);
  const straight = s0 && s1 ? Math.hypot(s0.x - s1.x, s0.z - s1.z) : 0, dy = s0 && s1 ? s1.y - s0.y : 0;
  return {
    nodes: V, edges: E, components: comps, loops, branchNodes,
    reachable: prev.has(exit), route: { hops: route.length - 1, length: r2(len), straightXZ: r2(straight), dy: r2(dy), ratio: straight ? r2(len / straight) : 0 },
    gaps: { n: gaps.length, p50: r2(pct(gaps, 0.5)), p90: r2(pct(gaps, 0.9)), max: r2(gaps[gaps.length - 1] || 0), sorted: gaps.map(r2) },
  };
}

// --- comparisons (used by the anti-reskin rule, see LEVEL-EXPANSION-PLAN.md section 7.1) ---
export function jsDistance(p, q) {            // Jensen-Shannon distance of two normalised histograms (base 2, range 0..1)
  const n = Math.max(p.length, q.length); let d = 0;
  const kl = (a, b) => { let s = 0; for (let i = 0; i < n; i++) if ((a[i] || 0) > 0) s += a[i] * Math.log2(a[i] / b); return s; };
  let s = 0;
  for (let i = 0; i < n; i++) { const a = p[i] || 0, b = q[i] || 0, m = (a + b) / 2; if (a > 0) s += a * Math.log2(a / m) / 2; if (b > 0) s += b * Math.log2(b / m) / 2; }
  return Math.sqrt(Math.max(0, s));
}
export function ksStat(a, b) {                 // two-sample Kolmogorov-Smirnov statistic on sorted arrays
  if (!a.length || !b.length) return 1;
  let i = 0, j = 0, d = 0; const xs = [...a, ...b].sort((x, y) => x - y);
  for (const x of xs) { while (i < a.length && a[i] <= x) i++; while (j < b.length && b[j] <= x) j++; d = Math.max(d, Math.abs(i / a.length - j / b.length)); }
  return d;
}
const ratioFar = (a, b, k) => { const r = a > b ? a / Math.max(1e-9, b) : b / Math.max(1e-9, a); return r >= k; };
const relDiff = (a, b) => Math.abs(a - b) / Math.max(1e-9, Math.max(Math.abs(a), Math.abs(b)));
// A: {sig, graph, topology}. Returns per-axis verdicts and an overall pass (>= need axes AND topology class differs).
export function compareLevels(A, B, need = 5) {
  const ax = [];
  ax.push(['footprint', ratioFar(A.sig.footprint.area, B.sig.footprint.area, 2), `${A.sig.footprint.area} vs ${B.sig.footprint.area}`]);
  const js = jsDistance(A.sig.elevation.histNorm, B.sig.elevation.histNorm);
  const dom = h => h.indexOf(Math.max(...h));
  ax.push(['elevation', js >= 0.25 && dom(A.sig.elevation.histNorm) !== dom(B.sig.elevation.histNorm), `JS ${js.toFixed(2)}`]);
  ax.push(['platforms', ratioFar(A.sig.platforms, B.sig.platforms, 2) || (relDiff(A.sig.sizes.median, B.sig.sizes.median) >= 0.3 && relDiff(A.sig.sizes.p90, B.sig.sizes.p90) >= 0.3), `${A.sig.platforms}/${A.sig.sizes.median}/${A.sig.sizes.p90} vs ${B.sig.platforms}/${B.sig.sizes.median}/${B.sig.sizes.p90}`]);
  const g1 = A.graph, g2 = B.graph;
  const dBr = Math.abs(g1.branchNodes - g2.branchNodes) >= 3, dLp = Math.abs(g1.loops - g2.loops) >= 3;
  ax.push(['branch/loop', (dBr ? 1 : 0) + (dLp ? 1 : 0) >= 1 && (g1.branchNodes !== g2.branchNodes || g1.loops !== g2.loops) && (dBr || dLp), `branches ${g1.branchNodes}/${g2.branchNodes} loops ${g1.loops}/${g2.loops}`]);
  const ks = ksStat(g1.gaps.sorted, g2.gaps.sorted);
  ax.push(['gaps', ks >= 0.30, `KS ${ks.toFixed(2)}`]);
  const o1 = g1.route, o2 = g2.route;
  const objDiff = Math.sign(o1.dy) !== Math.sign(o2.dy) || relDiff(o1.straightXZ, o2.straightXZ) >= 0.4 || relDiff(o1.ratio, o2.ratio) >= 0.4;
  ax.push(['objective', objDiff, `straight ${o1.straightXZ}/${o2.straightXZ} dy ${o1.dy}/${o2.dy} ratio ${o1.ratio}/${o2.ratio}`]);
  ax.push(['topology', A.topology !== B.topology, `${A.topology} vs ${B.topology}`]);
  const n = ax.filter(a => a[1]).length;
  return { axes: ax.map(([k, ok, why]) => ({ axis: k, differs: ok, why })), differing: n, pass: n >= need && A.topology !== B.topology };
}
