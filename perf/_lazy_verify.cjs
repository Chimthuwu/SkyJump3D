// LAZY-BODY + GEO-CACHE verification (headless): boot default level, measure buildLevel ms,
// teleport to enemy clusters -> bodies lazily build; count is sane; geo cache hit ratio; zero pageerrors.
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
      // instrument the geo() cache + expose build hooks
      h = h.replace('function geo(kind, ...a) { const k = kind + \':\' + a.map(v => Math.round(v * 1000)).join(\',\'); let out = geoCache.get(k); if (!out) geoCache.set(k, out = new THREE[kind](...a)); return out; }',
        `function geo(kind, ...a) { const k = kind + ':' + a.map(v => Math.round(v * 1000)).join(','); let out = geoCache.get(k); window.__geo = window.__geo || { calls: 0, builds: 0, size: 0 }; window.__geo.calls++; if (!out) { geoCache.set(k, out = new THREE[kind](...a)); window.__geo.builds++; window.__geo.size = geoCache.size; } return out; }`);
      h = h.replace('window.__ng = {', `window.__hk = {
        buildLevel,
        enterPlay: () => LEVELS[0].startFn(),
        stats: () => ({ solids: solids.length, enemies: enemies.length, items: items.length, seed }),
        built: () => enemies.filter(e => !e.dead && e.built).length,
        unbuilt: () => enemies.filter(e => !e.dead && !e.built).length,
        near: () => enemies.filter(e => !e.dead && e.mesh && e.mesh.parent).length,
        pos: () => pos,
        me: () => ({ x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2), state }),
        enemySpots: (n = 20, minGap = 60) => { const out = [], xs = []; for (const e of enemies) { if (e.dead) continue; if (xs.every(x => Math.hypot(x[0] - e.x, x[1] - e.z) > minGap)) { xs.push([e.x, e.z, e.y]); out.push([e.x, e.z, e.y]); if (out.length >= n) break; } } return out; },
        tp: (x, y, z) => { pos.x = x; pos.y = y; pos.z = z; vel.x = vel.y = vel.z = 0; },
        sample: () => enemies.slice(0, 5).map(e => ({ k: e.kind, v: e.variant, x: +(+e.x).toFixed(1), y: +(+e.y).toFixed(1), z: +(+e.z).toFixed(1), dead: !!e.dead })),
        hereEnemies: (r = 60) => enemies.filter(e => !e.dead && Math.hypot(e.x - pos.x, e.z - pos.z) < r && Math.abs(e.y - pos.y) < 80).length,
        hereBuilt: (r = 50) => enemies.filter(e => !e.dead && e.built && Math.hypot(e.x - pos.x, e.z - pos.z) < r).length,
        castProbe: () => { try { const e = enemies.find(u => !u.dead && Math.hypot(u.x - pos.x, u.z - pos.z) < 25); if (!e) return 'noenemy'; const o = new THREE.Vector3(pos.x, pos.y + 1.5, pos.z); const d = new THREE.Vector3(e.x - o.x, (e.y + 1) - o.y, e.z - o.z).normalize(); const h = castRay(o, d, 60); return 'ok t=' + (h.t | 0) + ' hp=' + e.hp; } catch (err) { return 'ERR ' + err.message; } },
      }; window.__ng = {`);
      req.respond({ status: 200, contentType: 'text/html', body: h });
      console.log('  [serve] marker checks:', { geo: h.includes('__geo.calls++'), hk: h.includes('window.__hk = {') });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__hk', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 4500));
  const evl = (fn, ...args) => page.evaluate(fn, ...args);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  // 1) measure a full rebuild of the default level
  await evl(() => window.__hk.enterPlay());
  await wait(1200);
  const buildMs = await evl(() => { const t0 = performance.now(); window.__hk.buildLevel(); return Math.round(performance.now() - t0); });
  await wait(3000);
  const st0 = await evl(() => ({ st: window.__hk.stats(), built: window.__hk.built(), unbuilt: window.__hk.unbuilt(), geo: window.__geo || null, me: window.__hk.me(), errs: window.__gyErr }));

  // 2) teleport to several enemy clusters -> lazy bodies must build within a few frames
  const sample = await evl(() => window.__hk.sample());
  console.log('enemy sample:', JSON.stringify(sample));
  const spots = await evl(() => window.__hk.enemySpots(6, 80));
  const probes = [];
  for (let i = 0; i < Math.min(4, spots.length); i++) {
    const s = spots[i];
    await evl((s) => window.__hk.tp(s[0] + 6, s[2] + 4, s[1] + 6), s);
    await wait(900);
    const here = await evl(() => ({ here: window.__hk.hereEnemies(50), hereBuilt: window.__hk.hereBuilt(50), geo: window.__geo }));
    probes.push({ spot: [Math.round(s[0]), Math.round(s[1])], here: here.here, builtHere: here.hereBuilt, geoCalls: here.geo && here.geo.calls, geoBuilds: here.geo && here.geo.builds, geoSize: here.geo && here.geo.size });
  }

  // 3) shooting path still resolves (castRay is position-based, not mesh-based) — fire at a nearby built enemy
  let shoot = 'skipped';
  if (spots.length) {
    const s = spots[0];
    await evl(s => window.__hk.tp(s[0] + 3, s[2] + 4, s[1] + 3), s);
    await wait(500);
    shoot = await evl(() => window.__hk.castProbe());
  }

  const builtFinal = await evl(() => ({ built: window.__hk.built(), unbuilt: window.__hk.unbuilt(), near: window.__hk.near(), enemies: window.__hk.stats().enemies }));

  console.log('buildLevel ms:', buildMs);
  console.log('boot:', JSON.stringify(st0));
  console.log('spots:', spots.length);
  console.log('cluster probes:', JSON.stringify(probes, null, 1));
  console.log('finish counts:', JSON.stringify(builtFinal));
  console.log('castRay probe:', shoot);
  console.log('runtime errors:', errors.length ? errors : 'none');
  const ok = !errors.length && probes.length > 0 && probes.every(p => p.here > 0 && p.builtHere > 0 && p.geoBuilds < p.geoCalls) && builtFinal.built > 0 && builtFinal.unbuilt > 0;
  console.log(ok ? 'LAZY VERIFY: PASS' : 'LAZY VERIFY: CHECK ABOVE');
  await browser.close();
  process.exit(ok ? 0 : 2);
})().catch(e => { console.error('LAZY VERIFY FAILED:', e && e.stack || e); process.exit(1); });
