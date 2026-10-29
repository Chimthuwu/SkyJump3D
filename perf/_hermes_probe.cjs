// HERMES improvements probe: twilight palette (F6/__ng), touch controls overlay, __ng.saveSession/loadSession
// (same-world + optional CROSSWORLD=1 cross-level restore), and the d4SanityT guard hook (__ng.d4cleanup).
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');
const CROSS = process.env.CROSSWORLD === '1';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fails = [];
const ok = (name, cond) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name); if (!cond) fails.push(name); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 300000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1100, height: 720 });
  // Pretend this is a handheld (coarse primary pointer) so the touch overlay auto-shows
  await page.evaluateOnNewDocument(() => {
    window.matchMedia = q => ({ matches: /pointer: coarse/.test(q), media: String(q), onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } });
    try { localStorage.removeItem('sk3d_session'); } catch (e) {}
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng', { timeout: 150000 });
  await sleep(2000);

  // ---- 1) twilight palette ----
  await page.evaluate(() => { window.__ng.twilight = true; });
  const tw = await page.evaluate(() => ({
    cls: document.documentElement.classList.contains('twilight'),
    varC: getComputedStyle(document.documentElement).getPropertyValue('--neon-cyan').trim(),
    saved: localStorage.getItem('sk3d_twilight') }));
  ok('twilight ON sets html class', tw.cls === true);
  ok('twilight remaps --neon-cyan to indigo', /8d7bff/i.test(tw.varC));
  ok('twilight choice persisted to localStorage', tw.saved === '1');
  await page.keyboard.press('F6');   // real key path through the game's keydown handler
  const tw2 = await page.evaluate(() => document.documentElement.classList.contains('twilight'));
  ok('F6 toggles twilight back OFF', tw2 === false);

  // ---- 2) touch controls overlay ----
  const tc = await page.evaluate(() => ({
    on: document.getElementById('touchUI').classList.contains('on'),
    shown: getComputedStyle(document.getElementById('touchUI')).display !== 'none',
    btns: Array.from(document.querySelectorAll('#touchUI .tbtn')).map(b => b.className.replace('tbtn ', '')),
    touchmode: document.documentElement.classList.contains('touchmode') }));
  ok('touch overlay auto-shown on coarse pointer', tc.on === true && tc.shown === true);
  ok('touch buttons built (FIRE/JUMP/AIM/WPN/PAUSE)', tc.btns.length === 5);
  ok('touchmode stops native canvas gestures', tc.touchmode === true);
  const touchDispatch = await page.evaluate(() => {
    try {
      const fire = document.querySelector('#touchUI .bFire');
      const T = new Touch({ identifier: 1, target: fire });
      const ev = o => new TouchEvent('touchstart', Object.assign({ bubbles: true, cancelable: true, targetTouches: [T], changedTouches: [T] }, o));
      fire.dispatchEvent(ev({ touches: [T] }));
      fire.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true, touches: [], targetTouches: [], changedTouches: [T] }));
      return 'dispatched';
    } catch (e) { return 'error: ' + e.message; }
  });
  ok('FIRE button accepts synthetic touch (no throw)', touchDispatch === 'dispatched');

  // ---- enter gameplay so the session snapshot has real state ----
  await page.evaluate(() => { window.__gpMenu('Enter'); window.__gpMenu('Enter'); });
  let playing = false;
  try { await page.waitForFunction('window.__ng.mv().st === \'play\'', { timeout: 20000 }); playing = true; } catch (e) {}
  ok('launched into gameplay', playing);

  // ---- 3) session persistence hook ----
  const snap = await page.evaluate(() => window.__ng.saveSession());
  ok('saveSession returns a full snapshot', !!snap && snap.levelId === 'descent' && Array.isArray(snap.pos) && typeof snap.hp === 'number' && Array.isArray(snap.weaponOwned));
  const stored = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('sk3d_session') || 'null'); } catch (e) { return null; } });
  ok('snapshot persisted to localStorage', !!stored && stored.levelId === 'descent');
  const restored = await page.evaluate(() => { const s = Object.assign(JSON.parse(localStorage.getItem('sk3d_session')), { hp: 3, weapon: 0 }); return window.__ng.loadSession(s); });
  ok('loadSession (same world) returns true', restored === true);
  await sleep(400);
  const after = await page.evaluate(() => ({ hp: window.__ng.mv().hp, w: window.__ng.kit().w }));
  ok('restored HP from snapshot', after.hp === 3);
  ok('restored weapon from snapshot', after.w === 0);
  const keptPos = await page.evaluate(snap => { const p = window.__ng.pos; return Math.abs(p.x - snap.pos[0]) < 0.5 && Math.abs(p.z - snap.pos[2]) < 0.5; }, snap);
  ok('same-world restore keeps saved position', keptPos);

  // ---- 4) d4SanityT guard hook ----
  const d4 = await page.evaluate(() => window.__ng.d4cleanup());
  ok('d4cleanup() leaves sanity at 1', d4 === 1);

  // ---- 5) cross-level restore (overnight crash-resume: boot into saved level, then apply state) ----
  if (CROSS) {
    const cross = await page.evaluate(() => { try { const s = JSON.parse(localStorage.getItem('sk3d_session')); s.levelId = 'rent'; s.hp = 41; s.pos = [0, -500, 0]; return window.__ng.loadSession(s); } catch (e) { return 'error: ' + e.message; } });
    ok('loadSession accepted cross-level snapshot', cross === true);
    let applied = false;
    try { await page.waitForFunction('(() => { const t = (document.getElementById(\'toast\')||{}).textContent || \'\'; return t.includes(\'SESSION RESTORED — RENT\'); })()', { timeout: 180000 }); applied = true; } catch (e) {}
    ok('rent world rebuilt + snapshot applied (watch→apply pipeline fired)', applied);
    const r = await page.evaluate(() => ({ hp: window.__ng.mv().hp, st: window.__ng.mv().st }));
    ok('cross-level world is live and playing (st play)', r.st === 'play' && Number.isFinite(r.hp) && r.hp > 0);   // hp may already differ from 41 (spawn combat starts instantly), so assert the restore pipeline + live world
    const keptSpawn = await page.evaluate(() => { const p = window.__ng.pos; return Math.abs(p.y + 500) > 5; });   // pos NOT applied (rebuilt world ≠ saved world)
    ok('cross-level restore kept level spawn (no bogus teleport into procedural unknowns)', keptSpawn);
  }

  ok('zero page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  console.log(fails.length === 0 ? 'HERMES PROBE: ALL PASS' : 'HERMES PROBE: ' + fails.length + ' FAIL(S)');
  await browser.close();
  process.exit(fails.length === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
