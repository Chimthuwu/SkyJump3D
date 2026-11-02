// _wildwood_add.cjs — adds WILDWOOD (the jungle world) to index.html, from scratch, under todo.md WORLD RULES.
// Reverse of the 2026-10-31 level-2-4 cut pattern: every edit is an anchored, single-occurrence replace; the file is
// only written if EVERY anchor matched exactly once. Run: node archive/levels/_wildwood_add.cjs
// Verification after: node perf/_synchk.cjs && node perf/_parse_module.cjs && node perf/_smoke.cjs
const fs = require('fs');
const P = process.argv[2] || 'index.html';
let src = fs.readFileSync(P, 'utf8');
let ok = true;
const crlf = s => s.replace(/\n/g, '\r\n');      // index.html is CRLF; anchors/texts are written LF
const must = (s, name) => { const c = src.split(s).length - 1; if (c !== 1) { console.error('ANCHOR FAIL [' + name + '] count=' + c); ok = false; return false; } return true; };
const ins = (anchor, text, name) => { const A = crlf(anchor), T = crlf(text); if (must(A, name)) { src = src.replace(A, A + T); console.log('OK ' + name); } };
const rep = (anchor, text, name) => { const A = crlf(anchor), T = crlf(text); if (must(A, name)) { src = src.replace(A, T); console.log('OK ' + name); } };

// ---- E1: the level flag ----
ins("const overgrowthOn = () => false;", "\nconst wildwoodOn = () => levelDef.id === 'wildwood';      // WILDWOOD: the jungle world (trees, never box skyscrapers) — built 2026-11-03 from scratch under WORLD RULES", 'E1 wildwoodOn');

// ---- E2: LEVEL_DEFS entry ----
rep("between: { id: 'between' } };", "between: { id: 'between' }, wildwood: { id: 'wildwood' } };", 'E2 LEVEL_DEFS');

// ---- E3: zones + ladder + boss roster (declared before every consumer) ----
ins("// levelZones() (Levels 2-4's own zone ladders) archived 2026-10-31 — pattern documented in archive/levels/LEVELS-2-4-SALVAGE.md for future levels",
`
// ===================== WILDWOOD — the jungle world (2026-11-03, from scratch under WORLD RULES) =====================
// Trees, not skyscrapers: every building hub is a trunk with foliage tiers, the spawn roof is a canopy disc, and the
// six dungeon anchors are bough knots (NOT Lvl1's ring slots). Shared runtime untouched: physics, weapons, AI,
// vehicles, co-op, the 6-dungeon rule, moon + planets, and the hell ladder below rung -1 all stay exactly as they are.
const WILDWOOD_ZONES = [
  { name: 'Boughs', desc: 'sunlit branches and the first spiral boughs', top: '#1c2e14', mid: '#2f4a1c', bot: '#4a6b26', fog: 0x27401e, hemi: 0.75, hemiCol: 0xb8f0a0, sun: 0.85, sunCol: 0xf6ffd8, cloud: 0x9ecb8a, plate: 0x7aff4a, weather: 'leaves' },
  { name: 'Underleaf', desc: 'green dusk under the leaf ceiling — jump weak, grip soft', top: '#12200e', mid: '#1e3314', bot: '#2e4a1e', fog: 0x162614, hemi: 0.55, hemiCol: 0x8ad06a, sun: 0.5, sunCol: 0xd6f0b0, cloud: 0x6a9455, plate: 0x5adf3a, weather: 'spores', weakJump: true },
  { name: 'Rootmire', desc: 'the peat dark where the roots drink the dark', top: '#0a1208', mid: '#141f0e', bot: '#223016', fog: 0x0c140a, hemi: 0.4, hemiCol: 0x6a9a4a, sun: 0.32, sunCol: 0xb0d888, cloud: 0x3a5528, plate: 0x3ab84a, weather: 'mist', lowGrav: true },
];
const levelZones = () => wildwoodOn() ? WILDWOOD_ZONES : null;                      // wildwood's own 3-zone ladder (keeps moon + hell ladder, unlike themeZones())
const levelZoneForHub = i => levelZones()[Math.min(2, Math.floor(Math.max(0, i) / (2 + (level >> 1))))];
const WILDWOOD_BOSSES = [
  { variant: 'gorilla', biome: 'Boughs', name: 'BARK-CHIEF', color: 0x9bdf4a },
  { variant: 'dinosaur', biome: 'Boughs', name: 'THE FERN KING', color: 0x8ad84a },
  { variant: 'charger', biome: 'Underleaf', name: 'THE WILD BOAR', color: 0x5adf3a },
  { variant: 'gunner', biome: 'Underleaf', name: 'BLOWGUN HUNTER', color: 0x6aff9a },
  { variant: 'frozenStalker', biome: 'Rootmire', name: 'MIRE SHADE', color: 0x3ac8a8 },
  { variant: 'infernal', biome: 'Rootmire', name: 'PEAT EMBER', color: 0xd8a840 },
  { variant: 'stormWraith', biome: 'Boughs', name: 'GALE HARPIA', color: 0x9a8aff },
  { variant: 'stalker', biome: 'Underleaf', name: 'THE VINE STALKER', color: 0x4ad86a },
  { variant: 'shield', biome: 'Rootmire', name: 'ROOT WARDEN', color: 0x8a6a4a },
  { variant: 'stegosaurus', biome: 'Rootmire', name: 'THE MOSS COLOSSUS', color: 0x3ab84a },
];`, 'E3 zones+ladder+bosses');

// ---- E4: shape walker + network wrapper + tree builders ----
ins("function buildNetwork(exitAngle, shape) {",
`// ===================== WILDWOOD world shape + tree builders =====================
// WILDWOOD_SHAPE: a macro-shape own to this level — four spiral boughs per universe winding outward/upward, zone
// bands by rung (Boughs near spawn, Underleaf mid, Rootmire deep). Its commons-mid band also replaces Lvl1's dungeon
// pass outright (see commonsMidBuild), the required pass-sequence deviation; everything downstream stays shared code.
const WILDWOOD_SHAPE = {
  zones: WILDWOOD_ZONES,
  place(j, M, slot, rand) {
    const BOUGHS = 4, rung = Math.floor(j / BOUGHS), b = j % BOUGHS;
    const baseAngle = slot * 0.73 + b * (6.28318 / BOUGHS) + 0.5;
    const ang = baseAngle + rung * 0.21 * (b % 2 ? -1 : 1) + (rand() - 0.5) * 0.18;
    const dist = 88 + rung * 58 + rand() * 22;
    const zoneIdx = rung < Math.max(1, Math.ceil(M / BOUGHS / 3)) ? 0 : rung < Math.ceil(M / BOUGHS * 2 / 3) ? 1 : 2;
    return { ang, dist, zoneIdx };
  }
};
function buildWildwoodNetwork(exitAngle) { return buildNetwork(exitAngle, WILDWOOD_SHAPE); }

let _wwBarkTex = null, _wwLeafMats = null;
function wwBarkMat() {
  if (!_wwBarkTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
    g.fillStyle = '#5a3d24'; g.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 90; i++) { g.strokeStyle = i % 2 ? 'rgba(40,26,14,0.55)' : 'rgba(120,88,52,0.4)'; g.beginPath(); const x = Math.random() * 128; g.moveTo(x, 0); g.bezierCurveTo(x + 8, 32, x - 8, 96, x + 4, 128); g.stroke(); }
    const t = trackRetroTexture(new THREE.CanvasTexture(c)); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 8); _wwBarkTex = t;
  }
  return retroMaterial(new THREE.MeshLambertMaterial({ map: _wwBarkTex }));
}
function wwLeafMat(i) {
  if (!_wwLeafMats) _wwLeafMats = [0x3a8a2a, 0x5adf3a, 0x6bc24a, 0x2f6b1e].map(col => retroMaterial(new THREE.MeshLambertMaterial({ color: col })));
  return _wwLeafMats[i % 4];
}
// the giant mother-trees players spawn on: trunk, root flare, branch shelves, canopy blobs (visuals only — the spawn
// solid + spawn point stay exactly where every other level puts them, so co-op's x/z contract is untouched)
function buildWildwoodHomeTree(hx, hz, top) {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(TH * 0.72, TH * 1.1, top, 10), wwBarkMat());
  trunk.position.set(hx, top / 2, hz); scene.add(trunk);
  for (let i = 0; i < 7; i++) {
    const a = i * 6.283 / 7 + 0.2;
    const root = new THREE.Mesh(new THREE.ConeGeometry(TH * 0.34, TH * 1.9, 5), wwBarkMat());
    root.position.set(hx + Math.cos(a) * TH * 0.95, TH * 0.7, hz + Math.sin(a) * TH * 0.95);
    root.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5); scene.add(root);
  }
  for (let i = 0; i < 4; i++) {
    const y = top * (0.32 + i * 0.15), a = i * 2.3;
    const shelf = new THREE.Mesh(new THREE.CylinderGeometry(TH * (0.62 - i * 0.09), TH * (0.52 - i * 0.07), 1.4, 9), wwLeafMat(i));
    shelf.position.set(hx + Math.cos(a) * TH * 1.5, y, hz + Math.sin(a) * TH * 1.5); scene.add(shelf);
  }
  for (let i = 0; i < 9; i++) {
    const a = i * 6.283 / 9 + 0.3;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(TH * (0.34 + (i % 3) * 0.1), 0), wwLeafMat(i));
    blob.position.set(hx + Math.cos(a) * TH * 1.05, top + 1.5 + (i % 3) * 2.2, hz + Math.sin(a) * TH * 1.05); scene.add(blob);
  }
}
// jungle building hub: trunk + foliage tiers + canopy roof — the same solid/interior contract as buildBuildingHub
function buildWildwoodTreeHub(cx, cz, w, d, h, zone) {
  const s = addSolid(cx - w / 2, cx + w / 2, 0, h, cz - d / 2, cz + d / 2);
  const trunkR = Math.min(w, d) * 0.42;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(trunkR * 0.72, trunkR, h, 9), wwBarkMat());
  trunk.position.set(cx, h / 2, cz); scene.add(trunk);
  const tiers = 2 + (rand() * 3 | 0);
  for (let i = 0; i < tiers; i++) {
    const ty = h * (0.28 + 0.6 * i / Math.max(1, tiers - 1));
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(trunkR * (2.4 + rand() * 1.3) * (1 - i / (tiers + 3)), 0), wwLeafMat((rand() * 4) | 0));
    blob.position.set(cx + (rand() - 0.5) * trunkR * 2.4, ty, cz + (rand() - 0.5) * trunkR * 2.4);
    blob.rotation.set(rand() * 3, rand() * 6.28, rand() * 3); scene.add(blob);
  }
  const c = zone ? zone.plate : 0x7aff4a;
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(w, d) * 0.62 + 0.4, Math.min(w, d) * 0.68 + 0.4, 0.4, 12), lam(c, { emissive: c, emissiveIntensity: zone ? 0.45 : 0.55 }));
  roof.position.set(cx, h + 0.1, cz); scene.add(roof); decorSites.push({ x: cx, z: cz, y: h, hw: w / 2, hd: d / 2, grp: null });
  const hub = { kind: 'building', x: cx, z: cz, top: h, hw: w / 2, hd: d / 2, w, d, zone, r: Math.max(w, d) / 2 + 3, roofSolid: s, roofMesh: roof, buildingMesh: trunk, mat: wwBarkMat(), bullMesh: null, opened: false, interior: null };
  s.building = true; s.hub = hub;
  buildingHubs.push(hub);
  trunk.userData.towerHub = hub;
  hub.bullMesh = addBullseye(cx, h + 0.2, cz, 2.2); coin(cx, h + 1.4, cz, zone);
  if (rand() < 0.5) {        // bounce pad to launch you toward the next tree
    const px = cx + w / 2 - 3, pad = addSolid(px - 2, px + 2, h, h + 0.4, cz - 2, cz + 2); pad.bounce = true;
    const pm = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 4), retroMaterial(new THREE.MeshLambertMaterial({ color: 0x7dff4a })));
    pm.position.set(px, h + 0.2, cz); scene.add(pm);
  }
  ammoBox(cx - 3, h + 0.8, cz + 3);
  if (rand() < 0.7) { const a = rand() * 6.283; makeWalker(cx + Math.cos(a) * trunkR * 1.8, h, cz + Math.sin(a) * trunkR * 1.8, s, 1, false, ['gorilla', 'dinosaur', 'charger', 'duck'][(rand() * 4) | 0]); }
  return hub;
}

`, 'E4 shape+builders');

// ---- E5: tree hubs replace box towers in wildwood ----
ins("function buildBuildingHub(cx, cz, w, d, h, zone) {", "\n  if (wildwoodOn()) return buildWildwoodTreeHub(cx, cz, w, d, h, zone);      // WILDWOOD: every tower is a living tree, never a box skyscraper", 'E5 tree-hub dispatch');

// ---- E6/E7: home towers become mother-trees (solid + weapons + props untouched) ----
rep(`    addSolid(hx - TH, hx + TH, 0, TOP, hz - TH, hz + TH);
    boxMesh(hx, hz, TH * 2, TH * 2, TOP, bldMats[0]);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(TH * 2 + 1, 0.2, TH * 2 + 1), roofMat);
    roof.position.set(hx, TOP + 0.1, hz); scene.add(roof);`,
`    addSolid(hx - TH, hx + TH, 0, TOP, hz - TH, hz + TH);
    if (wildwoodOn()) buildWildwoodHomeTree(hx, hz, TOP); else boxMesh(hx, hz, TH * 2, TH * 2, TOP, bldMats[0]);
    const roof = wildwoodOn()
      ? new THREE.Mesh(new THREE.CylinderGeometry(TH * 1.42, TH * 1.55, 0.6, 12), wwLeafMat(1))
      : new THREE.Mesh(new THREE.BoxGeometry(TH * 2 + 1, 0.2, TH * 2 + 1), roofMat);
    roof.position.set(hx, wildwoodOn() ? TOP + 0.3 : TOP + 0.1, hz); scene.add(roof);`, 'E6 home tree');

// ---- E8/E9: own seed + own spawn height ----
rep("betweenOn() ? 17003 : 0); gutVeins = 0;", "betweenOn() ? 17003 : wildwoodOn() ? 23011 : 0); gutVeins = 0;", 'E8 seed');
rep("TOP = nosOn() ? Math.min(220 + level * 30, 420) : Math.min(480 + level * 100, 1200);       // MUCH taller towers (Nostalgia Overdose is a road level: a short fall)",
    "TOP = nosOn() ? Math.min(220 + level * 30, 420) : wildwoodOn() ? Math.min(340 + level * 80, 760) : Math.min(480 + level * 100, 1200);       // MUCH taller towers (Nostalgia Overdose is a road level: a short fall; Wildwood keeps its own mid-tall canopy band)", 'E9 TOP');

// ---- E10: own spawn bearing on the canopy ----
rep("spawn.x = c.x + Math.cos(c.angle) * 10; spawn.z = c.z + Math.sin(c.angle) * 10; spawn.y = TOP;",
    "const sa = c.angle + (wildwoodOn() ? 2.4 : 0);      // wildwood spawns on its own bearing of the canopy (per-level spawn identity)\n    spawn.x = c.x + Math.cos(sa) * 10; spawn.z = c.z + Math.sin(sa) * 10; spawn.y = TOP + (wildwoodOn() ? 0.7 : 0);", 'E10 spawn bearing');

// ---- E11/E12: own boss roster + own boss-arena zone ----
rep(": arenaOn() ? ARENA_BOSSES : [", ": arenaOn() ? ARENA_BOSSES : wildwoodOn() ? WILDWOOD_BOSSES : [", 'E11 roster');
rep(": gutOn() ? GUT_ZONES[2] : ZONES[ZONES.length - 1], false);", ": gutOn() ? GUT_ZONES[2] : wildwoodOn() ? WILDWOOD_ZONES[2] : ZONES[ZONES.length - 1], false);", 'E12 boss arena zone');

// ---- E13: dispatch ----
rep("    else levelHubs = buildNetwork(padA);", "    else if (wildwoodOn()) levelHubs = buildWildwoodNetwork(padA);      // WILDWOOD: spiral-bough macro-shape\n    else levelHubs = buildNetwork(padA);", 'E13 dispatch');

// ---- E14: menu card + roster filter ----
ins("  { id: 'rent', name: \"Rent's Due\",",
`  { id: 'wildwood', name: 'Wildwood', subtitle: 'The jungle that ate the sky — spawn on a mother-tree canopy and climb out along spiral boughs. No skyscrapers anywhere.', unlocked: true, startFn: () => startLevelDef('wildwood'),
    glyph: '🌿', c1: '#12240c', c2: '#7aff4a', features: ['Spawn on a giant mother-tree canopy high above a green ocean', 'Every tower is a living tree — trunks, foliage tiers, canopy roofs', 'Six jungle dungeons on wildwood bough knots: Grove Heart, Mossdeep, Chrysalis, Bough Roost, Spore Garden, Vine Maze', 'Three zones: Boughs → Underleaf → Rootmire, with its own 10-boss gauntlet'] },
`, 'E14 menu card');
rep("const LEVELS = LEVELS_ALL.filter(lv => ['descent'].includes(lv.id));", "const LEVELS = LEVELS_ALL.filter(lv => ['descent', 'wildwood'].includes(lv.id));", 'E14 roster filter');

// ---- E15: zone-ladder wiring (ambient picker, descent zones, hub zones, ladder rolls, zoneByName) ----
ins("if (themeZones()) return themeZones()[2 - Math.min(2, Math.max(0, region | 0))];       // region rises with height, so region 0 (lowest) = Collections",
"\n  if (levelZones()) return levelZones()[2 - Math.min(2, Math.max(0, region | 0))];      // WILDWOOD: Boughs high, Rootmire deep", 'E15a pickAmbientZone');
ins("if (themeZones()) { const Z = themeZones(); return idx <= -72 ? Z[2] : idx <= -24 ? Z[1] : idx < 3 ? (idx <= -3 ? Z[0] : null) : Z[0]; }      // Rent's Due: the further down the ladder, the worse it gets",
"\n  if (levelZones()) { const Z = levelZones(); return idx <= -72 ? Z[2] : idx <= -24 ? Z[1] : idx < 3 ? (idx <= -3 ? Z[0] : null) : Z[0]; }      // Wildwood: Boughs on the surface, Underleaf on the way down, Rootmire in the peat dark", 'E15b zoneFor');
rep("const standardBiomes = ZONES.filter(zone => zone.name !== 'Psychedelic');", "const standardBiomes = levelZones() || ZONES.filter(zone => zone.name !== 'Psychedelic');", 'E15c standardBiomes');
rep(": level <= 2 ? ZONES.find(z => z.name === EARLY_BIOMES[(i + slot) % EARLY_BIOMES.length]) : biomeForRegion(level, region);",
    ": levelZones() ? levelZoneForHub(i) : level <= 2 ? ZONES.find(z => z.name === EARLY_BIOMES[(i + slot) % EARLY_BIOMES.length]) : biomeForRegion(level, region);", 'E15d zoneForRegion');
rep("themeZones() ? themeZones()[Math.floor(R() * 3)] : ZONES[Math.floor(R() * ZONES.length)]", "themeZones() ? themeZones()[Math.floor(R() * 3)] : levelZones() ? levelZones()[Math.floor(R() * 3)] : ZONES[Math.floor(R() * ZONES.length)]", 'E15e ladderExtend roll');
rep(": (themeZones() ? themeZones()[2] : null)", ": (themeZones() ? themeZones()[2] : levelZones() ? levelZones()[2] : null)", 'E15f ladderExtend band');
rep("|| ARENA_ZONE_LIST.find(z => z.name === nm) || null;", "|| ARENA_ZONE_LIST.find(z => z.name === nm) || WILDWOOD_ZONES.find(z => z.name === nm) || null;", 'E15g zoneByName');

// ---- E16: the Wildwood commons-mid band (replaces Lvl1's dungeon pass outright) ----
ins("  // ---- site 1: THE GIANT PUSSY (flesh nest + ball-chair arena) ----",
`  if (wildwoodOn()) {
    // ---- WILDWOOD: six jungle dungeons anchored on the level's OWN bough-knot geometry ----
    // WORLD-RULES de-clone: the knots are rolled from the level seed along three spiral boughs (angles, radii and
    // elevations all wildwood's own — nothing shared with Lvl1's ring slots). The pass itself replaces Lvl1's dungeon
    // pass outright (the required pass-sequence deviation); farMonument/farDungeon still do the shared plumbing so
    // mechanics translate.
    const DZ = (name, desc, plate, fog, topC, midC, botC, hemiCol, sunCol) => ({ name, desc, top: topC, mid: midC, bot: botC, fog, hemi: 0.72, hemiCol, sun: 0.8, sunCol, cloud: midC, plate, weather: 'none' });
    const GROVEHEART_ZONE = DZ('GroveHeart', 'a colossal hollow tree with a living core', 0x7adf3a, 0x233a14, '#101c0a', '#1c2e12', '#2c441c', 0xa8e878, 0xd8ffb0);
    const MOSSDEEP_ZONE = DZ('MossDeep', 'moss-swallowed root cells stacked in the dark', 0x3ac8a8, 0x14332c, '#0a1a16', '#12281f', '#1e3d2e', 0x78e0b8, 0xb0ffd8);
    const CHRYSALIS_ZONE = DZ('Chrysalis', 'a hanging cocoon vault of woven silk', 0xd8a8ff, 0x2a1c3a, '#150e20', '#241636', '#38244e', 0xc8a0f0, 0xe8d0ff);
    const BOUGHROOST_ZONE = DZ('BoughRoost', 'a nest-city in the fork of a dead bough', 0xe8c85a, 0x3a3012, '#1c1608', '#2c2410', '#42381a', 0xe8d088, 0xfff0b8);
    const SPOREGARDEN_ZONE = DZ('SporeGarden', 'a bioluminescent dell of glowing mushrooms', 0x5aff9a, 0x0e2a18, '#08140c', '#0f2314', '#18331f', 0x88ffb8, 0xc8ffd8);
    const VINEMAZE_ZONE = DZ('VineMaze', 'a floating knot of living vines', 0x6aff4a, 0x16300e, '#0c1608', '#14260e', '#203a16', 0x98f878, 0xd0ffb0);
    const KNOTS = [];
    for (let b = 0; b < 3; b++) {
      const baseA = 1.05 + b * (6.283 / 3) + (rand() - 0.5) * 0.5;
      for (let k = 0; k < 2; k++) {
        const a = baseA + (b % 2 ? 1 : -1) * k * 0.38 + (rand() - 0.5) * 0.16;
        const dist = 170 + b * 60 + k * 130 + rand() * 40;
        const y = commons.y + (k ? 130 : -120) + (rand() - 0.5) * 80;
        KNOTS.push({ a, x: CX + Math.cos(a) * dist, z: CZ + Math.sin(a) * dist, y });
      }
    }
    const forestSites = [
      { node: KNOTS[0], key: 'groveheart', zone: GROVEHEART_ZONE, col: 0x7adf3a, kinds: ['gorilla', 'dinosaur', 'charger'], deckLocal: 190, botLocal: -100, discR: 14, name: 'THE GROVE HEART' },
      { node: KNOTS[1], key: 'mossdeep', zone: MOSSDEEP_ZONE, col: 0x3ac8a8, kinds: ['duck', 'tapehead', 'grandpa'], deckLocal: 200, botLocal: -100, discR: 15, name: 'MOSSDEEP CELLS' },
      { node: KNOTS[2], key: 'chrysalis', zone: CHRYSALIS_ZONE, col: 0xd8a8ff, kinds: ['pixelghost', 'cabinet', 'popstar'], deckLocal: 170, botLocal: -100, discR: 16, name: 'THE CHRYSALIS' },
      { node: KNOTS[3], key: 'boughroost', zone: BOUGHROOST_ZONE, col: 0xe8c85a, kinds: ['stalker', 'frozenStalker', 'stormWraith'], deckLocal: 210, botLocal: -100, discR: 14, name: 'BOUGH ROOST' },
      { node: KNOTS[4], key: 'sporegarden', zone: SPOREGARDEN_ZONE, col: 0x5aff9a, kinds: ['kaomoji', 'glitchling', 'alien'], deckLocal: 220, botLocal: -100, discR: 13, name: 'SPORE GARDEN' },
      { node: KNOTS[5], key: 'vinemaze', zone: VINEMAZE_ZONE, col: 0x6aff4a, kinds: ['skeleton', 'demon', 'infernal'], deckLocal: 195, botLocal: -100, discR: 15, name: 'THE VINE MAZE' },
    ];
    console.log('[wildwood-mids] six jungle dungeons on bough-knot geometry');
    for (const ds of forestSites) {
      if (!ds.node) continue;
      const AD = farAnchor(ds.node, ds.key);
      const nx = Math.cos(AD.a), nz = Math.sin(AD.a);
      const X0 = AD.X0, Z0 = AD.Z0, y0 = AD.y0 + (ELEV[ds.key] || 0);
      if (AD.far) addSlab(X0, y0, Z0, 9, 9, 2.4, ds.zone, true);      // far land: the causeway's landing rim pad
      let bx = X0 + nx * 42, bz = Z0 + nz * 42, by = y0 - 10;         // the forecourt plaza where the dungeon ascent starts
      for (let mo = 42; blocked(bx, by, bz, 15) && mo <= 150; mo += 36) { bx = X0 + nx * mo; bz = Z0 + nz * mo; }
      if (blocked(bx, by, bz, 15)) { console.log(\`[wildwood-mids] \${ds.key} forecourt blocked at every outward nudge — site skipped this build\`); continue; }
      const hsteps = [];
      for (let k = 1; k <= 3; k++) {                                   // 3 hop-steps from the rim pad down to the plaza
        const sx = X0 + nx * (14 + k * 10), sz = Z0 + nz * (14 + k * 10), sy = y0 - 3 * k;
        if (blocked(sx, sy, sz, 4.2)) continue;
        hsteps.push({ x: sx, z: sz, y: sy, sl: addSlab(sx, sy, sz, 4.2, 4.2, 2, ds.zone, true) });
      }
      {
        let A2 = { x: X0, z: Z0, y: y0 };
        for (const B of hsteps) { addRail(A2.x, A2.z, A2.y + 1.35, B.x, B.z, ds.col, B.y + 1.35, false); addDashPad(A2.x, A2.y, A2.z, B.x - A2.x, B.z - A2.z); A2 = B; }
        addRail(A2.x, A2.z, A2.y + 1.35, bx, bz, ds.col, by + 1.35, false);
      }
      const plaza = addSlab(bx, by, bz, 12, 9, 2.6, ds.zone, true);
      const dl2 = makeLabel(ds.name); dl2.position.set(bx, by + 11, bz); dl2.scale.set(14, 3.5, 1); scene.add(dl2);
      const db2 = beacon(bx, by + 1, bz, ds.col);
      sites[ds.key] = { x: bx, z: bz, y: by, slabs: [...hsteps.map(h => h.sl), plaza] };
      if (AD.far) {
        db2.material.fog = false; db2.userData.noCull = true;
        farMonument(ds.key, bx + nz * 52, bz - nx * 52, by - 26, CX, CZ);      // spawn-visible giant monument
        farDungeon(ds.key, sites[ds.key], { x: bx, z: bz, y: by }, { x: bx + nz * 52, z: bz - nx * 52, base: by - 26 }, ds.zone, ds.col, ds.deckLocal, ds.botLocal, ds.discR);
      }
      if (AD.far) connectMid(ds.node, X0, Z0, y0, ds.zone, 9, 9);      // THE JOURNEY: full causeway from the bough knot to this land
      seedLeadChain(ds.key, bx, bz);
      // THE GARRISON: a standing watch on the forecourt and every few shaft landings — the jungle halls are never empty
      try {
        const sn2 = sites[ds.key];
        const seats = [plaza, ...(sn2.shaft || []).filter((_, i) => i % 5 === 0).map(s => s.slab)].filter(Boolean).slice(0, 7);
        for (const seat of seats) {
          const a = rand() * 6.283, r = 2 + rand() * 3;
          const e = makeWalker(seat.cx + Math.cos(a) * r, seat.top + 0.4, seat.cz + Math.sin(a) * r, seat, 1, false, ds.kinds[(rand() * ds.kinds.length) | 0]);
          if (e) { e.zone = ds.zone; e.midGuard = ds.key; e.neverDespawn = true; }
        }
      } catch (err) { console.warn(\`[wildwood-mids] \${ds.key} garrison seed failed\`, err); }
    }
    commons.mid = {};
    for (const ds of forestSites) if (sites[ds.key]) commons.mid[ds.key] = { ...sites[ds.key], dungeonOnly: true, gen: midGen++ };
    for (const ds of forestSites) if (commons.mid[ds.key]) commons.mid[ds.key].key = ds.key;
    {
      let farD = 0;      // the far lands live past the stock world edge: widen the bounds like the other far builders do
      for (const ds of forestSites) if (commons.mid[ds.key]) farD = Math.max(farD, Math.hypot(commons.mid[ds.key].x, commons.mid[ds.key].z));
      if (farD) { WORLD_R = Math.max(WORLD_R, farD + 320); camera.far = Math.max(camera.far, (farD + 400) * 1.7); camera.updateProjectionMatrix(); }
    }
    return;
  }
`, 'E16 wildwood dungeon pass');

// ---- E17: MID_DIST / ELEV entries for the six knots ----
rep("const MID_DIST = { nest: 2200, house: 1850, shroom: 2500, bone: 2050, bubble: 2650, eiffel: 2350 };",
    "const MID_DIST = { nest: 2200, house: 1850, shroom: 2500, bone: 2050, bubble: 2650, eiffel: 2350, groveheart: 2450, mossdeep: 2050, chrysalis: 2550, boughroost: 1900, sporegarden: 2200, vinemaze: 2600 };", 'E17 MID_DIST');
rep("const ELEV = { nest: 0, house: 190, shroom: -190, bone: 110, bubble: -150, eiffel: 200 };",
    "const ELEV = { nest: 0, house: 190, shroom: -190, bone: 110, bubble: -150, eiffel: 200, groveheart: 60, mossdeep: -40, chrysalis: 90, boughroost: 0, sporegarden: -70, vinemaze: 30 };", 'E17 ELEV');

// ---- E18: dressSite flavor layer (vines + glowing leaf clusters) ----
ins("  if (zone.name === 'Psychosis') {",
`  if (wildwoodOn()) {                                    // WILDWOOD flavor: hanging vines + glowing leaf clusters on every dressed surface
    const vm = MM('wwVine', () => lamC(0x2a8a3a)), vg = GG('wwVine', () => new THREE.BoxGeometry(0.12, 1, 0.12));
    for (let i = 0, c = n(1, big ? 5 : 2); i < c; i++) {
      const side = r() < 0.5;
      const x = side ? (r() < 0.5 ? -1 : 1) * site.hw : (r() * 2 - 1) * site.hw;
      const z = side ? (r() * 2 - 1) * site.hd : (r() < 0.5 ? -1 : 1) * site.hd;
      const len = 3 + r() * 6;
      const v = add(new THREE.Mesh(vg, vm), x, -len / 2 - 0.2, z); v.scale.set(1, len, 1);
    }
    const lm2 = MM('wwLeaf', () => lamC(0x7aff4a)), lg2 = GG('wwLeaf', () => new THREE.IcosahedronGeometry(0.4, 0));
    for (let i = 0, c = n(0, 3); i < c; i++) { const [x, z] = spot(); add(new THREE.Mesh(lg2, lm2), x, 0.3, z).scale.setScalar(0.5 + r() * 0.8); }
  }
`, 'E18 dressSite layer');

// ---- E19: the FAR LANDS GATE also covers the wildwood keys ----
rep("['nest', 'house', 'shroom', 'bone', 'bubble', 'eiffel'].some(k =>", "['nest', 'house', 'shroom', 'bone', 'bubble', 'eiffel', 'groveheart', 'mossdeep', 'chrysalis', 'boughroost', 'sporegarden', 'vinemaze'].some(k =>", 'E19 towerWindowCheck keys');

// ---- E20: farMonument exteriors for the six kinds ----
ins("const bx2 = new THREE.BoxGeometry(1, 1, 1), sp2 = new THREE.SphereGeometry(1, 9, 7), cy2 = new THREE.CylinderGeometry(1, 1, 1, 9), cn2 = new THREE.ConeGeometry(0.5, 1, 4);",
"\n    const wwb = lamF(0x6a4a2c, 0x382412, 0.3), wwm = lamF(0x3a8a2a, 0x1e5214, 0.45), wws = lamF(0xc8b0e8, 0x8a5ad0, 0.5), wwn = lamF(0x8a6a3a, 0x5a4018, 0.4), wwv = lamF(0x2a8a3a, 0x143a18, 0.5);      // wildwood dungeon exteriors", 'E20a monument mats');
rep("g.add(band);\n      }\n    }\n}",
`g.add(band);
      }
    } else if (kind === 'groveheart') {                 // colossal hollow tree, glowing heartwood core beating inside
      M(cy2, wwb, 0, 118, 0, 42, 236, 42, 0, 0.02);
      M(cy2, wwb, 0, 210, 0, 58, 70, 58, 0, 0.04);
      for (let i = 0; i < 7; i++) M(cn2, wwm, Math.cos(i * 0.9) * 44, 250 + (i % 2) * 14, Math.sin(i * 0.9) * 44, 26, 24, 26);
      const heart = M(sp2, glow(0xffb86a), 0, 118, 0, 16, 20, 16);
      for (let i = 0; i < 5; i++) M(cy2, wwb, Math.cos(i * 1.26) * 30, 150 + i * 24, Math.sin(i * 1.26) * 30, 10, 44, 10, 0, Math.cos(i) * 0.7);
    } else if (kind === 'mossdeep') {                   // moss-swallowed ruin: stacked root cells sinking into a peat mound
      for (let i = 0; i < 6; i++) {
        const r = 40 - i * 4;
        M(cy2, i % 2 ? wwm : wwb, (i % 2 ? -1 : 1) * (i - 2.5) * 4, 30 + i * 34, (i % 2 ? 1 : -1) * (i - 2.5) * 3, r, 30, r, i * 0.35, i * 0.2);
      }
      for (let i = 0; i < 8; i++) M(cn2, wwm, Math.cos(i * 0.785) * 26, 232 + (i % 3) * 10, Math.sin(i * 0.785) * 26, 16, 18, 16);
      for (let i = 0; i < 6; i++) M(sp2, glow(0x78ffb0), Math.cos(i) * 30, 40 + i * 36, Math.sin(i) * 30, 4, 4, 4);
    } else if (kind === 'chrysalis') {                  // a hanging cocoon vault: woven silk ellipsoid on root cables
      for (let i = 0; i < 4; i++) { const cbl = M(cy2, wwb, Math.cos(i * 1.57) * 34, 140, Math.sin(i * 1.57) * 34, 6, 200, 6, 0, 0.5); cbl.rotation.x = Math.cos(i) * 0.6; }
      M(sp2, wws, 0, 120, 0, 34, 62, 34, 0, 0);
      M(sp2, glow(0xd8a8ff), 0, 120, 0, 12, 20, 12, 0, 0);
      for (let i = 0; i < 6; i++) M(sp2, wws, Math.cos(i) * 22, 70 + i * 22, Math.sin(i) * 22, 8, 12, 8);
    } else if (kind === 'boughroost') {                 // nest-city in a dead bough fork: great limbs cradling woven nest domes
      M(cy2, wwb, 0, 90, 0, 30, 180, 30, 0, 0.05);
      M(cy2, wwb, 44, 150, 0, 12, 120, 12, 0, 1.1);
      M(cy2, wwb, -40, 170, 12, 12, 140, 12, 0, -0.9);
      for (let i = 0; i < 5; i++) M(sp2, wwn, Math.cos(i * 1.26) * 34, 150 + (i % 3) * 26, Math.sin(i * 1.26) * 34, 16, 10, 16);
      for (let i = 0; i < 8; i++) M(cn2, glow(0xe8c85a), Math.cos(i * 0.785) * 40, 120 + (i % 4) * 30, Math.sin(i * 0.785) * 40, 3, 8, 3);
    } else if (kind === 'sporegarden') {                // bioluminescent dell: a rim of giant glowcaps over a spore basin
      M(cy2, wwb, 0, 40, 0, 50, 80, 50);
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 52 : 30, a = i * 0.628, x = Math.cos(a) * r, z = Math.sin(a) * r;
        M(cy2, wwb, x, 60 + (i % 3) * 24, z, 6, 70 + (i % 3) * 20, 6);
        M(sp2, wwm, x, 96 + (i % 3) * 24, z, 20 + (i % 4) * 5, 9, 20 + (i % 4) * 5);
      }
      M(sp2, glow(0x5aff9a), 0, 18, 0, 14, 8, 14);
    } else if (kind === 'vinemaze') {                   // a floating knot of living vines braided into a walkable tangle
      for (let i = 0; i < 14; i++) {
        const a = i * 0.45, r = 20 + (i % 4) * 8;
        M(cy2, wwv, Math.cos(a) * r, 60 + (i % 7) * 26, Math.sin(a) * r, 4, 90, 4, a, (i % 2 ? 1 : -1) * 0.8);
      }
      for (let i = 0; i < 5; i++) M(sp2, glow(0x6aff4a), Math.cos(i * 1.26) * 18, 80 + i * 30, Math.sin(i * 1.26) * 18, 6, 6, 6);
    }
}`, 'E20b monument kinds');

// ---- E21: farDungeon interior room-props for the six kinds ----
ins("              } else if (key === 'eiffel') {",
`              } else if (key === 'groveheart') {        // heartwood knot-lights orbiting each room
                const kk = lam(0xffb86a, { emissive: 0xffb86a, emissiveIntensity: 0.8 });
                for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), kk); b.position.set(room.x + Math.cos(i * 2.1) * 6, dy + 2.5 + i * 0.4, room.z + Math.sin(i * 2.1) * 6); b.userData.noCull = true; scene.add(b); }
              } else if (key === 'mossdeep') {          // moss drapes on the cell walls
                const mm2 = lam(0x3ac8a8, { emissive: 0x1a6a52, emissiveIntensity: 0.5 });
                const d = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 0.4), mm2); d.position.set(room.x, dy + 4.5, room.z); d.userData.noCull = true; scene.add(d);
              } else if (key === 'chrysalis') {         // silk cocoons strung across the rooms
                const ss = lam(0xd8a8ff, { emissive: 0x8a4ad0, emissiveIntensity: 0.6 });
                for (let i = 0; i < 2; i++) { const c2 = new THREE.Mesh(new THREE.SphereGeometry(1.1, 7, 5), ss); c2.scale.set(1, 1.6, 1); c2.position.set(room.x + (i ? 5 : -5), dy + 2.2, room.z); c2.userData.noCull = true; scene.add(c2); }
              } else if (key === 'boughroost') {        // feather totems by the room doors
                const ft = lam(0xe8c85a, { emissive: 0x8a6a10, emissiveIntensity: 0.5 });
                const t = new THREE.Mesh(new THREE.ConeGeometry(0.8, 3.4, 5), ft); t.position.set(room.x + 7, dy + 1.7, room.z); t.userData.noCull = true; scene.add(t);
              } else if (key === 'sporegarden') {       // glowing spore bulbs
                const sb = lam(0x5aff9a, { emissive: 0x5aff9a, emissiveIntensity: 0.9 });
                for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.55, 6, 5), sb); b.position.set(room.x + Math.cos(i * 1.57) * 7, dy + 1.2 + (i % 2) * 2.6, room.z + Math.sin(i * 1.57) * 7); b.userData.noCull = true; scene.add(b); }
              } else if (key === 'vinemaze') {          // braided vine columns
                const vv = lam(0x6aff4a, { emissive: 0x1a5214, emissiveIntensity: 0.5 });
                for (const sx of [-1, 1]) { const v2 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 7, 6), vv); v2.position.set(room.x + sx * 8, dy + 3.5, room.z); v2.rotation.z = sx * 0.18; v2.userData.noCull = true; scene.add(v2); }
`, 'E21 room props');

// ---- E22: the seven per-key trim chains ----
rep(": key === 'eiffel' ? 'THE EIFFEL CANARD · CLIMB THE TOWER, DESCEND THE CELLAR' : 'GRAND SHROOM · CLIMB THE STEM, DESCEND WITHIN'",
    ": key === 'eiffel' ? 'THE EIFFEL CANARD · CLIMB THE TOWER, DESCEND THE CELLAR' : key === 'groveheart' ? 'GROVE HEART · CLIMB THE BARK, DESCEND THE CORE' : key === 'mossdeep' ? 'MOSSDEEP CELLS · CLIMB THE MOUND, SINK THE CELLS' : key === 'chrysalis' ? 'THE CHRYSALIS · CLIMB THE CABLES, DESCEND THE SILK' : key === 'boughroost' ? 'BOUGH ROOST · CLIMB THE FORK, DESCEND THE NEST' : key === 'sporegarden' ? 'SPORE GARDEN · CLIMB THE STEMS, DROP INTO THE DELL' : key === 'vinemaze' ? 'THE VINE MAZE · CLIMB THE TANGLE, DESCEND THE KNOT' : 'GRAND SHROOM · CLIMB THE STEM, DESCEND WITHIN'", 'E22 routeHeading');
rep(": key === 'eiffel' ? 'THE EIFFEL CANARD · CLIMB ↑' : 'GRAND SHROOM · CLIMB ↑'",
    ": key === 'eiffel' ? 'THE EIFFEL CANARD · CLIMB ↑' : key === 'groveheart' ? 'GROVE HEART · CLIMB ↑' : key === 'mossdeep' ? 'MOSSDEEP · CLIMB ↑' : key === 'chrysalis' ? 'CHRYSALIS · CLIMB ↑' : key === 'boughroost' ? 'BOUGH ROOST · CLIMB ↑' : key === 'sporegarden' ? 'SPORE GARDEN · CLIMB ↑' : key === 'vinemaze' ? 'VINE MAZE · CLIMB ↑' : 'GRAND SHROOM · CLIMB ↑'", 'E22 sign');
rep(": key === 'eiffel' ? 'ENTREZ ICI · DOWN ↓' : 'RABBIT STEM · DESCEND ↓'",
    ": key === 'eiffel' ? 'ENTREZ ICI · DOWN ↓' : key === 'groveheart' ? 'GROVE HEART · DOWN ↓' : key === 'mossdeep' ? 'MOSSDEEP · DOWN ↓' : key === 'chrysalis' ? 'CHRYSALIS · DOWN ↓' : key === 'boughroost' ? 'BOUGH ROOST · DOWN ↓' : key === 'sporegarden' ? 'SPORE GARDEN · DOWN ↓' : key === 'vinemaze' ? 'VINE MAZE · DOWN ↓' : 'RABBIT STEM · DESCEND ↓'", 'E22 dlbl');
rep(": key === 'eiffel' ? 0xd9b878 : 0xc9a981,", ": key === 'eiffel' ? 0xd9b878 : key === 'groveheart' ? 0x6a4a2c : key === 'mossdeep' ? 0x2a6a58 : key === 'chrysalis' ? 0x9a7ac8 : key === 'boughroost' ? 0xa88a3a : key === 'sporegarden' ? 0x3a8a5a : key === 'vinemaze' ? 0x3a9a2a : 0xc9a981,", 'E22 detailMat');
rep(": key === 'eiffel' ? 0xb8905a : 0xc34a70,", ": key === 'eiffel' ? 0xb8905a : key === 'groveheart' ? 0x7a5638 : key === 'mossdeep' ? 0x3a7a68 : key === 'chrysalis' ? 0x9a7ad0 : key === 'boughroost' ? 0xa88a3a : key === 'sporegarden' ? 0x3a9a6a : key === 'vinemaze' ? 0x4a9a3a : 0xc34a70,", 'E22 ribMat');
rep(": key === 'eiffel' ? 'BAGUETTE BARRAGE' : 'SPORE VENT';", ": key === 'eiffel' ? 'BAGUETTE BARRAGE' : key === 'groveheart' ? 'SAP-GEYSER RUNE' : key === 'mossdeep' ? 'PEAT-BURST RUNE' : key === 'chrysalis' ? 'SILK-SEAL RUNE' : key === 'boughroost' ? 'FEATHER-GALE RUNE' : key === 'sporegarden' ? 'SPORE-BLOOM RUNE' : key === 'vinemaze' ? 'THORN-LASH RUNE' : 'SPORE VENT';", 'E22 hazardName');
rep(": key === 'eiffel' ? 0xffb020 : 0x47f3c2;", ": key === 'eiffel' ? 0xffb020 : key === 'groveheart' ? 0xffb86a : key === 'mossdeep' ? 0x3ac8a8 : key === 'chrysalis' ? 0xd8a8ff : key === 'boughroost' ? 0xe8c85a : key === 'sporegarden' ? 0x5aff9a : key === 'vinemaze' ? 0x6aff4a : 0x47f3c2;", 'E22 hazardColor');

if (!ok) { console.error('ABORT — no file written'); process.exit(1); }
fs.writeFileSync(P, src);
console.log('WROTE ' + P);
