// GAMESALT: the home roof differs between games, is identical for the same salt, and a joining client adopts the host's salt. Plus: HOME PORTAL at #-1 and random music.
const { serve, launch, openGame } = require('./lib.cjs');
(async () => {
  const { srv, url } = await serve(); const br = await launch(); const R = {};
  const roof = page => page.evaluate(() => { const h = __ng.homeBase().tower; const it = __dbg.items.filter(i => i.mesh && Math.hypot(i.mesh.position.x - h.x, i.mesh.position.z - h.z) < 18 && Math.abs(i.mesh.position.y - h.top) < 4).map(i => [i.type, i.w, Math.round(i.mesh.position.x - h.x), Math.round(i.mesh.position.z - h.z)]).sort((a, b) => String(a).localeCompare(String(b))); const pr = __ng.propsNow().map(p => [p.k, Math.round(p.x - h.x), Math.round(p.z - h.z)]).filter(p => Math.abs(p[1]) < 20 && Math.abs(p[2]) < 20).sort(); return JSON.stringify({ it, pr }); });
  const a = await openGame(br, url, { dbg: true }), b = await openGame(br, url, { dbg: true });
  R.saltA = await a.page.evaluate(() => __ng.levels.salt()); R.saltB = await b.page.evaluate(() => __ng.levels.salt());
  R.differentSalts = R.saltA !== R.saltB;
  const ra = await roof(a.page), rb = await roof(b.page); R.roofDiffers = ra !== rb;
  await b.page.evaluate(s => __ng.levels.setSalt(s), R.saltA); await b.page.waitForTimeout(1500);
  const rb2 = await roof(b.page); R.sameSaltSameRoof = rb2 === ra;
  R.errors = [...a.errors, ...b.errors];
  console.log(JSON.stringify(R, null, 1)); const ok = R.differentSalts && R.roofDiffers && R.sameSaltSameRoof && !R.errors.length;
  console.log(ok ? 'SALT PASS' : 'SALT FAIL'); await br.close(); srv.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
