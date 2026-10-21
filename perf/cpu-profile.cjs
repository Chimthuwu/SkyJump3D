const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const URL = 'file:///C:/Users/Serge/Desktop/SkyDive/index.html';
const w = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', args: ['--allow-file-access-from-files','--enable-unsafe-swiftshader','--use-gl=swiftshader','--no-sandbox','--mute-audio','--window-size=1280,800'] });
  const page = await browser.newPage(); await page.setViewport({ width: 1280, height: 800 });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__ng', { timeout: 90000 });
  await page.evaluate(() => { const b = document.getElementById('bStart'); if (b) b.click(); });
  await w(6000);
  const cdp = await page.createCDPSession();
  await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 });
  const counts = () => page.evaluate(() => ({ ...window.__ng.cull(), heap: performance.memory.usedJSHeapSize }));
  async function scene(name, setup, secs) {
    if (setup) await page.evaluate(setup); await w(1500);
    await page.evaluate(() => window.__ng.perf.start());
    await cdp.send('Profiler.start'); const t0 = Date.now(); await w(secs * 1000);
    const { profile } = await cdp.send('Profiler.stop'); const el = (Date.now() - t0) / 1000;
    const snap = await page.evaluate(() => { const s = window.__ng.perf._snapshot(); window.__ng.perf.stop(); return s; });
    const c = await counts();
    // aggregate
    const nodes = new Map(profile.nodes.map(n => [n.id, n])); const parent = new Map();
    for (const n of profile.nodes) for (const ch of n.children || []) parent.set(ch, n.id);
    const self = new Map(); const dt = profile.timeDeltas; let total = 0;
    profile.samples.forEach((id, i) => { const d = (dt[i] || 0) / 1000; self.set(id, (self.get(id) || 0) + d); total += d; });
    const key = n => `${n.callFrame.functionName || '(anon)'}@${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber + 1}`;
    const bySelf = {}, byIncl = {};
    for (const [id, t] of self) {
      const n = nodes.get(id); const k = key(n); bySelf[k] = (bySelf[k] || 0) + t;
      const seen = new Set(); let cur = id;
      while (cur !== undefined) { const kk = key(nodes.get(cur)); if (!seen.has(kk)) { seen.add(kk); byIncl[kk] = (byIncl[kk] || 0) + t; } cur = parent.get(cur); }
    }
    const rank = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => ({ fn: k, msPerSec: +(v / el).toFixed(2), pct: +(100 * v / total).toFixed(1) }));
    const out = { name, seconds: el, totalMs: total, idlePct: +(100 * (bySelf['(idle)@:0'] || 0) / total).toFixed(1), perf: snap, counts: c, topSelf: rank(bySelf), topIncl: rank(byIncl) };
    fs.writeFileSync(`C:/Users/Serge/Desktop/SkyDive/perf/cpu-profile-${name}.json`, JSON.stringify(out, null, 1));
    console.log('==', name, 'fps', snap.fps, 'idle%', out.idlePct, JSON.stringify(c)); console.log(JSON.stringify(snap));
    out.topSelf.slice(0, 25).forEach(r => console.log(' S', r.msPerSec, r.pct + '%', r.fn));
    out.topIncl.slice(0, 25).forEach(r => console.log(' I', r.msPerSec, r.pct + '%', r.fn));
  }
  await scene('1-spawn-idle', () => { const p = window.__ng.perf; p.scenes.spawn(); }, 10);
  await scene('2-run', () => { const g = window.__ng; const p = g.pos; g.perf.scenes.spawn(); g.tp(p.x + 300, p.y + 10, p.z + 200); }, 5);
  // scripted movement: hold forward + periodic jump for 10s
  await page.evaluate(() => { window.__ng.perf.scenes.spawn(); });
  await page.keyboard.down('KeyW'); 
  const jump = setInterval(() => { page.keyboard.press('Space').catch(() => {}); }, 900);
  await scene('2b-moving', null, 10);
  clearInterval(jump); await page.keyboard.up('KeyW');
  await scene('3-enemies', () => { window.__ng.perf.scenes.arena(); }, 10);
  // heap growth 30s
  await page.evaluate(() => { clearInterval(window.__ng.perf._fire); window.__ng.perf.scenes.spawn(); }); await w(2000);
  const heap = []; for (let i = 0; i < 6; i++) { heap.push(await page.evaluate(() => performance.memory.usedJSHeapSize)); await w(5000); }
  heap.push(await page.evaluate(() => performance.memory.usedJSHeapSize));
  fs.writeFileSync('C:/Users/Serge/Desktop/SkyDive/perf/cpu-profile-heap.json', JSON.stringify({ heapBytesEvery5s: heap }));
  console.log('heap MB', heap.map(h => (h / 1e6).toFixed(1)).join(' '), 'errors', errors.slice(0, 5));
  await browser.close();
})();
