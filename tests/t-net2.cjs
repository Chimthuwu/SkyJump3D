// T-NET2: two real browser clients through the real Node relay (server/server.js, same protocol as the Cloudflare DO). LOCAL relay, not the deployed Worker.
// Checks: both join, distinct slots, each stands on its OWN home tower, same gameSalt (joiner adopts the host's), peers see each other move, host migration on leave.
const { spawn } = require('child_process'), path = require('path');
const { launch, openGame, ROOT } = require('./lib.cjs');
(async () => {
  const PORT = 8123, srv = spawn('node', ['server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500)); const url = `http://127.0.0.1:${PORT}/`, room = 'qa' + Date.now() % 100000;
  const br = await launch(); const R = {}; const ev = (p, f, a) => p.evaluate(f, a);
  const A = await openGame(br, url, { dbg: true, allowNet: true, query: '?room=' + room });
  await A.page.waitForFunction(() => __ng.netState().on, null, { timeout: 60000 }); await A.page.evaluate(() => document.getElementById('bStart').click()); await A.page.waitForFunction(() => __dbg.state === 'play', null, { timeout: 120000 });
  const B = await openGame(br, url, { dbg: true, allowNet: true, query: '?room=' + room });
  await B.page.waitForFunction(() => __ng.netState().on && __ng.netState().peers >= 1, null, { timeout: 60000 }); await B.page.evaluate(() => document.getElementById('bStart').click()); await B.page.waitForFunction(() => __dbg.state === 'play', null, { timeout: 120000 });
  await A.page.waitForFunction(() => __ng.netState().peers >= 1, null, { timeout: 30000 });
  await B.page.waitForTimeout(6000);                                   // let B rebuild if it adopted a different salt
  const info = p => ev(p, () => { const hb = __ng.homeBase(); return { net: __ng.netState(), slot: hb.slot, salt: __ng.levels.salt(), host: __dbg.net.host, me: __ng.me(), homes: hb.homes, id: __dbg.net.id }; });
  const a = await info(A.page), b = await info(B.page);
  R.slots = [a.slot, b.slot]; R.distinctSlots = a.slot !== b.slot;
  const dist = (i) => { const h = i.homes.find(q => q.slot === i.slot); return Math.round(Math.hypot(i.me.x - h.x, i.me.z - h.z)); };
  R.distToOwnTower = [dist(a), dist(b)]; R.onOwnTower = dist(a) < 30 && dist(b) < 30;
  R.salts = [a.salt, b.salt]; R.sameSalt = a.salt === b.salt; R.hosts = [a.host, b.host];
  // movement visibility: teleport A, B should see its avatar target near it
  await ev(A.page, () => __ng.tp(__ng.me().x + 3, __ng.me().y, __ng.me().z + 3)); await A.page.waitForTimeout(2500);
  R.peerSeen = await ev(B.page, () => { const p = [...__dbg.net.peers.values()][0]; const me = __ng.me(); return p ? { seen: p.seen, d: Math.round(Math.hypot(p.tgt.x - me.x, p.tgt.z - me.z)) } : null; });
  R.peerSees = !!(R.peerSeen && R.peerSeen.seen);
  // host migration
  await A.ctx.close(); await B.page.waitForTimeout(2500);
  R.hostAfterLeave = await ev(B.page, () => ({ host: __dbg.net.host, peers: __dbg.net.peers.size }));
  R.errors = [...A.errors, ...B.errors];
  console.log(JSON.stringify(R, null, 1));
  const ok = R.distinctSlots && R.onOwnTower && R.sameSalt && R.peerSees && R.hostAfterLeave.host && R.hostAfterLeave.peers === 0 && !R.errors.length;
  console.log(ok ? 'NET2 PASS' : 'NET2 FAIL'); await br.close(); srv.kill(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
