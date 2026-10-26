// Headless check of the COOP/PVP host toggle: MULTIPLAYER (P) -> host screen (KeyH) -> C toggles the label,
// hitPeer() is gated in COOP and transmits in PVP. No live peering needed (stubbed socket).
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' | ')));
  page.on('request', req => { if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) req.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(SRC, 'utf8') }); else req.continue(); });
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng && window.__gpMenu', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 5000));
  const evl = fn => page.evaluate(fn);

  await evl(() => window.__gpMenu('KeyP'));                       // main -> MULTIPLAYER
  await evl(() => window.__gpMenu('KeyH'));                       // MULTIPLAYER -> HOST screen
  const mode0 = await evl(() => ({ label: document.querySelector('#netModeLabel') ? document.querySelector('#netModeLabel').textContent : 'NO-LABEL', m: window.__ng.probeNetMode().get() }));
  console.log('initial:', JSON.stringify(mode0));
  await evl(() => window.__gpMenu('KeyC'));                       // toggle to COOP
  const mode1 = await evl(() => ({ label: document.querySelector('#netModeLabel').textContent, m: window.__ng.probeNetMode().get() }));
  console.log('after C:', JSON.stringify(mode1));
  await evl(() => window.__gpMenu('KeyC'));                       // back to PVP
  const mode2 = await evl(() => ({ label: document.querySelector('#netModeLabel').textContent, m: window.__ng.probeNetMode().get() }));
  console.log('after C again:', JSON.stringify(mode2));

  // gate probe: hitPeer must send in PVP, be blocked in COOP (either variable state)
  const gate = await evl(() => {
    const nm = window.__ng.probeNetMode();
    const r = {};
    nm.set('coop'); r.coop = window.__ng.probeHitPeer();
    nm.set('pvp'); r.pvp = window.__ng.probeHitPeer();
    r.final = nm.get();
    return r;
  });
  console.log('gate probe:', JSON.stringify(gate));
  console.log('runtime errors:', errors.length ? errors : 'none');
  await browser.close();
  const labelOK = mode0.label === 'PVP' && mode1.label === 'COOP' && mode1.m === 'coop' && mode2.label === 'PVP' && mode2.m === 'pvp';
  const gateOK = gate.coop === 'blocked' && gate.pvp === 'sent';
  console.log('TOGGLE OK:', labelOK, '| GATE OK (coop blocks, pvp sends):', gateOK);
  process.exit(labelOK && gateOK && errors.length === 0 ? 0 : 1);
})().catch(e => { console.error('PVP TEST FAILED:', e.message); process.exit(1); });
