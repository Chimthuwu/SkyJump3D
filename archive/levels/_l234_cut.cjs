// Levels 2-4 archive surgery (user request 2026-10-31).
// 1. Extracts removed content verbatim into archive/levels/salvage_code.txt
// 2. Cuts Levels 2-4 (Overgrowth/Ascent/Skyfall) out of index.html, keeping Lvl1 + generic infra.
// Aborts without writing if any cut fails to match.
const fs = require('fs');
let text = fs.readFileSync('index.html', 'utf8');
const failures = [];
const salvage = [];
const sal = (title, code) => {
  if (code && code.trim()) salvage.push('### ' + title + ' (from pre-cut index.html)\n' + code + '\n');
};
const KEYS = ['roothollow', 'beastnest', 'sunkenstump', 'sporevault', 'canopytemple', 'hornetshive', 'mineshaft', 'crystalgrotto', 'avalanchevault', 'eaglesaerie', 'deepcavern', 'frozenkeep', 'cloudcastle', 'skytemple', 'auroravault', 'thunderdock', 'floatingruin', 'lightningspire'];

function braceEnd(t, braceIdx) {
  let depth = 0;
  for (let i = braceIdx; i < t.length; i++) {
    const c = t[i]; if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}
function findLine(re, fromChar = 0, sub = text) {   // fromChar must be at (or inside) a line; sla first partial line too
  let lineStart = fromChar;
  for (let i = fromChar; i <= sub.length; i++) {
    if (i === sub.length || sub[i] === '\n') {
      const line = sub.slice(lineStart, i);
      if (re.test(line.replace(/\r$/, ''))) return { line, lo: lineStart, hi: i };
      lineStart = i + 1;
    }
  }
  return null;
}
function applyCut(name, fn) {
  const before = text;
  text = fn(text);
  if (text === before) failures.push('CUT HAD NO EFFECT: ' + name);
}

// ===== SALVAGE (anchors must all be present) =====
const s1 = findLine(/\/\/ ---- LEVEL 2 "THE OVERGROWTH": 6 forest dungeons/);
const e1 = findLine(/---- site 1: THE GIANT PUSSY/);
if (!s1 || !e1) failures.push('commonsMidBuild branch anchors missing');
if (s1 && e1) {
  sal('commonsMidBuild — whole-level dungeon branch families (Overgrowth/Ascent/Skyfall, ~190 lines each)', text.slice(s1.lo, e1.lo));
  for (const k of KEYS) {
    for (const kw of ['kind', 'key']) {
      const re = new RegExp("\\} else if \\(" + kw + " === '" + k + "'\\) \\{");
      const src = text.slice(0, s1.lo);
      const m = re.exec(src);
      if (!m) { failures.push('salvage: no block for ' + k + ' (' + kw + ')'); continue; }
      const end = braceEnd(src, src.indexOf('{', m.index));
      sal((kw === 'kind' ? 'farMonument exterior builder' : 'farDungeon room-prop') + ' — ' + k, src.slice(m.index, end + 1));
    }
  }
}
for (const anchorName of ["const routeHeading = makeLabel(key === 'nest'", "const sign = makeLabel(key === 'house'", "const dlbl = makeLabel(key === 'nest'", "const roomNames = key === 'house'", "const detailMat = lam(key === 'house'", "const ribMat = lam(key === 'house'", "let hazardName = key === 'house'", "const room = roomCenters[0], hazardColor = key === 'house'", "const MID_DIST = {", "const ELEV = {"].map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))) {
  const m = findLine(new RegExp(anchorName));
  if (!m) { failures.push('salvage chain anchor: ' + anchorName); continue; }
  let code = m.line;
  if (/MID_DIST|ELEV/.test(anchorName)) {
    const tail = /MID_DIST/.test(anchorName) ? findLine(/lightningspire: 2600/, m.hi) : findLine(/lightningspire: 200/, m.hi);
    if (tail) code = text.slice(m.lo, tail.hi); else failures.push('salvage tail: ' + anchorName);
  }
  sal('chain — ' + anchorName.slice(0, 50), code);
}
(function () {
  const ds = findLine(/if \(overgrowthOn\(\)\) \{\s*\/\/ LEVEL 2 "The Overgrowth"/);
  const dsEnd = findLine(/if \(zone\.name === 'Psychosis'\) \{/);
  if (ds && dsEnd) sal('dressSite — whole-level additive flavor layers (vines/mushrooms, icicles/snow, wisps/sparks)', text.slice(ds.lo, dsEnd.lo));
  else failures.push('dressSite anchors');
  const rk = findLine(/\/\/ LEVEL 3 "THE ASCENT": sibling of trunkify\(\) just above/);
  const cf = findLine(/function cloudify\(on\) \{/);
  if (rk && cf) { const end = braceEnd(text, text.indexOf('{', cf.lo)); sal('rockify() + cloudify() (functions + textures/mats/geos)', text.slice(rk.lo, end + 1)); }
  else failures.push('rockify/cloudify anchors');
  const bs = findLine(/\/\/ LEVEL 2 "THE OVERGROWTH" boss roster/);
  const bsEnd = findLine(/const SKYFALL_BOSSES = \[/);
  if (bs && bsEnd) sal('OVERGROWTH/ASCENT/SKYFALL_BOSSES rosters', text.slice(bs.lo, bsEnd.hi));
  else failures.push('boss rosters anchors');
  const zn = findLine(/\/\/ LEVELS 2-4's own 3-zone ladders/);
  const znEnd = findLine(/const SKYFALL_ZONES = \[/);
  if (zn && znEnd) sal('OVERGROWTH/ASCENT/SKYFALL_ZONES arrays + design comment', text.slice(zn.lo, znEnd.hi));
  else failures.push('zone arrays anchors');
  const sh = findLine(/\/\/ LEVELS 2-4's macro-shape generators/);
  const szs = findLine(/const SKYFALL_SHAPE = \{/);
  if (sh && szs) { const end = braceEnd(text, text.indexOf('{', szs.lo)); sal('OVERGROWTH/ASCENT/SKYFALL_SHAPE walkers + comment', text.slice(sh.lo, end + 2)); }
  else failures.push('shape walkers anchors');
  for (const id of ['overgrowth', 'ascent', 'skyfall']) {
    const card = findLine(new RegExp("\\{ id: '" + id + "', name:"));
    if (card) {
      const g = findLine(/^\s*glyph:/, card.hi + 1);
      if (g) sal("LEVELS_ALL menu card — " + id, text.slice(card.lo, g.hi + 1));
      else failures.push('card glyph line: ' + id);
    } else failures.push('menu card: ' + id);
  }
})();

// ===== CUTS =====
applyCut('commonsMidBuild branches', t => {
  const s = findLine(/\/\/ ---- LEVEL 2 "THE OVERGROWTH": 6 forest dungeons/, 0, t);
  const e = findLine(/---- site 1: THE GIANT PUSSY/, 0, t);
  if (!s || !e) return t;
  return t.slice(0, s.lo) + t.slice(e.lo);
});
for (const k of KEYS) for (const kw of ['kind', 'key']) {
  applyCut(kw + '-block ' + k, t => {
    const m = new RegExp("\\} else if \\(" + kw + " === '" + k + "'\\) \\{").exec(t);
    if (!m) return t;
    const end = braceEnd(t, t.indexOf('{', m.index));
    return t.slice(0, m.index + 1) + t.slice(end + 1);
  });
}
for (const k of KEYS) {
  applyCut('chain-trim ' + k, t => t.replace(new RegExp(":\\s*key === '" + k + "' \\? (?:'[^']*'|\"[^\"]*\"|\\[[^\\]]*\\]|0x[0-9a-fA-F]+)", 'g'), ''));
}
applyCut('MID_DIST', t => t.replace(
  /const MID_DIST = \{ nest: 2200, house: 1850, shroom: 2500, bone: 2050, bubble: 2650, eiffel: 2350,\r?\n    roothollow: 2150[^\n]*\r?\n    mineshaft: 2100[^\n]*\r?\n    cloudcastle: 2250[^\n]*/,
  '  const MID_DIST = { nest: 2200, house: 1850, shroom: 2500, bone: 2050, bubble: 2650, eiffel: 2350 };  // much further out than before (was a tight 1010-1140 band) so the dungeons genuinely spread across the map'));
applyCut('ELEV', t => t.replace(
  /const ELEV = \{ nest: 0, house: 190, shroom: -190, bone: 110, bubble: -150, eiffel: 200,\r?\n    roothollow: -40[^\n]*\r?\n    mineshaft: -160[^\n]*\r?\n    cloudcastle: 190[^\n]*/,
  "  const ELEV = { nest: 0, house: 190, shroom: -190, bone: 110, bubble: -150, eiffel: 200 };            // distinct absolute height offsets so the lands sit at different elevations relative to each other, not just different compass bearings (connectFar's causeway can climb/descend up to ~200 units safely — kept each offset under that cap so the causeway back to spawn stays reliable)"));
applyCut('dressSite L2-4 layers', t => {
  const s = findLine(/if \(overgrowthOn\(\)\) \{\s*\/\/ LEVEL 2 "The Overgrowth"/, 0, t);
  const e = findLine(/if \(zone\.name === 'Psychosis'\) \{/, 0, t);
  if (!s || !e) return t;
  return t.slice(0, s.lo) + t.slice(e.lo);
});
applyCut('rockify/cloudify', t => {
  const rk = findLine(/\/\/ LEVEL 3 "THE ASCENT": sibling of trunkify\(\) just above/, 0, t);
  const cf = findLine(/function cloudify\(on\) \{/, 0, t);
  if (!rk || !cf) return t;
  const end = braceEnd(t, t.indexOf('{', cf.lo));
  return t.slice(0, rk.lo) + t.slice(end + 1);
});
applyCut('setZone trunkify line', t => t.replace(
  /  if \(!interior\) trunkify\(overgrowthOn\(\) \|\| !!\(z && z\.name === 'Jungle'\)\);[^\n]*\n/,
  "  if (!interior) trunkify(!!(z && z.name === 'Jungle'));   // jungle takes over: every building becomes a giant tree trunk\n"));
applyCut('setZone rockify/cloudify lines', t => t.replace(/  if \(!interior\) rockify\(ascentOn\(\)\);[^\n]*\n  if \(!interior\) cloudify\(skyfallOn\(\)\);[^\n]*\n/, ''));
applyCut('buildLevel trunkify line', t => t.replace(
  /  \{ const wantTrunks = overgrowthOn\(\) \|\| !!\(activeZ && activeZ\.name === 'Jungle'\); trunkify\(false\); if \(wantTrunks\) trunkify\(true\); \}[^\n]*\n/,
  "  { const wantTrunks = !!(activeZ && activeZ.name === 'Jungle'); trunkify(false); if (wantTrunks) trunkify(true); }   // rebuilt levels in an active jungle keep their trunks; toggled off first so a stale state never sticks\n"));
applyCut('buildLevel rockify/cloudify lines', t => t.replace(/  \{ const wantRock = ascentOn\(\); rockify\(false\); if \(wantRock\) rockify\(true\); \}[^\n]*\n  \{ const wantCloud = skyfallOn\(\); cloudify\(false\); if \(wantCloud\) cloudify\(true\); \}[^\n]*\n/, ''));
applyCut('bossRoster ternary', t => t.replace(/ overgrowthOn\(\) \? OVERGROWTH_BOSSES : ascentOn\(\) \? ASCENT_BOSSES : skyfallOn\(\) \? SKYFALL_BOSSES : \[/, ' ['));
applyCut('buildLevel dispatch', t => t.replace(/    else if \(overgrowthOn\(\)\) levelHubs = buildOvergrowthNetwork\(padA\);\r?\n    else if \(ascentOn\(\)\) levelHubs = buildAscentNetwork\(padA\);\r?\n    else if \(skyfallOn\(\)\) levelHubs = buildSkyfallNetwork\(padA\);\r?\n/, ''));
for (const id of ['overgrowth', 'ascent', 'skyfall']) {
  applyCut('menu card ' + id, t => {
    const s = findLine(new RegExp("\\{ id: '" + id + "', name:"), 0, t);
    const g = s && findLine(/^\s*glyph:/, s.hi + 1, t);
    if (!g) return t;
    return t.slice(0, s.lo) + t.slice(g.hi);
  });
}
applyCut('LEVELS filter', t => t.replace(
  /\/\/ Single player menu roster: user request 2026-10-29[^]*?const LEVELS = LEVELS_ALL\.filter\(lv => \['descent', 'overgrowth', 'ascent', 'skyfall'\]\.includes\(lv\.id\)\);/,
  "// Single player menu roster: only Lil Spasticism (user request 2026-10-31: Levels 2-4 archived, new levels to be built\n// from scratch under TODO.md's WORLD RULES). Rent's Due / Nostalgia Overdose / THE ARENAS / THE BETWEEN are NOT\n// deleted (code, LEVEL_DEFS entries and LEVELS_ALL cards all still exist) — filtered out here only, so this is a\n// one-line, fully reversible change if any of them are wanted back.\n// Archived levels' content vault: archive/levels/LEVELS-2-4-SALVAGE.md\nconst LEVELS = LEVELS_ALL.filter(lv => ['descent'].includes(lv.id));"));
applyCut('network wrappers', t => {
  const s = findLine(/\/\/ LEVEL 2 "THE OVERGROWTH": per the 2026-10-29 DELIVERABLES plan/, 0, t);
  const e = findLine(/function buildSkyfallNetwork\(exitAngle\) \{ return buildNetwork\(exitAngle, SKYFALL_SHAPE\); \}/, 0, t);
  if (!s || !e) return t;
  return t.slice(0, s.lo) + t.slice(e.hi);
});
applyCut('buildNetwork shape comment', t => t.replace(
  /  \/\/ `shape` \(LEVEL_SHAPES\.overgrowth\/ascent\/skyfall, see below\) replaces the default's uniform radial-band[^]*?which of its own 3 zones they get\) -/,
  "  // `shape` (optional — Lvl1 passes none; the archived Level 2-4 walkers are salvaged at archive/levels/) replaces the\n  // default's uniform radial-band scatter with a genuinely different per-universe spatial pattern (branching tree /\n  // switchback trail / archipelago). It only changes WHERE hubs are placed (and which of shape.zones they get) -"));
applyCut('buildNetwork islands comment', t => t.replace('archipelago shapes (Skyfall) deliberately space islands', 'islands-set shapes (shape.islands) deliberately space islands'));
applyCut('towerWindowCheck keys', t => t.replace("'bone', 'bubble', 'eiffel', 'roothollow', 'beastnest', 'sunkenstump', 'sporevault', 'canopytemple', 'hornetshive']", "'bone', 'bubble', 'eiffel']"));
applyCut('towerWindowCheck comment', t => t.replace(/Overgrowth's 6 forest dungeon keys added alongside Lvl1's own 6\./, "Lvl1's own 6."));
applyCut('zoneByName clause', t => t.replace(/ \|\| OVERGROWTH_ZONES\.find\(z => z\.name === nm\) \|\| ASCENT_ZONES\.find\(z => z\.name === nm\) \|\| SKYFALL_ZONES\.find\(z => z\.name === nm\)/, ''));
applyCut('boss rosters block', t => {
  const s = findLine(/\/\/ LEVEL 2 "THE OVERGROWTH" boss roster/, 0, t);
  if (!s) return t;
  const sk = findLine(/const SKYFALL_BOSSES = \[/, s.hi + 1, t);
  const end = sk && findLine(/^];$/, sk.hi + 1, t);
  if (!end) return t;
  return t.slice(0, s.lo) + t.slice(end.hi);
});
applyCut('zone arrays block', t => {
  const s = findLine(/\/\/ LEVELS 2-4's own 3-zone ladders/, 0, t);
  const hub = s && findLine(/const levelZoneForHub = /, s.hi + 1, t);
  if (!hub) return t;
  return t.slice(0, s.lo) + t.slice(hub.hi);
});
applyCut('shape walkers block', t => {
  const s = findLine(/\/\/ LEVELS 2-4's macro-shape generators/, 0, t);
  if (!s) return t;
  const szs = findLine(/const SKYFALL_SHAPE = \{/, s.hi + 1, t);
  const end = braceEnd(t, t.indexOf('{', szs.hi));
  return t.slice(0, s.lo) + t.slice(end + 2);
});
applyCut('pickAmbientZone branch', t => t.replace(/  if \(levelZones\(\)\) return levelZones\(\)\[2 - Math\.min\(2, Math\.max\(0, region \| 0\)\)\];\r?\n/, ''));
applyCut('zoneFor prefix', t => t.replace('const standardBiomes = levelZones() || ZONES.filter', 'const standardBiomes = ZONES.filter'));
applyCut('zoneForRegion prefix', t => t.replace(': levelZones() ? levelZoneForHub(i) : level <= 2', ': level <= 2'));
applyCut('ladderExtend restore', t => t.replace(
  'levelZones() ? levelZones()[Math.floor(R() * 3)] : ZONES[Math.floor(R() * ZONES.length)]) : (themeZones() ? themeZones()[2] : levelZones() ? levelZones()[2] : null)',
  'ZONES[Math.floor(R() * ZONES.length)]) : (themeZones() ? themeZones()[2] : null)'));

// ===== WRITE =====
if (failures.length) {
  console.log('FAILED — nothing written. Problems:');
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
fs.writeFileSync('archive/levels/salvage_code.txt', 'SALVAGE CODE — Levels 2-4 (removed from index.html 2026-10-31). Reference only: the levels\nthemselves are archived; follow the WORLD RULES in todo.md for anything new. Verbatim pre-cut sources.\n\n' + salvage.join('\n'));
fs.writeFileSync('index.html', text);
console.log('OK: index.html cut, salvage_code.txt written (' + salvage.length + ' sections).');

// ===== REPORT stragglers =====
const lines = text.split('\n');
lines.forEach((l, i) => { if (/overgrowth|OVERGROWTH|ASCENT_|SKYFALL_|ascentOn|skyfallOn|overgrowthOn|forestSites|alpineSites|skySites|rockify|cloudify|levelZone|buildOvergrowth|buildAscent|buildSkyfall/.test(l)) console.log(String(i + 1).padStart(5), l.trim().slice(0, 140)); });
for (const k of KEYS) {
  const cnt = (text.match(new RegExp(k, 'g')) || []).length;
  if (cnt) console.log('LEFTOVER KEY', k, cnt);
}
