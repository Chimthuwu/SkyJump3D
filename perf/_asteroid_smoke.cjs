// Asteroid set-piece smoke: Mars route -> all 7 planet legs -> assert each leg has its
// asteroid tiers/boulders + planet pad apron, with zero page errors.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new', protocolTimeout: 600000,
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) {
      let h = fs.readFileSync(SRC, 'utf8');
      h = h.replace('window.__ng = {', `window.__ak = {
        diag: () => ({ jobs: jobs.length, built: { ...planetLegBuilt }, marsBuilt, marsInfo: !!marsInfo, pi: planetInfo.map(q => q ? 1 : undefined) }),
        marsInfo: () => (typeof marsInfo !== 'undefined' ? marsInfo : null),
        planetInfo: () => planetInfo.map(q => (q ? { x: q.x, y: q.y, z: q.z } : null)),
        asteroidSolids: () => solids.filter(s => s.asteroid),
        aprons: () => solids.filter(s => s.planetSurface).map(s => ({ hw: s.hw, top: s.top })),
      }; window.__ng = {`);
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', c => { const t = c.text() || ''; if (c.type() === 'error' && !/Failed to load resource|net::ERR_/.test(t)) errors.push('console-error: ' + t.slice(0, 500)); });

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const waitFor = async (fn, label, ms = 180000, ...args) => {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
      try { const v = await page.evaluate(fn, ...args); if (v) return v; }
      catch (_) {}
      await sleep(500);
    }
    throw new Error('TIMEOUT waiting for ' + label + ' (diag: ' + JSON.stringify(await page.evaluate(() => window.__ak.diag())) + ', errors: ' + errors.join(' || ') + ')');
  };

  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.waitForFunction('window.__ak', { timeout: 180000 });
  await sleep(4000);
  if (errors.length) throw new Error(errors.join(' | '));

  // 1) Mars route (sets marsInfo), then the Jupiter leg
  await page.evaluate(() => { try { window.__ng.mars && window.__ng.mars(); } catch (_) {} });
  await waitFor(() => window.__ak.marsInfo(), 'marsInfo');
  await page.evaluate(() => window.__ng.planet(0));
  await waitFor(() => window.__ak.planetInfo()[0], 'Jupiter leg end');
  await page.evaluate(() => window.__ng.planet(0));   // idempotent (planetLegBuilt guard)

  // 2) chain the remaining legs (each gen needs the previous planetInfo); small breather between
  //    legs so the sliced job queue has frames to drain and planetReached-style flags settle
  for (let i = 1; i < 7; i++) {
    await page.evaluate(idx => window.__ng.planet(idx), i);
    await waitFor(val => window.__ak.planetInfo()[val], 'leg ' + i, 180000, i);
    await sleep(1500);
  }

  // 3) assertions
  const ast = await page.evaluate(() => window.__ak.asteroidSolids());
  const aprons = await page.evaluate(() => window.__ak.aprons());
  const names = ['JUPITER', 'SATURN', 'URANUS', 'NEPTUNE', 'PLUTO', 'CHARON', 'OSIS'];
  console.log('asteroid solids:', ast.length, ' aprons:', JSON.stringify(aprons));
  // every leg contributes 3 stacked tiers + 3 summit boulders = 6 flagged solids
  if (ast.length !== 7 * 6) throw new Error('expected 42 asteroid solids, got ' + ast.length);
  if (aprons.length !== 7) throw new Error('expected 7 planet aprons, got ' + aprons.length);
  const maxApron = Math.max(...aprons.map(a => a.hw));
  if (maxApron > 75) throw new Error('apron too big: hw=' + maxApron);
  for (const a of ast) { if (!isFinite(a.cx) || !isFinite(a.top) || a.top - a.maxy !== 0) throw new Error('bad asteroid solid: ' + JSON.stringify(a)); }
  if (errors.length) throw new Error(errors.join(' | '));
  console.log('ASTEROID SMOKE OK — 7 legs (' + ast.length + ' asteroid solids, max apron hw=' + maxApron + '), 0 page errors');
  await browser.close();
})().catch(e => { console.error('ASTEROID SMOKE FAIL:', e.message); process.exit(1); });
