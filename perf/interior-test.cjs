// Temporary verification harness for the tower-interior feature (Agent A, PLAN-INTERIORS-MP.md).
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const path = require('path');

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'file:///' + path.resolve(__dirname, 'index.html').replace(/\\/g, '/');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// mean/stddev/distinct-colour stats of a screenshot, computed inside the page
async function shotStats(page) {
  const b64 = await page.screenshot({ encoding: 'base64' });
  return page.evaluate(async (data) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + data; });
    const c = document.createElement('canvas'); c.width = 320; c.height = 200;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0, 320, 200);
    const d = g.getImageData(0, 0, 320, 200).data;
    let sr = 0, sg = 0, sb = 0, n = 320 * 200; const seen = new Set();
    for (let i = 0; i < d.length; i += 4) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; seen.add((d[i] >> 3 << 10) | (d[i + 1] >> 3 << 5) | (d[i + 2] >> 3)); }
    const mr = sr / n, mg = sg / n, mb = sb / n; let vr = 0, vg = 0, vb = 0;
    for (let i = 0; i < d.length; i += 4) { vr += (d[i] - mr) ** 2; vg += (d[i + 1] - mg) ** 2; vb += (d[i + 2] - mb) ** 2; }
    return { mean: [mr, mg, mb].map(v => +v.toFixed(1)), std: [vr, vg, vb].map(v => +Math.sqrt(v / n).toFixed(1)), colours: seen.size };
  }, b64);
}

(async () => {
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: 'new',
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/voice-lines|tts-status|ERR_FILE_NOT_FOUND/.test(m.text())) errors.push('CONSOLE: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction('window.__ng && typeof window.__ng.towers === "function"', { timeout: 90000 });
  await page.evaluate(() => { const b = document.getElementById('bStart'); if (b) b.click(); });
  await sleep(1000);

  const out = { themes: [], checks: [] };

  // 1. every theme opens, is enterable, has a solid ground floor, enemies, loot and renders
  for (const theme of ['server', 'atrium', 'reactor', 'club', 'vault']) {
    const res = await page.evaluate(async (theme) => {
      window.__ng.level = 1;
      await new Promise(r => setTimeout(r, 350));
      const opened = window.__ng.openTower(0, theme);
      const t = window.__ng.towers()[0];
      window.__ng.tp(t.x, 1.5, t.z);
      await new Promise(r => setTimeout(r, 800));
      return { theme, opened, zone: window.__ng.info().zone, inside: window.__ng.interiors().inside, standing: window.__ng.pos.toArray().map(v => +v.toFixed(2)), hp: window.__ng.mv().hp };
    }, theme);
    res.pixels = await shotStats(page);
    out.themes.push(res);
  }

  // 2. falling inside must never kill the player (interior floors are catch nets)
  out.checks.push(await page.evaluate(async () => {
    const t = window.__ng.towers()[0];
    window.__ng.tp(t.x, t.top - 6, t.z);
    const before = window.__ng.mv().hp;
    await new Promise(r => setTimeout(r, 2500));
    return { check: 'fall-inside-no-death', before, after: window.__ng.mv().hp, y: +window.__ng.pos.y.toFixed(1), inside: window.__ng.interiors().inside };
  }));

  // 3. leaving the tower restores the outside world
  out.checks.push(await page.evaluate(async () => {
    const t = window.__ng.towers()[0];
    window.__ng.tp(t.x + t.hw + 40, t.top + 30, t.z);
    await new Promise(r => setTimeout(r, 900));
    return { check: 'leave-restores-outside', zone: window.__ng.info().zone, inside: window.__ng.interiors().inside, pos: window.__ng.pos.toArray().map(v => +v.toFixed(1)) };
  }));

  // 4. landing on a closed tower roof opens it and keeps the player on the roof
  out.checks.push(await page.evaluate(async () => {
    window.__ng.level = 1;
    await new Promise(r => setTimeout(r, 400));
    const towers = window.__ng.towers(), tries = [];
    for (const t of towers) {
      window.__ng.tp(t.x, t.top + 0.4, t.z);
      await new Promise(r => setTimeout(r, 1200));
      const row = window.__ng.towers().find(x => x.i === t.i);
      tries.push({ i: t.i, roofTop: t.top, y: +window.__ng.pos.y.toFixed(1), onG: window.__ng.mv().onG, opened: row.opened, theme: row.theme, inside: window.__ng.interiors().inside });
      if (row.opened) break;
    }
    return { check: 'roof-landing-opens', tries };
  }));

  // 5. the roof hatch is a real hole: dropping through the centre lands inside
  out.checks.push(await page.evaluate(async () => {
    window.__ng.level = 1;
    await new Promise(r => setTimeout(r, 400));
    const t = window.__ng.towers()[0];
    window.__ng.openTower(0);
    await new Promise(r => setTimeout(r, 200));
    window.__ng.tp(t.x, t.top + 1.2, t.z);
    await new Promise(r => setTimeout(r, 2500));
    return { check: 'hatch-drops-inside', y: +window.__ng.pos.y.toFixed(1), roof: t.top, inside: window.__ng.interiors().inside, zone: window.__ng.info().zone, hp: window.__ng.mv().hp };
  }));

  // 6. the service pads under each hatch throw the player up to the next floor
  out.checks.push(await page.evaluate(async () => {
    const t = window.__ng.towers()[0];
    const pads = window.__ng.bounces().filter(b => Math.abs(b.x - t.x) <= t.hw && Math.abs(b.z - t.z) <= t.hd && b.y > 1);
    if (!pads.length) return { check: 'pad-launch', error: 'no interior pad found' };
    const pad = pads.sort((a, b) => a.y - b.y)[0];
    window.__ng.tp(pad.x, pad.y + 2.5, pad.z);
    await new Promise(r => setTimeout(r, 1100));
    return { check: 'pad-launch', padY: pad.y, boost: pad.b, y: +window.__ng.pos.y.toFixed(1), vy: window.__ng.mv().vy, pads: pads.length };
  }));

  // 7. a collect contract for the opened tower is offered to the player
  out.checks.push(await page.evaluate(() => {
    const ms = window.__ng.missions();
    const interior = ms.filter(m => m.interior);
    return { check: 'interior-contract', offered: interior.length, title: interior[0] ? interior[0].title : null, state: interior[0] ? interior[0].state : null };
  }));

  // 8. frame cost: same viewpoint with the tower closed vs opened, plus the city and the inside
  out.perf = await page.evaluate(async () => {
    window.__ng.level = 1;
    await new Promise(r => setTimeout(r, 600));
    const t = window.__ng.towers()[0];
    const pick = o => ({ fps: o.fps, 'frame ms avg': o['frame ms avg'], 'frame ms p95': o['frame ms p95'], 'draw calls/frame': o['draw calls/frame'], 'triangles/frame': o['triangles/frame'], solids: o.solids, geometries: o.geometries });
    // city baseline from the spawn roof (level setter already parks the player there)
    await new Promise(r => setTimeout(r, 900));
    const city = await window.__ng.perf.capture('city', 4);
    // A/B from one fixed vantage point outside the tower (never touch the roof, or it auto-opens)
    window.__ng.tp(t.x + t.hw + 26, t.top + 8, t.z);
    await new Promise(r => setTimeout(r, 900));
    const closed = await window.__ng.perf.capture('tower-closed', 4);
    window.__ng.openTower(0, 'server');
    await new Promise(r => setTimeout(r, 900));
    const opened = await window.__ng.perf.capture('tower-open', 4);
    // and from inside
    window.__ng.tp(t.x, 1.5, t.z);
    await new Promise(r => setTimeout(r, 1200));
    const inside = await window.__ng.perf.capture('interior', 4);
    return { city: pick(city), closed: pick(closed), opened: pick(opened), inside: pick(inside) };
  });

  // 9. screenshots for a visual look
  const shotDir = path.join(require('os').tmpdir(), 'skydive-interiors');
  require('fs').mkdirSync(shotDir, { recursive: true });
  await page.evaluate(async () => {
    const t = window.__ng.towers()[0];
    window.__ng.openTower(0, 'server');
    window.__ng.tp(t.x, 1.5, t.z);
    window.__ng.look(0.6, -0.05);
  });
  await sleep(1200);
  await page.screenshot({ path: path.join(shotDir, 'interior-server.png') });
  await page.evaluate(async () => {
    const t = window.__ng.towers()[0];
    window.__ng.tp(t.x + 9, t.top + 3.2, t.z + 9);
    window.__ng.look(-2.5, -0.18);
  });
  await sleep(1200);
  await page.screenshot({ path: path.join(shotDir, 'roof-open-hatch.png') });
  out.shots = shotDir;

  await browser.close();
  console.log(JSON.stringify(out, null, 2));
  console.log(errors.length ? 'ERRORS:\n' + errors.slice(0, 20).join('\n') : 'NO JS ERRORS');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error('HARNESS FAILED', e); process.exit(2); });
