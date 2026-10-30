// Confirms the 18 new Overgrowth/Ascent/Skyfall dungeons now carry real room content (not the default teacup
// fallback) and that hazard runes are armed. Same request-interception shim pattern as perf/_l234_probe.cjs,
// plus exposing the game's own midRoute(key)-shaped introspection (rooms/hazards/secrets) directly off commons.mid.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');
const KEYS_BY_LEVEL = {
  overgrowth: ['roothollow', 'beastnest', 'sunkenstump', 'sporevault', 'canopytemple', 'hornetshive'],
  ascent: ['mineshaft', 'crystalgrotto', 'avalanchevault', 'eaglesaerie', 'deepcavern', 'frozenkeep'],
  skyfall: ['cloudcastle', 'skytemple', 'auroravault', 'thunderdock', 'floatingruin', 'lightningspire'],
};

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
        site: key => { const s = commons && commons.mid && commons.mid[key]; if (!s) return null; return { rooms: (s.rooms||[]).map(r=>r.name), hazards: (s.hazards||[]).map(x=>({name:x.name, hasSigilCooldownField: typeof x.cooldown === 'number'})), secrets: (s.secrets||[]).map(x=>x.name) }; },
      }; window.__ng = {`);
      req.respond({ status: 200, contentType: 'text/html', body: h });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__hk', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 4000));
  const evl = (fn, ...args) => page.evaluate(fn, ...args);

  for (const [lvl, keys] of Object.entries(KEYS_BY_LEVEL)) {
    await evl(id => { window.__hk.setLevelDefById(id); window.__hk.buildLevel(); }, lvl);
    await new Promise(r => setTimeout(r, 3000));
    for (const key of keys) {
      const r = await evl(k => window.__hk.site(k), key);
      if (!r) { console.log(`${lvl}/${key}: NO SITE FOUND (not registered in commons.mid)`); continue; }
      const isTeacup = r.rooms.some(n => /MOONCAP|TEA PARLOUR/i.test(n));
      console.log(`${lvl}/${key}: rooms=${JSON.stringify(r.rooms)} hazards=${JSON.stringify(r.hazards)} secret=${r.secrets.join(',')} isTeacupFallback=${isTeacup}`);
    }
  }
  console.log('runtime errors:', errors.length ? errors.slice(0, 10).join(' | ') : 'none');
  await browser.close();
})().catch(e => { console.error('PROBE FAILED:', e.message); process.exit(1); });
