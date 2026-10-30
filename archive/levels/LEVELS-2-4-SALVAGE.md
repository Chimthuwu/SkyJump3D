# Levels 2–4 content vault (removed 2026-10-31)

⛔ **HISTORICAL — not a spec to follow.** THE OVERGROWTH / THE ASCENT / SKYFLAY were removed from the game
(user request 2026-10-31: "all levels archived except lvl 1, start new levels from scratch").
This file exists ONLY as a salvage vault so their good content can be reused in NEW levels.

Any future level built from this vault MUST obey the WORLD RULES in `../TODO.md`
(LEVEL IDENTITY § — per-level spawn height/bearing, biome ordering, all-biomes coverage,
moons/planets/dungeons per level, fire/hell depth gating, non-clone layout, etc.).
**Known failure of the old builds:** they were deliberate clones of Lil Spasticism
(one shared `buildNetwork` graph, same 6-tower ring, same dungeon spots) with the look swapped.
Never resurrect that approach. The `place()` formulas below are reusable; the shared-verbatim-builder decision is not.

---

## 1. Level zone-ladders (3-zone palettes, mechanics keyed by per-zone flags)

Shape: same as `RENT_ZONES`/`NOS_ZONES` — kept outside the global `ZONES`, consumed by a
`levelZones()` accessor so moonless/below-zero/threshold logic stays untouched (keeps the real
moon/space column and the -1/-2 depth ladder). Mechanic flags are generic fields on the zone object;
the physics block reads them: `weakJump` (0.88× jump), `lowGrav` (0.7× gravity), `thermal`
(updrafts like Inferno), `wind` (Storm-style env wind), `ice` (slippery underfoot), `decay: 1..3`
(bonus crumble-rolls via `zoneCrumbleRoll`, tiers 0.22/0.42/0.62). **These flags are still live in
index.html — any new zone object can opt into them today.**

```js
const OVERGROWTH_ZONES = [
  { name: 'Canopy',    desc: 'sunlit boughs high above the forest floor - the branches give less underfoot', top: '#061f0a', mid: '#0f5c1e', bot: '#5a9a2c', fog: 0x123a16, hemi: 0.68, hemiCol: 0x9fe07a, sun: 0.68, sunCol: 0xd8f08a, cloud: 0x1c4a22, plate: 0x7aff4a, weather: 'leaves', weakJump: true },
  { name: 'Understory', desc: 'spore-light and hanging moss - the air itself is thinner down here', top: '#0a1208', mid: '#1c3a1a', bot: '#4a6a2e', fog: 0x16281a, hemi: 0.5, hemiCol: 0x8ad888, sun: 0.4, sunCol: 0xb8e08a, cloud: 0x1a2e1c, plate: 0x5aff8a, weather: 'spores', lowGrav: true },
  { name: 'Rootrot',   desc: 'the roots go on forever and most of them have given up holding anything together', top: '#0c0603', mid: '#241408', bot: '#5a3a18', fog: 0x1e1208, hemi: 0.4, hemiCol: 0xa07850, sun: 0.32, sunCol: 0xc09050, cloud: 0x1a1008, plate: 0x8a5a2a, weather: 'ash', decay: 2 },
];
const ASCENT_ZONES = [
  { name: 'Summit',    desc: 'black ice and thin air above the tree line - every ledge is slicker than it looks', top: '#02081a', mid: '#1a3a5a', bot: '#7ab8e0', fog: 0x1a3850, hemi: 0.6, hemiCol: 0xb0e0ff, sun: 0.55, sunCol: 0xe0f4ff, cloud: 0x2a4a68, plate: 0x9ae0ff, weather: 'snow', ice: true },
  { name: 'Cliffs',    desc: 'bare rock faces and a crosswind that never stops pushing', top: '#0a0e14', mid: '#283038', bot: '#5a6470', fog: 0x242a30, hemi: 0.5, hemiCol: 0xaab4c0, sun: 0.42, sunCol: 0xd0dce8, cloud: 0x303840, plate: 0x8a9aaa, weather: 'rain', wind: true },
  { name: 'Magma Core', desc: 'the mountain is hollow and it is on fire underneath - the heat slows your glide', top: '#140402', mid: '#5a1608', bot: '#c05a1a', fog: 0x3a1206, hemi: 0.55, hemiCol: 0xff9a4a, sun: 0.6, sunCol: 0xffb050, cloud: 0x4a1a0a, plate: 0xff6a2a, weather: 'embers', thermal: true },
];
const SKYFALL_ZONES = [
  { name: 'Storm Band', desc: 'the clouds are solid here and furious about it - constant crosswind, lightning overhead', top: '#06081a', mid: '#1c2850', bot: '#4a5aa0', fog: 0x1a2448, hemi: 0.5, hemiCol: 0x9ab0f0, sun: 0.4, sunCol: 0xb8c8ff, cloud: 0x222a4a, plate: 0x6a8aff, weather: 'rain', wind: true, lightning: true },
  { name: 'Clear Air',  desc: 'above the weather, where the air is thin and nothing weighs quite as much as it should', top: '#0a1830', mid: '#2a5a8a', bot: '#9adaf0', fog: 0x2a5068, hemi: 0.75, hemiCol: 0xcaf0ff, sun: 0.85, sunCol: 0xffffff, cloud: 0x3a6a90, plate: 0xaef0ff, weather: 'none', lowGrav: true },
  { name: 'Cloud Floor', desc: 'the bottom of the sky - everything down here is soft enough to land on', top: '#14101e', mid: '#3a2e4a', bot: '#cabce0', fog: 0x2a2238, hemi: 0.7, hemiCol: 0xe8d8ff, sun: 0.6, sunCol: 0xf0e0ff, cloud: 0xd8c8ea, plate: 0xe0d0ff, weather: 'none' },
];
```

Weather strings that existed: `leaves`, `spores`, `snow`, `rain`, `embers` (`weather:'embers'` maps
through `WEATHER`; `lightning` was a visual flag used by Storm-echo dressing).

---

## 2. Macro-shape formulas (`buildNetwork`'s generic `shape` param)

`buildNetwork(exitAngle, shape)` still supports a `shape` walker — each `place(j, M, slot, rand)`
maps hub want-list index j (0..M-1) in universe slot to `{ang, dist, zoneIdx}`; `shape.zones[zoneIdx]`
is the hub's zone; `shape.islands` (optional) triggers ring bridging of cluster representatives.
**Jump-off point for any new level's own shape.** The three stock walkers removed with the levels:

```js
const OVERGROWTH_SHAPE = { zones: OVERGROWTH_ZONES,   // branching tree: hubs climb outward rung by rung
  place(j, M, slot, rand) {        // in alternating boughs, so they read as separate limbs, not one ring.
    const BOUGHS = 5, rungsTotal = Math.ceil(M / BOUGHS);
    const b = j % BOUGHS, rung = Math.floor(j / BOUGHS);
    const baseAngle = slot * 0.73 + b * (6.28318 / BOUGHS);
    const ang = baseAngle + (b % 2 ? 1 : -1) * rung * 0.13 + (rand() - 0.5) * 0.2;
    const dist = 72 + rung * 54 + rand() * 20;
    const zoneIdx = rung < rungsTotal / 3 ? 0 : rung < rungsTotal * 2 / 3 ? 1 : 2;
    return { ang, dist, zoneIdx };
  } };
const ASCENT_SHAPE = { zones: ASCENT_ZONES,           // single switchback trail: zigzags left/right every leg
  place(j, M, slot, rand) {        // while net-drifting forward, winding around the massif.
    const leg = Math.floor(j / 2), legDir = (leg % 2 === 0) ? 1 : -1;
    const ang = slot * 0.73 + leg * 0.22 + legDir * 0.46 + (rand() - 0.5) * 0.1;
    const dist = 80 + j * 23 + rand() * 12;
    const thirds = Math.ceil(M / 3), zoneIdx = j < thirds ? 0 : j < thirds * 2 ? 1 : 2;
    return { ang, dist, zoneIdx };
  } };
const SKYFALL_SHAPE = { zones: SKYFALL_ZONES, islands: 5,   // archipelago: tight island clusters per universe,
  place(j, M, slot, rand) {        // spaced so buildNetwork force-bridges each island ring.
    const ISLANDS = 5, c = j % ISLANDS, k = Math.floor(j / ISLANDS);
    const clusterAngle = slot * 0.73 + c * (6.28318 / ISLANDS), clusterDist = 130 + c * 68;
    const ang = clusterAngle + k * 1.7 + (rand() - 0.5) * 0.5;
    const dist = clusterDist + 10 + k * 7 + rand() * 4;
    const zoneIdx = c < ISLANDS / 3 ? 0 : c < ISLANDS * 2 / 3 ? 1 : 2;
    return { ang, dist, zoneIdx };
  } };
```

---

## 3. Dungeon themes (18, via `farDungeon`/`farMonument`)

Pipeline used: `farAnchor(node,key)` → 9×9 rim pad → radiating detection for forecourt plaza
(bx = X0+nx*42, blocked-nudge to mo≤150) → 3 hop-steps (4.2×4.2 slabs, y0-3k) with rails+dash pads →
12×9 plaza + label + beacon → `farMonument(key, bx+nz*52, bz-nx*52, by-26, CX, CZ)` +
`farDungeon(...)` when far → `connectMid(...)` causeway → garrison seeding (7 seats: plaza +
every 5th shaft landing, `e.midGuard = key; e.neverDespawn = true`). **Go-through:** the pipeline
shape itself was fine; the clones were the problem. Reuse it, but the levels' dungeons must also
get real room-prop/hazard/boss branches (these 18 all fell through to the default teacup room).

Forest six (Overgrowth): keys on Lvl1's ring-node slots nest/house/shroom/bone/bubble/eiffel.

```js
const ROOTHOLLOW_ZONE = { name: 'RootHollow', desc: 'a hollow under the roots, thick with soil and old growth', top: '#2a1c0e', mid: '#4a3418', bot: '#6b5228', fog: 0x3a2a14, hemi: 0.68, hemiCol: 0xc8a868, sun: 0.7, sunCol: 0xe0b878, cloud: 0x5a4420, plate: 0x8a6a2a, weather: 'none' };
const BEASTNEST_ZONE = { name: 'BeastNest', desc: 'matted fur, old bones, and a den that is very much still used', top: '#241408', mid: '#5a3214', bot: '#a8601c', fog: 0x4a280e, hemi: 0.6, hemiCol: 0xd89a5a, sun: 0.65, sunCol: 0xff9a3a, cloud: 0x6a3c18, plate: 0xc87a2a, weather: 'none' };
const SUNKENSTUMP_ZONE = { name: 'SunkenStump', desc: 'a rotten giant stump, half-flooded, thick with moss', top: '#081c14', mid: '#143a28', bot: '#2a6248', fog: 0x0e2a1c, hemi: 0.58, hemiCol: 0x6ac89a, sun: 0.5, sunCol: 0x8ae8b8, cloud: 0x1c4a32, plate: 0x3a9a6a, weather: 'none' };
const SPOREVAULT_ZONE = { name: 'SporeVault', desc: 'a cathedral of fungus, spores drifting in shafts of light', top: '#1a0c24', mid: '#3a1a52', bot: '#7a3aa8', fog: 0x2a1240, hemi: 0.7, hemiCol: 0xc89aff, sun: 0.62, sunCol: 0xe0b8ff, cloud: 0x4a2270, plate: 0xb05aff, weather: 'none' };
const CANOPYTEMPLE_ZONE = { name: 'CanopyTemple', desc: 'a stone shrine swallowed by leaves, sun-dappled and silent', top: '#0a2410', mid: '#1c4a20', bot: '#4a8a3a', fog: 0x143a18, hemi: 0.74, hemiCol: 0x9adf7a, sun: 0.78, sunCol: 0xd8e878, cloud: 0x2c5a28, plate: 0x6ac84a, weather: 'none' };
const HORNETSHIVE_ZONE = { name: 'HornetsHive', desc: 'a vast paper comb, humming, every cell a little door', top: '#1c1404', mid: '#4a3408', bot: '#a87a14', fog: 0x3a2a08, hemi: 0.64, hemiCol: 0xe8c858, sun: 0.72, sunCol: 0xffd82a, cloud: 0x5a4210, plate: 0xe8a81a, weather: 'none' };
const ROOTHOLLOW_KINDS = ['gorilla', 'dinosaur', 'charger'];
const BEASTNEST_KINDS = ['dinosaur', 'stegosaurus', 'gorilla'];
const SUNKENSTUMP_KINDS = ['frog', 'frog', 'gorilla'];
const SPOREVAULT_KINDS = ['sporeling', 'capBrute', 'prismWraith'];
const CANOPYTEMPLE_KINDS = ['gorilla', 'frog', 'stegosaurus'];
const HORNETSHIVE_KINDS = ['drone', 'bomber', 'gunner'];
// site table (mini): [{node:nestNode, key:'roothollow', col:0x8a6a2a, deckLocal:190, botLocal:-100, discR:14, name:'ROOT HOLLOW'}, {houseNode,'beastnest',0xc87a2a,200,15,"BEAST'S NEST"}, {shroomNode,'sunkenstump',0x3a9a6a,170,16,'SUNKEN STUMP'}, {boneNode,'sporevault',0xb05aff,210,14,'SPORE VAULT'}, {bubbleNode,'canopytemple',0x6ac84a,220,13,'CANOPY TEMPLE'}, {eiffelNode,'hornetshive',0xe8a81a,195,15,"HORNET'S HIVE"}]
```

Alpine six (The Ascent): mineshaft/crystalgrotto/avalanchevault/eaglesaerie/deepcavern/frozenkeep.

```js
const MINESHAFT_ZONE = { name: 'MineShaft', desc: 'a played-out shaft, timber shoring, rail carts left where they stopped', top: '#1a1410', mid: '#3a2e22', bot: '#5a4a38', fog: 0x241c16, hemi: 0.5, hemiCol: 0xc8ae8a, sun: 0.46, sunCol: 0xe0b878, cloud: 0x3a2e1c, plate: 0x8a7858, weather: 'none' };
const CRYSTALGROTTO_ZONE = { name: 'CrystalGrotto', desc: 'a geode cracked open, every wall a forest of glittering spires', top: '#0a1430', mid: '#1c3a62', bot: '#3a6ab0', fog: 0x122450, hemi: 0.78, hemiCol: 0x9ad8ff, sun: 0.72, sunCol: 0xc8e8ff, cloud: 0x2a4a88, plate: 0x6ad0ff, weather: 'none' };
const AVALANCHEVAULT_ZONE = { name: 'AvalancheVault', desc: 'snowpack groaning overhead, the whole slope ready to let go', top: '#eef4fb', mid: '#cfe0f0', bot: '#9fbcd8', fog: 0xdcebf8, hemi: 0.95, hemiCol: 0xffffff, sun: 0.8, sunCol: 0xeaf6ff, cloud: 0xdcebf8, plate: 0xaecbe8, weather: 'none' };
const EAGLESAERIE_ZONE = { name: "EaglesAerie", desc: 'a windswept nest on the highest crag, the whole range spread below', top: '#0e1a3a', mid: '#24407a', bot: '#5a8ad0', fog: 0x16285a, hemi: 0.85, hemiCol: 0xbcd8ff, sun: 0.95, sunCol: 0xfff0c8, cloud: 0x2c4c8a, plate: 0x7aaaf0, weather: 'none' };
const DEEPCAVERN_ZONE = { name: 'DeepCavern', desc: 'the shaft gives out into a black void that swallows the lamplight', top: '#06050a', mid: '#14121c', bot: '#262232', fog: 0x0e0c16, hemi: 0.32, hemiCol: 0x8a86a0, sun: 0.22, sunCol: 0x9a8ac0, cloud: 0x1a1726, plate: 0x4a4468, weather: 'none' };
const FROZENKEEP_ZONE = { name: 'FrozenKeep', desc: 'a fortress carved from the glacier itself, blue ice for walls', top: '#081828', mid: '#123a56', bot: '#3a7a9a', fog: 0x0e2a3e, hemi: 0.8, hemiCol: 0xaee8ff, sun: 0.68, sunCol: 0xd8f4ff, cloud: 0x1c4a68, plate: 0x4ac4ea, weather: 'none' };
const MINESHAFT_KINDS = ['charger', 'skeleton', 'shield'];
const CRYSTALGROTTO_KINDS = ['prismWraith', 'kaomoji', 'alien'];
const AVALANCHEVAULT_KINDS = ['frozenStalker', 'frozenStalker', 'charger'];
const EAGLESAERIE_KINDS = ['drone', 'bomber', 'gunner'];
const DEEPCAVERN_KINDS = ['skeleton', 'cryptGhost', 'zombie'];
const FROZENKEEP_KINDS = ['frozenStalker', 'shield', 'skeleton'];
// site table (mini): [nestNode,'mineshaft',0x8a7858,190,14,'MINE SHAFT'], [houseNode,'crystalgrotto',0x6ad0ff,200,15,'CRYSTAL GROTTO'], [shroomNode,'avalanchevault',0xaecbe8,170,16,'AVALANCHE VAULT'], [boneNode,'eaglesaerie',0x7aaaf0,210,14,"EAGLE'S AERIE"], [bubbleNode,'deepcavern',0x4a4468,220,13,'DEEP CAVERN'], [eiffelNode,'frozenkeep',0x4ac4ea,195,15,'FROZEN KEEP']
```

Sky six (Skyfall): cloudcastle/skytemple/auroravault/thunderdock/floatingruin/lightningspire.

```js
const CLOUDCASTLE_ZONE = { name: 'CloudCastle', desc: 'a castle built from compacted cloud, battlements of solid mist', top: '#dce8f8', mid: '#b8d0ee', bot: '#8aa8d8', fog: 0xc8dcf4, hemi: 0.9, hemiCol: 0xffffff, sun: 0.75, sunCol: 0xfff8e8, cloud: 0xdce8f8, plate: 0xaec8ea, weather: 'none' };
const SKYTEMPLE_ZONE = { name: 'SkyTemple', desc: 'a golden temple adrift on a cloud bank, columns fading into haze', top: '#1a2a4a', mid: '#3a5a8a', bot: '#eac878', fog: 0x2a3a5e, hemi: 0.78, hemiCol: 0xcce0ff, sun: 0.85, sunCol: 0xffe8b0, cloud: 0xeadcc0, plate: 0xd8b878, weather: 'none' };
const AURORAVAULT_ZONE = { name: 'AuroraVault', desc: 'curtains of green and violet light rippling over a vault of glass', top: '#060818', mid: '#0e2838', bot: '#1a4a3a', fog: 0x0a1428, hemi: 0.6, hemiCol: 0x7af0c8, sun: 0.5, sunCol: 0xd85aff, cloud: 0x1a3a4a, plate: 0x5af0a8, weather: 'none' };
const THUNDERDOCK_ZONE = { name: 'ThunderDock', desc: 'a landing dock lashed by rolling storm clouds, air crackling before every strike', top: '#0a0e1a', mid: '#1c2438', bot: '#3a4258', fog: 0x121828, hemi: 0.5, hemiCol: 0x8ac8ff, sun: 0.6, sunCol: 0xd8e8ff, cloud: 0x2a3248, plate: 0x6ab4ea, weather: 'none' };
const FLOATINGRUIN_ZONE = { name: 'FloatingRuin', desc: 'a shattered ancient structure drifting apart, moss and mist in every crack', top: '#283038', mid: '#4a5258', bot: '#6a8a6a', fog: 0x3a4240, hemi: 0.55, hemiCol: 0xaabcac, sun: 0.4, sunCol: 0xc8d8c0, cloud: 0x4a5248, plate: 0x7a9a7a, weather: 'none' };
const LIGHTNINGSPIRE_ZONE = { name: 'LightningSpire', desc: 'a needle of a tower drawing every bolt from the storm above', top: '#0c0a20', mid: '#241848', bot: '#5a3ad8', fog: 0x180f38, hemi: 0.65, hemiCol: 0x9a8aff, sun: 0.7, sunCol: 0xd8c8ff, cloud: 0x2a1a4a, plate: 0x8a5aff, weather: 'none' };
const CLOUDCASTLE_KINDS = ['walker', 'shield', 'gunner'];
const SKYTEMPLE_KINDS = ['kaomoji', 'alien', 'raver'];
const AURORAVAULT_KINDS = ['raver', 'kaomoji', 'prismWraith'];
const THUNDERDOCK_KINDS = ['drone', 'bomber', 'gunner'];
const FLOATINGRUIN_KINDS = ['skeleton', 'cryptGhost', 'zombie'];
const LIGHTNINGSPIRE_KINDS = ['drone', 'stormWraith', 'bomber'];
// site table (mini): [nestNode,'cloudcastle',0xaec8ea,200,15,'CLOUD CASTLE'], [houseNode,'skytemple',0xd8b878,210,14,'SKY TEMPLE'], [shroomNode,'auroravault',0x5af0a8,220,13,'AURORA VAULT'], [boneNode,'thunderdock',0x6ab4ea,190,16,'THUNDER DOCK'], [bubbleNode,'floatingruin',0x7a9a7a,180,15,'FLOATING RUIN'], [eiffelNode,'lightningspire',0x8a5aff,230,14,'LIGHTNING SPIRE']
```

---

## 4. Boss rosters (same AI/pool as Lvl1's 10-champion shape, renamed/recolored)

Firebase: `scatterBosses` gives a biome-match bonus when `bossRoster.biome` equals the hub's zone name.

```js
const OVERGROWTH_BOSSES = [
  { variant: 'gorilla', biome: 'Canopy', name: 'THE CANOPY KING', color: 0x6adf4a },
  { variant: 'dinosaur', biome: 'Canopy', name: 'ROOT TYRANT', color: 0x9bdf2a },
  { variant: 'stegosaurus', biome: 'Canopy', name: 'BARKBACK', color: 0x4ab85a },
  { variant: 'stormWraith', biome: 'Canopy', name: 'THE GALE OAK', color: 0x6a9aff },
  { variant: 'charger', biome: 'Rootrot', name: 'THE KINDLING', color: 0xff6a2a },
  { variant: 'infernal', biome: 'Rootrot', name: 'EMBER STAG', color: 0xff8a3a },
  { variant: 'stalker', biome: 'Rootrot', name: 'THE HOLLOW MAN', color: 0xff2a4a },
  { variant: 'shield', biome: 'Rootrot', name: 'MOSSBACK WARDEN', color: 0xb0c08a },
  { variant: 'frozenStalker', biome: 'Understory', name: 'FROSTBARK', color: 0x6adfff },
  { variant: 'stegosaurus', biome: 'Understory', name: 'THE SPORE QUEEN', color: 0xd45aff },
];
const ASCENT_BOSSES = [
  { variant: 'frozenStalker', biome: 'Summit', name: 'THE RIME KING', color: 0x9adfff },
  { variant: 'frozenStalker', biome: 'Summit', name: 'GLACIER WIDOW', color: 0x6ab4da },
  { variant: 'dinosaur', biome: 'Summit', name: "THE PEAK'S OLD BONES", color: 0xaecbe8 },
  { variant: 'shield', biome: 'Cliffs', name: 'STONE SENTINEL', color: 0x8f887c },
  { variant: 'stalker', biome: 'Cliffs', name: 'THE CREVASSE', color: 0x4a4458 },
  { variant: 'stormWraith', biome: 'Cliffs', name: "THE SUMMIT'S BREATH", color: 0x7aaaf0 },
  { variant: 'gunner', biome: 'Cliffs', name: 'RIDGE SNIPER', color: 0x9adfff },
  { variant: 'charger', biome: 'Magma Core', name: 'THE AVALANCHE', color: 0xd89a4a },
  { variant: 'infernal', biome: 'Magma Core', name: 'MAGMA VEIN', color: 0xff6a2a },
  { variant: 'stegosaurus', biome: 'Magma Core', name: 'THE PRISM WYRM', color: 0xb05aff },
];
const SKYFALL_BOSSES = [
  { variant: 'stormWraith', biome: 'Storm Band', name: 'THE JETSTREAM', color: 0x7aaaf0 },
  { variant: 'drone', biome: 'Storm Band', name: 'THE SQUALL', color: 0x9adfff },
  { variant: 'bomber', biome: 'Storm Band', name: 'THUNDERHEAD', color: 0x6ab4ea },
  { variant: 'gunner', biome: 'Storm Band', name: 'CLOUDBREAKER', color: 0xd8e8ff },
  { variant: 'kaomoji', biome: 'Clear Air', name: 'THE AURORA FACE', color: 0x5af0a8 },
  { variant: 'prismWraith', biome: 'Clear Air', name: 'THE PRISM GALE', color: 0xb05aff },
  { variant: 'alien', biome: 'Clear Air', name: 'SKYBORNE VISITOR', color: 0xd85aff },
  { variant: 'shield', biome: 'Cloud Floor', name: 'THE CUMULONIMBUS', color: 0x8f887c },
  { variant: 'stalker', biome: 'Cloud Floor', name: 'THE VOID DRAFT', color: 0x4a4458 },
  { variant: 'raver', biome: 'Cloud Floor', name: 'DISCO ZEPHYR', color: 0xff5ad8 },
];
```

BIOME_ENEMIES entries (safe to re-add when a new level reintroduces the zones):

```js
Canopy: ['dinosaur', 'gorilla', 'stegosaurus', 'frog', 'frog', 'charger'],
Understory: ['sporeling', 'sporeling', 'prismWraith', 'capBrute', 'prismWraith'],
Rootrot: ['roach', 'roach', 'spider', 'skeleton', 'charger'],
Summit: ['frozenStalker', 'frozenStalker', 'shield', 'walker', 'drone'],
Cliffs: ['stormWraith', 'stormWraith', 'gunner', 'shield', 'drone'],
'Magma Core': ['infernal', 'infernal', 'charger', 'gunner', 'bomber'],
'Storm Band': ['stormWraith', 'stormWraith', 'gunner', 'drone', 'bomber'],
'Clear Air': ['alien', 'alien', 'drone', 'ufo', 'kaomoji'],
'Cloud Floor': ['raver', 'raver', 'drone', 'kaomoji', 'kaomoji'],
```

---

## 5. Whole-level building reskins (mechanism = `trunkify()`, Lvl1 keeps it for Jungle)

All three were the same mechanism: on toggle, for every `boxMesh` in `buildingBoxes` — swap
material to a texture and add capped accent meshes (≤220, skipped when foot < 10). Only the
texture/geometry differed. `trunkify()` itself stays in index.html (Jungle biome). The removed
"siblings" were:
- `rockify()` (Ascent): grey streaked rock canvas texture (`#5a5a62`/`#45484f`/`#6e7078` bands),
  crack strokes `#2a2a30`; peaks = shared `ConeGeometry(1,1.5,5)` in snow whites 0xf0f4ff/0xe0e8f8/0xd0dcf0.
- `cloudify()` (Skyfall): white puff-dotted cloud canvas texture; wisps = shared sphere geo,
  0xffffff/0xeaf2ff/0xd8e6fb lamberts, opacity 0.88.

Sites dressing (additive layers in `dressSite`, one per level, ran on EVERY site regardless of zone):
Overgrowth added hanging vines (0x3a7a3a swaying rods) + red mushroom caps; Ascent added trailing
icicles (addC 0xbcdcf4) + snow icosahedra; Skyfall added glowing wisp puffs (0xf0f6ff, op 0.55) +
spark octahedra (0xd8c8ff). Cheap and worth cloning for any new level's "everywhere" flavor pass.

`setZone`/`buildLevel` wiring pattern (for future levels needing forced reskins):

```js
{ const wantTrunks = !!(activeZ && activeZ.name === 'Jungle'); trunkify(false); if (wantTrunks) trunkify(true); }   // buildLevel rebuild-safety
// setZone (additive flavor layers above, or forced reskin as overgrowthForced here):
if (!interior) trunkify(<forced> || !!(z && z.name === 'Jungle'));
```

---

## 6. What else was removed and does NOT come back

- `LEVEL_DEFS` entries `overgrowth/ascent/skyfall`, their `*On()` gates, `levelZones()`,
  `levelZoneForHub()`, the `pickAmbientZone`/`zoneFor`/`zoneForRegion`/`ladderExtend` levelZones
  branches, the menu cards/filters, the build dispatch, the SKY_PROFILES keys, and the whole-level
  forced reskins — these were the clone infrastructure. Future worlds get their own identity via
  TODO.md's WORLD RULES instead.
- The 2026-10-29 DELIVERABLES acceptance criteria ("a player cannot tell they're not on Lvl1") is
  **void** — see the ⛔ banner on these levels' creation docs. Any new level must be genuinely
  distinct while keeping moon/planets/dungeons/co-op.
- `perf/_l234_probe.cjs` (headless L2-4 build probe) moved to `archive/levels/tools/`.
