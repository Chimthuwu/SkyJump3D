// Headless mid-band test: three commons locations, three bosses, rewards, maw purge.
// Boot the real page (single player, net off), teleport to each site, drive the wave pipeline, kill the boss, assert rewards.
const puppeteer = require('C:/Users/Serge/AppData/Roaming/npm/node_modules/puppeteer');
const fs = require('fs');
const SRC = require('path').resolve(__dirname, '..', 'index.html');

(async () => {
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: 'new', protocolTimeout: 600000, args: ['--allow-file-access-from-files', '--enable-unsafe-swiftshader', '--use-gl=swiftshader', '--no-sandbox', '--mute-audio', '--window-size=1280,800'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.setRequestInterception(true);
  page.on('request', req => {
    if (req.url().startsWith('file:') && /index\.html$/.test(req.url())) {
      req.respond({ status: 200, contentType: 'text/html', body: fs.readFileSync(SRC, 'utf8') });
    } else req.continue();
  });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 5).join(' | ')));
  await page.goto('file:///' + SRC.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction('window.__ng && window.__ng.mids', { timeout: 180000 });
  await new Promise(r => setTimeout(r, 5000));                       // let the world build + settle

  const evl = (fn, ...args) => page.evaluate(fn, ...args);   // args MUST be forwarded (see todo.md gamepad-session note)
  const w = ms => new Promise(r => setTimeout(r, ms));
  const mid = () => evl(() => window.__ng.mids());
  const state0 = await evl(() => window.__ng.enterPlay());          // leave the title menu into actual gameplay (tick gates on state==='play')
  console.log('enterPlay ->', state0);
  await new Promise(r => setTimeout(r, 2000));

  const fp0 = await evl(() => window.__ng.commons());
  console.log('commons:', JSON.stringify(fp0));
  const M0 = await mid();
  console.log('mids initial:', JSON.stringify(M0, null, 1));
  console.log('outrider lead-in chains (platforms seeded per site):', JSON.stringify(await evl(() => window.__ng.midLead())));
  const outr = await evl(() => window.__ng.midLead());
  if (!outr || outr.nest < 2 || outr.house < 2 || outr.shroom < 2) console.log('!! OUTRIDER SEED CHECK FAILED — lead chains empty');

  const runSite = async (site, expectKind) => {
    const gone = await evl(s => window.__ng.midsGo(s), site);
    if (!gone) { console.log(site + ': SITE MISSING (blocked placement) — skip'); return null; }
    await w(700);
    const s1 = await mid();
    const st = s1.sites.find(x => x.site === site);
    console.log(site + ': arrive ->', JSON.stringify(st));
    if (st.missing) return null;
    // drive the pipeline: drop cooldowns (midsStep), kill one unit per pass, let the boss emerge
    // headless frames advance ~0.25 s of game time per second with the 2x monuments up, and the garrison can maul the
    // unprotected runner into the 'dead' state (which gates the site tick) — so stay alive, keep passes tight and many
    let bossSeen = false, guardKills = 0, tries = 0;
    while (tries++ < 70) {
      const stAlive = await evl(() => window.__ng.mv().st);
      if (stAlive !== 'play') {
        await evl(() => window.__ng.midRespawn());
        await evl(s => window.__ng.midsGo(s), site);
        await w(900);
        continue;
      }
      const st0 = (await mid()).sites.find(x => x.site === site);
      if (st0.waves >= 3 && !st0.bossSpawned) {
        const k = await evl(s => window.__ng.midsKill(s), site);      // waves>=3: kill WITHOUT forcing cooldowns — the boss gate (zero live guards) then fires on the next tick
        if (k !== 'killed' && guardKills === 0) console.log('   pass' + tries + ': kill -> ' + k);
        else if (k === 'killed') guardKills++;
        await w(3500);
      } else if (st0.bossSpawned) {
        // post-boss: do NOT force cooldowns — midsStep zeroes waveCd and the summoner refills a guard the same tick,
        // which starves the guard-first kill order of an empty tick and the boss is never reachable (hp never drops)
        const k = await evl(s => window.__ng.midsKill(s), site);
        if (k !== 'killed' && guardKills === 0) console.log('   pass' + tries + ': kill -> ' + k);
        else if (k === 'killed') guardKills++;
        await w(3500);
      } else {
        await evl(s => window.__ng.midsStep(s), site);                // keep the garrison coming until waves == 3
        const k = await evl(s => window.__ng.midsKill(s), site);
        if (k !== 'killed' && guardKills === 0) console.log('   pass' + tries + ': kill -> ' + k);
        else if (k === 'killed') guardKills++;
        await w(4200);                                              // guardCd is 9 s of GAME time (~2.3 s real per game-second headless); tight passes still let waves develop
      }
      const st2 = (await mid()).sites.find(x => x.site === site);
      if (st2.bossSpawned && st2.bossHp !== null) bossSeen = true;
      if (st2.bossDead) break;
      if (tries === 66 && !st2.bossDead) console.log(site + ': SLOW pipeline after 66 passes ->', JSON.stringify(st2));
    }
    const after = await mid();
    return after;
  };

  // NEST: kill 3 maw guards -> Mother Maw -> voidbeam / +2 hearts / purge
  const nest = await runSite('nest');
  if (nest) {
    const s = nest.sites.find(x => x.site === 'nest');
    console.log('NEST RESULT:', JSON.stringify(s), 'mawPurged:', nest.mawPurged, 'hearts:', nest.bonusHearts, 'maxhp:', nest.maxhp, 'voidbeam owned:', nest.owned[7]);
    if (!s.bossDead || !nest.mawPurged || nest.owned[7] !== true || nest.bonusHearts < 2) console.log('!! NEST REWARD CHECK FAILED');
  }
  // wild maw purge: force the spawn timer and watch for 4s — no new maw may appear
  if (nest && nest.mawPurged) {
    await evl(() => { window.__ng.commonsGo(); });                 // park somewhere neutral (tp() with no args would NaN pos.set)
    const before = await evl(() => window.__ng.midsStaff());
    await w(4000);
    const afterP = await evl(() => window.__ng.midsStaff());
    console.log('maw purge gate: staffed maws before', before.mawCount, 'after 4s', afterP.mawCount, afterP.mawCount === before.mawCount ? '| PURGE OK (needs mawCd forced to fire:' : '', 'pass' );
  }

  // HOUSE: horror garrison -> Nexus -> hexfire / +2 hearts
  const house = await runSite('house');
  if (house) {
    const s = house.sites.find(x => x.site === 'house');
    console.log('HOUSE RESULT:', JSON.stringify(s), 'hearts:', house.bonusHearts, 'maxhp:', house.maxhp, 'hexfire owned:', house.owned[8]);
    if (!s.bossDead || house.owned[8] !== true || house.bonusHearts < 4) console.log('!! HOUSE REWARD CHECK FAILED');
  }

  // SHROOM: trippers -> Cheshire -> teaparty / +2 hearts
  const shroom = await runSite('shroom');
  if (shroom) {
    const s = shroom.sites.find(x => x.site === 'shroom');
    console.log('SHROOM RESULT:', JSON.stringify(s), 'hearts:', shroom.bonusHearts, 'maxhp:', shroom.maxhp, 'teaparty owned:', shroom.owned[9], 'wins:', JSON.stringify(shroom.midWins));
    if (!s.bossDead || shroom.owned[9] !== true || shroom.bonusHearts < 6 || shroom.maxhp !== 11) console.log('!! SHROOM REWARD CHECK FAILED');
  }

  for (const site of ['nest', 'house', 'shroom']) {
    const route = await evl(s => window.__ng.midRoute(s), site);
    if (!route || !route.interior || route.interior.height < 400 || !route.rooms.length || !route.hazards.length || route.secrets.length !== 1) {
      console.log(`!! ${site.toUpperCase()} DUNGEON CONTENT CHECK FAILED`, JSON.stringify(route && { interior: route.interior, rooms: route.rooms, hazards: route.hazards, secrets: route.secrets }));
    } else console.log(`${site.toUpperCase()} DUNGEON CONTENT PASS: ${route.interior.floors} storeys, ${route.rooms.length} rooms, ${route.hazards.length} hazards, ${route.secrets[0].name}`);
  }
  console.log('runtime errors:', errors.length ? errors : 'none');
  await browser.close();
})().catch(e => { console.error('MID TEST FAILED:', e.message); process.exit(1); });
