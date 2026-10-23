// HOME PORTAL on platform #-1: extend the platform ladder below the bottom, stand on the gate, and end up on the spawn tower.
const { serve, launch, openGame } = require('./lib.cjs');
(async () => {
  const { srv, url } = await serve(); const br = await launch(); const { page, errors } = await openGame(br, url, { dbg: true }); const R = {};
  await page.click('#bStart'); await page.waitForFunction(() => __dbg.state === 'play', null, { timeout: 120000 }); await page.waitForTimeout(1500);
  R.ext = await page.evaluate(() => __ng.levels.ladderExtend(-1));
  const g = R.ext.gates[0]; R.hasGate = !!g && g.dormant === false;
  const start = await page.evaluate(() => ({ ...__ng.me() }));
  await page.evaluate(g => __ng.tp(g.x, g.y + 0.2, g.z), g);
  await page.waitForFunction(() => Math.hypot(__ng.me().x - __ng.homeBase().tower.x, __ng.me().z - __ng.homeBase().tower.z) < 40 && __ng.me().y > 100, null, { timeout: 30000 }).then(() => { R.teleportedHome = true; }).catch(() => { R.teleportedHome = false; });
  R.me = await page.evaluate(() => ({ me: __ng.me(), tower: __ng.homeBase().tower })); R.errors = errors;
  console.log(JSON.stringify(R, null, 1)); const ok = R.hasGate && R.teleportedHome && !errors.length; console.log(ok ? 'HOMEPORTAL PASS' : 'HOMEPORTAL FAIL'); await br.close(); srv.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
