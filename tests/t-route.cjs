// T-ROUTE / T-COLL for one level in a REAL browser: opens the menu, clicks LEVELS -> the level, then a bot plays the declared main route with real
// key events (no teleporting). Records one continuous video and a screenshot at every new checkpoint. Usage: node tests/t-route.cjs [level-id] [--video]
const fs = require('fs'), path = require('path');
const { serve, launch, openGame } = require('./lib.cjs');
const id = process.argv.find((a, i) => i > 1 && !a.startsWith('--')) || 'nostalgia-overdose', wantVideo = process.argv.includes('--video');
const out = path.join(__dirname, 'out', id); fs.mkdirSync(out, { recursive: true });
(async () => {
  const { srv, url } = await serve(); const br = await launch();
  const { ctx, page, errors } = await openGame(br, url, { dbg: true, video: wantVideo ? out : undefined });
  const ev = (f, a) => page.evaluate(f, a); const R = { id, steps: [] };
  await page.addScriptTag({ path: path.join(__dirname, 'bot.js') });
  await page.click('#bLevels'); await page.waitForSelector(`#levelsList button[data-level="${id}"]`);
  const t0 = Date.now();
  await page.click(`#levelsList button[data-level="${id}"]`);
  await page.waitForFunction(() => __ng.levels.state().active && __dbg.state === 'play', null, { timeout: 120000 });
  R.menuToPlayMs = Date.now() - t0;
  await page.waitForTimeout(1500);
  R.spec = await ev(() => { const s = __ng.levels.spec(); return { id: s.id, route: s.route, cells: s.cells }; });
  const graph = await ev(() => __ng.levels.graph());
  const node = Object.fromEntries(graph.nodes.map(n => [n.id, n]));
  const kindOf = (a, b) => { const e = graph.edges.find(e => (e.a === a && e.b === b) || (e.b === a && e.a === b)); return e ? e.kind : 'jump'; };
  const wps = []; let prev = null;
  for (const nid of R.spec.route) {
    if (typeof nid === 'object') { wps.push({ id: nid.id, x: nid.pt[0], y: nid.pt[1], z: nid.pt[2], r: nid.pt[3] || 1.6, point: true }); continue; }
    const n = node[nid]; wps.push({ id: nid, x: n.x, y: n.y, z: n.z, hw: n.w / 2, hd: n.d / 2, kind: prev ? kindOf(prev, nid) : 'walk' }); prev = nid;
    for (const c of R.spec.cells) if (Math.abs(c.x - n.x) <= n.w / 2 && Math.abs(c.z - n.z) <= n.d / 2 && Math.abs(c.y - n.y) < 1) wps.push({ id: 'cell:' + c.id, x: c.x, y: c.y, z: c.z, point: true, r: 1.6 });
  }
  R.waypoints = wps.length;
  // checkpoint screenshots while the bot runs
  let lastCp = null, shots = 0, stop = false;
  const poll = (async () => {
    while (!stop) {
      const s = await ev(() => ({ cp: __ng.levels.state().checkpoint, me: __ng.me() })).catch(() => null);
      if (s && (!lastCp || Math.abs(s.cp.x - lastCp.x) + Math.abs(s.cp.z - lastCp.z) > 1)) { lastCp = s.cp; const f = path.join(out, `cp-${String(++shots).padStart(2, '0')}.png`); await page.screenshot({ path: f }); R.steps.push({ checkpoint: s.cp, shot: path.basename(f) }); }
      await page.waitForTimeout(700);
    }
  })();
  const res = await page.evaluate(w => window.__bot.run(w, { maxDeaths: 2, legTimeout: 120000 }), wps);
  stop = true; await poll;
  R.bot = { ok: res.ok, why: res.why, deaths: res.deaths, reached: res.reached.length, of: wps.length, timeMs: res.timeMs, at: res.at, target: res.target, log: res.log };
  await page.screenshot({ path: path.join(out, 'final-clear.png') });
  R.afterClear = await ev(() => ({ st: __ng.levels.state(), msg: document.getElementById('msg').innerText.slice(0, 120) }));
  await page.waitForFunction(() => __ng.levels.state().active === null, null, { timeout: 60000 }).then(() => { R.returnedToSkyCity = true; }).catch(() => { R.returnedToSkyCity = false; });
  R.errors = errors;
  const pass = res.ok && res.deaths === 0 && R.returnedToSkyCity && !errors.length;
  R.verdict = pass ? 'PASS' : 'FAIL';
  fs.writeFileSync(path.join(out, 'route-result.json'), JSON.stringify(R, null, 1));
  console.log(JSON.stringify({ ...R, spec: undefined, waypoints: R.waypoints }, null, 1));
  await ctx.close(); await br.close(); srv.close();
  if (wantVideo) { const v = fs.readdirSync(out).find(f => f.endsWith('.webm')); if (v) fs.renameSync(path.join(out, v), path.join(out, 'route-run.webm')); }
  process.exit(pass ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
