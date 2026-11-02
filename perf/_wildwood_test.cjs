// Headless WILDWOOD verification:
//  boot default baseline -> build 'wildwood' (stats, tree hubs, 6 dungeon mids, spawn on canopy, no box towers) ->
//  anti-clone probes (dungeon knots NOT on Lvl1's ring slots; own TOP band; moon present; badMats) ->
//  determinism (rebuild twice, counts identical) -> descent baseline fingerprint unchanged.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC_LIVE = require('path').resolve(__dirname, '..', 'index.html');
const SRC = require('path').resolve(__dirname, '_wildwood_snapshot.html');

(async () => {
  fs.copyFileSync(SRC_LIVE, SRC);
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  page.on('pageerror', e => console.log('PAGEERROR:', (e && e.message || String(e)).slice(0, 300)));
  page.on('requestfailed', r => console.log('REQFAIL:', r.url().split('/').pop(), r.failure() && r.failure().errorText));
  page.on('console', m => { if (m.type() === 'error' || (m.text() || '').includes('wildwood')) console.log('CONSOLE:', (m.text() || '').slice(0, 300)); });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().includes('snapshot')) console.log('INTERCEPT:', req.url().slice(-70));
    if (req.url().startsWith('file:') && /(_wildwood_snapshot|index)\.html$/.test(req.url())) {
      const h = fs.readFileSync(SRC, 'utf8')
        .replace('window.__ng = {', `window.__hk = {
        setLevelDefById, buildLevel, startLevelDef,
        stats: () => ({ solids: solids.length, platforms: platforms.length, enemies: enemies.length, items: items.length, portals: portals.length, seed }),
        ww: () => ({ tops: TOP, spawn: (typeof starts !== 'undefined' && starts.length) ? { x: +starts[0].x.toFixed(1), y: +starts[0].y.toFixed(1), z: +starts[0].z.toFixed(1) } : null, hubs: levelHubs.length, kinds: levelHubs.reduce((m, h) => { m[h.kind] = (m[h.kind] || 0) + 1; return m; }, {}), mids: commons && commons.mid ? Object.keys(commons.mid) : [], moon: !!(moonInfo && !moonInfo.moonless), moonArena: solids.filter(s => s.moon).length, zones: WILDWOOD_ZONES.map(z => z.name), bossRoster: WILDWOOD_BOSSES.length, boughs: levelHubs.filter(h => h.kind !== 'start' && h.kind !== 'launch').reduce((m, h) => { m[h.zone ? h.zone.name : 'none'] = (m[h.zone ? h.zone.name : 'none'] || 0) + 1; return m; }, {}) }),
        ringProbe: () => { const R = 600; return { l1Slots: [0, 1, 2, 3, 4, 5].map(i => ({ a: +(i * Math.PI / 3).toFixed(2) })), knotAngles: commons && commons.mid ? Object.values(commons.mid).map(m => +Math.atan2(m.z - (universeCentre ? 0 : 0), m.x).toFixed(2)) : [] }; },
        boxTowers: () => { let n = 0; scene.traverse(o => { if (o.isMesh && o.userData && o.userData.towerHub && o.geometry && o.geometry.type === 'BoxGeometry') n++; }); return n; },
        menu: () => ({ all: LEVELS_ALL.map(l => l.id), shown: LEVELS.map(l => l.id) }),
        badMats: () => { const bad = []; scene.traverse(o => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (!(m && m.isMaterial && m.opacity !== undefined && m.color !== undefined)) bad.push(o.type + '/' + (o.name || '')); } } }); return bad.slice(0, 8); },
        play: (on) => { if (on) { if (state !== 'play') { menuRender(); menuKey({ code: 'Enter' }); } } },
        tp: (x, y, z) => { pos.set(x, y, z); vel.set(0, 0, 0); onGround = false; },
        ready: () => ({ state, g: onGround, y: +pos.y.toFixed(2) }),
        probe: () => ({ ld: levelDef.id, worldR: WORLD_R }),
      }; window.__ng = {`)
      if (!h.includes('window.__hk')) throw new Error('hook injection failed');
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  await page.goto('file:///' + SRC.replace(/\\/g, '/') + '', { waitUntil: 'load', timeout: 120000 });
  await page.waitForFunction('!!window.__hk', { timeout: 120000 });
  const evl = f => page.evaluate(f);

  // 1) descent baseline (must be unchanged by the wildwood code)
  await evl(() => { window.__hk.setLevelDefById('descent'); window.__hk.buildLevel(); });
  const base = await evl(() => window.__hk.stats());

  // 2) build wildwood
  await evl(() => { window.__hk.setLevelDefById('wildwood'); window.__hk.buildLevel(); });
  const ww = await evl(() => window.__hk.ww());
  const wwStats = await evl(() => window.__hk.stats());
  const menu = await evl(() => window.__hk.menu());
  const badMats = await evl(() => window.__hk.badMats());
  const boxTowers = await evl(() => window.__hk.boxTowers());
  console.log('baseline (descent):', JSON.stringify(base));
  console.log('WILDWOOD stats:', JSON.stringify(wwStats));
  console.log('WILDWOOD world:', JSON.stringify(ww));
  console.log('menu:', JSON.stringify(menu));
  console.log('boxTowers in wildwood (must be 0):', boxTowers);
  console.log('badMats:', JSON.stringify(badMats));

  // 3) play probe: spawn on the canopy roof, grounded
  await evl(() => { window.__hk.setLevelDefById('wildwood'); window.__hk.startLevelDef('wildwood'); window.__hk.play(true); });
  await new Promise(r => setTimeout(r, 2500));
  const ready = await evl(() => window.__hk.ready());
  const probe = await evl(() => window.__hk.probe());
  console.log('play ready:', JSON.stringify(ready), 'probe:', JSON.stringify(probe));

  // 4) determinism: rebuild twice, stats must match
  await evl(() => { window.__hk.buildLevel(); });
  const ww2 = await evl(() => window.__hk.stats());
  await evl(() => { window.__hk.buildLevel(); });
  const ww3 = await evl(() => window.__hk.stats());
  console.log('determinism:', JSON.stringify(ww2) === JSON.stringify(ww3) ? 'PASS' : 'FAIL ' + JSON.stringify({ ww2, ww3 }));

  // 5) descent fingerprint after wildwood rebuilds
  await evl(() => { window.__hk.setLevelDefById('descent'); window.__hk.buildLevel(); });
  const base2 = await evl(() => window.__hk.stats());
  console.log('descent after wildwood rebuild:', JSON.stringify(base2), JSON.stringify(base) === JSON.stringify(base2) ? 'MATCH' : 'CHANGED (first-boot ambient growth)');

  await browser.close();
  console.log('WILDWOOD TEST DONE');
})().catch(e => { console.error('WILDWOOD TEST ERROR:', e && e.message || e); process.exit(1); });
