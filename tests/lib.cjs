// Shared QA helpers: static HTTP server, Chromium (software GL) launcher, three.js route, page bootstrap. Portable (no machine-specific paths).
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..');
const PW = process.env.PW_MODULE || '/opt/node22/lib/node_modules/playwright';
const THREE_FILE = process.env.THREE_FILE || path.join(ROOT, '.qa-cache/three/package/build/three.module.js');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.css': 'text/css', '.md': 'text/plain' };
function serve(root = ROOT, port = 0) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(req.url.split('?')[0]); let f = path.join(root, u === '/' ? 'index.html' : u);
    if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); fs.createReadStream(f).pipe(res);
  });
  return new Promise(r => srv.listen(port, '127.0.0.1', () => r({ srv, url: `http://127.0.0.1:${srv.address().port}/` })));
}
async function launch(opts = {}) {
  const { chromium } = require(PW);
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--mute-audio', '--ignore-gpu-blocklist', '--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights,BlockInsecurePrivateNetworkRequests'] });
  return browser;
}
// open a page on the game. opts.dbg injects a harness-only __dbg object (solids/enemies/scene/...) without editing the product.
async function openGame(browser, url, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1280, height: 800 }, ...(opts.video ? { recordVideo: { dir: opts.video, size: { width: 960, height: 600 } } } : {}) });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' && !/Failed to load resource/.test(t)) errors.push('CONSOLE: ' + t.slice(0, 300)); if (opts.log) console.log('[page]', t.slice(0, 200)); });
  await page.route('**/three.module.js', r => r.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(THREE_FILE) }));
  await page.route(opts.allowNet ? /voice-lines|tts-status|\/voices\// : /voice-lines|tts-status|net-info|\/voices\//, r => r.abort());      // net-info aborted => the game would fall back to the PRODUCTION relay, so non-net tests never allow it (and only the local-relay test sets allowNet)
  if (opts.allowNet) await page.routeWebSocket(/^wss?:\/\/(?!127\.0\.0\.1)/, ws => ws.close());      // safety: never let a QA client reach the deployed relay
  if (opts.dbg) await page.route(/\/(index\.html)?(\?.*)?$/, async r => {
    const resp = await r.fetch(); let body = await resp.text();
    body = body.replace('window.__ng = {', 'window.__dbg = { get solids() { return solids; }, get enemies() { return enemies; }, get items() { return items; }, get lvl() { return lvl; }, get pos() { return pos; }, get vel() { return vel; }, get keys() { return keys; }, THREE, scene, camera, renderer, get camYaw() { return camYaw; }, set camYaw(v) { camYaw = v; }, get state() { return state; }, get net() { return net; } }; window.__ng = {');
    r.fulfill({ response: resp, body, headers: { ...resp.headers(), 'content-type': 'text/html' } });
  });
  await page.goto(url + (opts.query || ''), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng', null, { timeout: 120000 });
  return { ctx, page, errors };
}
module.exports = { serve, launch, openGame, ROOT };
