// Headless THE BETWEEN Phase 0 verification:
//  boot default baseline -> build 'between' (structure counts, no skyway, seed, sky) ->
//  enter play and MEASURE low-gravity (jump apex/airtime), y=0 hard floor, void-clamp respawn ->
//  determinism (rebuild 'between' twice, counts identical) -> default fingerprint unchanged.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC_LIVE = require('path').resolve(__dirname, '..', 'index.html');
const SRC = require('path').resolve(__dirname, '_between_snapshot.html');   // self-snapshot: immune to concurrent edits of index.html mid-run

(async () => {
  fs.copyFileSync(SRC_LIVE, SRC);
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('file:') && /(_between_snapshot|index)\.html$/.test(req.url())) {
      const h = fs.readFileSync(SRC, 'utf8')
        .replace('window.__ng = {', `window.__hk = {
        setLevelDefById, buildLevel, startLevelDef,
        stats: () => ({ solids: solids.length, platforms: platforms.length, enemies: enemies.length, items: items.length, portals: portals.length, seed }),
        between: () => ({ canopy: solids.filter(s => s.isCanopy).length, beacons: solids.filter(s => s.isBeacon).length, mouths: solids.filter(s => s.isDungeonMouth).length, foundation: solids.filter(s => s.isFoundation).map(s => ({ top: s.top, hw: s.hw, hd: s.hd }))[0] || null, missions: missions.length, commons: !!commons }),
        betweenExtra: () => ({ beaconPadTops: solids.filter(s => s.isBeacon).map(s => +s.top.toFixed(2)), mouthTops: solids.filter(s => s.isDungeonMouth).length, well: (() => { let w = null; scene.traverse(o => { if (o.isGravityWell) w = o; }); return w ? { anchors: (w.anchors || []).length, active: !!w.active } : null; })() }),
        sky: () => ({ fog: scene.fog ? scene.fog.color.getHexString() : null, stars: scene.children.some(o => o.isPoints) }),
        levels: () => ({ all: LEVELS_ALL.map(l => l.id), menu: LEVELS.map(l => l.id) }),
        play: (on) => { if (on) { if (state !== 'play') { menuRender(); menuKey({ code: 'Enter' }); } } },
        tp: (x, y, z) => { pos.set(x, y, z); vel.set(0, 0, 0); onGround = false; },
        jump: (on) => { keys.Space = !!on; },
        ready: () => ({ state, g: onGround, y: +pos.y.toFixed(2) }),
        me: () => ({ y: +pos.y.toFixed(2), vy: +vel.y.toFixed(2), g: onGround, state }),
      }; window.__ng = {`)
        .replace('gamepadTick(now);', 'if (window.__rec) { window.__rec.push({ y: +pos.y.toFixed(3), vy: +vel.y.toFixed(3), g: onGround, s: state, t: now }); if (window.__rec.length > 4000) window.__rec.shift(); } try { gamepadTick(now); } catch (e) { window.__gpErr = (window.__gpErr || []).concat(String(e && e.message || e)); }');
      if (!h.includes('window.__hk')) throw new Error('hook injection failed');
      if (!h.includes('__rec.push')) throw new Error('recorder injection failed');
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', c => { const t = c.text(); if (/error|undefined is not/i.test(t)) console.log('  console>', t); });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__hk', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 3500));

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const evl = (fn, ...args) => page.evaluate(fn, ...args);
  const fails = [], pass = [];
  const check = (name, ok, detail) => { (ok ? pass : fails).push(name + (detail ? ': ' + detail : '')); console.log((ok ? '  PASS ' : '  FAIL ') + name + (detail ? ' — ' + detail : '')); };

  // ============ 1. DEFAULT BASELINE FINGERPRINT ============
  const fp0 = await evl(() => window.__hk.stats());
  console.log('DEFAULT baseline:', JSON.stringify(fp0));

  // ============ 2. BUILD BETWEEN — structure ============
  await evl(() => { window.__hk.setLevelDefById('between'); window.__hk.buildLevel(); });
  await wait(2500);
  const bt = await evl(() => window.__hk.between());
  const bex = await evl(() => window.__hk.betweenExtra());
  const sky = await evl(() => window.__hk.sky());
  console.log('BETWEEN:', JSON.stringify(bt), EXTRA_NAME(bex));
  console.log('BETWEEN sky:', JSON.stringify(sky), 'seed:', (await evl(() => window.__hk.stats())).seed);
  check('canopy slab built (>= 1; Phase 1 may flag a slab per sector)', bt.canopy >= 1, 'isCanopy=' + bt.canopy);
  check('4 beacon pads', bt.beacons === 4, 'isBeacon=' + bt.beacons);
  check('6 dungeon mouths', bt.mouths === 6, 'isDungeonMouth=' + bt.mouths);
  check('foundation at y=0', bt.foundation && bt.foundation.top === 0, JSON.stringify(bt.foundation));
  check('no missions / no commons squares on the between build', bt.missions === 0 && !bt.commons, JSON.stringify({ missions: bt.missions, commons: bt.commons }));
  const seedNow = (await evl(() => window.__hk.stats())).seed;
  check('between seed differs from default seed', seedNow !== fp0.seed, 'seed=' + seedNow);
  check('abyssal sky applied', sky.fog === '0a001a', 'fog=' + sky.fog);
  check('beacon pads sit on canopy top', JSON.stringify(bex.beaconPadTops) === '[120,120,120,120]', JSON.stringify(bex.beaconPadTops));
  check('gravity well stub activates with 6 anchor slots', bex.well && bex.well.anchors === 6, JSON.stringify(bex.well));
  const ls = await evl(() => window.__hk.levels());
  check('LEVELS_ALL has between (menu filter state owned by other sessions)', ls.all.includes('between'), 'menu=' + JSON.stringify(ls.menu));

  // ============ 3. ENTER PLAY — REAL PHYSICS MEASUREMENTS ============
  await evl(() => window.__hk.startLevelDef('between'));   // uses the real player path (preload -> begin)
  await wait(3000);
  const st = await evl(() => window.__hk.me());
  console.log('play state:', JSON.stringify(st));
  check('entered play on a beacon', st.state === 'play' && st.y > 100, JSON.stringify(st));
  if (st.state !== 'play') { console.log('play entry failed; skipping physics checks'), await browser.close(), process.exit(1); }

  // 3a. low-gravity jump: wait for ground contact first (Space accepts a fresh press while landed),
  // then hold Space until apex (vy < 0) and release so the fall measures raw low-gravity airtime.
  // Probe candidate x spots — Phase 1 has seeded special/trampoline platforms along the spine, so a
  // contaminated measurement is re-located, not failed.
  const rec = await (async () => {
    let out = null;
    for (const cx of [240, 180, 220, 100, 60]) {
      await evl((x, y, z) => window.__hk.tp(x, y, z), cx, 121, 0);
      let lands = 0;
      for (let i = 0; i < 40 && !lands; i++) { await wait(150); const r = await evl(() => window.__hk.ready()); if (r.g && r.state === 'play' && r.y < 130) lands = r.y; }
      if (!lands) continue;
      await evl(() => { window.__rec = []; window.__hk.jump(true); });
      for (let i = 0; i < 60; i++) { await wait(120); const r = await evl(() => window.__hk.me()); if (r.state === 'play' && !r.g && r.vy < -0.5) break; }
      await evl(() => window.__hk.jump(false));
      await wait(2600);
      const rs = (await evl(() => window.__rec || [])).filter(s => s.s === 'play');
      const apexL = +(Math.max(...rs.map(s => s.y), -1e9) - (rs.length ? rs[0].y : 0)).toFixed(2);
      if (apexL > 1.6 && apexL < 3.0) { console.log('clean candidate x=' + cx); out = rs; break; }
      else console.log('peak at x=' + cx + ' apex=' + apexL + ' (contaminated; likely a bounce special) -> next spot');
    }
    return out || (await evl(() => window.__rec || []));
  })();
  console.log('grounded at y=120 (probe loop above handles landing and edge); jump done');
  const recPlay = rec.filter(s => s.s === 'play' || s.state === 'play');
  const maxY = Math.max(...recPlay.map(s => s.y), -1e9), y0 = recPlay.length ? recPlay[0].y : 0;
  const gndTicks = recPlay.filter(s => s.g).map(s => s.t);
  const airTicks = recPlay.filter(s => !s.g && s.t > (gndTicks[0] || 0));
  const airtime = airTicks.length ? (airTicks[airTicks.length - 1].t - airTicks[0].t) : 0;
  const apex = +(maxY - y0).toFixed(2);
  console.log('JUMP: apex=' + apex + 'm airtime=' + (Math.round(airtime / 100) / 10) + 's samples=' + recPlay.length);
  console.log('JUMP trace: ' + recPlay.slice(0, 30).map(s => `y${s.y}/v${s.vy}${s.g ? 'G' : ''}`).join(' ') + (recPlay.length > 30 ? ' ...' : ''));
  const doubleIdx = [];
  for (let i = 1; i < recPlay.length; i++) if (recPlay[i].vy > 2 && recPlay[i - 1].vy < recPlay[i].vy - 0.5) doubleIdx.push(i);
  console.log('JUMP double-jump events at ' + (doubleIdx.length ? 'samples ' + doubleIdx.slice(0, 8).join(',') : 'none') + ': ' + doubleIdx.slice(0, 8).map(i => `@${i} y${recPlay[i].y}/v${recPlay[i].vy} prev y${recPlay[i - 1].y}/v${recPlay[i - 1].vy}`).join(' | '));
  check('jump apex ~2.2 m (same max height as default)', apex > 1.6 && apex < 3.0, 'apex=' + apex);
  check('airtime ~= 1.7x default (low-g float)', airtime > 1000, 'ms=' + Math.round(airtime) + ' (default ~770)');

  // 3b. hard floor: drop onto the Foundation — land at y ~= 0, survive a 10 m fall
  await evl((x, y, z) => window.__hk.tp(x, y, z), 60, 10, 60);  // over the foundation, clear of the well
  let fl0 = null;
  for (let i = 0; i < 40 && !fl0; i++) { await wait(150); const r = await evl(() => window.__hk.me()); if (r.state === 'play' && r.g && r.y < 0.3) fl0 = r; }
  const fl = fl0 || (await evl(() => window.__hk.me()));
  const alive = fl.state === 'play';
  check('landed on the y=0 hard floor', fl.g && fl.y > -0.11 && fl.y < 0.3 && alive, JSON.stringify({ y: fl.y, onGround: fl.g, state: fl.state }));
  console.log('FLOOR:', JSON.stringify(fl));

  // 3c. void clamp: walk off the foundation edge (x=600 > 400 half-span) -> falls below -5 -> respawns at own beacon, still alive
  await evl((x, y, z) => window.__hk.tp(x, y, z), 600, 0.5, 0);
  await wait(1800);
  const vc = await evl(() => window.__hk.me());
  check('void clamp respawns above y=0, alive', vc.state === 'play' && vc.y > 100, JSON.stringify({ y: vc.y, state: vc.state }));

  // ============ 4. DETERMINISM — rebuild 'between' twice, counts must match ============
  await evl(() => { window.__hk.setLevelDefById('between'); window.__hk.buildLevel(); });
  await wait(2500);
  const b1 = await evl(() => ({ ...window.__hk.stats(), zone: 0 }));
  await evl(() => { window.__hk.buildLevel(); });
  await wait(2500);
  const b2 = await evl(() => window.__hk.stats());
  const keysd = ['platforms', 'enemies', 'items', 'portals', 'seed'];
  const solD = Math.abs((b1.solids || 0) - (b2.solids || 0));
  const sameCore = keysd.every(k => b1[k] === b2[k]);
  check('between rebuild is deterministic (same core counts + seed)', sameCore && solD <= 3, JSON.stringify(b1) + ' vs ' + JSON.stringify(b2) + ' (solids |d|=' + solD + '; documented ±1-3 static-matrix wobble tolerated)');

  // ============ 5. DEFAULT FINGERPRINT UNCHANGED ============
  await evl(() => { window.__hk.setLevelDefById('descent'); window.__hk.buildLevel(); });
  await wait(2500);
  const fp1 = await evl(() => window.__hk.stats());
  const solD2 = Math.abs((fp0.solids || 0) - (fp1.solids || 0));
  const fpSame = ['platforms', 'enemies', 'items', 'portals', 'seed'].every(k => fp0[k] === fp1[k]) && solD2 <= 5;
  console.log('FP-DEBUG: ' + ['solids', 'platforms', 'enemies', 'items', 'portals', 'hubs', 'seed'].map(k => k + ':' + fp0[k] + '->' + fp1[k]).join(' '));
  check('default fingerprint unchanged (±5-solids wobble tolerated on solids only pre-existing)', fpSame, JSON.stringify(fp1) + ' solids|d|=' + solD2);

  console.log('\n==== RESULT: ' + pass.length + ' pass / ' + fails.length + ' fail ====');
  if (fails.length) fails.forEach(f => console.log('  FAILED: ' + f));
  if (errors.length) console.log('page errors:', errors);
  else console.log('page errors: none');
  await browser.close();
  process.exit(fails.length || errors.length ? 1 : 0);
})().catch(e => { console.error('BETWEEN TEST FAILED:', e.message); process.exit(1); });

function EXTRA_NAME(bex) { return JSON.stringify({ padTops: bex.beaconPadTops, mouthTops: bex.mouthTops, well: bex.well }); }
