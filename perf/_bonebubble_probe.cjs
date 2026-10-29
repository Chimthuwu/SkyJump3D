// Headless probe: THE BONE CATHEDRAL + THE BUBBLE CITADEL far-dungeon content + garrison, via midRoute/midsDbg hooks.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 300000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  page.on('console', c => { const t = c.text(); if (/\[mids\]/.test(t)) console.log('console>', t.slice(0, 200)); });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng && window.__ng.midRoute', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 5000));

  for (const [site, roomA, roomB, secret, dungeon] of [
    ['bone', 'RELIC GALLERY', 'OSSUARY STACKS', 'THE CHOIR MASTER’S PAY', 'BONE CATHEDRAL'],
    ['bubble', 'SODA PARLOUR', 'FOAM GALLERY', 'THE UNSPOILED TITHE', 'BUBBLE CITADEL'],
  ]) {
    const r = await page.evaluate(s => window.__ng.midRoute(s), site);
    const names = (r.rooms || []).map(q => q.name);
    const floors = r.interior ? r.interior.floors : 0;
    const height = r.interior ? Math.round(r.interior.height) : 0;
    const okDeco = names.includes(roomA) && names.includes(roomB);
    const okSecret = (r.secrets || []).length === 1 && r.secrets[0].name === secret;
    const hazarded = (r.hazards || []).length >= 1 && !!(r.hazards[0].name);
    const shafted = (r.shaft || []).length >= 10;
    console.log(`${dungeon}: floors=${floors} height=${height} rooms=${r.rooms.length} hazards=${r.hazards.length} (${(r.hazards[0] || {}).name}) secret=${okSecret ? r.secrets[0].name : 'MISSING'} shaft=${(r.shaft || []).length} deck=${!!r.deck} bot=${!!r.bot} decoOk=${okDeco}`);
    if (!r.interior || !r.deck || !r.bot || !shafted || !okDeco || !okSecret || !hazarded) console.log(`!! ${site.toUpperCase()} DUNGEON BUILD PROBE FAILED`);
  }
  const dbg = await page.evaluate(() => window.__ng.midsDbg());
  const guards = { bone: 0, bubble: 0 };
  for (const g of dbg.guards) { if (g.startsWith('bone')) guards.bone++; else if (g.startsWith('bubble')) guards.bubble++; }
  console.log('garrison units deployed:', JSON.stringify(guards));
  if (guards.bone < 3 || guards.bubble < 3) console.log('!! GARRISON PROBE FAILED');
  console.log('runtime errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('BONEBUBBLE PROBE FAILED:', e.message); process.exit(1); });
