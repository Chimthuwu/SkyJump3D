// ARENA MATCH layer: two real clients in THE ARENAS through the local relay. B frags A with real `pvp` messages; both clients must agree on the score, the host
// announces the winner at the (test-lowered) frag limit, and a new round starts. LOCAL relay only.
const { spawn } = require('child_process'), path = require('path');
const { launch, openGame, ROOT } = require('./lib.cjs');
(async () => {
  const PORT = 8127, srv = spawn('node', ['server.js'], { cwd: path.join(ROOT, 'server'), env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500)); const url = `http://127.0.0.1:${PORT}/`, room = 'mt' + Date.now() % 100000;
  const br = await launch(); const R = {}; const ev = (p, f, a) => p.evaluate(f, a);
  const A = await openGame(br, url, { dbg: true, allowNet: true, query: '?room=' + room });
  await A.page.waitForFunction(() => __ng.netState().on, null, { timeout: 60000 });
  await ev(A.page, () => { __ng.levels.startDef('arena'); }); await A.page.waitForFunction(() => __ng.levels.def() === 'arena' && __dbg.state === 'play', null, { timeout: 180000 });
  const B = await openGame(br, url, { dbg: true, allowNet: true, query: '?room=' + room });
  await B.page.waitForFunction(() => __ng.netState().on && __ng.netState().peers >= 1, null, { timeout: 60000 });
  await ev(B.page, () => document.getElementById('bStart').click());
  await B.page.waitForFunction(() => __ng.levels.def() === 'arena' && __dbg.state === 'play', null, { timeout: 240000 }); await B.page.waitForTimeout(5000);
  await ev(A.page, () => __ng.levels.setFragLimit(2)); await ev(B.page, () => __ng.levels.setFragLimit(2));
  const idA = await ev(A.page, () => __dbg.net.id), idB = await ev(B.page, () => __dbg.net.id); R.ids = [idA, idB];
  R.hudVisible = await ev(A.page, () => { const e = document.getElementById('matchHud'); return !!e && e.style.display !== 'none'; });
  // B frags A twice with real pvp messages (hits spaced past the 1.3 s invulnerability); keep hitting until the frag registers
  const fragsOf = (p, id) => ev(p, id => { const f = __ng.levels.match().frags.find(q => q[0] === id); return f ? f[1] : 0; }, idB);
  for (let kill = 1; kill <= 2; kill++) {
    for (let h = 0; h < 60; h++) {
      if (await fragsOf(A.page) >= kill || (await ev(A.page, () => __ng.levels.match().over))) break;
      const st = await ev(A.page, () => __ng.me().state); if (st === 'play') await ev(B.page, id => __dbg.net.ws.send(JSON.stringify({ t: 'pvp', to: id, d: 1 })), idA);
      await B.page.waitForTimeout(1600);
    }
    await A.page.waitForTimeout(800);
    R['afterKill' + kill] = { A: await ev(A.page, () => __ng.levels.match()), B: await ev(B.page, () => __ng.levels.match()) };
  }
  await B.page.waitForFunction(() => __ng.levels.match().over, null, { timeout: 30000 }).then(() => { R.guestSawMatchEnd = true; }).catch(() => { R.guestSawMatchEnd = false; });
  R.final = { A: await ev(A.page, () => __ng.levels.match()), B: await ev(B.page, () => __ng.levels.match()) };
  await A.page.waitForFunction(() => !__ng.levels.match().over, null, { timeout: 60000 }).then(() => { R.newRound = true; }).catch(() => { R.newRound = false; });
  R.errors = [...A.errors, ...B.errors];
  const fr = o => JSON.stringify(o.frags.slice().sort());
  R.agree = fr(R.afterKill1.A) === fr(R.afterKill1.B) && R.afterKill1.A.frags.some(([id, f]) => id === idB && f === 1);
  console.log(JSON.stringify(R, null, 1));
  const ok = R.hudVisible && R.agree && R.final.A.over && R.final.B.over && R.final.A.winner === idB && R.guestSawMatchEnd && R.newRound && !R.errors.length;
  console.log(ok ? 'MATCH PASS' : 'MATCH FAIL'); await br.close(); srv.kill(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
