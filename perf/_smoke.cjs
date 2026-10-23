// Headless smoke: default fingerprint -> NOS & Rent builds -> lazy below-0 -> default fingerprint again.
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
        setLevelDefById, buildLevel, buildBelowZeroForLevel,
        stats: () => ({ solids: solids.length, platforms: platforms.length, enemies: enemies.length, items: items.length, portals: portals.length, hubs: (typeof levelHubs !== 'undefined' && levelHubs) ? levelHubs.length : 0, seed }),
        nosRoad: () => ({ chunks: nosRoadAudit.chunks, totalLength: nosRoadAudit.totalLength, gaps: nosRoadAudit.gaps.slice(), arenas: nosRoadAudit.arenas, services: nosRoadAudit.services, traffic: nosRoadAudit.traffic, pipes: nosPipes.length, pipesLinked: nosPipes.filter(p=>p.to).length }),
        below: () => ({ built: belowZeroBuilt, touched: thresholdTouched, entry: !!belowZeroEntry, hubs: belowZeroHubs.length }),
        themeHubCounts: () => levelHubs.reduce((m, h) => { m[h.kind] = (m[h.kind] || 0) + 1; return m; }, {}),
        thresholdSolids: () => solids.filter(s => s.isThreshold).map(s => ({ top: Math.round(s.top), cx: Math.round(s.cx), cz: Math.round(s.cz) })),
        roadSolids: () => solids.filter(s => s.nosRoadChunk).length,
      }; window.__ng = {`);
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', c => { const t = c.text(); if (t.includes('[nos]') || t.includes('[rent]')) console.log('  console>', t); });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__hk', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 4000));

  const evl = fn => page.evaluate(fn);
  const fp0 = await evl(() => window.__hk.stats());
  console.log('DEFAULT baseline:', JSON.stringify(fp0));

  // === NOS ===
  await evl(() => { window.__hk.setLevelDefById('nos'); window.__hk.buildLevel(); });
  await new Promise(r => setTimeout(r, 2500));
  const nos = await evl(() => ({ stats: window.__hk.stats(), road: window.__hk.nosRoad(), thr: window.__hk.thresholdSolids(), below: window.__hk.below(), roadSolids: window.__hk.roadSolids(), kinds: window.__hk.themeHubCounts() }));
  console.log('NOS:', JSON.stringify({ ...nos, road: { ...nos.road, gaps: undefined } }));
  console.log(`NOS check: chunks=${nos.road.chunks} rampSpans=${nos.road.gaps.length} roadSolids=${nos.roadSolids} thresholdAtY0=${nos.thr.some(s => s.top === 0)} probing`);
  // === below-0 (VCR) builds lazily only when asked ===
  await evl(() => window.__hk.buildBelowZeroForLevel());
  await new Promise(r => setTimeout(r, 1500));
  const vcr = await evl(() => window.__hk.below());
  console.log('NOS below-0 after threshold build:', JSON.stringify(vcr));

  // === RENT ===
  await evl(() => { window.__hk.setLevelDefById('rent'); window.__hk.buildLevel(); });
  await new Promise(r => setTimeout(r, 2500));
  const rent = await evl(() => ({ stats: window.__hk.stats(), thr: window.__hk.thresholdSolids(), below: window.__hk.below(), kinds: window.__hk.themeHubCounts() }));
  console.log('RENT:', JSON.stringify(rent));
  await evl(() => window.__hk.buildBelowZeroForLevel());
  await new Promise(r => setTimeout(r, 1500));
  const hell = await evl(() => window.__hk.below());
  console.log('RENT below-0 after threshold build:', JSON.stringify(hell));

  // === default world unchanged ===
  await evl(() => { window.__hk.setLevelDefById('descent'); window.__hk.buildLevel(); });
  await new Promise(r => setTimeout(r, 2500));
  const fp1 = await evl(() => window.__hk.stats());
  const fpSame = ['solids', 'platforms', 'enemies', 'items', 'portals', 'hubs', 'seed'].every(k => fp0[k] === fp1[k]);
  console.log('DEFAULT after rebuilds:', JSON.stringify(fp1), '| fingerprint match:', fpSame);

  console.log('runtime errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('SMOKE FAILED:', e.message); process.exit(1); });
