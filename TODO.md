# SkyJump3D — Task List / Agent Handoff

> **Read this first.** Newest entries at the top. Append a dated log entry when you finish work.
> `index.html` is a single ES module (~17,320 lines). Search by function name; line numbers drift.
> Run `node perf/_synchk.cjs` after every edit; `node perf/_brace_scan.cjs` for brace balance.
> Boot a headless page via `perf/_asteroid_smoke.cjs` for anything touching `buildLevel`/multiplayer.
> Determinism is sacred: no `Math.random()` in seeded worldgen paths.

---

## 📍 Current Status (2026-10-31)

**All 4 main levels built & headless-verified:**
- **Descent** (Lvl1) — original sky-city, 6 dungeons (nest/house/shroom/bone/bubble/eiffel)
- **Overgrowth** (Lvl2) — forest theme, 6 dungeons (roothollow/beastnest/sunkenstump/sporevault/canopytemple/hornetshive), `trunkify()` reskin
- **Ascent** (Lvl3) — alpine theme, 6 dungeons (mineshaft/crystalgrotto/avalanchevault/eaglesaerie/deepcavern/frozenkeep), `rockify()` reskin
- **Skyfall** (Lvl4) — cloud theme, 6 dungeons (cloudcastle/skytemple/auroravault/thunderdock/floatingruin/lightningspire), `cloudify()` reskin

**Other completed levels:**
- **Rent's Due** — Kowloon block layout, 3 zones (Foreclosure/Condemned/Collections), 5 new enemies, 9 bosses, Rent Clock
- **Nostalgia Overdose** — pure linear highway, 3 zones (Sunset Strip/Tracking Error/Arcade Overdrive), CRT/VHS fog, warp pipes + bonus rooms + piranha plants, 7 easter eggs
- **The Between** (Phases 0–4 complete) — Canopy/Foundation, 6 dungeons (D1–D6), sanity system, gravity well, co-op, corruption bleed, 7 common enemies + 6 surreal uniques + 6 bosses
- **Arena / Deathmatch** — 4 archetypes × 6 chambers, mirror symmetry, void/lava/kill-pit fall rules, route-graph verified reachable

**Core systems working:** multiplayer (≤6 — `MAX_ROOM = 6` in server/server.js, host simulates enemies, COOP/PVP room mode), vehicles (DeLorean/bike), 7 weapons, hoverboard, grapple, gore (persistent decals), Fish Audio TTS voices, retro presets (PS1/N64/MODERN), F2 perf HUD, warp-pad fast travel, Moon + Alien Void + Mars + planet legs (Jupiter→Neptune)

**Not yet eyeballed on real GPU:** everything recent is headless-verified only (see P0 #3 below)

---

## 🧩 LEVEL IDENTITY — user direction (2026-10-31)

> User: levels 2–4 are still clones of Lvl1. **Mechanics should translate; architecture must not.**
> THE BETWEEN will most likely go unused as a standalone level, but its content may be reused elsewhere.

**What stays IDENTICAL across levels (shared runtime, not allowed to fork):** movement/physics, weapons, enemy
AI + `WALKER_STATS`/`AI_ALIAS`, the biome flag system (`weakJump`/`lowGrav`/`thermal`/`wind`/`ice` + dressSite),
vehicles, co-op (`universeCentre(slot)` spawn math + `activeStartHubs()` contracts), the 6-dunceon-count rule,
and the moon/space/hell-ladder depth requirement (per the levels' own HARD RULES).

**What must STOP being identical (the actual clone vectors, verified in code):**
1. **Fixed dungeon ring slots** — all four levels place their 6 dungeons on the same ring-node slots as Lvl1's
   own bone/bubble/eiffel/nest/house/shroom sites. Per level: redistribute the 6 dungeon anchors on a totally
   different geometry per level (branch knots along a trunk for Overgrowth; cave mouths along a switchback
   ridge for Ascent; separate drifting islands for Skyfall).
2. **The one `UNIVERSE_R = 600` ring of six spawn towers** (~937–954) is identical everywhere — for each level,
   hide the ring layout behind a level-specific `shape` walker (placement per slot, radii, and tower styles
   differ) while keeping `universeCentre(slot)` intact for netcode. A tower "on a ring" at the same coordinates
   as Lvl1's is the strongest clone tell.
3. **The shared `buildNetwork` pass sequence** (`buildFlow` → `buildCommons` → `buildHubPortalLoop`, ~5697) —
   each level should swap the pass order or replace one pass outright (a level with no Commons; a level whose
   branches are a single river; a bough-tree with zero street-grid).
4. **Platform family mix / vertical rhythm** — the same slab+plate histogram lands everywhere. Give levels
   different platform mutation pools (conveyor-heavy Overgrowth, ledge/run-heavy Ascent, drifting-crumble
   Skyfall) rather than only `trunkify`/`rockify`/`cloudify` reskins.

**WORLD RULES — user's 2026-10-31 brief, applies to ALL levels:**

A. **Every level carries ALL available biomes**, with depth constraints:
   - **Fire/hell biomes (Hellscape, Inferno) only below depth 1** — never near spawn heights or the upper
     regions. Enforce a hard depth gate in `zoneFor`/`pickAmbientZone`/`zoneForRegion`, not just the ladder.
   - **Underground caverns run down to rung -666, then hell takes over.** Rework `depthZoneFor` (~12832):
     today caverns only cover rungs 1–14 and Horror/Hellscape start at ~15 — make `DEPTH_ZONES.caverns`
     the band up to -666 (cycling cavern-style zone variants so it doesn't repeat flat), with the
     Horror/Hellscape/pentagram band only kicking in *below* -666. Keep the psychosis dial as overlay.

B. **Spawn differs per level** — not the same height, not the same location, not the same biomes around
   spawn. Per level: own start height (currently everything uses the same TOP-derived start hub), own
   neighbourhood biome ordering around `universeCentre(slot)` (start-zone roll seeded per level, e.g.
   Overgrowth wakes in jungle-adjacent Canopy, Ascent in Frozen, Skyfall in Storm Band), and own landmark
   visible from spawn. Netcode keeps `universeCentre`'s x/z contract.

C. **Every level has a moon, space planets, and 6 dungeons** — these four stay invariants.

D. **Varied platform shapes and sizes everywhere** — including on future biome platforms (not just the
   wild post-moon space platforms). Implement per-zone weighted shape/size pools in the platform builders
   (`addSlab` takes width/depth/height today — feed it per-zone histogram tables + occasional exotic
   geometry kinds), keeping zone assignment via colour/material untouched.

E. **The neutral-platform marker problem (needs a design decision — proposed here):** biomes are dictated
   by colour, but the wild space-route platforms use every colour AND every shape without affecting biome.
   Once biome platforms also go shape-crazy, “colour+shape = biome” no longer identifies anything.
   Proposed rule: **truth lives on the underside and the rim; the top face is decoration.**
   - Biome platform: zone-coloured underside cone/casing + a thin zone-coloured edge strip or additive
     halo on the rim (the existing `plate` colour resources go here).
   - Neutral/wild platform: **always** a stone/steel-grey underside + a hazard-stripe rim + **no**
     coloured edge glow — regardless of top colour or shape.
   That is material-based, so it scales to any future shape/size mix, and can be applied retroactively to
   the existing space-route platforms (a single styling change in their builder). Optionally stamp a tiny
   white `○` glyph on neutral plates as a second tell once players are trained.

F. **Randomize the bottom-ladder extension** — landing on the lowest rung extends by a **fixed 14**
   platforms today (`ladderExtend`, ~13538, `for (let k = 0; k < 14; k++)`). Change to a randomized count:
   current amount = minimum, **8× = maximum** (14–112 rungs per landing, rolled from the existing seeded
   `R()` chain so co-op determinism is preserved — do NOT use `Math.random()`). Performance guard: 112
   platforms in one tick will hitch — build them via the existing sliced/job (flushJobs) pattern or a few
   per frame, and let the enemy/coin dressing respect the existing budgets.

**The BETWEEN as a content library (rather than a level):** D1–D6 dungeon kits (VHS/GULLET/LIMINAL/FRACTAL
zones, sanity/observation/rewind-rewind mechanics, 6 surreal uniques + 6 bosses) are candidates to harvest:
the dungeon themes can become extra `farDungeon`-framework dungeons on the other levels (they already eat any
key via the per-key cosmetic branches), and the surreal uniques can appear as one-off set-piece encounters.
No code removal — it stays behind its existing menu filter.

**Process:** rework ONE level's spine first as the pattern (recommend Overgrowth — most different theme,
strongest existing hooks), verified by `perf/_layout_diff.cjs` PLUS a new sameness probe (dungeon-anchor
geometry + hub-angle histogram + pass-sequence fingerprint), headless-verified, then roll out per level.

---

## 🎯 P0 — Quick Wins (each ~1 session, no worldgen risk)

### 1. ~~Biome music table~~ — DROPPED (user 2026-10-31)
The user added their own soundtrack (19 shuffled, loudness-normalized mp3s in `music/track01..19`, loaded at ~13715). The `MUSIC` per-biome synth table at ~13738 is a separate metronome layer that plays *underneath* the playlist — user-owned, don't plan changes to it.

### 2. VOICE table completion
`VOICE` (~line 16590) covers 8 kinds only. Newer enemies silently fall back to `walker` voice/colour/name via `voiceKind` (~16597). Add one line per variant: pitch, rate, `col`, `who`. `col` should match the variant's kit colour (see `biomeAccent` map ~line 1243). Affected: demon, skeleton, glitchling, kaomoji, dinosaur, stalker, alien, duck, tapehead, crthead, cabinet, pixelghost, popstar, grandpa, etc.

### 3. Human-eyeball debt sweep (playtest pass, **no code**)
Everything recent is headless-verified only. One sitting in a real browser, checking:
- 18 new dungeon room props (Overgrowth/Ascent/Skyfall — do they read as themed?)
- Pussy Palace cloud-parting at ~15 m (reveal ramp feel, does it re-close?)
- Level macro-shapes in hand (Overgrowth boughs, Ascent switchbacks, Skyfall cluster bridges)
- Asteroid set-pieces from 5a5dfd0 (hop-stone pacing, loot density, beacon visibility)
- Viewmodel framing after `vmScene`/`vmCamera` near-clip fix
Log findings into this file per session convention.

### 4. Toast/banner polish + copy
- "KeyE" raw-keycode leak in block-placer toast
- HUD banner overlaps stats panel top-left (AUDIT bugs #2/#3)
- Toast + label tables (`clusterThemes` ~1732, `zoneLabel` ~1778) lack newer zones → generic "ZONE" labels

---

## ⚡ P1 — Performance Foundation (measure every step)

**Protocol (from PERFORMANCE_PLAN.md, non-negotiable):** one change per commit, before/after numbers from same device + same 3 reference scenes (spawn roof / arena fight / Alien Void), save baselines as `perf/baseline-<sha>.json`. Real-GPU F2 captures still missing — do one before starting.

### 5. Freeze static matrices (full)
Partially done: `scene` + `lvl` roots frozen (~line 842, ~934). Remaining win: after each `buildLevel`, set `matrixAutoUpdate=false; updateMatrix()` for every non-animated object. Determine the exempt list empirically (run 60 frames headless, record whose position/rotation/scale changes — movers, enemies, spinning pickups) instead of hard-coding. `updateMatrixWorld` measured 19.5 ms/call at 65k objects — single biggest CPU item.

### 6. Instance the static world
~59k meshes / 28.9k unique materials / 44.7k geometries.
- Platforms (slab/plate/under-cone/bullseye/springs) → 4–5 `InstancedMesh` + `setColorAt` (Alien route + asteroid debris already do this — pattern at ~3086, ~2758)
- Coins/ammo/hearts/weapon pickups (~8,242 items) → one InstancedMesh per type, update near-player instances only, `taken` hides instance
- Rails, road segments, halo boxes, ground pads → `mergeGeometries` per ~250 m cell (per-cell frustum culling stays free). One merged chunk exists at ~14895 (`noCull`)
- **Payoff:** delete platform distance-cull (CULL_R 290 / CULL_BIG_R 450) and keep full silhouette draw distance

### 7. Enemy streaming
~1,157 enemies alive at boot (~19 meshes each). Region budget (e.g. ~120 live within ~450 m): spawn on approach, despawn behind, keep per-arena `cleared` flags. Also fixes multiplayer snapshot weight (host simulates all). Cheap pre-step: shared per-variant materials (currently per-enemy `lam(...)`) and instanced aura/beacon/aggro-cone sets.

### 8. Adaptive resolution scaler
Target 60 fps from F2 frame-time ring: drop render scale 0.6–1.0 when avg > 18 ms for 1 s, recover slowly. `setPixelRatio(Math.min(dpr,2))*scale` already exists (~788) — just automate the dial. Consider FXAA when scaled instead of MSAA.

### 9. CDN fallback / robustness
Three.js comes from jsdelivr with no fallback (offline = blank page). Vendoring it (esbuild already in node_modules) also enables minification and module splitting; at minimum, add a second importmap fallback or inline error state.

---

## 🎨 P2 — Design & Feel (after perf, or interleaved)

### 10. Kaomoji / Glitch / Hellscape become real mechanics biomes
Currently cosmetic-only (AUDIT §3.2/3.3 has full designs). Highest-value items:
- **Kaomoji:** mochi squash-and-stretch bounce + face-mood escalation tied to HP/deaths
- **Glitch:** beat-reactive flickering/ghost platforms
- **Hellscape:** heat line + brimstone vents
Ship as small mechanics attached to existing zone flags (precedent: `weakJump`/`lowGrav`/`thermal`/`wind` already added for the 9 new zones — extend same matchers).

### 11. Warp destination list UI
Q-cycling works up to ~8 destinations, painful beyond. Small panel (list + nearest-first ordering) at warp pad, plus cap of ~1 checkpoint per region (they're chapter gates, not respawn-fast-travel).

### 12. Style meter
Unify bullseye / trick / kill combos into one multiplier with rank letters, banked on landing. Feeds from systems that already exist; no new verbs.

### 13. Death marker / banked-at-checkpoint
Souls-like one-shot warp to retrieve dropped loot; makes deaths interesting without softening the punishment.

### 14. Authored set-pieces + far landmarks
Readable route rhythm (reveal → gauntlet → climb → breather → boss) per chapter, plus 2–3 giant lit silhouettes visible from spawn. Cheap: they're static `noCull`-style objects once P1 #6 is done.

### 15. Biome-mechanics backlog / hybrids
AUDIT §3.4 (two overlapping noise fields, 6–8 curated hybrids, unify `zoneFor`/`biomeForRegion`/planet `biomes[]` into one `biomeAt(x,y,z)`). Design debt from three duplicated systems migrating toward one.

---

## 📦 Later / Opportunistic

- Boss-as-level, grapple/zipline, daily seeded run + leaderboard, photo/replay mode
- Full `PLAN-UNIVERSES` per-universe generation (six spawn slots exist; distinct mirror universes don't — decide if this survives contact with the 4-level plan or gets retired)
- `localStorage` key migration off `towerdrop.*` (cosmetic, only when names are stable)
- Rolling deploy reconnect: `npm run deploy:pages` when a playable milestone wants going live

---

## 📋 Standing Rules (repeated from repo docs — they keep getting broken)

1. Read this file's top entry before starting; append a dated log entry at the **TOP** when done.
2. `node perf/_synchk.cjs` after every edit; `node perf/_brace_scan.cjs` for brace balance; boot headless page via `perf/_asteroid_smoke.cjs` for anything touching `buildLevel`/multiplayer; never trust a "works" claim without probe output in the entry.
3. Determinism is sacred: no `Math.random()` in seeded worldgen paths (checked 2026-10-31 — currently clean, keep it that way).
4. Everything not yet eyeballed on a real GPU is explicitly marked as such above.

---

## 📝 Session Log

- **2026-10-31** [BUFFY] World-rules brief captured into the LEVEL IDENTITY section (A–F, docs only, no game code): all-biome coverage with fire/hell gated below depth -1 and caverns extended to -666 (rework `depthZoneFor` ~12832), per-level spawn height/location/neighbour-biomes, moon+planets+dungeons invariants, per-zone shape/size platform pools, the neutral-platform marker decision ("truth on the underside + rim, top face is decoration"), and randomized bottom-ladder extension (fixed 14 today at `ladderExtend` ~13538 → 14–112 via the seeded `R()` chain so co-op determinism holds, built through the sliced job pattern to avoid a hitch).

- **2026-10-31** [BUFFY] User direction captured into LEVEL IDENTITY section above (docs only, no game code): THE BETWEEN likely goes unused as a level but its content may be harvested (D1–D6 dungeon kits, VHS/GULLET/LIMINAL/FRACTAL zones, surreal uniques/bosses) — stays built behind its menu filter, zero code removed. Levels 2–4 remain clone-flavored because of 3 verified shared structures the 2026-10-30 shape rework never touched: the fixed dungeon ring-node slots (same slots as Lvl1), the identical `UNIVERSE_R = 600` six-tower ring (~937), and the same `buildFlow`→`buildCommons`→`buildHubPortalLoop` pass sequence (~5697). Plan: rework ONE level's spine as the pattern (recommended: Overgrowth) with per-level dungeon geometry + tower ring variation + platform-family diversity, verified with an extended sameness probe alongside `_layout_diff`, then roll the pattern out level-by-level. Mechanics stay shared; architecture stops being a re-skin. Also re-dropped the P0 music item (the concurrent rewrite had restored it) and renumbered nothing.

- **2026-10-31** [BUFFY] Deep doc-audit pass 2 (docs only, no game code): finished cross-referencing the docs the first pass only partially read (ENEMY_CONSISTENCY_REPORT, PLAN.md, uwu.txt transcript in full, PERFORMANCE_PLAN checklist, Phase handoff claims). Verified in code: the PLAN.md vehicle makeover **did** ship (`makeBikeMesh`/`makeBuggyMesh`/`updateVehicleFx` + the `prop.fx` {exhausts,lights,glowMats,body,steer} contract, ~14233-15008 — the plan's own "not yet present" note is stale); all THE BETWEEN Phase 2-4 handoff claims (BETWEEN_GRAV_MULT 0.35, 4 beacons with corruption/touched/downedPlayers/fast-travel via `betweenWarpCd`, Gravity Well + 6 anchors + moon launch, sanity grounding + D4 sanity, BETWEEN_ENEMY_ROSTER 7 commons, AI_ALIAS complete incl. duck, 6 surreal uniques + 6 bosses + D1-D6 update functions `updateVhsRewind`/`updateTheGullet`/`updateLiminalPools` via `swapArenaBoss`); `window.__ng.perf` instrumentation exists (opt-in, ~17069); soundtrack is the author's own 19 shuffled loudness-normalized mp3s (music/track01..19, ~13715 — the MUSIC per-biome synth table is a separate metronome layer and user-owned from here on). Fixed 2 more doc-vs-code drifts in this same commit: OVERVIEW controls table said "P retro preset" while code `KeyP` opens the multiplayer menu (~11524); the new todo's own "≤8" multiplayer claim vs `MAX_ROOM = 6` (server/server.js:20). Also annotated ENEMY_CONSISTENCY_REPORT's spawn-swarm row: it claimed a split-on-death onDeath hook that was never built (WALKER_STATS ~1203 still says `TODO: split-on-death`; the §7.2 rework already turns each spawn-swarm roll into a brood of 5 spawnlings with no mother body, ~2203).

- **2026-10-31** [BUFFY] Doc audit + repo cleanup: read all 20 root handoff/plan/audit docs, cross-referenced claims against current `index.html` (~17,320 lines), reorganized root (git mv, history preserved). Archived old `todo.md`/`nexsteps.md` to `archive/old_root_docs/`, rewrote this clean `todo.md`. Verified fixed bugs from AUDIT: Digit2/Rifle hotkey routes to weapon 1, window.onerror + unhandledrejection overlays exist, matrix-freeze partially landed. Confirmed still-open: MUSIC table missing Hellscape/Glitch/Kaomoji/Alien Void/Moon/Ride Park + level zones; VOICE covers only 8 kinds; static platform instancing + enemy streaming remain (P1 #6/#7).