// PLAN-HOMEBASE definition-of-done, runtime part: [E] TALK opens the Guide dialog; a goto mission completes and is turned in at the base; credits persist across a page reload.
const { serve, launch, openGame } = require('./lib.cjs');
(async () => {
  const { srv, url } = await serve(); const br = await launch(); const R = {};
  const { page, errors } = await openGame(br, url, { dbg: true }); const ev = (f, a) => page.evaluate(f, a);
  const startGame = async () => { await ev(() => document.getElementById('bStart').click()); await page.waitForFunction(() => __dbg.state === 'play', null, { timeout: 120000 }); await page.waitForTimeout(1500); };
  await startGame();
  R.guideNotEnemy = await ev(() => !__dbg.enemies.some(e => e.isGuide || e.guide));
  const g = await ev(() => { const h = __ng.homeBase(); const me = h.guides.find(q => q.slot === h.slot); return me; });
  await ev(g => __ng.tp(g.x + 1.6, __ng.homeBase().tower.top + 0.1, g.z), g); await page.waitForTimeout(2500);
  await ev(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE', bubbles: true }))); await page.waitForTimeout(400); await ev(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyE', bubbles: true })));
  R.talkOpensDialog = await ev(() => __ng.homeBase().dialog);
  await ev(() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }))); await ev(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Escape', bubbles: true }))); await page.waitForTimeout(500);
  // goto mission round trip
  const before = await ev(() => __ng.base().credits);
  const m = await ev(() => { const ms = __ng.missions(); const i = ms.findIndex(q => (q.type || q.kind) === 'goto'); __ng.acceptMission(i); const q = __ng.missions()[i]; return { i, id: q.id, target: q.target, reward: q.reward }; });
  await ev(t => __ng.tp(t.x, t.y + 0.5, t.z), m.target); await page.waitForTimeout(3500);
  R.stateAtTarget = await ev(id => { const q = __ng.missions().find(x => x.id === id); return q && q.state; }, m.id);
  await ev(() => { const h = __ng.homeBase().tower; __ng.tp(h.x + 2, h.top + 0.3, h.z + 2); }); await page.waitForTimeout(2500);
  const t = await ev(() => { const r = __ng.turnIn(); return { ok: r.ok, reason: r.reason }; }); R.turnIn = t;
  const after = await ev(() => __ng.base().credits); R.credits = { before, after, reward: m.reward && m.reward.credits };
  R.creditsPaid = after > before;
  // persistence
  await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForFunction('window.__ng', null, { timeout: 120000 }); await startGame();
  R.creditsAfterReload = await ev(() => __ng.base().credits); R.persisted = R.creditsAfterReload === after;
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  const ok = R.guideNotEnemy && R.talkOpensDialog && R.stateAtTarget === 'ready' && t.ok && R.creditsPaid && R.persisted && !errors.length;
  console.log(ok ? 'HOMEBASE PASS' : 'HOMEBASE FAIL'); await br.close(); srv.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
