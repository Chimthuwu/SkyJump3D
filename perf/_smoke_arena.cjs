// Headless arena smoke: arena build -> per-chamber spec -> BFS walk graph -> kill-pit & void falls -> respawn rotation -> default fingerprint.
// NOTE: headless SwiftShader runs the game loop at ~0.4-0.5x real time, so all waits are POLLED state transitions, not sleeps.
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
        stats: () => ({ solids: solids.length, platforms: platforms.length, enemies: enemies.length, items: items.length, portals: portals.length, seed }),
        start: () => { state = 'play'; showMsg(''); },
        tp: (x, y, z) => { pos.set(x, y, z); vel.set(0, 0, 0); },
        posOf: () => ({ x: pos.x, y: pos.y, z: pos.z, st: state }),
        fall: () => arenaFall,
        killPits: () => solids.filter(s => s.arenaKill).length,
        itemKinds: () => items.filter(i => !i.taken && i.respawnSec).map(i => i.type === 'weapon' ? (i.weaponIndex === 3 ? 'rocket' : 'rail') : (i.type === 'heart' || i.type === 'ammo') ? 'cluster' : i.type),
        match: () => (arenaMatch ? { slot: arenaMatch.slot } : null),
        dead: () => ({ st: state, deadT, ao: arenaOn(), matchOk: !!arenaMatch, spawns: arenaMatch ? arenaMatch.spawns.length : -1 }),
        rebuild: () => { setLevelDefById('descent'); buildLevel(); return { solids: solids.length, platforms: platforms.length, enemies: enemies.length, items: items.length, portals: portals.length, seed }; },   // default fingerprint like-for-like (rebuild vs rebuild)
      }; window.__ng = {`);
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => { const m = 'pageerror: ' + e.message; errors.push(m); console.log('  !!', m); });
  page.on('console', c => { const t = c.text(); if (t.includes('[arena]')) console.log('  console>', t); });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__hk', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 4000));
  const evl = (fn, arg) => page.evaluate(fn, arg);
  // poll until the game (running below real time) reaches a player state
  const waitState = async (want, label, ms = 15000) => {
    try { await page.waitForFunction(w => window.__hk.posOf().st === w, { timeout: ms }, want); return true; }
    catch (_) { console.log('  TIMEOUT waiting for state "' + want + '" (' + label + '); state now = ' + JSON.stringify(await evl(() => window.__hk.posOf()))); return false; }
  };

  const fp0 = await evl(() => window.__hk.stats());
  console.log('DEFAULT baseline (boot):', JSON.stringify(fp0));

  // === ARENA build ===
  await evl(() => { window.__hk.setLevelDefById('arena'); window.__hk.buildLevel(); });
  await new Promise(r => setTimeout(r, 2500));
  const ar = await evl(() => ({ meta: window.__arena, stats: window.__hk.stats(), pits: window.__hk.killPits() }));
  const chambers = ar.meta.chambers;
  console.log('ARENA stats:', JSON.stringify(ar.stats), '| killPit solids:', ar.pits);
  console.log('ARENA meta: archetypes=' + ar.meta.archetypes.join(',') + ' chambers=' + chambers.length);

  let fail = 0;
  // --- spec checks per chamber (height bands come from platform geometry, not only item y) ---
  for (const c of chambers) {
    const tag = `[${c.archetype} slot${c.slot}]`;
    const probs = [];
    const span = Math.max(c.span.w, c.span.d);
    if (span > 120) probs.push('span ' + span + ' > 120');
    const kinds = c.itemTable.map(i => i.kind);
    if (!['rocket', 'rail', 'quad'].every(k => kinds.includes(k))) probs.push('missing core weapon/powerup: ' + kinds.join(','));
    const clusters = kinds.filter(k => k === 'cluster').length;
    if (clusters < 2 || clusters > 3) probs.push('clusters ' + clusters + ' not in 2..3');
    if (c.spawns.length < 4 || c.spawns.length > 8) probs.push('spawns ' + c.spawns.length + ' not in 4..8');
    const quad = c.itemTable.find(i => i.kind === 'quad');
    if (!quad || quad.respawn < 60 || quad.respawn > 90) probs.push('quad respawn ' + (quad && quad.respawn) + ' not in 60..90');
    const bands = new Set(c.graph.nodes.filter(n => n.kind === 'plat').map(n => Math.round(n.y / 4)));
    if (bands.size < 3) probs.push('height bands ' + bands.size + ' < 3 (plats at rounded y: ' + [...bands].join(',') + ')');
    if (c.fall === 'pit' && !c.killPit) probs.push('declared pit but no killPit doc');
    console.log(`${tag} span=${span} sym=${c.symmetry} fall=${c.fall}(${c.fallWhy || '-'} @y=${c.fallY}) spawns=${c.spawns.length} items=${c.itemTable.length} kinds=${kinds.join('/')} bands=${[...bands].join(',')} pit=${JSON.stringify(c.killPit)}`);
    if (probs.length) { fail++; console.log('  SPEC FAIL:', probs.join(' | ')); }
  }

  // --- BFS: every spawn reaches every item on any edge kind ---
  const walk = await evl(() => {
    const out = [];
    for (const c of window.__arena.chambers) {
      const { nodes, edges } = c.graph;
      const adj = new Map();
      edges.forEach(e => { if (!adj.has(e.a)) adj.set(e.a, []); adj.get(e.a).push(e.b); });
      const itemIdx = [], spawnIdx = [];
      nodes.forEach((n, i) => {
        if (String(n.kind).startsWith('item:')) itemIdx.push(i);
        if (n.kind === 'spawn') spawnIdx.push(i);
      });
      const bad = new Set();
      for (const s of spawnIdx) {
        const seen = new Set([s]); const q = [s];
        while (q.length) { const cur = q.shift(); for (const nb of adj.get(cur) || []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); } }
        for (const it of itemIdx) if (!seen.has(it)) bad.add(nodes[s].kind + '->' + nodes[it].kind + '@' + (nodes[it].cx | 0) + ',' + (nodes[it].cz | 0));
      }
      out.push({ arch: c.archetype, slot: c.slot, spawns: spawnIdx.length, items: itemIdx.length,
        edges: { walk: edges.filter(e => e.kind === 'walk').length, jump: edges.filter(e => e.kind === 'jump').length, drop: edges.filter(e => e.kind === 'drop').length, launch: edges.filter(e => e.kind === 'launch').length, other: edges.length - edges.filter(e => ['walk', 'jump', 'drop', 'launch'].includes(e.kind)).length },
        unreachable: [...bad] });
    }
    return out;
  });
  for (const w of walk) {
    const ok = w.unreachable.length === 0;
    if (!ok) fail++;
    console.log(`WALK [${w.arch} slot${w.slot}] spawns=${w.spawns} items=${w.items} edges(walk/jump/drop/launch/other)=${w.edges.walk}/${w.edges.jump}/${w.edges.drop}/${w.edges.launch}/${w.edges.other} -> ${ok ? 'ALL REACHABLE' : 'UNREACHABLE: ' + w.unreachable.join(' ; ')}`);
  }

  // === kill pit fall (deck chamber centre: under-deck kill floor at y=-6.5) ===
  const deck = chambers.find(c => c.archetype === 'deck');
  await evl(c => { window.__hk.start(); window.__hk.tp(c.cx, -1, c.cz); }, deck);
  if (!await waitState('dead', 'kill-pit landing')) fail++;
  else console.log('KILLPIT: landed on the kill floor and died ✓ (dead state reached)');

  // === respawn on a start pad ===
  if (!await waitState('play', 'respawn after kill-pit death')) fail++;
  const rsp = await evl(c => {
    const p = window.__hk.posOf(); const m = window.__hk.match();
    const d = window.__arena.chambers.find(x => x.slot === m.slot);
    return { ...p, slot: m.slot, near: d.spawns.some(s => Math.hypot(s.x - p.x, s.z - p.z) < 3) };
  }, deck);
  console.log('RESPAWN 1 (kill-pit):', JSON.stringify(rsp), '(expect st=play, on a start pad of the respawn chamber)');
  if (rsp.st !== 'play' || !rsp.near) fail++;

  // === void fall (longestYard: open void below, arenaFall backstop kills on the way down) ===
  const ly = chambers.find(c => c.archetype === 'longestYard');
  await evl(c => window.__hk.tp(c.cx + 42, -5, c.cz), ly);       // past the east discs: free fall into the void
  if (!await waitState('dead', 'void-fall kill')) fail++;
  else console.log('VOID: falling below fallY killed the player ✓');
  if (!await waitState('play', 'respawn after void fall')) fail++;
  const rsp2 = await evl(() => ({ ...window.__hk.posOf(), slot: window.__hk.match().slot }));
  console.log('RESPAWN 2 (void fall):', JSON.stringify(rsp2), '(previous pad pos x=' + rsp.x.toFixed(0) + ' z=' + rsp.z.toFixed(0) + ' — expect a different pad)');
  if (rsp2.st !== 'play') fail++;
  else if (rsp2.slot === rsp.slot && Math.abs(rsp.x - rsp2.x) + Math.abs(rsp.z - rsp2.z) < 1) { fail++; console.log('  ROTATION FAIL: respawned on the same pad'); }

  // === items on the live level ===
  const live = await evl(() => { const kinds = window.__hk.itemKinds(); return { quad: kinds.filter(k => k === 'quad').length, rocket: kinds.filter(k => k === 'rocket').length, rail: kinds.filter(k => k === 'rail').length, cluster: kinds.filter(k => k === 'cluster').length, total: kinds.length }; });
  console.log('LIVE items: rocket=' + live.rocket + ' rail=' + live.rail + ' quad=' + live.quad + ' cluster=' + live.cluster + ' totalArena=' + live.total, '(expect rocket=rail=quad=' + chambers.length + ')');
  if (live.rocket !== chambers.length || live.rail !== chambers.length || live.quad !== chambers.length) { fail++; console.log('  ITEM COUNT FAIL'); }

  // === default world unchanged (rebuild vs rebuild, like-for-like; boot adds a known-pre-existing transition) ===
  const fp0r = await evl(() => window.__hk.rebuild());   // plain default rebuild BEFORE arena artifacts
  await evl(() => { window.__hk.setLevelDefById('arena'); window.__hk.buildLevel(); });
  await new Promise(r => setTimeout(r, 2500));
  const fp1 = await evl(() => window.__hk.rebuild());    // plain default rebuild AFTER arenas have been built once
  const fpSame = ['solids', 'platforms', 'enemies', 'items', 'portals', 'seed'].every(k => fp0r[k] === fp1[k]);
  console.log('DEFAULT rebuild before arenas:', JSON.stringify(fp0r));
  console.log('DEFAULT rebuild after arenas :', JSON.stringify(fp1), '| fingerprint match:', fpSame);

  console.log('runtime errors:', errors.length ? errors : 'none');
  console.log(fail === 0 && fpSame && errors.length === 0 ? 'ARENA SMOKE: PASS' : 'ARENA SMOKE: FAIL (' + fail + ' spec/flow failures)');
  if (fail || !fpSame || errors.length) process.exitCode = 1;
  await browser.close();
})().catch(e => { console.error('SMOKE CRASHED:', e.message); process.exit(1); });
