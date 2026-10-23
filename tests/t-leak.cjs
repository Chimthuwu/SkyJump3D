// T-LEAK / T-PERF: sky-city baseline vs after N round trips into a spec level and back. Counters: scene/lvl children, solids, renderer geometries/textures, JS heap.
// Software GL (SwiftShader): numbers are valid for before/after comparison only, NOT real-GPU frame times.
const { serve, launch, openGame } = require('./lib.cjs');
const id = process.argv[2] || 'nostalgia-overdose', N = +process.argv[3] || 3;
(async () => {
  const { srv, url } = await serve(); const br = await launch(); const { page, errors } = await openGame(br, url, { dbg: true }); const ev = (f, a) => page.evaluate(f, a);
  await ev(() => document.getElementById('bStart').click()); await page.waitForFunction(() => __dbg.state === 'play', null, { timeout: 120000 }); await page.waitForTimeout(3000);
  const snap = () => ev(async () => { __ng.flushJobs(); await new Promise(r => setTimeout(r, 1500)); const c = __ng.levels.sceneCounts(), r = __ng.levels.rendererInfo(); return { ...c, geometries: r.geometries, textures: r.textures, heapMB: Math.round(performance.memory.usedJSHeapSize / 1e6), staticSolids: __dbg.solids.filter(s => !s.sp).length }; });
  await snap(); await page.waitForTimeout(4000); const R = { baseline: await snap(), trips: [] };      // first snapshot is a warm-up (preload parks objects in the scene for a few seconds)
  for (let i = 0; i < N; i++) {
    const t0 = Date.now();
    const into = await ev(async id => { const t = performance.now(); const ok = await __ng.levels.load(id); await new Promise(r => setTimeout(r, 1500)); return { ok, ms: Math.round(performance.now() - t), state: __ng.levels.state(), r: __ng.levels.rendererInfo(), c: __ng.levels.sceneCounts() }; }, id);
    const back = await ev(async () => { const t = performance.now(); __ng.levels.exit(); await new Promise(r => setTimeout(r, 200)); return Math.round(performance.now() - t); });
    R.trips.push({ intoMs: into.ms, buildMs: into.state.buildMs, specSolids: into.state.solids, specLvlChildren: into.c.lvl, specGeometries: into.r.geometries, exitRebuildMs: back, after: await snap() });
  }
  const last = R.trips[R.trips.length - 1].after, b = R.baseline;
  const within = (a, c, tol) => Math.abs(a - c) <= Math.max(2, c * tol);
  R.note = 'renderer.info geometries/textures count only GPU-resident resources: they are low right after a rebuild (lazy re-upload) so the check is texture GROWTH across round trips, not equality with the baseline'; R.verdict = { sceneChildren: last.scene === b.scene, solids: within(last.staticSolids, b.staticSolids, 0.001), textures: last.textures <= R.trips[0].after.textures + 2, heap: last.heapMB <= b.heapMB * 1.15 + 20 };
  R.errors = errors; console.log(JSON.stringify(R, null, 1));
  const ok = Object.values(R.verdict).every(Boolean) && !errors.length; console.log(ok ? 'LEAK PASS' : 'LEAK FAIL'); await br.close(); srv.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
