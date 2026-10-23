// The level/arena KIT (contract version 1). index.html hands us `host` (a bridge of closures over its module-scope helpers, see the LEVELKIT:BRIDGE region)
// and we return the only API a level spec may use. Specs never touch game globals directly.
import { signature, graphSignature, geometryHash } from './sig.js';

export const KIT_VERSION = 1;

export function createKit(host) {
  const T = host.THREE;
  const solids = [];               // boxes created through this kit (for signature + dispose)
  const batches = new Map();       // colour -> {pos[], nor[], idx[], n}
  const mats = new Map();          // colour -> material (ours, disposed with the spec)
  const geos = [], meshes = [], dyn = [], extras = [];
  const nodes = [], edges = [];
  let baked = false;

  const matFor = c => { let m = mats.get(c); if (!m) { m = host.lam(c); mats.set(c, m); } return m; };
  function bake(color, cx, cy, cz, w, h, d) {                 // append one box to the merged batch for this colour
    let b = batches.get(color); if (!b) { b = { pos: [], nor: [], idx: [], n: 0 }; batches.set(color, b); }
    const g = new T.BoxGeometry(w, h, d); g.translate(cx, cy, cz);
    const p = g.attributes.position.array, n = g.attributes.normal.array, ix = g.index.array;
    for (let i = 0; i < p.length; i++) b.pos.push(p[i]); for (let i = 0; i < n.length; i++) b.nor.push(n[i]);
    for (let i = 0; i < ix.length; i++) b.idx.push(ix[i] + b.n); b.n += p.length / 3; g.dispose();
  }

  const kit = {
    version: KIT_VERSION, THREE: T,
    rng: tag => host.missionRandom(hashStr('lvl:' + tag)),

    // ---- geometry (collision + merged greybox mesh) ----
    // slab: top-anchored platform. block: base-anchored pillar/wall. Both create one AABB solid; platform tops are walkable.
    slab(cx, top, cz, w, d, thick = 1, color = 0x8a8f9c, flags = null) {
      const s = host.addSolid(cx - w / 2, cx + w / 2, top - thick, top, cz - d / 2, cz + d / 2);
      Object.assign(s, { cx, cz, top, hw: w / 2, hd: d / 2 }); if (flags) Object.assign(s, flags);
      solids.push(s); bake(color, cx, top - thick / 2, cz, w, thick, d); return s;
    },
    block(cx, base, cz, w, h, d, color = 0x6b7586, flags = null) {
      const s = host.addSolid(cx - w / 2, cx + w / 2, base, base + h, cz - d / 2, cz + d / 2);
      Object.assign(s, { cx, cz, top: base + h, hw: w / 2, hd: d / 2 }); if (flags) Object.assign(s, flags);
      solids.push(s); bake(color, cx, base + h / 2, cz, w, h, d); return s;
    },
    // bounce pad: same solid flags the game's own trampolines use (`bounce`, `boost`)
    bouncePad(cx, top, cz, size = 4, boost = 26, color = 0xffd23a) {
      const s = kit.slab(cx, top, cz, size, size, 0.6, color, { bounce: true, boost }); return s;
    },
    // checkpoint: flat pad flagged exactly like the game's own checkpoint solids (physicsStep records it)
    checkpoint(cx, top, cz, color = 0x36f6ff) {
      const s = host.addSolid(cx - 1.6, cx + 1.6, top, top + 0.3, cz - 1.6, cz + 1.6);
      Object.assign(s, { cx, cz, top: top + 0.3, hw: 1.6, hd: 1.6, checkpoint: true }); solids.push(s);
      bake(color, cx, top + 0.15, cz, 3.2, 0.3, 3.2);
      bake(0xdddddd, cx - 1.3, top + 2.3, cz, 0.2, 4, 0.2);
      return s;
    },
    // dynamic visual (beam/diamond/etc): not merged, owned by the spec, removed with the level group. Returns the mesh.
    marker(x, y, z, color = 0xffd23a, height = 40) {
      const g = new T.Group();
      const beam = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, height, 8), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
      beam.position.y = height / 2; const dia = new T.Mesh(new T.OctahedronGeometry(1.1), new T.MeshBasicMaterial({ color })); dia.position.y = 2.2;
      g.add(beam, dia); g.position.set(x, y, z); g.userData.noCull = true; host.scene.add(g); dyn.push(g); g.userData.dia = dia; return g;
    },
    // declare nodes/edges of the traversal graph while building; edge feasibility is linted (see lintGraph)
    node(id, x, y, z, w = 0, d = 0, meta = null) { nodes.push({ id, x, y, z, w, d, ...(meta || {}) }); return id; },
    edge(a, b, kind = 'jump', extra = null) {
      const A = nodes.find(n => n.id === a), B = nodes.find(n => n.id === b); if (!A || !B) throw new Error('edge: unknown node ' + a + '->' + b);
      const gx = Math.max(0, Math.abs(A.x - B.x) - (A.w + B.w) / 2), gz = Math.max(0, Math.abs(A.z - B.z) - (A.d + B.d) / 2);
      const gap = Math.hypot(gx, gz); edges.push({ a, b, kind, gap: Math.round(gap * 100) / 100, dy: Math.round((B.y - A.y) * 100) / 100, ...(extra || {}) });
    },
    // bake all batched boxes into one mesh per colour (call once at the end of build)
    finish() {
      if (baked) return; baked = true;
      for (const [color, b] of batches) {
        const g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(b.pos, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(b.nor, 3));
        g.setIndex(b.n > 65535 ? new T.Uint32BufferAttribute(b.idx, 1) : new T.Uint16BufferAttribute(b.idx, 1)); g.computeBoundingSphere(); g.computeBoundingBox();
        const m = new T.Mesh(g, matFor(color)); m.userData.noCull = true; m.matrixAutoUpdate = false; m.updateMatrix(); host.scene.add(m); geos.push(g); meshes.push(m);
      }
      batches.clear();
    },

    // ---- environment ----
    sky(on = true) { if (on) host.buildSky(); },
    applyBiome(name) { host.setZone(name || null, true, true); },        // visual only: never affects geometry
    setSpawn(x, y, z, yaw = 0) { host.setStart(x, y, z, yaw); },
    setBounds(o) { host.setBounds(o); },

    // ---- player (read / controlled writes) ----
    player: host.player,
    toast: host.toast, message: host.showMsg,
    complete(title, html) { host.complete(title, html); },
    now: () => host.now(),

    // ---- signature / lint ----
    solids: () => solids,
    graph: (start, exit) => ({ nodes, edges, start, exit }),
    sig(opts) { return signature(solids, opts); },
    graphSig(start, exit) { return graphSignature({ nodes, edges, start, exit }); },
    hash() { return geometryHash(solids); },
    lintGraph() { return lintGraph(nodes, edges); },

    // ---- lifecycle helpers used by the loader ----
    _dispose() {
      for (const m of meshes) m.removeFromParent(); for (const g of dyn) { g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); g.removeFromParent(); }
      for (const g of geos) g.dispose(); for (const m of mats.values()) { host.retroMaterials.delete(m); m.dispose(); }
      meshes.length = geos.length = dyn.length = 0; mats.clear(); batches.clear(); solids.length = 0; nodes.length = edges.length = 0;
    },
  };
  return kit;
}

function hashStr(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return h | 0; }

// Physics-derived reach limits (JUMP 11.5, JUMP2 10, GRAV 30, RUN 9, sprint x1.6) with a 15 % safety margin. kind: walk | jump | jump2 | pad
const G = 30, J1 = 11.5, J2 = 10, SPR = 9 * 1.6;
export function reach(kind, dy) {
  const t1 = (J1 + Math.sqrt(Math.max(0, J1 * J1 - 60 * dy))) / G;                       // single jump air time to height dy (descending branch)
  if (kind === 'jump') return J1 * J1 - 60 * dy < 0 ? 0 : SPR * t1 * 0.85;
  if (kind === 'jump2') {                                                                    // second jump fired at the apex of the first
    const apexY = J1 * J1 / (2 * G), tA = J1 / G, top = apexY + J2 * J2 / (2 * G);
    if (dy > top - 0.1) return 0; const t2 = (J2 + Math.sqrt(Math.max(0, J2 * J2 - 60 * (dy - apexY)))) / G; return SPR * (tA + t2) * 0.85;
  }
  return Infinity;
}
export function lintGraph(nodes, edges) {
  const bad = [];
  for (const e of edges) {
    if (e.kind === 'walk') { if (e.gap > 0.3 || e.dy > 0.5) bad.push({ ...e, why: 'walk edge with gap/rise' }); continue; }
    if (e.kind === 'pad' || e.kind === 'lift') continue;
    const r = reach(e.kind, e.dy); if (e.gap > r) bad.push({ ...e, why: `gap ${e.gap} > reach ${r.toFixed(2)}` });
  }
  return bad;
}
