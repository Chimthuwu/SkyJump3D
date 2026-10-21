const { launch } = require('./harness.cjs');
const fs = require('fs');
const w = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page, errors } = await launch();
  await page.evaluate(() => window.__ng.look(Math.atan2(-610, 0) + 0, -0.05));
  await page.evaluate(() => { window.__ng.look(Math.atan2(610, 0), -0.05); });  // face the centre (-x)
  await w(2500);
  const res = await page.evaluate(async () => {
    const d = window.__dbg, scene = d.scene, cam = d.camera, r = d.renderer, o = {};
    // ---- renderer / settings
    o.renderer = { preset: d.preset, pixelRatio: r.getPixelRatio(), drawingBuffer: r.getDrawingBufferSize(cam.position.clone()).toArray().slice(0, 2), antialias: r.getContextAttributes().antialias, toneMapping: r.toneMapping, exposure: r.toneMappingExposure, shadowMapEnabled: r.shadowMap.enabled, autoClear: r.autoClear, sortObjects: r.sortObjects, outputColorSpace: r.outputColorSpace, dpr: window.devicePixelRatio, innerSize: [innerWidth, innerHeight], camFar: cam.far, camNear: cam.near, fov: cam.fov, fog: scene.fog && { type: scene.fog.type, near: scene.fog.near, far: scene.fog.far }, maxAniso: r.capabilities.getMaxAnisotropy(), maxSamples: r.capabilities.maxSamples };
    o.lights = []; scene.traverse(x => { if (x.isLight) o.lights.push({ type: x.type, castShadow: !!x.castShadow, intensity: x.intensity }); });
    // ---- global uniqueness over the whole scene (even hidden)
    const mats = new Set(), geos = new Set(), texs = new Set(), matByType = {}, geoByType = {}; let meshes = 0, noSharedGeo = 0, tot = 0;
    const geoUse = new Map(), matUse = new Map();
    scene.traverse(x => { tot++; if (!(x.isMesh || x.isSprite || x.isPoints)) return; meshes++; const ms = Array.isArray(x.material) ? x.material : [x.material]; for (const m of ms) { mats.add(m); matByType[m.type] = (matByType[m.type] || 0) + 1; matUse.set(m, (matUse.get(m) || 0) + 1); if (m.map) texs.add(m.map); } if (x.geometry) { geos.add(x.geometry); geoByType[x.geometry.type] = (geoByType[x.geometry.type] || 0) + 1; geoUse.set(x.geometry, (geoUse.get(x.geometry) || 0) + 1); } });
    let geoSingle = 0, matSingle = 0; for (const [, n] of geoUse) if (n === 1) geoSingle++; for (const [, n] of matUse) if (n === 1) matSingle++;
    // identical-material dedupe potential: key = type|color|emissive|flags
    const keyOf = m => [m.type, m.color && m.color.getHex(), m.emissive && m.emissive.getHex(), m.emissiveIntensity, m.transparent, m.opacity, m.blending, m.depthWrite, m.side, m.fog, m.flatShading, m.map && m.map.uuid, m.toneMapped].join('|');
    const keys = new Set(); for (const m of mats) keys.add(keyOf(m));
    o.global = { objects: tot, renderables: meshes, uniqueMaterials: mats.size, uniqueMaterialsAfterDedupeByValue: keys.size, singleUseMaterials: matSingle, uniqueGeometries: geos.size, singleUseGeometries: geoSingle, canvasTextures: texs.size, matByType, geoByType, rendererMemory: { geometries: r.info.memory.geometries, textures: r.info.memory.textures, programs: r.info.programs.length } };
    // ---- dynamic vs static
    const dyn = new Set(); const mark = x => { if (x) x.traverse(c => dyn.add(c)); };
    for (const e of d.enemies) mark(e.mesh); for (const i of d.items) mark(i.mesh); for (const p of d.props) mark(p.mesh); for (const p of d.portals) mark(p.group);
    for (const s of d.specials) mark(s.grp || s.g || s.slab);
    for (const f of d.fx) mark(f.mesh || f); for (const c of d.clouds) mark(c); for (const c of d.skyProps) mark(c); for (const h of d.homeGuides) mark(h.group); for (const [, dr] of d.dressings) mark(dr.g); mark(cam);
    for (const x of d.shots) mark(x.mesh || x);
    let stat = 0, dynn = 0, statGroups = 0; scene.traverse(x => { if (dyn.has(x)) dynn++; else { stat++; if (!x.isMesh && !x.isSprite) statGroups++; } });
    o.staticVsDynamic = { staticObjects: stat, dynamicObjects: dynn, staticNonRenderables: statGroups, note: 'dynamic = enemies, items (spin/bob), props, portals, specials, fx, clouds, sky, home guide, dressings, camera subtree' };
    // ---- matrix update cost (autoUpdate path = every matrixAutoUpdate object recomposes + world recompute)
    const t = (fn, n) => { fn(); const a = performance.now(); for (let i = 0; i < n; i++) fn(); return +((performance.now() - a) / n).toFixed(2); };
    o.matrixCost = { updateMatrixWorld_all_ms: t(() => scene.updateMatrixWorld(), 8) };
    const flip = [], hold = [];
    scene.traverse(x => { if (!dyn.has(x) && x !== scene && x.matrixAutoUpdate) { flip.push(x); } });
    for (const x of flip) { x.updateMatrix(); } scene.updateMatrixWorld(true);
    for (const x of flip) x.matrixAutoUpdate = false;
    o.matrixCost.updateMatrixWorld_static_frozen_ms = t(() => scene.updateMatrixWorld(), 8);
    o.matrixCost.staticFrozenCount = flip.length;
    for (const x of flip) { x.matrixAutoUpdate = true; }
    // ---- frustumCulled false list
    o.frustumCulledFalse = []; scene.traverse(x => { if ((x.isMesh || x.isSprite || x.isPoints) && x.frustumCulled === false) o.frustumCulledFalse.push({ type: x.type, geo: x.geometry && x.geometry.type, inst: x.count, mat: x.material && x.material.type }); });
    // ---- overdraw: transparent / additive drawn objects ranked by projected screen coverage
    cam.updateMatrixWorld(); const camP = cam.position, fovT = Math.tan(cam.fov * Math.PI / 360), asp = cam.aspect;
    const big = []; let covSum = 0, nT = 0;
    scene.traverseVisible(x => {
      if (!(x.isMesh || x.isSprite)) return; const m = Array.isArray(x.material) ? x.material[0] : x.material; if (!m || !(m.transparent || m.blending === 2)) return;
      let rad, cx, cy, cz; const e = x.matrixWorld.elements;
      if (x.isSprite) { rad = Math.max(x.scale.x, x.scale.y) / 2; cx = e[12]; cy = e[13]; cz = e[14]; }
      else { const g = x.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const bs = g.boundingSphere, sc = Math.sqrt(Math.max(e[0]*e[0]+e[1]*e[1]+e[2]*e[2], e[4]*e[4]+e[5]*e[5]+e[6]*e[6], e[8]*e[8]+e[9]*e[9]+e[10]*e[10])); rad = bs.radius * sc; cx = e[0]*bs.center.x+e[4]*bs.center.y+e[8]*bs.center.z+e[12]; cy = e[1]*bs.center.x+e[5]*bs.center.y+e[9]*bs.center.z+e[13]; cz = e[2]*bs.center.x+e[6]*bs.center.y+e[10]*bs.center.z+e[14]; }
      const dx = cx - camP.x, dy = cy - camP.y, dz = cz - camP.z, dist = Math.hypot(dx, dy, dz); if (dist < 0.1) return;
      // in front?
      const fw = cam.getWorldDirection(camP.clone()); if (dx * fw.x + dy * fw.y + dz * fw.z < 0) return;
      const ang = Math.atan(rad / dist); const cov = Math.min(1, (Math.PI * Math.pow(Math.tan(ang), 2)) / (4 * fovT * fovT * asp)); // sphere disc area / screen area
      nT++; covSum += cov; if (cov > 0.01) big.push({ cov: +cov.toFixed(3), geo: x.isSprite ? 'Sprite' : x.geometry.type, mat: m.type, add: m.blending === 2, op: m.opacity, dw: m.depthWrite, color: m.color && m.color.getHexString(), dist: Math.round(dist), rad: +rad.toFixed(1), fog: m.fog, side: m.side });
    });
    big.sort((a, b) => b.cov - a.cov);
    o.overdraw = { transparentVisibleChain: nT, sumCoverageScreens_upperBound: +covSum.toFixed(2), over1pctScreen: big.length, top: big.slice(0, 15) };
    return o;
  });
  // ---- Object3D.add patch cost during a level rebuild
  const addCost = await page.evaluate(async () => {
    const d = window.__dbg, O3 = Object.getPrototypeOf(Object.getPrototypeOf(d.scene)); const cur = O3.add; let calls = 0, nodes = 0, ms = 0;
    const count = x => { let n = 1; for (const c of x.children) n += count(c); return n; };
    O3.add = function (...a) { const t0 = performance.now(); for (const x of a) if (x) nodes += count(x); calls++; const r = cur.apply(this, a); ms += performance.now() - t0; return r; };
    const t0 = performance.now(); window.__ng.level = 1; const buildMs = performance.now() - t0;
    O3.add = cur;
    return { addCalls: calls, nodesVisitedByRetrofitTraverse: nodes, msInsidePatchedAdd_inclusive: +ms.toFixed(0), levelBuildMs: +buildMs.toFixed(0) };
  });
  res.addPatch = addCost;
  fs.writeFileSync('render-scene.json', JSON.stringify(res, null, 1));
  console.log(JSON.stringify(res, null, 1).slice(0, 7000)); console.log(errors.slice(0, 4));
  await browser.close();
})();
