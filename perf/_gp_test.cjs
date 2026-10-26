// Headless GAMEPAD functional test: fake a gamepad entirely from page context (navigator.getGamepads
// override + mutable pad object), enter play, and verify: left stick => movement keys + position
// change; right stick => camera yaw; A => jump; RT => mouseHeld (fire) and releases; L3 => sprint.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC_LIVE = require('path').resolve(__dirname, '..', 'index.html');
const SRC = require('path').resolve(__dirname, '_gp_snapshot.html');   // self-refreshed below: immune to concurrent edits of index.html mid-run

(async () => {
  fs.copyFileSync(SRC_LIVE, SRC);   // fresh snapshot of the live file at test start (other agents may rewrite index.html DURING the run)
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('file:') && /(_gp_snapshot|index)\.html$/.test(req.url())) {
      const h = fs.readFileSync(SRC, 'utf8').replace('function gamepadTick(nowMs) {', `function gamepadTick(nowMs) {
        window.__gpTicks = (window.__gpTicks || 0) + 1;
        if (window.__gpTicks % 60 === 1) console.log('[gdp] tick#', window.__gpTicks, 'pads=', (navigator.getGamepads ? navigator.getGamepads() : []).map(p => p && p.connected), 'gt=', typeof navigator.getGamepads, 'sameNav=', navigator === window.navigator);
        try {
          const _pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : null;
          window.__gpProbe = { pads: _pads ? _pads.map(p => p && p.connected) : null, gt: typeof navigator.getGamepads, getGamepadsSrc: navigator.getGamepads ? String(navigator.getGamepads).slice(0, 80) : null, navIsWinNav: navigator === window.navigator };
        } catch (e) { window.__gpProbe = { probeErr: '' + e }; }
      `).replace('window.__ng = {', `window.__gp = {
        enterPlay: () => { LEVELS[0].startFn(); },
        me: () => ({ x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2), yaw: +camYaw.toFixed(3), state, keyW: keys.KeyW, keyA: keys.KeyA, sprint: keys.ShiftLeft, held: mouseHeld, aim: aiming, space: keys.Space }),
      }; window.__ng = {`).replace('gamepadTick(now);', 'window.__gpLoop = (window.__gpLoop || 0) + 1; try { window.__gpSrc = typeof navigator.getGamepads; gamepadTick(now); } catch (e) { window.__gpErr = (window.__gpErr || []).concat(String(e && e.message || e)); } document.title = "L" + window.__gpLoop + ",T" + (window.__gpTicks || 0) + ",S" + window.__gpSrc + ",E" + (window.__gpErr ? window.__gpErr.length : 0);');
      req.respond({ status: 200, contentType: 'text/html', body: h });
      console.log('  [serve] marker checks:', { gpTicks: h.includes('__gpTicks'), gpObj: h.includes('window.__gp'), callWrap: h.includes('catch (e) { window.__gpErr'), tickCall: h.includes('gamepadTick(now);'), hasDef: h.includes('function gamepadTick(nowMs)') });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', c => { const t = c.text(); if (t.startsWith('[gdp]')) console.log('  console>', t); });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__gp', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 3000));

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const evl = fn => page.evaluate(fn);

  // Install the fake pad from page context: a mutable pad object behind navigator.getGamepads,
  // plus window.__gp.setPad(axes, bits) to drive it. Runs on the same navigator object the game polls.
  const hooked = await evl(() => {
    try {
      const pad = {
        connected: true, index: 0, id: 'test-pad', timestamp: performance.now(), vibrationActuator: null,
        axes: [0, 0, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
      };
      window.navigator.getGamepads = () => [pad, null, null, null];
      window.__gp.setPad = (ax, bits) => {
        for (let i = 0; i < 4; i++) pad.axes[i] = ax[i];
        for (let i = 0; i < 17; i++) { pad.buttons[i].pressed = !!(bits[i]); pad.buttons[i].value = bits[i] ? 1 : 0; }
      };
      return typeof window.__gp.setPad;
    } catch (e) { return 'err:' + e.message; }
  });
  console.log('hook installed:', hooked);
  if (hooked !== 'function') { await browser.close(); process.exit(1); }

  // Enter play
  await evl(() => window.__gp.enterPlay());
  await page.waitForFunction('window.__gp && document.querySelector("body") && (function(){ try { return window.__gp.me().state === "play"; } catch (e) { return false; } })()', { timeout: 240000 }).catch(() => {});
  const nowState = (await evl(() => window.__gp.me())).state;
  console.log('state after startFn:', nowState);
  if (nowState !== 'play') { console.error('did not enter play'); await browser.close(); process.exit(1); }
  await wait(1500);
  const before = await evl(() => window.__gp.me());
  console.log('play state:', before.state);

  // 1) left stick forward -> KeyW true and position moves; released -> KeyW false again
  const beforePos = before;
  await evl(() => window.__gp.setPad([0, -1, 0, 0], {}));
  await wait(150);
  const whileHeld = await evl(() => window.__gp.me());
  await wait(1300);
  await evl(() => window.__gp.setPad([0, 0, 0, 0], {}));
  await wait(400);
  const after = await evl(() => window.__gp.me());
  const dist = Math.hypot(after.x - beforePos.x, after.z - beforePos.z);
  console.log('KeyW while held:', whileHeld.keyW, '| distance moved:', +dist.toFixed(2), '| released ok:', !after.keyW);
  const moveOK = whileHeld.keyW === true && dist > 1 && after.keyW === false;

  // 2) right stick -> yaw changes
  const yaw0 = (await evl(() => window.__gp.me())).yaw;
  await evl(() => window.__gp.setPad([0, 0, 1, 0], {}));
  await wait(900);
  await evl(() => window.__gp.setPad([0, 0, 0, 0], {}));
  const yaw1 = (await evl(() => window.__gp.me())).yaw;
  console.log('yaw:', yaw0, '->', yaw1);
  const lookOK = Math.abs(yaw1 - yaw0) > 0.2;

  // 3) A -> jump: keys.Space true while held, y rises
  const y0 = (await evl(() => window.__gp.me())).y;
  await evl(() => window.__gp.setPad([0, 0, 0, 0], { 0: 1 }));
  await wait(150);
  const jumpMid = await evl(() => window.__gp.me());
  await wait(1100);
  await evl(() => window.__gp.setPad([0, 0, 0, 0], {}));
  const jumpOK = jumpMid.space === true || (jumpMid.y - y0) > 0.3;
  console.log('A jump: Space-held', jumpMid.space, '| y', y0.toFixed(2), '->', jumpMid.y.toFixed(2));

  // 4) RT -> mouseHeld (fire) then false on release
  await evl(() => window.__gp.setPad([0, 0, 0, 0], { 7: 1 }));
  await wait(250);
  const fireOn = (await evl(() => window.__gp.me())).held;
  await evl(() => window.__gp.setPad([0, 0, 0, 0], {}));
  await wait(250);
  const fireOff = (await evl(() => window.__gp.me())).held;
  console.log('RT fire: held', fireOn, '| after release', fireOff);
  const fireOK = fireOn === true && fireOff === false;

  // 5) L3 -> sprint key
  await evl(() => window.__gp.setPad([0, 0, 0, 0], { 10: 1 }));
  await wait(250);
  const spr = (await evl(() => window.__gp.me())).sprint;
  await evl(() => window.__gp.setPad([0, 0, 0, 0], {}));
  console.log('L3 sprint:', spr);
  const sprintOK = spr === true;

  console.log('RESULTS: move', moveOK, '| look', lookOK, '| jump', jumpOK, '| fire', fireOK, '| sprint', sprintOK, '| TITLE:', await page.title());
  const probe = await evl(() => ({ ticks: window.__gpTicks, loop: window.__gpLoop, probe: window.__gpProbe, err: window.__gpErr, fnType: typeof window.__gp.setPad, src: window.__gpSrc, title: document.title }));
  console.log('PAGE TITLE:', await page.title());
  console.log('PROBE:', JSON.stringify(probe));
  console.log('runtime errors:', errors.length ? errors : 'none');
  const allOK = moveOK && lookOK && jumpOK && fireOK && sprintOK && errors.length === 0;
  await browser.close();
  process.exit(allOK ? 0 : 1);
})().catch(e => { console.error('GP TEST FAILED:', e.message); process.exit(1); });
