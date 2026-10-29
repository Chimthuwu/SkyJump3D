// Single-player LEVEL SELECT probe: boot -> ENTER opens the select -> cards/preview/locks ->
// keyboard nav incl. locked tile -> launch (fade/zoom + gameplay) -> persistence across reload -> click/dblclick -> ESC back.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fails = [];
const ok = (name, cond) => { console.log((cond ? 'PASS  ' : 'FAIL  ') + name); if (!cond) fails.push(name); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 300000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.evaluateOnNewDocument(() => { try { if (!sessionStorage.getItem('_probeClean')) { sessionStorage.setItem('_probeClean', '1'); localStorage.removeItem('sk3d_lastLevel'); } } catch (e) {} });   // first load only: start with a clean "last level"
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng', { timeout: 150000 });
  await sleep(2500);

  const vis = sel => page.evaluate(s => { const el = document.querySelector(s); return el ? getComputedStyle(el).display : null; }, sel);
  const txt = sel => page.evaluate(s => (document.querySelector(s) || {}).textContent || '', sel);
  const cardState = () => page.evaluate(() => {
    const cards = Array.from(document.querySelectorAll('#lvlCards .lvlCard'));
    return { n: cards.length, locked: cards.filter(c => c.classList.contains('locked')).length, sel: cards.findIndex(c => c.classList.contains('sel')),
             dbl: typeof document.getElementById('lvlBtn1').ondblclick, glyphs: cards.map(c => !!c.querySelector('.lvlThumb')), lockBadge: cards.some(c => c.textContent.includes('🔒')) };
  });

  ok('boot shows MAIN menu only', (await vis('#menuMain')) === 'block' && (await vis('#menuLevels')) === 'none');

  // ENTER on the main menu now opens the level select (no more straight-to-level bypass)
  await page.evaluate(() => window.__gpMenu('Enter'));
  ok('ENTER opens level select', (await vis('#menuLevels')) === 'block' && (await vis('#menuMain')) === 'none');
  let cs = await cardState();
  ok('6 level cards rendered with thumbnails', cs.n === 6 && cs.glyphs.every(Boolean));
  ok('1 locked card with lock badge', cs.locked === 1 && cs.lockBadge);
  ok('default selection = card 0 (Lil Spasticism)', cs.sel === 0);
  ok('preview shows card 0 name', (await txt('#lvlPrevName')) === 'Lil Spasticism');
  ok('preview shows subtitle + 3 features', (await txt('#lvlPrevSub')).length > 20 && (await page.evaluate(() => document.querySelectorAll('#lvlPrevFeat li').length)) === 3);
  ok('preview hint offers ENTER / DOUBLE-CLICK', /ENTER \/ DOUBLE-CLICK/i.test(await txt('#lvlPrevHint')));

  // keyboard nav: Enter-5 lands on the LOCKED tile; its preview shows the unlock criteria
  for (let i = 0; i < 5; i++) await page.evaluate(() => window.__gpMenu('ArrowDown'));
  cs = await cardState();
  ok('stuck at locked tile bottom (no wrap-skip)', cs.sel === 5);
  ok('locked preview shows ??? + LOCKED criteria', (await txt('#lvlPrevName')) === '???' && /SEAL INTACT/i.test(await txt('#lvlPrevSub')) && (await txt('#lvlPrevHint')).toUpperCase().includes('LOCKED'));
  await page.evaluate(() => window.__gpMenu('Enter'));
  ok('ENTER on locked tile does NOT launch', (await vis('#menuLevels')) === 'block' && !(await page.evaluate(() => document.getElementById('menu').classList.contains('launching'))));

  // left/right arrows also navigate; UP x5 back to card 0 and launch it
  await page.evaluate(() => window.__gpMenu('ArrowLeft'));
  ok('ArrowLeft steps back', (await cardState()).sel === 4);
  for (let i = 0; i < 10; i++) { if ((await cardState()).sel === 0) break; await page.evaluate(() => window.__gpMenu('ArrowUp')); }
  ok('wrap-around to card 0', (await cardState()).sel === 0);
  await page.evaluate(() => window.__gpMenu('Enter'));
  ok('launch adds fade/zoom transition to #menu', (await page.evaluate(() => document.getElementById('menu').classList.contains('launching'))) === true);
  let launched = false;
  try { await page.waitForFunction('window.__ng.mv().st === \'play\'', { timeout: 20000 }); launched = true; } catch (e) {}
  ok('launched into gameplay (state play)', launched);
  ok('menu hidden after launch', (await vis('#menu')) === 'none');
  ok('selection persisted to localStorage', (await page.evaluate(() => localStorage.getItem('sk3d_lastLevel'))) === 'descent');

  // persistence: pretend the last played level was nos, reload, it should be preselected
  await page.evaluate(() => { try { localStorage.setItem('sk3d_lastLevel', 'nos'); } catch (e) {} });
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng', { timeout: 150000 });
  await sleep(2000);
  await page.evaluate(() => window.__gpMenu('Enter'));
  ok('remembered level (nos) preselected after reload', (await cardState()).sel === 2);

  // mouse: click selects (and previews), double-click is the launcher
  await page.evaluate(() => document.getElementById('lvlBtn1').click());
  ok('single CLICK selects card 1 without launching', (await cardState()).sel === 1 && (await vis('#menuLevels')) === 'block' && (await txt('#lvlPrevName')) !== 'Lil Spasticism');
  cs = await cardState();
  ok('double-click handler wired on unlocked cards', cs.dbl === 'function');
  await page.evaluate(() => window.__gpMenu('Escape'));
  ok('ESC/BACK returns to MAIN menu', (await vis('#menuMain')) === 'block' && (await vis('#menuLevels')) === 'none');

  ok('zero page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
  console.log(fails.length === 0 ? 'LEVEL SELECT PROBE: ALL PASS' : 'LEVEL SELECT PROBE: ' + fails.length + ' FAIL(S)');
  await browser.close();
  process.exit(fails.length === 0 ? 0 : 1);
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
