// Acceptance evidence for PLAN-UNIVERSES / PLAN-HOMEBASE / PLAN-INTERIORS-MP against the live build (headless software GL). Structural + runtime checks only;
// "looks good / feels good" items are NOT TESTED here and stay open for a human.
const { serve, launch, openGame } = require('./lib.cjs');
(async () => {
  const { srv, url } = await serve(); const br = await launch(); const { page, errors } = await openGame(br, url, { dbg: true }); const R = {}; const ev = f => page.evaluate(f);
  await page.evaluate(() => document.getElementById('bStart').click()); await page.waitForFunction(() => __dbg.state === 'play', null, { timeout: 120000 }); await page.waitForTimeout(3000);
  await ev(() => __ng.flushJobs && __ng.flushJobs());
  // ---- UNIVERSES ----
  R.universes = await ev(() => { const h = __ng.homeBase().homes; const d = []; for (let i = 0; i < h.length; i++) for (let j = i + 1; j < h.length; j++) d.push(Math.round(Math.hypot(h[i].x - h[j].x, h[i].z - h[j].z))); const g = __ng.linkGraph(); return { homes: h.length, ringRadius: h.map(q => Math.round(Math.hypot(q.x, q.z))), minPairDist: Math.min(...d), links: g.links.length, okLinks: g.links.filter(l => l.ok).length, unreachable: g.unreachable }; });
  // ---- HOMEBASE ----
  R.homebase = await ev(() => { const hb = __ng.homeBase(); return { guides: hb.guides.length, myGuide: hb.guide, enemiesNearSpawn: hb.enemiesNearSpawn, recipes: __ng.craftList().length, missions: __ng.missions().length, missionTypes: [...new Set(__ng.missions().map(m => m.type || m.kind))], tips: typeof __ng.guideTips === 'function' }; });
  R.mission = await ev(async () => { const ms = __ng.missions(); const g = ms.find(m => (m.type || m.kind) === 'goto') || ms[0]; if (!g) return null; __ng.acceptMission(g.id !== undefined ? ms.indexOf(g) : 0); const after = __ng.missions().find(m => m.id === g.id); return { id: g.id, state: after && after.state }; });
  // ---- INTERIORS ----
  R.interiors = [];
  for (const [i, theme] of [[0, 'server'], [1, 'atrium'], [2, 'reactor'], [3, 'club'], [4, 'vault']]) {
    const r = await page.evaluate(([i, t]) => { try { return __ng.openTower(i, t); } catch (e) { return 'ERR ' + e.message; } }, [i, theme]); R.interiors.push({ theme, r });
  }
  R.towers = await ev(() => __ng.towers().length);
  R.perf = await ev(() => __ng.renderInfo());
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1)); await br.close(); srv.close();
})().catch(e => { console.error(e); process.exit(2); });
