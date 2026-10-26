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
      const h = fs.readFileSync(SRC, 'utf8').replace('function menuKey(e) {', `window.__menuLog = (window.__menuLog || []); function menuKey(e) { window.__menuLog.push((e && e.code) + '@' + menuMode + '/' + menuSel + '/st' + state);`)
      .replace('function gamepadTick(nowMs) {', `function gamepadTick(nowMs) {
        window.__gpTicks = (window.__gpTicks || 0) + 1;
        if (window.__gpTicks % 60 === 1) console.log('[gdp] tick#', window.__gpTicks, 'pads=', (navigator.getGamepads ? navigator.getGamepads() : []).map(p => p && p.connected), 'gt=', typeof navigator.getGamepads, 'sameNav=', navigator === window.navigator);
        try {
          const _pads = (typeof navigator !== 'undefined' && navigator.getGamepads) ? navigator.getGamepads() : null;
          window.__gpProbe = { pads: _pads ? _pads.map(p => p && p.connected) : null, gt: typeof navigator.getGamepads, getGamepadsSrc: navigator.getGamepads ? String(navigator.getGamepads).slice(0, 80) : null, navIsWinNav: navigator === window.navigator };
        } catch (e) { window.__gpProbe = { probeErr: '' + e }; }
      `).replace('window.__ng = {', `window.__gp = {
        enterPlay: () => { LEVELS[0].startFn(); },
        me: () => ({ x: +pos.x.toFixed(2), y: +pos.y.toFixed(2), z: +pos.z.toFixed(2), yaw: +camYaw.toFixed(3), pitch: +camPitch.toFixed(3), state, keyW: keys.KeyW, keyA: keys.KeyA, sprint: keys.ShiftLeft, held: mouseHeld, aim: aiming, space: keys.Space }),
        menu: () => ({ mode: menuMode || '?', sel: (typeof menuSel === 'number') ? menuSel : -1, lvl: (typeof levelSel === 'number') ? levelSel : -1, lvls: LEVELS.length, un: LEVELS.filter(lv => lv.unlocked).length, main: (document.querySelector('#menuMain') || {}).style ? document.querySelector('#menuMain').style.display : '', multi: (document.querySelector('#menuMulti') || {}).style ? document.querySelector('#menuMulti').style.display : '', host: (document.querySelector('#menuHost') || {}).style ? document.querySelector('#menuHost').style.display : '', join: (document.querySelector('#menuJoin') || {}).style ? document.querySelector('#menuJoin').style.display : '' }),
        selOf: id => { const b = document.querySelector('#' + id); return b ? b.className : 'NOBTN'; },
        levelsOpen: () => { menuMode = 'levels'; levelSel = 0; menuRender(); },   // the menu is bypassed at START while SP_ONLY_DESCENT=true; open it directly for this check
      }; window.__ng = {`).replace('gamepadTick(now);', 'window.__gpLoop = (window.__gpLoop || 0) + 1; try { window.__gpSrc = typeof navigator.getGamepads; gamepadTick(now); } catch (e) { window.__gpErr = (window.__gpErr || []).concat(String(e && e.message || e)); } document.title = "L" + window.__gpLoop + ",T" + (window.__gpTicks || 0) + ",S" + window.__gpSrc + ",E" + (window.__gpErr ? window.__gpErr.length : 0);');
      req.respond({ status: 200, contentType: 'text/html', body: h });
      console.log('  [serve] marker checks:', { gpTicks: h.includes('__gpTicks'), gpObj: h.includes('window.__gp'), menuInj: h.includes('menu: () => ({ mode: menuMode'), callWrap: h.includes('catch (e) { window.__gpErr'), tickCall: h.includes('gamepadTick(now);'), hasDef: h.includes('function gamepadTick(nowMs)') });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', c => { const t = c.text(); if (t.startsWith('[gdp]')) console.log('  console>', t); });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__gp', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 3000));

  const wait = ms => new Promise(r => setTimeout(r, ms));
  const evl = (fn, ...args) => page.evaluate(fn, ...args);

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
  console.log('hook probe:', await evl(() => ({ t: typeof window.__gp, keys: window.__gp ? Object.keys(window.__gp).filter(k => ['enterPlay','me','menu','selOf','levelsOpen','setPad'].includes(k)) : null })));

  // ===== MENU NAVIGATION (title screen): d-pad/stick browse, A = confirm, B = back =====
  const menuInfo = () => evl(() => window.__gp.menu());
  const selOf = id => evl(i => window.__gp.selOf(i), id);
  const tap = async (bits, ax = [0, 0, 0, 0]) => { await evl((b, a) => window.__gp.setPad(a, b), bits, ax); await wait(160); await evl(b => window.__gp.setPad([0, 0, 0, 0], b), {}); await wait(160); };
  const m0 = await menuInfo();
  console.log('menu boot:', JSON.stringify(m0));
  // stick down -> multi selected; A -> multiplayer screen
  await tap({}, [0, 1, 0, 0]);
  const m1 = await menuInfo();
  m1.startSel = await selOf('bStart');
  await tap({ 0: 1 });
  const m2 = await menuInfo();
  console.log('menu browse+confirm:', JSON.stringify(m1), '->', JSON.stringify(m2), '| keys:', await evl(() => (window.__menuLog || []).join(',')));
  const nav1 = m1.sel === 1 && m1.main === 'block' && m2.mode === 'multi' && m2.multi === 'block';
  // B back to main, re-confirm, X = host screen, B, Y = join screen, B, B
  await tap({ 1: 1 });
  const m3 = await menuInfo();
  await tap({ 0: 1 });                                        // A again (sel still on multi) -> multi
  await tap({ 2: 1 });                                        // X -> HOST
  const m4 = await menuInfo();
  await tap({ 1: 1 });                                        // B back
  await tap({ 3: 1 });                                        // Y -> JOIN
  const m5 = await menuInfo();
  await tap({ 1: 1 }); await tap({ 1: 1 });                   // B -> multi, B -> main
  const m6 = await menuInfo();
  console.log('menu sub-screens + back:', JSON.stringify(m4), '/', JSON.stringify(m5), '->', JSON.stringify(m6), '| keys:', await evl(() => (window.__menuLog || []).join(',')));
  // keyboard arrows still work on the rebuilt main menu (sel must actually change each press, regardless of where it starts)
  await page.keyboard.press('ArrowUp');
  await wait(200);
  const mSel1 = (await menuInfo()).sel;
  await page.keyboard.press('ArrowDown');
  await wait(200);
  const m7 = await menuInfo();
  const nav2 = m3.mode === 'main' && m4.mode === 'host' && m5.mode === 'join' && m6.mode === 'main' && m7.sel !== mSel1;
  console.log('keyboard ArrowDown still steps:', JSON.stringify(m7), '| navOK:', nav2);
  // LEVEL SELECT (menu is bypassed at START while SP_ONLY_DESCENT=true, so open it via the hook):
  // stick down/up steps levelSel (only ^1 unlocked level exists now, so down+up must stay put), A = start, B = Escape back
  await evl(() => window.__gp.levelsOpen());
  await wait(200);
  const l1 = await menuInfo();
  await tap({}, [0, 1, 0, 0]);                                // stick down -> step levelSel
  const l2 = await menuInfo();
  await tap({}, [0, -1, 0, 0]);                               // stick up -> step back
  const l3 = await menuInfo();
  await tap({ 1: 1 });                                        // B = Escape -> main
  const l4 = await menuInfo();
  const stepOK = (unN => l1.lvl === l3.lvl && (unN > 1 ? l2.lvl !== l1.lvl : l2.lvl === l1.lvl))(l1.un);
  const nav3 = l1.mode === 'levels' && l2.mode === 'levels' && l3.mode === 'levels' && l4.mode === 'main' && stepOK;
  console.log('levels pad nav: open', JSON.stringify(l1), '-> step', JSON.stringify(l2), '-> back', JSON.stringify(l3), '-> escape', JSON.stringify(l4), '| lvlOK:', nav3, '| keys:', await evl(() => (window.__menuLog || []).join(',')));
  const menuOK = nav1 && nav2 && nav3;
  // get back to main-menu default selection before entering play
  await page.keyboard.press('ArrowUp'); await wait(150);

  // ===== GAMEPLAY (enter play) =====
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

  // 6) look SENSITIVITY (] = up): full-tilt yaw rate should scale ~1.75x after 3 presses
  const yawRate = async () => {
    const y0 = (await evl(() => window.__gp.me())).yaw;
    await evl(() => window.__gp.setPad([0, 0, 1, 0], {}));
    await wait(600);
    await evl(() => window.__gp.setPad([0, 0, 0, 0], {}));
    return Math.abs((await evl(() => window.__gp.me())).yaw - y0);
  };
  const r1 = await yawRate();
  await page.keyboard.press('BracketRight');
  await page.keyboard.press('BracketRight');
  await page.keyboard.press('BracketRight');
  await wait(300);
  const storedSens = await evl(() => localStorage.getItem('towerdrop.gp.sens'));
  const r2 = await yawRate();
  console.log('sens: stored', storedSens, '| rate', +r1.toFixed(3), '->', +r2.toFixed(3));
  const sensOK = storedSens === '1.75' && Math.abs(r2 / r1 - 1.75) < 0.35;

  // 7) INVERT-Y (KeyI): stick-down (ry=+1) must move camPitch DOWN after toggling
  const pitchMove = async () => {
    const p0 = (await evl(() => window.__gp.me())).pitch;
    await evl(() => window.__gp.setPad([0, 0, 0, 1], {}));
    await wait(500);
    await evl(() => window.__gp.setPad([0, 0, 0, 0], {}));
    return (await evl(() => window.__gp.me())).pitch - p0;
  };
  const pm0 = await pitchMove();                 // default non-invert: stick down = look down = camPitch UP
  await page.keyboard.press('KeyI');
  await wait(200);
  const pm1 = await pitchMove();                 // inverted: opposite sign
  const invStored = await evl(() => localStorage.getItem('towerdrop.gp.invertY'));
  console.log('invertY: pitch delta', +pm0.toFixed(3), '->', +pm1.toFixed(3), '| stored', JSON.stringify(invStored));
  const invOK = pm0 > 0.02 && pm1 < -0.02 && invStored === '1';

  // 8) PERSISTENCE: reload, values must load back and drive the same behaviour
  await page.goto(page.url(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__gp', { timeout: 180000 });
  await evl(() => {
    const pad = { connected: true, index: 0, id: 'test-pad', timestamp: performance.now(), vibrationActuator: null, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    window.navigator.getGamepads = () => [pad, null, null, null];
    window.__gp.setPad = (ax, bits) => { for (let i = 0; i < 4; i++) pad.axes[i] = ax[i]; for (let i = 0; i < 17; i++) { pad.buttons[i].pressed = !!(bits[i]); pad.buttons[i].value = bits[i] ? 1 : 0; } };
  });
  await evl(() => window.__gp.enterPlay());
  await page.waitForFunction('window.__gp && (function(){ try { return window.__gp.me().state === "play"; } catch (e) { return false; } })()', { timeout: 240000 }).catch(() => {});
  await wait(1000);
  const r3 = await yawRate();
  const stillInvert = await pitchMove();
  console.log('persist: rate after reload', +r3.toFixed(3), '| pitch delta after reload', +stillInvert.toFixed(3));
  const persistOK = Math.abs(r3 / r2 - 1) < 0.3 && stillInvert < 0;   // still ~1.75x AND still inverted

  console.log('RESULTS: move', moveOK, '| look', lookOK, '| jump', jumpOK, '| fire', fireOK, '| sprint', sprintOK, '| menu', menuOK, '| TITLE:', await page.title());
  const probe = await evl(() => ({ ticks: window.__gpTicks, loop: window.__gpLoop, probe: window.__gpProbe, err: window.__gpErr, fnType: typeof window.__gp.setPad, src: window.__gpSrc, title: document.title }));
  console.log('PAGE TITLE:', await page.title());
  console.log('PROBE:', JSON.stringify(probe));
  console.log('runtime errors:', errors.length ? errors : 'none');
  const allOK = moveOK && lookOK && jumpOK && fireOK && sprintOK && sensOK && invOK && persistOK && menuOK && errors.length === 0;
  await browser.close();
  process.exit(allOK ? 0 : 1);
})().catch(e => { console.error('GP TEST FAILED:', e.message, '\n', (e.stack || '').split('\n').slice(0, 4).join('\n')); process.exit(1); });
