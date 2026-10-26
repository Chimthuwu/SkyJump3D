// Headless route regression: enter the haunted keep, ascend the connected floor stairs,
// then descend the monument's marked shaft to the Nexus crypt.
const assert = require('assert');
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const path = require('path');
const SRC = path.resolve(__dirname, '..', 'index.html');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    headless: 'new',
    protocolTimeout: 600000,
    args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'],
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    await page.setRequestInterception(true);
    page.on('request', req => req.url().startsWith('file:') && /index\.html$/.test(req.url())
      ? req.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(SRC, 'utf8') })
      : req.continue());
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__ng && window.__ng.midRoute', { timeout: 180000 });
    await wait(5000);
    await page.evaluate(() => window.__ng.enterPlay());
    await wait(1500);

    const data = await page.evaluate(() => window.__ng.midRoute('house'));
    assert(data, 'haunted house route/site must be built');
    assert(data.route, 'haunted keep must expose its interior floor route');
    assert(data.route.entry && data.route.ground, 'entry and ground landing must be present');
    assert(data.route.floor1.length && data.route.floor2.length && data.route.spire, 'all interior floor landings must be present');
    assert.strictEqual(data.route.stairs.length, 3, 'expected stairs for ground→floor 1, floor 1→floor 2 and floor 2→spire');
    assert(data.route.stairs.every(run => run.length === 12), 'each floor stair run must have all twelve steps');

    const inside = (surface, p) => Math.abs(surface.x - p.x) <= surface.hw + 0.01 && Math.abs(surface.z - p.z) <= surface.hd + 0.01;
    const touchesAny = (surfaces, p, y) => surfaces.some(s => inside(s, p) && Math.abs(s.y - y) < 0.05);
    assert(Math.abs(data.route.entry.y - data.route.ground.y) < 0.05, 'door entry must meet the ground landing height');
    assert(Math.abs(data.route.entry.z - data.site.z + 14) < 0.05, 'door approach point must sit just outside the entrance');
    assert(Math.hypot(data.route.entry.x - data.route.ground.x, data.route.entry.z - data.route.ground.z) <= data.route.ground.hw + 0.1,
      'door entry should lie within the ground landing footprint');

    const [groundToOne, oneToTwo, twoToSpire] = data.route.stairs;
    const runEnd = run => run[run.length - 1];
    const runStart = run => run[0];
    const first = runStart(groundToOne), firstEnd = runEnd(groundToOne);
    const second = runStart(oneToTwo), secondEnd = runEnd(oneToTwo);
    const third = runStart(twoToSpire), thirdEnd = runEnd(twoToSpire);
    assert(touchesAny(data.route.floor1, firstEnd, firstEnd.y), 'first stair run must land on floor 1');
    assert(touchesAny(data.route.floor1, second, data.route.floor1[0].y), 'floor 1 landing must connect to the second stair run');
    assert(touchesAny(data.route.floor2, secondEnd, secondEnd.y), 'second stair run must land on floor 2');
    assert(touchesAny(data.route.floor2, third, data.route.floor2[0].y), 'floor 2 landing must connect to the spire stair run');
    assert(touchesAny([data.route.spire], thirdEnd, data.route.spire.y), 'spire stair run must reach the Nexus floor');
    assert(firstEnd.y > first.y && secondEnd.y > second.y && thirdEnd.y > third.y, 'interior stairs must climb monotonically to the upper spire');

    assert(data.deck && data.shaft.length >= 6 && data.bot, 'haunted monument needs a deck, descending shaft, and crypt floor');
    let previousY = data.deck.y;
    for (let i = 0; i < data.shaft.length; i++) {
      const rung = data.shaft[i];
      assert(rung.y < previousY, `shaft rung ${i + 1} must descend below the prior landing`);
      assert(previousY - rung.y <= 16, `shaft rung ${i + 1} is too large a drop to follow`);
      previousY = rung.y;
    }
    assert(data.bot.y < previousY && previousY - data.bot.y <= 10, 'last shaft rung must connect to the bottom Nexus crypt');
    assert(errors.length === 0, `runtime errors: ${errors.join('; ')}`);
    console.log(`HAUNTED ROUTE PASS: entry → ${data.route.stairs.map(r => r.length).join('/')} steps → spire; ${data.shaft.length} descending shaft landings → crypt; no page errors`);
  } finally {
    await browser.close();
  }
})().catch(err => {
  console.error('HAUNTED ROUTE TEST FAILED:', err.stack || err.message);
  process.exit(1);
});
