// T-REG/T-LIFE (kit-selftest): load, activate, fall -> checkpoint respawn, complete, exit to sky-city, reload x3, determinism, leak counters.
const { serve, launch, openGame } = require('./lib.cjs');
(async () => {
  const { srv, url } = await serve(); const br = await launch();
  const { page, errors } = await openGame(br, url, { dbg: true });
  const R = {}; const ev = f => page.evaluate(f); const wait = ms => page.waitForTimeout(ms);
  await ev(() => document.getElementById('bStart').click()); await wait(3000);
  R.skyBefore = await ev(() => ({ solids: __dbg.solids.length, ...__ng.levels.sceneCounts(), r: __ng.levels.rendererInfo(), heap: Math.round(performance.memory.usedJSHeapSize / 1e6) }));
  R.skyHashBefore = await ev(() => { const s = __dbg.solids.filter(q => !q.sp); const f = x => Math.round(x * 100); let a = 0; for (const b of s) a = (a * 31 + f(b.minx) * 7 + f(b.maxy) * 13 + f(b.minz) * 17 + f(b.maxx) * 3) % 1000000007; return s.length + ':' + a; });      // static (non-moving) solids only: movers drift
  const hashes = [];
  for (let i = 0; i < 3; i++) {
    R['load' + i] = await ev(async () => { const ok = await __ng.levels.load('kit-selftest'); return { ok, st: __ng.levels.state(), sig: __ng.levels.sig() }; });
    hashes.push(R['load' + i].sig.hash);
    await ev(() => __ng.levels.exit()); await wait(500);
  }
  R.hashesEqual = hashes.every(h => h === hashes[0]); R.hashes = hashes;
  R.skyAfter = await ev(() => ({ solids: __dbg.solids.length, ...__ng.levels.sceneCounts(), r: __ng.levels.rendererInfo(), heap: Math.round(performance.memory.usedJSHeapSize / 1e6) }));
  R.skyHashAfter = await ev(() => { const s = __dbg.solids.filter(q => !q.sp); const f = x => Math.round(x * 100); let a = 0; for (const b of s) a = (a * 31 + f(b.minx) * 7 + f(b.maxy) * 13 + f(b.minz) * 17 + f(b.maxx) * 3) % 1000000007; return s.length + ':' + a; });      // static (non-moving) solids only: movers drift
  // gameplay lifecycle inside the spec
  await ev(async () => { await __ng.levels.load('kit-selftest'); }); await wait(800);
  R.spawn = await ev(() => ({ me: __ng.me(), st: __ng.levels.state() }));
  const until = (expr, ms = 60000) => page.waitForFunction(expr, null, { timeout: ms, polling: 100 });
  await ev(() => __ng.tp(0, 3, 24)); await until(`__ng.levels.state().checkpoint.z > 20`);   // land on the checkpoint pad (physics + checkpoint branch)
  R.cp = await ev(() => __ng.levels.state().checkpoint);
  await ev(() => __ng.tp(30, -61, 0)); await until(`__ng.me().state === 'dead'`); R.died = true;     // fall below killY -> die
  await until(`__ng.me().state === 'play'`); await wait(300);                                       // -> respawn at the checkpoint
  R.afterFall = await ev(() => ({ me: __ng.me(), st: __ng.levels.state() }));
  await ev(() => __ng.tp(0, 1, 44)); await until(`__ng.levels.state().state === 'clear'`);
  R.complete = await ev(() => __ng.levels.state().state);
  await until(`__ng.levels.state().active === null`);
  R.exited = await ev(() => ({ active: __ng.levels.state().active, state: __ng.levels.state().state, solids: __dbg.solids.length }));
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  const ok = R.hashesEqual && R.afterFall.me.state === 'play' && Math.abs(R.afterFall.me.z - 24) < 3 && R.complete === 'clear' && R.exited.active === null && R.skyHashBefore === R.skyHashAfter && !errors.length;
  console.log(ok ? 'SELFTEST PASS' : 'SELFTEST FAIL'); await br.close(); srv.close(); process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
