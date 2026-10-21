const { launch } = require('./harness.cjs');
const { ANALYZE } = require('./render-audit2.cjs');
const fs = require('fs');
const w = ms => new Promise(r => setTimeout(r, ms));
const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
const SPOTS = [
  ['spawn-roof', [610, 582, 0], [0, 0]],
  ['dense-cell (-250,476,474)', [-250, 478, 474], [0, 0]],
  ['opposite-roof (-590,582,0)', [-590, 582, 0], [0, 0]],
  ['low-centre (0,60,0)', [0, 60, 0], [300, 300]],
  ['alien-void (moon edge)', null, null],
];
(async () => {
  const { browser, page, errors } = await launch();
  const out = { preset: await page.evaluate(() => window.__dbg.preset), spots: {} };
  await page.evaluate(() => { const r = window.__dbg.renderer, orig = r.render.bind(r); window.__last = null; r.render = function (s, c) { orig(s, c); window.__last = { calls: r.info.render.calls, tris: r.info.render.triangles, geos: r.info.memory.geometries, tex: r.info.memory.textures, progs: r.info.programs.length }; }; });
  for (const [name, p, look] of SPOTS) {
    if (p) { await page.evaluate(([x, y, z, yaw]) => { window.__ng.tp(x, y, z); window.__ng.look(yaw, -0.05); }, [p[0], p[1], p[2], yawTo(p[0], p[2], look[0], look[1])]); }
    else { await page.evaluate(() => window.__ng.mars()); await w(1500); await page.evaluate(() => { const m = window.__ng.info().moon; window.__ng.tp(m.x + m.ux * 95, m.y + 6, m.z + m.uz * 95); window.__ng.look(Math.atan2(m.ux, m.uz) + Math.PI, -0.12); }); }
    await w(2500);
    if (process.env.CULLR) { await page.evaluate(async R => { const d = window.__dbg; d.CULL = R; for (let i = 0; i < 14; i++) d.cullTick(1); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); d.cullTick(1); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); }, +process.env.CULLR); }
    const last = await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(window.__last)))));
    const a = await page.evaluate(ANALYZE);
    const stat = await page.evaluate(() => ({ cull: window.__ng.cull(), CULL_R: window.__dbg.CULL_R }));
    out.spots[name] = { frame: last, analysis: a, stat };
    console.log(name, JSON.stringify(last), 'myDrawn', a.drawn, 'tr', a.drawnTransparent, 'add', a.drawnAdditive, 'objs', a.counts.objects, 'cull', JSON.stringify(stat.cull));
  }
  out.errors = errors.slice(0, 5);
  fs.writeFileSync('render-spots' + (process.env.CULLR ? '-cull' + process.env.CULLR : '') + '.json', JSON.stringify(out, null, 1));
  await browser.close();
})();
