// Probe for Levels 2-4 (overgrowth/ascent/skyfall) after the "genuinely distinct" rework:
// builds each level headless and reports stats + the actual zone names that appear in its
// hub graph (to confirm levelZones() is really replacing the global ZONES for these levels).
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
        stats: () => ({ solids: solids.length, platforms: platforms.length, enemies: enemies.length, items: items.length, portals: portals.length, hubs: (typeof levelHubs !== 'undefined' && levelHubs) ? levelHubs.length : 0, seed }),
        zoneNames: () => { const m = {}; for (const h of (levelHubs||[])) { const n = h.zone && h.zone.name || '(none)'; m[n] = (m[n]||0)+1; } return m; },
        ladderZoneNames: () => { const m = {}; for (const s of (ladder||[])) { const n = s.zone && s.zone.name || '(none)'; m[n] = (m[n]||0)+1; } return m; },
        moonReachable: () => !!(typeof moonInfo !== 'undefined' && moonInfo && moonInfo.col),
        midSiteKeys: () => (typeof MID_SITE_KEY !== 'undefined' ? MID_SITE_KEY : null),
        dungeonProbe: key => { const r = (typeof midRoute === 'function') ? midRoute(key) : null; return r; },
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

  for (const id of ['overgrowth', 'ascent', 'skyfall']) {
    await evl(lvl => { window.__hk.setLevelDefById(lvl); window.__hk.buildLevel(); }, id);
    await new Promise(r => setTimeout(r, 3000));
    const stats = await evl(() => window.__hk.stats());
    const zoneNames = await evl(() => window.__hk.zoneNames());
    const ladderZoneNames = await evl(() => window.__hk.ladderZoneNames());
    const moon = await evl(() => window.__hk.moonReachable());
    console.log(`${id.toUpperCase()}:`, JSON.stringify({ stats, zoneNames, ladderZoneNames, moon }));
  }

  console.log('runtime errors:', errors.length ? errors.slice(0, 10).join(' | ') : 'none');
  await browser.close();
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
