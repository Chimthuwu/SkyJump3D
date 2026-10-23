// THE ARENAS (live's LEVEL_DEFS.arena) through the real local relay with two real clients: the guest adopts the host's level, both build the SAME chambers
// (static geometry hash), each client is placed in its OWN chamber, and a fall below the chamber's kill plane respawns. LOCAL relay only.
const { spawn } = require('child_process'), path = require('path');
const { launch, openGame, ROOT } = require('./lib.cjs');
(async () => {
  const PORT = 8126, srv = spawn('node', ['server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500)); const url = `http://127.0.0.1:${PORT}/`, room = 'ar' + Date.now() % 100000;
  const br = await launch(); const R = {}; const ev = (p, f, a) => p.evaluate(f, a);
  const sig = p => ev(p, () => { __ng.flushJobs(); const s = __dbg.solids.filter(x => !x.sp); let a = 0; const f = v => Math.round(v * 100); for (const b of s) a = (a * 31 + f(b.minx) * 7 + f(b.maxy) * 13 + f(b.minz) * 17 + f(b.maxx) * 3) % 1000000007; const ar = window.__arena; return { def: __ng.levels.def(), solids: s.length, hash: a, chambers: ar ? ar.chambers.length : 0, archetypes: ar ? ar.chambers.map(c => c.archetype + ':' + c.slot).join(',') : '', salt: __ng.levels.salt(), slot: __ng.homeBase().slot, me: __ng.me() }; });
  const A = await openGame(br, url, { dbg: true, allowNet: true, query: '?room=' + room });
  await A.page.waitForFunction(() => __ng.netState().on, null, { timeout: 60000 });
  await ev(A.page, () => { __ng.levels.startDef('arena'); }); await A.page.waitForFunction(() => __ng.levels.def() === 'arena' && __dbg.state === 'play', null, { timeout: 180000 });
  const B = await openGame(br, url, { dbg: true, allowNet: true, query: '?room=' + room });
  await B.page.waitForFunction(() => __ng.netState().on && __ng.netState().peers >= 1, null, { timeout: 60000 });
  await ev(B.page, () => document.getElementById('bStart').click());
  await B.page.waitForFunction(() => __ng.levels.def() === 'arena' && __dbg.state === 'play', null, { timeout: 240000 }).then(() => { R.guestAdoptedArena = true; }).catch(() => { R.guestAdoptedArena = false; });
  await B.page.waitForTimeout(6000);
  const a = await sig(A.page), b = await sig(B.page); R.A = a; R.B = b;
  R.sameGeometry = a.hash === b.hash && a.solids === b.solids; R.sameChambers = a.archetypes === b.archetypes && a.chambers === 6;
  R.sameSalt = a.salt === b.salt; R.distinctSlots = a.slot !== b.slot;
  // fall kill: drop A below the chamber kill plane, expect death then respawn on a spawn pad
  await ev(A.page, () => __ng.tp(__ng.me().x, -80, __ng.me().z));
  await A.page.waitForFunction(() => __ng.me().state === 'dead', null, { timeout: 30000 }).then(() => { R.fellAndDied = true; }).catch(() => { R.fellAndDied = false; });
  await A.page.waitForFunction(() => __ng.me().state === 'play' && __ng.me().y > -30, null, { timeout: 60000 }).then(() => { R.respawned = true; }).catch(() => { R.respawned = false; });
  R.errors = [...A.errors, ...B.errors];
  console.log(JSON.stringify(R, null, 1));
  const ok = R.guestAdoptedArena && R.sameGeometry && R.sameChambers && R.sameSalt && R.distinctSlots && R.fellAndDied && R.respawned && !R.errors.length;
  console.log(ok ? 'ARENA-NET2 PASS' : 'ARENA-NET2 FAIL'); await br.close(); srv.kill(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
