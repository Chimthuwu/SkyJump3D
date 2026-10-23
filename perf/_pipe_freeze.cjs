// Repro: NOS level, put the player on a warp pipe, press crouch, watch whether the frame loop keeps ticking.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs'); const SRC = require('path').resolve(__dirname, '..', 'index.html');
(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 90000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio'] });
  const page = await browser.newPage(); await page.setRequestInterception(true);
  page.on('request', req => { if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) { let h = fs.readFileSync(SRC, 'utf8');
    h = h.replace('window.__ng = {', `window.__hk = { setLevelDefById, buildLevel, begin, pipes: () => nosPipes.map(p => ({ x: p.x, y: p.y, z: p.z, to: !!p.to })), put: (x, y, z) => { pos.set(x, y, z); vel.set(0, 0, 0); }, st: () => ({ state, y: pos.y, onGround, stand: !!(standOn && standOn.pipe), frames: (window.__fr = window.__fr || 0) }), key: (k, v) => { keys[k] = v; } }; window.__ng = {`);
    req.respond({ status: 200, contentType: 'text/html', body: h }); } else req.continue(); });
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto('file:///' + SRC.split(String.fromCharCode(92)).join('/'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction('window.__hk', { timeout: 120000 });
  await page.evaluate(() => { __hk.setLevelDefById('nos'); __hk.buildLevel(); __hk.begin(); });
  await new Promise(r => setTimeout(r, 4000));
  const pipes = await page.evaluate(() => __hk.pipes()); console.log('pipes', pipes.length, pipes.slice(0, 3));
  const p = pipes.find(q => q.to) || pipes[0];
  await page.evaluate(p => __hk.put(p.x + 0.3, p.y + 6, p.z), p);
  for (let i = 0; i < 6; i++) { await new Promise(r => setTimeout(r, 1500)); try { console.log(await Promise.race([page.evaluate(() => __hk.st()), new Promise((_, j) => setTimeout(() => j(new Error('PAGE FROZEN')), 20000))])); } catch (e) { console.log(e.message); break; } }
  await page.evaluate(() => __hk.key('KeyC', true)); await new Promise(r => setTimeout(r, 2000));
  try { console.log('after crouch', await Promise.race([page.evaluate(() => __hk.st()), new Promise((_, j) => setTimeout(() => j(new Error('PAGE FROZEN')), 20000))])); } catch (e) { console.log(e.message); }
  console.log('errors', errs); await browser.close(); process.exit(0);
})();
