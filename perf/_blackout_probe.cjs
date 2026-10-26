// Blackout repro probe: enter play, teleport onto the haunted-house land slab, wait, and check every scene light intensity stays finite.
// Also checks FleshNest + Shroom site slabs. Asserts activeZ flips to the site zone and back cleanly.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) {
      let h = fs.readFileSync(SRC, 'utf8');
      h = h.replace('window.__ng = {', `window.__hk = {
        enterPlay: () => { LEVELS[0].startFn(); return state; },
        tpRaw: (x, y, z) => { pos.set(x, y, z); vel.set(0, 0, 0); },
        landZone: nm => { const s = solids.find(q => q.zone && q.zone.name === nm && q.cx !== undefined); if (!s) return null; pos.set(s.cx, s.top + 1.2, s.cz); vel.set(0, 0, 0); return { x: +s.cx.toFixed(0), y: +s.top.toFixed(1), z: +s.cz.toFixed(0), zone: s.zone.name }; },
        zoneNow: () => activeZ && activeZ.name,
        lights: () => scene.traverse ? (r => { scene.traverse(o => { if (o.isLight) r.push({ t: o.type, i: +o.intensity.toFixed(4), bad: !Number.isFinite(o.intensity) }); }); return r; })([]) : 'nos-scene',
        solidHere: () => solids.filter(s => s.cx !== undefined && Math.abs(s.cx - pos.x) < s.hw + 3 && Math.abs(s.cz - pos.z) < s.hd + 3 && Math.abs(s.top - pos.y) < 4).map(s => ({ z: s.zone && s.zone.name, top: +s.top.toFixed(1) })),
      }; window.__ng = {`);
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng && window.__ng.mids', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 6000));
  const w = ms => new Promise(r => setTimeout(r, ms));
  const evl = (fn, ...args) => page.evaluate(fn, ...args);

  await evl(() => window.__hk.enterPlay());
  await w(1500);

  const badLights = () => evl(() => window.__hk.lights().filter(l => l.bad));
  const lightSample = () => evl(() => window.__hk.lights().slice(0, 3).map(l => l.t + ':' + l.i).join(','));
  console.log('lights baseline finite:', JSON.stringify(await badLights()) === '[]', '|', await lightSample());

  const mids = await evl(() => window.__ng.mids());
  const sites = Object.fromEntries((mids.sites || []).map(s => [s.site, s]));
  console.log('mids sites:', JSON.stringify(Object.keys(sites)));

  for (const name of ['HauntedHouse', 'FleshNest', 'Shroom']) {
    const landed = await evl(nm => window.__hk.landZone(nm), name);
    if (!landed) { console.log(name + ': no zone slab in scene — skip'); continue; }
    await w(2500);
    const litBad = await badLights();
    const here = await evl(() => window.__hk.solidHere().slice(0, 3));
    const zone = await evl(() => window.__hk.zoneNow());
    console.log(name + ': landed -> activeZ=' + zone + ' | slabs under: ' + JSON.stringify(here) + ' | NaN lights:', litBad.length ? JSON.stringify(litBad) : 'none');
  }
  // return to open air: zone should repaint to the level theme, lights stay finite
  await evl(() => window.__hk.tpRaw(0, 400, 0));
  await w(1500);
  const litBad2 = await badLights();
  console.log('open air again -> activeZ=' + (await evl(() => window.__hk.zoneNow())) + ' | NaN lights:', litBad2.length ? JSON.stringify(litBad2) : 'none');
  console.log('runtime errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('BLACKOUT PROBE FAILED:', e.message); process.exit(1); });
