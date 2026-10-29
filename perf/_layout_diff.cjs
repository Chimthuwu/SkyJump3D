// Quantitative proof that Levels 2-4's sky-city hub SHAPE actually differs from descent (and from each other) -
// not just palette/zone names. Raw (x,z) comparison is useless here since every level uses a different seed
// offset, so coordinates differ numerically even for byte-identical algorithms. Instead this builds a
// seed-invariant structural fingerprint per level: for every non-start/launch/exit/island hub (the sky-city
// arenas/buildings placed by buildNetwork's per-universe loop), take its (angle, radius) relative to its own
// universe's centre, and bucket those into normalized histograms (16 angle bins x 2pi, 12 radius bins x 600).
// A uniform radial-band scatter (the old/default shape) gives a near-flat angle histogram. A branching-tree,
// switchback-trail, or archipelago shape should give a visibly peaky/clustered histogram instead.
// Diff metric per level pair = average total-variation distance (half L1) between their two histograms, 0..1.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');
const LEVELS = ['descent', 'overgrowth', 'ascent', 'skyfall'];

function tvDist(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / 2; }
function norm(h) { const t = h.reduce((a, b) => a + b, 0) || 1; return h.map(v => v / t); }

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
        fingerprint: () => {
          const hubs = (levelHubs || []).filter(h => h.universe !== undefined && h.kind !== 'start' && h.kind !== 'launch' && h.kind !== 'island');
          const ANG_BINS = 16, RAD_BINS = 12, RAD_MAX = 600;
          const angH = new Array(ANG_BINS).fill(0), radH = new Array(RAD_BINS).fill(0);
          for (const hub of hubs) {
            const c = universeCentre(hub.universe);
            const dx = hub.x - c.x, dz = hub.z - c.z;
            const ang = (Math.atan2(dz, dx) + Math.PI * 2) % (Math.PI * 2);
            const rad = Math.hypot(dx, dz);
            angH[Math.min(ANG_BINS - 1, Math.floor(ang / (Math.PI * 2) * ANG_BINS))]++;
            radH[Math.min(RAD_BINS - 1, Math.floor(rad / RAD_MAX * RAD_BINS))]++;
          }
          return { count: hubs.length, angH, radH };
        },
        edgeCount: () => solids.filter(s => s.isRoute || s.routeEdge).length,
        moonReachable: () => !!(typeof moonInfo !== 'undefined' && moonInfo && moonInfo.col),
      }; window.__ng = {`);
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__hk', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 4000));
  const evl = (fn, ...args) => page.evaluate(fn, ...args);

  const fps = {};
  for (const id of LEVELS) {
    await evl(lvl => { window.__hk.setLevelDefById(lvl); window.__hk.buildLevel(); }, id);
    await new Promise(r => setTimeout(r, 3000));
    const fp = await evl(() => window.__hk.fingerprint());
    const moon = await evl(() => window.__hk.moonReachable());
    fps[id] = fp;
    console.log(`${id}: hubs=${fp.count} moon=${moon} angH=${JSON.stringify(fp.angH)} radH=${JSON.stringify(fp.radH)}`);
  }

  console.log('\n--- pairwise shape diff (0..1, higher = more structurally different) ---');
  for (let i = 0; i < LEVELS.length; i++) for (let j = i + 1; j < LEVELS.length; j++) {
    const a = fps[LEVELS[i]], b = fps[LEVELS[j]];
    const angD = tvDist(norm(a.angH), norm(b.angH)), radD = tvDist(norm(a.radH), norm(b.radH));
    const diff = (angD + radD) / 2;
    console.log(`${LEVELS[i]} vs ${LEVELS[j]}: angle_diff=${angD.toFixed(3)} radius_diff=${radD.toFixed(3)} combined=${diff.toFixed(3)}`);
  }

  console.log('\nruntime errors:', errors.length ? errors.slice(0, 10).join(' | ') : 'none');
  await browser.close();
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
