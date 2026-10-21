const { launch } = require('./harness.cjs');
const fs = require('fs'); const w = ms => new Promise(r => setTimeout(r, ms));
const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
const SPOTS = [['spawn-roof', [610, 582, 0], [0, 0]], ['dense-cell', [-250, 478, 474], [0, 0]], ['opposite-roof', [-590, 582, 0], [0, 0]], ['low-centre', [0, 60, 0], [300, 300]], ['alien-void', null, null]];
(async () => {
  const { browser, page } = await launch(); const out = {};
  await page.evaluate(() => { const r = window.__dbg.renderer, orig = r.render.bind(r); window.__last = null; r.render = function (s, c) { orig(s, c); window.__last = { calls: r.info.render.calls, tris: r.info.render.triangles }; }; });
  for (const [name, p, look] of SPOTS) {
    if (p) await page.evaluate(([x, y, z, yaw]) => { window.__ng.tp(x, y, z); window.__ng.look(yaw, -0.05); }, [p[0], p[1], p[2], yawTo(p[0], p[2], look[0], look[1])]);
    else { await page.evaluate(() => window.__ng.mars()); await w(1500); await page.evaluate(() => { const m = window.__ng.info().moon; window.__ng.tp(m.x + m.ux * 95, m.y + 6, m.z + m.uz * 95); window.__ng.look(Math.atan2(m.ux, m.uz) + Math.PI, -0.12); }); }
    await w(2500);
    const r = await page.evaluate(async () => {
      const d = window.__dbg, P = d.camera.position, fr = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const res = {};
      d.CULL = 1e9; for (let i = 0; i < 14; i++) d.cullTick(1); await fr(); d.cullTick(1); await fr(); res.none = window.__last.calls;
      d.CULL = 450; for (let i = 0; i < 14; i++) d.cullTick(1); await fr(); d.cullTick(1); await fr(); res.cull450 = window.__last.calls;
      const dist = x => { const e = x.matrixWorld.elements; return Math.hypot(e[12] - P.x, e[13] - P.y, e[14] - P.z); };
      const hid = []; const hide = (x, R) => { if (x.visible && dist(x) > R) { x.visible = false; hid.push(x); } };
      for (const e of d.enemies) hide(e.mesh, 330); for (const i of d.items) hide(i.mesh, 330); for (const p of d.props) hide(p.mesh, 330);
      await fr(); res.cull450_plus_dynamicHide330 = window.__last.calls; res.dynHidden = hid.length;
      // cull-free alternative: hide only dynamic, no lvl cull
      d.CULL = 1e9; for (let i = 0; i < 3; i++) d.cullTick(1); await fr(); d.cullTick(1); await fr(); res.dynHideOnly330 = window.__last.calls;
      // camera.far trick (frustum culling does it, zero CPU): far=330 on top of nothing
      const far0 = d.camera.far; for (const x of hid) x.visible = true; d.camera.far = 330; d.camera.updateProjectionMatrix(); await fr(); res.cameraFar330_only = window.__last.calls; d.camera.far = far0; d.camera.updateProjectionMatrix();
      return res;
    });
    out[name] = r; console.log(name, JSON.stringify(r));
  }
  fs.writeFileSync('render-dynhide.json', JSON.stringify(out, null, 1)); await browser.close();
})();
