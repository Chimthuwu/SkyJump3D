const { launch } = require('./harness.cjs');
const fs = require('fs');
const w = ms => new Promise(r => setTimeout(r, ms));
const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
const SPOTS = [
  ['spawn-roof', [610, 582, 0], [0, 0]],
  ['dense-cell', [-250, 478, 474], [0, 0]],
  ['opposite-roof', [-590, 582, 0], [0, 0]],
  ['low-centre', [0, 60, 0], [300, 300]],
  ['alien-void', null, null],
];
const RS = [1e9, 1000, 600, 450, 330];
(async () => {
  const { browser, page, errors } = await launch();
  const out = { spots: {} };
  await page.evaluate(() => { const r = window.__dbg.renderer, orig = r.render.bind(r); window.__last = null; r.render = function (s, c) { orig(s, c); window.__last = { calls: r.info.render.calls, tris: r.info.render.triangles }; }; });
  for (const [name, p, look] of SPOTS) {
    if (p) await page.evaluate(([x, y, z, yaw]) => { window.__ng.tp(x, y, z); window.__ng.look(yaw, -0.05); }, [p[0], p[1], p[2], yawTo(p[0], p[2], look[0], look[1])]);
    else { await page.evaluate(() => window.__ng.mars()); await w(1500); await page.evaluate(() => { const m = window.__ng.info().moon; window.__ng.tp(m.x + m.ux * 95, m.y + 6, m.z + m.uz * 95); window.__ng.look(Math.atan2(m.ux, m.uz) + Math.PI, -0.12); }); }
    await w(2500);
    out.spots[name] = {};
    for (const R of RS) {
      const res = await page.evaluate(async R => {
        const d = window.__dbg; d.CULL = R;
        for (let i = 0; i < 14; i++) d.cullTick(1);            // build tracking list (budget 1500/children per call) then apply
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        d.cullTick(1);
        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
        const info = window.__last, scene = d.scene, cam = d.camera;
        let vis = 0; scene.traverseVisible(() => vis++);
        const t = (fn, n) => { fn(); const a = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - a) / n; };
        const rm = t(() => d.renderer.render(scene, cam), 6);
        const um = t(() => { scene.traverse(o => { o.matrixWorldNeedsUpdate = true; }); scene.updateMatrixWorld(); }, 4);   // worst case: what autoUpdate does
        const tv = t(() => { let n = 0; scene.traverseVisible(() => n++); }, 6);
        return { R, hidden: d.cull.hidden, tracked: d.cull.list.length, calls: info.calls, tris: info.tris, visibleObjs: vis, renderMs: +rm.toFixed(1), updateMatrixWorldMs: +um.toFixed(2), traverseVisibleMs: +tv.toFixed(2) };
      }, R);
      out.spots[name][R] = res; console.log(name, JSON.stringify(res));
    }
    await page.evaluate(() => { window.__dbg.CULL = 1000; });
  }
  fs.writeFileSync('render-cull.json', JSON.stringify(out, null, 1));
  console.log(errors.slice(0, 5));
  await browser.close();
})();
