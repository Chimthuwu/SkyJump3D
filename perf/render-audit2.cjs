const { launch } = require('./harness.cjs');
const fs = require('fs');
const w = ms => new Promise(r => setTimeout(r, ms));
const ANALYZE = `(() => {
  const d = window.__dbg, cam = d.camera, scene = d.scene, lvl = d.lvl;
  scene.updateMatrixWorld(true); cam.updateMatrixWorld();
  const pm = cam.projectionMatrix.elements, vm = cam.matrixWorldInverse.elements;
  const mul = (a, b) => { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; };
  const pv = mul(pm, vm), planes = [];
  for (const [r, sg] of [[0,1],[0,-1],[1,1],[1,-1],[2,1],[2,-1]]) { const p = []; for (let c = 0; c < 4; c++) p.push(pv[c*4+3] + sg*pv[c*4+r]); const l = Math.hypot(p[0],p[1],p[2]); planes.push(p.map(v => v/l)); }
  const inF = (x,y,z,r) => { for (const p of planes) if (p[0]*x+p[1]*y+p[2]*z+p[3] < -r) return false; return true; };
  const owner = new Map(); const tag = (root, name) => { if (!root) return; root.traverse(o => { if (!owner.has(o)) owner.set(o, name); }); };
  for (const e of d.enemies) tag(e.mesh, 'enemy');
  for (const i of d.items) tag(i.mesh, 'item:' + i.type);
  for (const p of d.props) tag(p.mesh, 'prop/vehicle');
  for (const p of d.portals) tag(p.group, 'portal');
  for (const s of d.platforms) tag(s.grp, 'platform');
  for (const h of d.homeGuides) tag(h.group, 'homebase:guide');
  for (const [site, dr] of d.dressings) tag(dr.g, 'zone-dressing');
  for (const m of d.buildingBoxes) tag(m, 'building box');
  for (const c of d.clouds) tag(c, 'cloud');
  for (const c of d.skyProps) tag(c, 'sky');
  for (const f of d.fx) tag(f.mesh || f, 'particle/fx');
  for (const f of d.shots) tag(f.mesh || f, 'shot');
  tag(d.camera, 'viewmodel(camera child)');
  const geoTris = g => g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
  const dimsOf = o => { const g = o.geometry; if (!g.boundingBox) g.computeBoundingBox(); const b = g.boundingBox, e = o.matrixWorld.elements; const sx = Math.hypot(e[0],e[1],e[2]), sy = Math.hypot(e[4],e[5],e[6]), sz = Math.hypot(e[8],e[9],e[10]); return [(b.max.x-b.min.x)*sx, (b.max.y-b.min.y)*sy, (b.max.z-b.min.z)*sz]; };
  const rootOf = o => { let a = o; while (a.parent && a.parent !== lvl && a.parent !== scene) a = a.parent; return a; };
  const classify = (o, m) => {
    let c = owner.get(o);
    const gt = o.geometry ? o.geometry.type.replace('Geometry','') : '', add = m.blending === 2, tr = m.transparent;
    if (o.isPoints) return 'particles(Points)';
    if (c === 'enemy') {
      if (o.isSprite) return 'enemy:label/aura sprite';
      if (add || m.fog === false || (tr && m.depthWrite === false)) return 'enemy:aura/beacon/warn (transp/additive)';
      if (gt === 'Torus' || gt === 'Octahedron') return 'enemy:aura/beacon/warn (opaque rings)';
      return 'enemy:body parts';
    }
    if (c === 'platform') {
      if (gt === 'Circle' && m.map) return 'platform:bullseye decal';
      if (gt === 'Plane') return 'platform:checkpoint flag';
      if (gt === 'Cone') return 'platform:underside cone';
      if (gt === 'Torus') return 'platform:bounce springs';
      if (gt === 'Cylinder' && o.geometry.parameters.radiusTop < 0.2) return 'platform:checkpoint pole';
      const dm = dimsOf(o); if (dm[1] < 0.9 && dm[1] > 0.5 && dm[2] < 1.5) return 'platform:support beam';
      if (dm[1] < 0.5) return 'platform:plate';
      return 'platform:slab';
    }
    if (c) return c;
    if (o.isSprite) return add ? 'sprite glow (additive)' : 'label/nameplate sprite';
    if (o.isInstancedMesh) return 'instanced(other)';
    const dm = dimsOf(o), mn = Math.min(...dm), mx = Math.max(...dm);
    if (add && gt === 'Cylinder' && dm[1] > 20) return 'beam/pillar (additive)';
    if (add) return 'additive(other)';
    if (m.map && gt === 'Box') return 'building box';
    if (gt === 'Box' && mn <= 0.2 && mx > 3 && o.material.type === 'MeshBasicMaterial') return 'rail/tube';
    if (gt === 'Cylinder' && dm[1] < 1.3 && mx < 0.3) return 'rail post';
    if (gt === 'Cylinder' && dm[1] < 1.3 && mx > 1) return 'coin';
    if (gt === 'Torus' && mx < 1.5) return 'coin/banana';
    if (gt === 'Cone') return 'platform:underside cone';
    return 'other:' + gt + (m.type==='MeshBasicMaterial'?':basic':':lambert') + (tr?':T':'');
  };
  const P = cam.position;
  const out = { counts: { objects: 0, lights: 0, meshes: 0, instancedMeshes: 0, instancesDrawn: 0, sprites: 0, points: 0, groupsOrObj3D: 0, frustumCulledFalse: 0, matrixAutoUpdateFalse: 0, matrixWorldAutoUpdateFalse: 0, hiddenObjectsInScene: 0 }, cats: {}, residual: {}, drawn: 0, drawnTris: 0, totalVisibleRenderables: 0, drawnTransparent: 0, drawnAdditive: 0, drawnOpaque: 0, depthWriteOffDrawn: 0 };
  const mats = new Set(), geos = new Set(), drawnMats = new Set(), drawnGeos = new Set();
  scene.traverse(o => { out.counts.objects++; if (o.isLight) out.counts.lights++; if (o.type === 'Group' || o.type === 'Object3D') out.counts.groupsOrObj3D++; if (o.matrixAutoUpdate === false) out.counts.matrixAutoUpdateFalse++; if (o.matrixWorldAutoUpdate === false) out.counts.matrixWorldAutoUpdateFalse++; if (o.visible === false) out.counts.hiddenObjectsInScene++; if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && o.frustumCulled === false) out.counts.frustumCulledFalse++; });
  scene.traverseVisible(o => {
    if (!(o.isMesh || o.isSprite || o.isPoints || o.isLine)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!m || m.visible === false) return;
    if (o.isInstancedMesh) { out.counts.instancedMeshes++; if (o.count === 0) return; }
    if (o.isMesh && !o.isInstancedMesh) out.counts.meshes++; if (o.isSprite) out.counts.sprites++; if (o.isPoints) out.counts.points++;
    mats.add(m.uuid); if (o.geometry) geos.add(o.geometry.uuid); out.totalVisibleRenderables++;
    const cat = classify(o, m), C = out.cats[cat] || (out.cats[cat] = { visible: 0, drawn: 0, tris: 0, transparent: 0, additive: 0, instancedDrawn: 0 }); C.visible++;
    let inside = true;
    if (o.frustumCulled !== false && o.geometry) {
      let bs; if (o.isInstancedMesh) { if (!o.boundingSphere) o.computeBoundingSphere(); bs = o.boundingSphere; } else { const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); bs = g.boundingSphere; }
      const e = o.matrixWorld.elements, sc = Math.sqrt(Math.max(e[0]*e[0]+e[1]*e[1]+e[2]*e[2], e[4]*e[4]+e[5]*e[5]+e[6]*e[6], e[8]*e[8]+e[9]*e[9]+e[10]*e[10]));
      inside = inF(e[0]*bs.center.x+e[4]*bs.center.y+e[8]*bs.center.z+e[12], e[1]*bs.center.x+e[5]*bs.center.y+e[9]*bs.center.z+e[13], e[2]*bs.center.x+e[6]*bs.center.y+e[10]*bs.center.z+e[14], bs.radius * sc);
    } else if (o.isSprite) { const e = o.matrixWorld.elements; inside = inF(e[12], e[13], e[14], Math.max(o.scale.x, o.scale.y)); }
    if (!inside) return;
    const n = o.isInstancedMesh ? o.count : 1, tris = (o.geometry ? geoTris(o.geometry) : 0) * n;
    C.drawn++; C.tris += tris; if (m.transparent) { C.transparent++; out.drawnTransparent++; } else out.drawnOpaque++; if (m.blending === 2) { C.additive++; out.drawnAdditive++; } if (m.depthWrite === false) out.depthWriteOffDrawn++;
    if (o.isInstancedMesh) { C.instancedDrawn += n; out.counts.instancesDrawn += n; }
    out.drawn++; out.drawnTris += tris; drawnMats.add(m.uuid); if (o.geometry) drawnGeos.add(o.geometry.uuid);
    if (cat.startsWith('other') || cat.startsWith('instanced(other)') || cat.startsWith('additive(other)')) { const k = cat + '|' + (m.color ? m.color.getHexString() : '') + '|root=' + (rootOf(o).type) + (rootOf(o).isGroup ? rootOf(o).children.length : ''); out.residual[k] = (out.residual[k] || 0) + 1; }
  });
  out.uniqueMatsVisible = mats.size; out.uniqueGeosVisible = geos.size; out.uniqueMatsDrawn = drawnMats.size; out.uniqueGeosDrawn = drawnGeos.size;
  out.programs = d.renderer.info.programs ? d.renderer.info.programs.length : null;
  out.cam = [P.x, P.y, P.z].map(Math.round);
  return out;
})()`;
module.exports.ANALYZE = ANALYZE;
if (require.main === module) (async () => {
  const { browser, page, errors } = await launch();
  const out = { spots: {} };
  const spots = JSON.parse(process.env.SPOTS || 'null') || [['spawn', null]];
  out.preset = await page.evaluate(() => window.__dbg.preset);
  for (const [name, p] of spots) {
    if (p) { await page.evaluate(([x,y,z]) => window.__ng.tp(x,y,z), p); await w(2500); }
    const t = await page.evaluate(() => window.__ng.renderInfo());
    const a = await page.evaluate(ANALYZE);
    out.spots[name] = { renderInfo2frames: t, analysis: a };
    console.log(name, 'calls(2fr)', t.calls, 'myDrawn', a.drawn, 'cam', a.cam);
  }
  fs.writeFileSync('raw-spots.json', JSON.stringify(out, null, 1));
  await browser.close();
})();
