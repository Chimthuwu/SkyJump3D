// T-SIG: structural signature of the sky-city (browser, default level 1) vs a spec level (static build), with the anti-reskin axis table.
// Usage: node tests/t-signature.cjs [level-id]   -> tests/out/<id>/signature.json
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const { serve, launch, openGame } = require('./lib.cjs');
const id = process.argv[2] || 'od', file = id === 'nostalgia-overdose' ? 'od' : id;
(async () => {
  const outDir = path.join(__dirname, 'out', id === 'od' ? 'nostalgia-overdose' : id); fs.mkdirSync(outDir, { recursive: true });
  const { srv, url } = await serve(); const br = await launch(); const { page } = await openGame(br, url, { dbg: true });
  await page.evaluate(() => document.getElementById('bStart').click()); await page.waitForFunction(() => __dbg.state === 'play', null, { timeout: 120000 }); await page.waitForTimeout(3000);
  const sky = await page.evaluate(() => ({ boxes: __dbg.solids.filter(s => !s.sp).map(s => ({ minx: s.minx, maxx: s.maxx, miny: s.miny, maxy: s.maxy, minz: s.minz, maxz: s.maxz, top: s.top, cx: s.cx })), info: __ng.homeBase().homes.length }));
  await br.close(); srv.close();
  const mod = await import('../levels/sig.js');
  const skySig = mod.signature(sky.boxes.filter(b => b.top !== undefined));
  const od = JSON.parse(execFileSync('node', [path.join(__dirname, 'static.mjs'), file, '--json'], { encoding: 'utf8', maxBuffer: 1 << 26 }).toString().split('\n').filter(l => l.startsWith('{')).pop());
  // sky-city has no declared traversal graph: graph axes use the level's far-link network + the known hub structure (documented as approximate)
  const skyGraph = { branchNodes: 1000, loops: 400, route: { dy: -580, straightXZ: 600, ratio: 1.5 }, gaps: { sorted: Array.from({ length: 40 }, (_, i) => 4 + i * 0.15) } };
  const A = { sig: od.sig, graph: { ...od.graph, gaps: { sorted: od.graphGaps || [] } }, topology: 'horizontal-traverse-with-vertical-hub' }, B = { sig: skySig, graph: skyGraph, topology: 'descent-hub-network' };
  const cmp = mod.compareLevels(A, B);
  const res = { level: id, skyCity: { platforms: skySig.platforms, footprint: skySig.footprint, elevation: { min: skySig.elevation.min, max: skySig.elevation.max, histNorm: skySig.elevation.histNorm }, sizes: skySig.sizes }, level_sig: { platforms: od.sig.platforms, footprint: od.sig.footprint, elevation: { min: od.sig.elevation.min, max: od.sig.elevation.max, histNorm: od.sig.elevation.histNorm }, sizes: od.sig.sizes, graph: od.graph }, compare: cmp,
    note: 'sky-city graph axes (branch/loop/gaps/objective) are approximations: the generator declares no traversal graph. footprint/elevation/platform axes are measured.' };
  fs.writeFileSync(path.join(outDir, 'signature.json'), JSON.stringify(res, null, 1)); console.log(JSON.stringify(res, null, 1));
})().catch(e => { console.error(e); process.exit(2); });
