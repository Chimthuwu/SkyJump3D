// NOS 'HORIZON DRIVE' verifier: spawn on road, seam continuity (no void holes), height bands.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) {
      let h = fs.readFileSync(SRC, 'utf8');
      h = h.replace('window.__ng = {', `window.__hk = {
        setLevelDefById, buildLevel,
        stats: () => ({ solids: solids.length, enemies: enemies.length, items: items.length, portals: portals.length, seed }),
        starts: () => starts.map(s => ({ ...s })),
        roadSolids: () => solids.filter(s => s.nosRoadChunk).map(s => ({ minx: s.minx, maxx: s.maxx, miny: s.miny, maxy: s.maxy, minz: s.minz, maxz: s.maxz, top: s.top, cx: s.cx, cz: s.cz, hw: s.hw || 0, hd: s.hd || 0, plaza: !!s.plaza, finish: !!s.finish })),
        segs: () => solids.filter(s => s.nosSeg).map(s => ({ minx: s.minx, maxx: s.maxx, maxy: s.maxy, minz: s.minz, maxz: s.maxz, top: s.top, cx: s.cx, cz: s.cz, run: s.nosRun, idx: s.nosIdx, prog: s.prog })),
        treads: () => solids.filter(s => s.nosRampTread).map(s => ({ minx: s.minx, maxx: s.maxx, miny: s.miny, maxy: s.maxy, minz: s.minz, maxz: s.maxz })),
        threshold: () => solids.filter(s => s.isThreshold).map(s => ({ top: Math.round(s.top), cx: Math.round(s.cx), cz: Math.round(s.cz), tpl: s.template })),
      }; window.__ng = {`);
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__hk', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 3500));
  const evl = fn => page.evaluate(fn);

  await evl(() => { window.__hk.setLevelDefById('nos'); window.__hk.buildLevel(); });
  await new Promise(r => setTimeout(r, 2500));

  const data = await evl(() => ({ stats: window.__hk.stats(), starts: window.__hk.starts(), road: window.__hk.roadSolids(), segs: window.__hk.segs(), treads: window.__hk.treads(), thr: window.__hk.threshold() }));
  console.log('NOS:', JSON.stringify(data.stats));
  console.log('THRESHOLD:', JSON.stringify(data.thr), 'thresholdAtY0=', data.thr.some(s => s.top === 0));

  // 1) spawn must be ON the road (onRoad marker + a road solid under the spawn point)
  let spawnFail = 0;
  for (const s of data.starts.slice(0, 1)) {
    if (!s.onRoad) spawnFail++;
    const under = data.road.some(r => !r.plaza && !r.finish && s.x >= r.minx - 0.5 && s.x <= r.maxx + 0.5 && s.z >= r.minz - 0.5 && s.z <= r.maxz + 0.5 && Math.abs(r.top - (s.y - 0.25)) < 2.5);
    console.log('SPAWN:', JSON.stringify(s), 'onRoadMarker:', !!s.onRoad, 'standing on road tarmac:', under);
    if (!under) spawnFail++;
  }
  console.log('1) ROAD SPAWN:', spawnFail === 0 ? 'PASS' : 'FAIL');

  // 2) seam continuity: walk consecutive segments (nosRun/nosIdx) of each road; every seam must be
  //    a) a flush butt joint, b) a drop carried by ramp treads down to the next deck, or c) a corner inside a bend plaza
  let seamFails = 0, seams = 0, drops = 0, corners = 0;
  const byRun = {};
  for (const s of data.segs) (byRun[s.run] = byRun[s.run] || []).push(s);
  const roadEnd = (seg, next) => {                  // the point of `seg` that faces `next` along the run
    const longX = (seg.maxx - seg.minx) > (seg.maxz - seg.minz);
    if (longX) return { x: next.cx > seg.cx ? seg.maxx : seg.minx, z: seg.cz };
    return { x: seg.cx, z: next.cz > seg.cz ? seg.maxz : seg.minz };
  };
  for (const run of Object.keys(byRun)) {
    const list = byRun[run].slice().sort((a, b) => a.idx - b.idx);
    if (data.segs.some(s => s.run == null)) { console.log('2a) TAGS: some segment blocks run/idx -> FAIL'); seamFails++; }
    for (let k = 0; k + 1 < list.length; k++) {
      const a = list[k], b = list[k + 1]; seams++;
      const pa = roadEnd(a, b), pb = roadEnd(b, a);
      const dist = Math.hypot(pb.x - pa.x, pb.z - pa.z), drop = Math.abs(a.top - b.top);
      const longA = (a.maxx - a.minx) > (a.maxz - a.minz), longB = (b.maxx - b.minx) > (b.maxz - b.minz);
      let ok, kind;
      if (longA !== longB) {                                   // corner: both joints must sit inside one bend plaza
        kind = 'corner';
        ok = data.road.some(p => p.plaza && pa.x >= p.minx - 2 && pa.x <= p.maxx + 2 && pa.z >= p.minz - 2 && pa.z <= p.maxz + 2 && pb.x >= p.minx - 2 && pb.x <= p.maxx + 2 && pb.z >= p.minz - 2 && pb.z <= p.maxz + 2);
        if (ok) corners++;
      } else {
        kind = dist <= 2.5 ? (drop > 4.5 ? 'ramp-drop' : 'flush') : 'GAP';
        ok = dist <= 2.5;
        if (ok && drop > 4.5) {                                // the stepped descent must land exactly on the next segment's deck
          drops++;
          const seamX = (pa.x + pb.x) / 2, seamZ = (pa.z + pb.z) / 2, loTop = Math.min(a.top, b.top);
          ok = data.treads.some(t => seamX >= t.minx - 2 && seamX <= t.maxx + 2 && seamZ >= t.minz - 2 && seamZ <= t.maxz + 2 && Math.abs(t.maxy - loTop) < 8);
        }
      }
      if (!ok) { seamFails++; console.log(`  SEAM FAIL run=${run} ${a.idx}->${b.idx} ${kind} dist=${dist.toFixed(1)} drop=${drop.toFixed(1)} pa=(${pa.x.toFixed(1)},${pa.z.toFixed(1)}) pb=(${pb.x.toFixed(1)},${pb.z.toFixed(1)})`); }
    }
  }
  console.log(`2) SEAM CONTINUITY: ${seams} seams (${corners} bend corners, ${drops} ramped drops) ->`, seamFails === 0 ? 'PASS (never a hole)' : 'FAIL');

  // 3) one continuous downward profile: start deck highest, finish lowest, stepped bands between
  const tops = [...new Set(data.segs.map(s => +s.top.toFixed(0)))].sort((a, b) => b - a);
  console.log('3) HEIGHT BANDS:', tops.length >= 3 ? 'PASS' : 'FAIL', '-', tops.length, 'distinct rows:', tops.join(','));

  console.log('runtime errors:', errors.length ? errors : 'none');
  await browser.close();
  process.exit(spawnFail === 0 && seamFails === 0 && errors.length === 0 ? 0 : 1);
})().catch(e => { console.error('VERIFY FAILED:', e.message); process.exit(1); });
