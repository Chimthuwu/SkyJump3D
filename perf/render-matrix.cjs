const { launch } = require('./harness.cjs');
const fs = require('fs'); const w = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const { browser, page } = await launch();
  await page.evaluate(() => { window.__ng.look(Math.atan2(610, 0), -0.05); }); await w(2000);
  const res = await page.evaluate(async () => {
    const d = window.__dbg, scene = d.scene, lvl = d.lvl, cam = d.camera, o = { revision: null };
    const t = (fn, n) => { fn(); const a = performance.now(); for (let i = 0; i < n; i++) fn(); return +((performance.now() - a) / n).toFixed(2); };
    // enemies & items far from player
    const P = cam.position, far = (x, R) => { const e = x.matrixWorld.elements; return Math.hypot(e[12] - P.x, e[13] - P.y, e[14] - P.z) > R; };
    scene.updateMatrixWorld(true);
    o.baseline_ms = t(() => scene.updateMatrixWorld(), 10);
    const dynRoots = new Set([...d.enemies.map(e => e.mesh), ...d.items.map(i => i.mesh), ...d.props.map(p => p.mesh)]);
    // B: scene+lvl identity frozen, static lvl children frozen
    scene.matrixAutoUpdate = false; lvl.matrixAutoUpdate = false;
    const frozen = []; for (const c of lvl.children) if (!dynRoots.has(c) && !d.specials.some(s => s.grp === c)) frozen.push(c);
    const sp = new Set(d.specials.map(s => s.grp)); let n = 0;
    for (const c of lvl.children) { if (dynRoots.has(c) || sp.has(c) || c.isSprite) continue; c.matrixAutoUpdate = false; c.matrixWorldAutoUpdate = false; n++; }
    o.B_staticFrozen_roots = n; o.B_ms = t(() => scene.updateMatrixWorld(), 10);
    // C: also enemy/item/prop roots farther than 450 m
    let m = 0; for (const r of dynRoots) { if (far(r, 450)) { r.matrixAutoUpdate = false; r.matrixWorldAutoUpdate = false; m++; } }
    o.C_farDynamicRootsFrozen = m; o.C_ms = t(() => scene.updateMatrixWorld(), 10);
    let live = 0; scene.traverse(x => { if (x.matrixWorldAutoUpdate !== false) live++; }); o.objectsStillAutoUpdating_approx = live;
    return o;
  });
  console.log(res); fs.writeFileSync('render-matrix.json', JSON.stringify(res, null, 1)); await browser.close();
})();
