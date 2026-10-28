// one-off probe: why doesn't the player settle on the between beacon?
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');
// NOTE: the snapshot IS the source of truth (the live index.html is being concurrently clobbered
// by another session); the snapshot must NOT be copied from live here.
const SRC_LIVE = path.resolve(__dirname, '..', 'index.html');
const SRC = path.resolve(__dirname, '_between_snapshot.html');
(async () => {
  // fs.copyFileSync(SRC_LIVE, SRC);  // disabled: never overwrite the hoisted snapshot from the racing live file
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('file:') && /(_between_snapshot|index)\.html$/.test(req.url())) {
      const threeSrc = fs.readFileSync(path.resolve(__dirname, '_three_guard.mjs'), 'utf8');      // guarded three: catches the refreshUniformsCommon throw and records the culprit material
      const h = fs.readFileSync(SRC, 'utf8')
        .replace(/"three":"[^"]*"/, '"three":"' + 'file:///Z:/GITHUB/GAME%20%C2%B7%20SKYJUMP3D/perf/_three_guard.mjs'.replace(/\\/g, '/') + '"')
        .replace('window.__ng = {', `window.addEventListener('error', e => (window.__pageErrs || (window.__pageErrs = [])).push('E ' + String((e && e.error && e.message) || e)));
      window.addEventListener('unhandledrejection', e => (window.__pageErrs || (window.__pageErrs = [])).push('R ' + String((e && e.reason && e.reason.message) || e)));
      window.__hk = {
        fk: () => ({ n: window.__fk || 0, err: window.__fkErr || null, lastT: window.__fkT || 0 }),
        badMats: () => { const out = []; scene.traverse(o => { if (o.isMesh && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (!(m && m.isMaterial && m.color && m.opacity !== undefined)) out.push({ at: o.type + '/' + (o.name || ''), mat: m === null ? null : (m && m.type ? m.type + ' u=' + (m.isShaderMaterial || m.uniforms ? 'has' : 'no') : 'anonymous //' + (m && m.constructor && m.constructor.name)), geoms: o.geometry && o.geometry.type }); } } }); return out.slice(0, 12); },
        matTypes: () => { const t = {}; scene.traverse(o => { if ((o.isMesh || o.isSprite || o.isPoints || o.isLine) && o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { const k = (m && m.isMaterial) ? (m.type + '|' + (m.isShaderMaterial || m.uniforms ? 'u' : 'nou')) : ('BAD:' + (m && m.constructor && m.constructor.name)); t[k] = (t[k] || 0) + 1; } } }); return t; },
        setLevelDefById, buildLevel, startLevelDef,
        // wrap die()/respawn so the probe can see whether the entry loop is dying repeatedly
        dieWrap: () => { if (!window.__deaths) { window.__deaths = 0; window.__wrecks = 0; const d0 = die; try { die = function(...a) { window.__deaths++; return d0.apply(null, a); }; } catch (_) { window.__wrecks = 1; } } return 'ok'; },
        ready: () => ({ state, g: onGround, y: +pos.y.toFixed(2), vy: +vel.y.toFixed(2), coyote: +coyote.toFixed(3), jumps, paused, ld: levelDef.id }),
        deep: () => ({ climb: !!climbing, glide: +glide.toFixed(2), pounding, grinding: !!grinding, dialog: !!guideDialogOpen, lockT: +lockT.toFixed(2), invuln: +invuln.toFixed(2), portalCd: +portalCooldown.toFixed(1), noclip, gpErr: window.__gpErr || null, pgErr: window.__pageErrs || null }),
        solidsNear: (r) => solids.filter(s => pos.x > (s.minx || s.cx || 0) - r && pos.x < (s.maxx || s.cx || 0) + r && pos.y > (s.miny || 0) - 5 && pos.y < (s.maxy || s.top || 999) + 5 && pos.z > (s.minz || s.cz || 0) - r && pos.z < (s.maxz || s.cz || 0) + r).slice(0, 6).map(s => ({ minx: +(s.minx ?? s.cx).toFixed(0), maxx: +(s.maxx ?? s.cx).toFixed(0), maxy: +(s.maxy ?? s.top).toFixed(2), minz: +(s.minz ?? s.cz).toFixed(0), maxz: +(s.maxz ?? s.cz).toFixed(0), beacon: !!s.isBeacon })),
        tp: (x, y, z) => { pos.set(x, y, z); vel.set(0, 0, 0); onGround = false; },
        startInfo: () => ({ start: { x: start.x, y: start.y, z: start.z }, beacon0: betweenBeacons[0] && { x: betweenBeacons[0].x, y: betweenBeacons[0].y, z: betweenBeacons[0].z }, slot: mySlot, state, ld: levelDef.id }),
        fine: () => ({ p: { x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2) }, v: { x: +vel.x.toFixed(2), y: +vel.y.toFixed(2), z: +vel.z.toFixed(2) }, g: onGround, coyote: +coyote.toFixed(2), health, state, paused, hillT: undefined, cp: checkpoint && { x: checkpoint.x, y: checkpoint.y, z: checkpoint.z }, deaths: window.__deaths || 0, wreck: window.__wrecks || 0 }),
      }; window.__ng = {`)
        .replace('gamepadTick(now);', 'window.__fk = (window.__fk || 0) + 1; window.__fkT = now; try { gamepadTick(now); } catch (e) { window.__gpErr = (window.__gpErr || []).concat(String(e && e.message || e)); }');
    if (!h.includes('window.__hk')) throw new Error('hook injection failed');
    if (!h.includes('__fkT')) throw new Error('frame counter injection failed');
    if (!h.includes('_three_guard.mjs')) throw new Error('importmap redirect failed');
    req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  page.on('pageerror', e => console.log('pageerror:', e.message, '\n' + (e.stack || '').split('\n').slice(1, 6).join('\n')));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__hk', { timeout: 180000 });
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const evl = (fn, ...a) => page.evaluate(fn, ...a);
  await wait(3500);
  const T0 = performance.now();
  setInterval(() => { evl(() => window.__hk.fk()).catch(() => {}).then(f => f && console.log('frames[' + Math.round((performance.now() - T0) / 1000) + 's]:', JSON.stringify(f))); }, 3000);
  await evl(() => { window.__hk.setLevelDefById('between'); window.__hk.buildLevel(); });
  await wait(2500);
  await evl(() => { window.__hk.setLevelDefById('descent'); window.__hk.startLevelDef('between'); });   // levelDef must still be 'descent' at call time so the build-and-spawn branch runs
  console.log('startInfo:', JSON.stringify(await evl(() => window.__hk.startInfo())));
  await evl(() => window.__hk.dieWrap());
  await wait(4500);   // let the render loop reach the death point (loop dies ~2 s after entry)
  console.log('badMats at death window:', JSON.stringify(await evl(() => window.__hk.badMats())));
  console.log('matTypes:', JSON.stringify(await evl(() => window.__hk.matTypes())));
  for (let i = 0; i < 30; i++) {
    await wait(1000);
    const r = await evl(() => ({ ...window.__hk.fine(), deep: window.__hk.deep(), near: window.__hk.solidsNear(14) }));
    if (i >= 3 && i < 6 && r.deep.pgErr) console.log('  pgErrs:', JSON.stringify(r.deep.pgErr));
    console.log(i + 's:', JSON.stringify(r));
    if (r.g) break;
  }
  await browser.close();
})().catch(e => { console.log('PROBE FAILED:', e.message); process.exit(1); });
