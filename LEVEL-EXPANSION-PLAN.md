# LEVEL-EXPANSION-PLAN.md — SkyJump3D single-player levels + multiplayer arenas

Status: **PHASE 0 / GATE 0 — research + plan only. No game code has been written. `index.html` is untouched.**
Audited commit: `6a9f902` (`main`, `origin/main` and `claude/festive-volta-coj7vi` are identical; working tree clean).
Everything below marked **[measured]** was observed in a real headless-Chromium run on this machine; **[read]** means read from source; **[unverified]** means I could not confirm it and it must be verified before anyone relies on it.

---------------------------------------------------------------------

## 0. Where the brief and the repo disagree (read first)

| Brief says | Repo reality | Consequence |
|---|---|---|
| "Verify, do not trust this summary" | Summary is broadly right. Beach/Rave biomes, roof battles, blink/swing/spin platforms, Void Maw, six spawn towers, radar, batching, time-sliced jobs, warm-up screen, adaptive resolution, F2 perf HUD all exist **[read]**. "Nostalgia Overdose", Void Tower, Neon Foundry, Starfall, Citadel, Chaos Engine, Facing Worlds, Deck16, Longest Yard, Campgrounds, `LayoutProfile` appear nowhere in code or docs **[grep]**. | Nothing to reuse; nothing to collide with. |
| "Cloudflare Pages direct-upload; git push does not deploy" | README/TODO say so. **But** the repo root also contains a `wrangler.jsonc` (`name: skyjump3d`, `assets.directory: "."`, compat date 2026-10-19) that looks like a *Workers static-assets* deploy config, and `cloudflare/wrangler.jsonc` is a separate Worker+Durable-Object config (the relay at `skyjump3d.chimske.workers.dev`). Three deploy surfaces exist: Pages `sky-jump`, Worker relay, and a possible root Workers-assets project. | I **cannot** verify which are live from this sandbox (no Cloudflare credentials). Gate 6 deployment steps must be checked against the dashboard by the user or via `wrangler` with their token. I will not assert a deploy procedure from the docs alone. |
| "Existing tests / harness" | `perf/harness.cjs`, `smoke-universes.cjs`, `interior-test.cjs` hardcode `C:/Users/Serge/...` Windows paths, Edge, and a global puppeteer. | They do not run here. I wrote and ran a **portable Playwright+Chromium probe** (see §8) — headless works in this sandbox. |
| Game "loads three.js from jsdelivr" | The sandbox proxy returns 403 for jsdelivr. | Harness serves `three@0.160.0` (fetched via `npm pack`) through a Playwright route. Pure test infra; no game change. |
| "Checkpoints" are a level concept | **Death always respawns at the home tower** (`respawn()`, index.html:4360); touching a checkpoint only sets `checkpoint` and unlocks a **warp-pad destination** (`physicsStep` ~5716, `warpUnlock`). | SP levels need their own respawn rule. That is a shared-symbol hook (§5, region R3). |
| "Multiplayer-safe geometry" | Co-op is **host-simulated enemies + peer-to-peer positions** through a dumb JSON relay. Level sync is just `level` number → `seed = 11 + level*97`. There is **no match state, no frag/score, no arena concept** in the netcode. PvP exists only as `pvp`/`died` messages and home-tower safe zones. | Arena match logic (frags, timer, spawn choice, win) is new code, but the **relay needs no change** (§6). |

---------------------------------------------------------------------

---------------------------------------------------------------------

## 0.5 RECONCILIATION WITH THE `live` BRANCH (added during Gate 1 — read before anything else)

Phase 0 was audited on `main` (`6a9f902`). While working I found a second remote branch, **`origin/live`** (9 commits ahead of `main`, 29 files), and the TODO.md you uploaded is identical to `live`'s TODO. **`live` is the line you actually work on and deploy from; `main` is stale.** Several things the brief (and my Phase 0 audit) described as "does not exist yet" **already exist on `live`**, built with a different architecture:

| Brief/plan item | State on `live` |
|---|---|
| "Nostalgia Overdose does NOT exist" | **Exists** as `LEVEL_DEFS.nos`: a linear outrun-highway level (VHS/CRT theme, warp pipes, easter eggs, retro checker road). |
| Level select / registration | **Exists**: data-driven `LEVELS[]` + `LEVEL_DEFS` (+ `SP_ONLY_DESCENT` flag that currently hides everything but Lil Spasticism). Levels are `levelDef.id`-gated branches *inside* the one generator, not separate modules. |
| UT/Quake MP arenas | **Exists** as `LEVEL_DEFS.arena` (`THE ARENAS`): four closed chambers — Longest Yard, Deck, Camping Grounds, Facing Worlds — with spawn pads, rocket/rail/quad, documented fall behaviour, route-graph verifier (`perf/_smoke_arena.cjs`). |
| Rent's Due level | Exists (`LEVEL_DEFS.rent`). |
| Six universes (PLAN-UNIVERSES) | **Implemented** in `buildNetwork` (per-slot mini-cities) + `buildUniverseLinks`/`connectFar` bridges (TODO.md still says "not started" — stale). |
| 19-track soundtrack | Exists (`music/track01..19.mp3`, `scMusic`). |

**What I did about it:** merged `origin/live` into the working branch (`claude/festive-volta-coj7vi`), re-pointed my menu integration at `live`'s level-select (spec levels enter via `?spec=<id>` or a `LEVELS_ALL` entry that `SP_ONLY_DESCENT` currently hides), renamed nothing of yours, and re-ran every test on the merged tree.

**Consequences / open decisions for you (I did not guess):**
1. **Two different "Nostalgia Overdose"s now exist.** Yours (`nos`, highway) is untouched. My greybox is registered as *"Nostalgia Overdose — Compound (greybox)"* (`levels/od.js`, id `nostalgia-overdose`). Keep both, rename mine, or drop mine?
2. **Arenas (Gates 4–5):** `live` already ships four arena chambers inside the main generator. Building my separate `arenas/*.js` + `match.js` set would duplicate them. Recommendation: do **not** build parallel arenas; instead (a) QA the existing ones with the two-client test, (b) add match state (frags/timer/scoreboard) only if you want it, (c) add the two *original* arenas as new `archetype`s there if wanted.
3. **Other five SP levels (Void Tower, Neon Foundry, Starfall, Citadel, Chaos Engine):** still blocked on the Gate 1 approval, and on decision 1 (spec-module architecture vs. your `LEVEL_DEFS` branches).
4. **Deploy:** `live` is what Pages deploys. `main` should be fast-forwarded/merged from `live` only by you.

---------------------------------------------------------------------

## 1. Architecture as it actually exists [read + measured]

**One file.** `index.html` = 8,926 lines / 708 KB, one inline `<script type="module">` (line 267), Three.js r160 via importmap. ~434 top-level functions. Everything (state, physics, enemies, weapons, net, UI) is **module-scope** inside that one script — nothing is reachable from outside except `window.__ng` (a 100+ method dev hook).

**World model.**
- Global mutable collections reset each build: `solids` (AABB list, collision), `platforms`, `specials` (movers), `enemies`, `items`, `portals`, `props`, `decorSites`, `jobs`, `shots`, `decals`… (cleared in `buildLevel`, line ~3670).
- `lvl` = one `THREE.Group` that owns every per-level mesh. `buildLevel()` removes/disposes it, builds a new one, temporarily monkey-patches `scene.add = o => lvl.add(o)` so all `scene.add` calls inside builders land in `lvl`. (`inLevel(fn)` does the same for late/jobbed builds.)
- `buildLevel()` → shared reset → `buildLevelBody()` (line 3699). `buildLevelBody` is **the sky-city**: 6 home towers on a 600 m ring (`UNIVERSE_R`), `buildSky`, boss roster, street pad, perimeter arc, `buildNetwork` (hubs/arenas/buildings), `scatterBosses`, `generateMissions`, `buildHomeBase`×6, `buildSurroundings`, then time-sliced Mars/planet legs (`jobs`, `buildMarsRoute`, `buildPlanetLegGen`).
- Determinism: `seed = 11 + level*97`; global LCG `rand()` consumed **in build order** (any extra `rand()` call anywhere in the sky-city builder reshuffles the whole world). `missionRandom(x)` is an independent mulberry-style PRNG already used for isolated streams (planet legs, missions).
- Collision: `physicsStep` tests only `nearSolids` (75 m box around the player, refreshed every 20 m / 0.5 s / when `solids.length` or `solidsVer` changes) — so **arbitrarily large `solids` lists are cheap**, and a level far from the origin works. Player AABB `PW=0.45`, `PH=1.8`. Movers go through `moveSpecial`. Step-up ≤ 0.55 m.
- Culling: `cull` system hides far `lvl` children (`CULL_R 290 / BIG 450`); static platforms are baked into 160 m cell meshes (`MERGE_CELL`, `buildChunkMeshes`); matrices frozen on static roots; `adaptRes` scales render resolution.
- Bounds: `WORLD_R` radial clamp (line 5885), `camera.far`, `VOID_Y` death plane; **`voidLoop()` requires `moonInfo`** (sky-city only) — otherwise falling does nothing but kill.
- Single-player flow: menu `START` → `begin()`; `levelClear()` requires `endBosses` all dead; `nextLevel()` → `level++; buildLevel()`.
- Multiplayer: `net` object (index.html:7255). Relay (`server/server.js` Node `ws`, `cloudflare/worker.js` Durable Object per room name) is a **generic JSON broadcaster**: stamps `from`, assigns slot 0–5 and a host (lowest id), stores only `level` (set on `clear`), forwards any `{t:string,...}` ≤64 KB, supports directed `to`. Client `netMessage` switch handles `hi, join, leave, host, state, p, mission, snap, dmg, kill, es, ray, rkt, boom, pvp, slam, clear, died`. Host simulates enemies and broadcasts snapshots 10 Hz (+ full 5 s); late joiners get `state{level,snap}` from the host.
- UI: `#menu` with `menuMain` (START / MULTIPLAYER / EXIT) and `menuMulti` (HOST / JOIN / BACK).

**Baseline structural signature of the sky-city, level 1** [measured, headless Chromium + SwiftShader, 1280×800, ~7 s after START]:

| Metric | Sky-city L1 |
|---|---|
| solids (all / with platform top) | 5,886 / 4,680 |
| bounding box x, z | [-1346, 1281] × [-1365, 1400] (≈ 2.6 km × 2.8 km) |
| elevation range (platform tops) | -152 … 1,498 m |
| elevation histogram (per 100 m) | 0:141, 100:529, 200:1022, 300:680, 400:840, 500:1252, 600:39, 700–1200: ~15 each, 1300:46 (moon), -100:25, -200:9 |
| platform half-width histogram | <2: 407 · 2–4: 1,863 · 4–8: 2,211 · 8–16: 132 · 16+: 67 |
| enemies / items | 1,193 / 9,199 |
| `lvl` children / scene children | 19,654 / 14 |
| draw calls / triangles / geometries / textures (software GL, single frame) | 557 / 14.5 k / 427 / 10 |
| JS heap | ≈ 386 MB |
| route character | descent from tower roof through a disc-shaped hub network; vertical bulk 100–600 m; overwhelmingly small (2–8 m half-width) platforms |

These are **software-rendered numbers** (SwiftShader). They are valid for relative before/after comparison on the same machine; they are **not** real-GPU frame-time evidence and must never be presented as such.

---------------------------------------------------------------------

## 2. Mechanism decision: smallest safe registration/loading

### 2.1 Options considered

| Option | What it is | Verdict |
|---|---|---|
| **A. `LayoutProfile` wrapping the sky-city generator** | Parameterise `buildNetwork` / `buildLevelBody` by a layout object | **Rejected.** `buildLevelBody` and `buildNetwork` are entangled with ≥10 globals (`levelHubs`, `groundPad`, `endBosses`, `boss`, `moonInfo`, `missions`, `warp`, `TOP`, `starts`, `levelSeed`) and the global `rand()` order. `PLAN-UNIVERSES.md`'s `buildUniverse` refactor of the same function was planned and never landed — evidence that refactoring this generator is high-risk. A profile would also still produce a *sky-city* (hubs on a disc), which fails the anti-reskin rule by construction. |
| **B. Parallel "side world" at a far offset, sky-city stays alive** | Build the level at x=+30 000 in the same scene | **Rejected.** Doubles resident scene/solids/enemies (1,193 enemies tick/freeze), needs `WORLD_R`/sky/fog/cull overrides anyway, and leaves the sky-city simulating behind the player. |
| **C. Replace-the-body hook (chosen)** | Add one branch in `buildLevel()`: if a level/arena spec is active, call `buildSpecBody(spec)` **instead of** `buildLevelBody()`. Everything else in `buildLevel()` (reset of all globals, disposal of `lvl`, `scene.add` re-route, theme, gore) is reused as-is. | **Chosen.** Smallest diff in shared code (≈ 10 lines in `buildLevel`), reuses the proven teardown, cannot alter sky-city generation (the sky-city path is byte-for-byte the same when `activeSpec == null`). |

**Honest cost of C:** leaving a spec level back to the sky-city means a full `buildLevel()` rebuild (deterministic: `seed = 11+level*97`). Measure it at Gate 1 (load hitch is a QA metric); it can run behind the existing loading overlay. The player's sky-city *progress* (level number, score, best) is untouched because it lives in other globals; only transient world state is rebuilt (same as `nextLevel()` today).

### 2.2 Where the level code lives

Specs are **separate ES modules** `levels/*.js` and `arenas/*.js`, loaded lazily with dynamic `import()` *only when the player picks that level/arena*. Rationale vs. inlining in `index.html`:
- Five+ workers editing one 708 KB file guarantees conflicts; the repo's own docs already complain about two agents editing it concurrently.
- Zero parse/startup cost for players who never open a level; sky-city path is untouched.
- Each level file is independently revertible (`git revert` of one merge).

Costs, stated plainly:
1. **`file://` no longer works for levels** (browsers block module imports from `file://`). The base game keeps working from `file://`; only the level/arena menus need an HTTP origin (README already says "open through a static server"). Menu entries detect `location.protocol === 'file:'` and show "serve over http to play levels".
2. **`npm run cf:prep` must also copy `levels/` and `arenas/`** into `cf-public/`, otherwise production 404s every level. This is a shared-file edit (package.json) owned by the integration lead and covered by a Gate-1 smoke test that serves the *built* `cf-public/`.
3. Modules can't see module-scope symbols, so `index.html` hands them a **`kit`** object (§3.3) built from closures over the existing helpers. The kit is the *only* coupling surface and is versioned (`kit.version`).

### 2.3 Registration

`levels/registry.js` (integration-lead owned) is a static manifest — no side effects, no code from level files executed until selected:

```js
export const SP_LEVELS = [
  { id:'nostalgia-overdose', name:'Nostalgia Overdose', mode:'sp', load: () => import('./od.js') },
  // void-tower, neon-foundry, starfall, citadel, chaos-engine appended one line each, only after their gate passes
];
export const MP_ARENAS = [ /* { id, name, mode:'mp-arena', load } appended at Gate 4+ */ ];
```

Menu code reads `SP_LEVELS` **only** on the offline START path and `MP_ARENAS` **only** under MULTIPLAYER. They are two different arrays imported by two different UI handlers; there is no code path that lists one in the other's menu (this is the HARD SEPARATION rule enforced structurally, and by test T-SEP in §8).

---------------------------------------------------------------------

## 3. Data contract, lifecycle, kit

### 3.1 Spec (what a level/arena module default-exports)

```js
export default {
  id, name, mode,            // mode: 'sp' | 'mp-arena'
  layout,                    // string id of the layout (geometry owner)
  biome,                     // visual-only zone name (ZONES) — MUST NOT affect geometry
  version: 1,                // bumped whenever geometry changes (used in net handshake)
  perf: { maxSolids, maxMeshes, maxEnemies, maxLights, buildMsBudget },
  // all arrays are plain data; build() turns them into solids+meshes via kit
  geometry:    [...],        // boxes, ramps, cylinders, movers: {kind, x,y,z, w,h,d, ..., tags}
  connections: [...],        // declared traversal graph: {a,b,kind:'walk|jump|pad|lift|rail|glide', gap, dy}
  spawns:      [...],        // {x,y,z,yaw,team?,safeRadius}
  checkpoints: [...],        // sp only
  objectives:  [...],        // sp: {kind:'reach|kill|collect|activate', ...}; mp: flags/zones
  pickups:     [...],        // {type:'weapon|health|ammo|armor|powerup', id, x,y,z, respawnS}
  encounters:  [...],        // sp only: {at, trigger, wave:[{variant,n}]}
  jumpPads/lifts/teleporters: [...],   // mp (and sp) traversal devices
  build(kit),                // pure function of spec data + kit; deterministic
  activate(kit), update(kit,dt), reset(kit), dispose(kit),
};
```

### 3.2 Determinism / seed-safety / multiplayer safety rules (enforced by lint-in-test)

1. A spec's geometry is a **pure function of its own data**. It must not read `level`, `seed`, `levelSeed`, `Math.random`, `performance.now`, or call the global `rand()`. Any randomness comes from `kit.rng(specId + ':' + purpose)` (a `missionRandom` stream). Result: building a spec cannot perturb — and cannot be perturbed by — the sky-city seed stream.
2. **Biome ≠ geometry:** `biome` is applied only through `kit.applyBiome()` (sky/fog/colour/lights/materials). Geometry-affecting data lives only in `layout`/`geometry`. Test: build same layout under 3 biomes → identical geometry hash. Build two layouts under one biome → different hashes. (The brief's rule "changing layout must change geometry" is tested the same way.)
3. **Geometry hash** = FNV-1a over the sorted, rounded (0.01 m) `solids` + mover base transforms + pickup/spawn tables, computed by `kit.sig()`. Arena clients exchange `{arenaId, version, sigHash}` on join; mismatch → refuse to start the match and show a clear error (this turns "matching geometry" from an assumption into a runtime-checked invariant).
4. Level-owned things are registered through the kit (`kit.solid`, `kit.mesh`, `kit.pickup`, …) so `dispose` can release them; **shared** materials/geometries (`lam`, `unitDiscGeo`, retro materials, weapon meshes) are never disposed by a spec.

### 3.3 Lifecycle

`build` (inside `buildLevel`'s reset shell, `scene.add` already routed into `lvl`) → `activate` (place player at spawn, set checkpoint rule, start encounters/timers) → per-frame `update(dt)` → `reset` (respawn/checkpoint/restart: restore movers, pickups, encounters without rebuilding geometry) → `dispose` (called by the lead's hook *before* the next `buildLevel` tears `lvl` down: stop timers/audio, drop kit registrations, null module refs; geometries inside `lvl` are already disposed by `buildLevel`'s traverse — **spec must dispose anything it created outside `lvl`**, e.g. canvases/textures/audio nodes).

### 3.4 Kit surface (read-only wrappers over existing symbols — no weapon/enemy/vehicle/physics edits)

`kit.THREE`, `kit.solid(box)`, `kit.slab(...)` (wraps `addSlab`), `kit.bounce(...)`, `kit.mover(...)` (wraps the existing `specials` blink/swing/spin/orbit), `kit.checkpoint(...)`, `kit.pickup(type,...)` (wraps `weaponPickup`, `coin`, heart/ammo), `kit.enemy(variant,x,y,z,plat)` (wraps `makeWalker`), `kit.rng(tag)`, `kit.sky(opts)` (wraps `buildSky`/`setZone`), `kit.applyBiome(name)`, `kit.player` (get/set pos, vel, health — wrapping the existing globals), `kit.toast/showMsg`, `kit.sfx` (existing), `kit.net` (`send`, `onMessage(fn)`, `id`, `host`, `peers()`), `kit.clear(why,bonus)` (SP exit → returns to sky-city via `buildLevel()`), `kit.sig()`, `kit.cull.register(group)`.

---------------------------------------------------------------------

## 4. Guard points in existing code that assume a sky-city (inventory)

When `activeSpec != null` these sky-city assumptions are false. Each is a *shared-symbol* edit, listed with its sentinel region (§5). All are small guard clauses; none change behaviour when `activeSpec == null`.

| # | Symbol / line | Assumption | Spec-mode behaviour |
|---|---|---|---|
| G1 | `buildLevel` (3670) | always calls `buildLevelBody()` | branch to `buildSpecBody(activeSpec)` |
| G2 | `respawn()` (4360), `die()` (4369) text | always home tower | SP: `spec.checkpoints` last-touched (or spawn); MP: arena spawn selection |
| G3 | `voidLoop()` (5780), `VOID_Y` | needs `moonInfo`; falling loops via Moon corridor | spec: fall below `spec.killY` → G2 respawn |
| G4 | `WORLD_R` clamp (5885), `camera.far` | radial 1000+ m | spec sets its own bound via kit |
| G5 | `levelClear` (4809) | requires `endBosses` dead, `level+1`, `clear` net msg | spec exit uses `kit.clear` → `activeSpec=null; buildLevel()`; no `level` bump, no `clear` broadcast |
| G6 | `buildHomeBase`/warp pad/`generateMissions`/radar `myMissionHub` | home towers always exist | not built; radar/mission helpers already tolerate empty `levelHubs` (`(levelHubs||[])`) — verify |
| G7 | main loop tick | — | call `activeSpec.update(dt)` |
| G8 | menu | START/MULTIPLAYER only | add SP LEVELS (offline path) / ARENAS (under MULTIPLAYER) |
| G9 | `netMessage` `default` | unknown `t` ignored | forward to `kit.net` listeners (arena match messages) |
| G10 | `physicsStep` checkpoint branch (5716) | sets `checkpoint`, unlocks warp | unchanged; spec reads `checkpoint` via kit |
| G11 | `window.__ng` | dev hook | add `__ng.levels.{list,load,sig,state,goto}` for tests only |
| G12 | `applyNetSlot` / `hi`.slot | six home towers | arena rooms ignore home-tower slot logic (guard by `activeSpec`) |

Known unrelated defect that will bite arenas: **weapon key `2` is hijacked by the builder hand** (TODO.md). I will not fix it in this project unless approved; arena weapon-pickup tests select weapons via `__ng.giveWeapon`.

---------------------------------------------------------------------

## 5. File ownership (symbol-level) and sentinel regions

### 5.1 `index.html` — integration lead ONLY (workers may not touch it)

Every region is wrapped in sentinels so it can be reverted/located mechanically:

```
// >>> LEVELKIT:<REGION> BEGIN
// <<< LEVELKIT:<REGION> END
```

| Region | Location | Content | Owner |
|---|---|---|---|
| `STATE` | after `let lvl…`/`startHubs` (~line 676) | `let activeSpec=null, specModule=null`; flags | Lead |
| `KIT` | single block before `buildLevel` | construction of `kit` (closures over `addSolid`, `addSlab`, `weaponPickup`, `makeWalker`, `missionRandom`, `setZone`, …), `loadSpec(id)`, `enterSpec`, `exitSpec`, `buildSpecBody` | Lead |
| `BUILD-HOOK` | inside `buildLevel()` where it calls `buildLevelBody()` | `activeSpec ? buildSpecBody(activeSpec) : buildLevelBody()` + `spec.dispose` before teardown | Lead |
| `RESPAWN` | `respawn()`, `die()`, `voidLoop()` heads | G2/G3 guards | Lead |
| `BOUNDS` | `WORLD_R` clamp site | G4 | Lead |
| `CLEAR` | `levelClear` head | G5 | Lead |
| `TICK` | main loop | G7 | Lead |
| `MENU` | `#menu` HTML + menu handlers (~199, ~8617) | G8 | Lead |
| `NET` | `netMessage` default branch | G9 | Lead |
| `DEVHOOK` | after `window.__ng = {…}` | G11 | Lead |

Symbols that **no worker may modify at all** (read-only through kit): `physicsStep`, `playerUpdate`, `WEAPONS`/weapon firing functions, `makeWalker`/enemy AI/stats, vehicles/props/rails, `setZone` internals, `buildNetwork` & all sky-city builders, `buildSky`, batching/cull/jobs internals, `net` core, `WORLD`/`GRAV`/`TERM`/`PH`/`PW`.

### 5.2 Other files

| Path | Owner | Notes |
|---|---|---|
| `levels/registry.js`, `levels/kit-contract.md`, `levels/sig.js` (signature/hash/lint helpers shared with QA) | **A / Lead** | contract frozen at end of Gate 1a; changes need lead sign-off |
| `levels/od.js`, `docs/levels/nostalgia-overdose.md` | **B** | OD only |
| `levels/void-tower.js`, `neon-foundry.js`, `starfall.js`, `citadel.js`, `chaos-engine.js` + one design doc each | **C** | **blocked until Gate 1 approved and OD greybox passed** |
| `arenas/match.js` (frags, timer, spawn choice, scoreboard HUD, handshake) | **A** (infra) | uses `kit.net` only |
| `arenas/ut-*.js`, `docs/arenas/ut-*.md` | **D** | MP-only |
| `arenas/q3-*.js`, `arenas/orig-*.js`, docs | **E** | MP-only |
| `tests/**` (Playwright harness, signature tool, relay two-client test, evidence output scripts), `qa/REPORT.md` | **F** | F never edits product code |
| `package.json` (`cf:prep` copy list, `test:*` scripts), `README.md`, `TODO.md`, this plan | **Lead** | |
| `server/server.js`, `cloudflare/worker.js` | **nobody (no change planned)** | If a change becomes unavoidable it needs explicit user approval because it needs a separate Worker deploy |

---------------------------------------------------------------------

## 6. Multiplayer arena design (infrastructure, for Gate 4)

- **Separate mode, same relay.** An arena room is just a room whose first message exchange is `arena` handshake. Existing co-op rooms never see these messages (the new `default:` listener only fires for `t` values registered by an active arena match).
- Messages (all new `t` values, relayed verbatim): `arena{id,version,sig,cfg}` (host → all, and to late joiners via the existing `join` → `state` pattern extended with `arena`), `ready`, `frag{killer,victim,w}`, `match{state,timeLeft,scores}` (host authoritative, 1 Hz), `respawn{spawnIdx}`, `pickup{id,taken,at}` (host arbitrates taken/respawn timers to avoid double pickups).
- **PvP damage reuse:** shooter keeps using existing `hitPeer → pvp{to}`; **victim** applies damage (existing authority model) and on death broadcasts existing `died` plus `killer`. Arena code counts frags from those; no change to weapon code.
- **Enemies off** in arenas (`spec.encounters` is SP-only); host-simulation machinery stays idle.
- **No relay change** ⇒ no Worker redeploy risk. Late join: host sends `{arena, sig, match, pickups}`; joiner builds the arena from the *id* (not from the host's geometry), compares `sig`, then syncs state.
- Max 6 players (relay `MAX_ROOM`). Arena menu: pick arena → host creates room → share link (`?room=…&arena=id`). Joining via that link auto-loads the arena module before `begin()`.
- Home-tower safe-zone PvP rule (`pvpReceive`) must be read to confirm it doesn't suppress damage when `activeSpec` is an arena — verify in Gate 4 audit.

---------------------------------------------------------------------

## 7. Content plan (provisional — final designs are each worker's first deliverable)

### 7.1 Single-player — anti-reskin thresholds

Baseline (sky-city) numbers are in §1. A level is **new** only if, versus *every* existing level (sky-city and each previously accepted SP level), it differs materially on **at least 5 of these 7 axes**, *and* the route character differs:

| # | Axis | "Materially different" |
|---|---|---|
| 1 | Horizontal footprint (bbox area of solids) | ratio ≥ 2× or ≤ 0.5× |
| 2 | Elevation distribution (platform tops normalised) | Jensen–Shannon distance ≥ 0.25 on 20 bins **and** different dominant band |
| 3 | Platform count & size distribution | count ratio ≥ 2×/≤0.5× **or** median half-width differs ≥ 30 % and p90 differs ≥ 30 % |
| 4 | Branch / loop / intersection counts (from declared graph, cross-checked against solids) | differ by ≥ 3 in at least two of the three |
| 5 | Main-route gap distribution (gap length per edge) | two-sample KS ≥ 0.30 |
| 6 | Objective placement relative to start (horizontal distance, vertical delta, route-length ratio) | different quadrant of (Δy sign, route/straight-line ratio) **or** ≥ 40 % difference in either |
| 7 | Route topology class | not the same class: {descent, ascent, horizontal traverse, spiral, hub-and-spoke, vertical tower, ring/loop, vault/compound} |

Colour, material, lighting, biome, enemy skin, seed never count. Thresholds are **proposed**; I will report actual numbers at Gate 1 and ask you to ratify or tighten them.

### 7.2 Nostalgia Overdose — concept to be refined by Worker B (needs your steer)

*Fantasy (proposal):* a fever-dream of 90s/Y2K childhood scaled so the player is "toy-sized": three distinct spaces —
1. **The Arcade Mile** (horizontal traverse, ground-heavy): a long mall/arcade strip; cabinet tops, claw-machine cranes, ticket-counter bridges; wide platforms, long runs, shortcuts through vents.
2. **The Bedroom Stack** (vertical, ascent): a stacked room — bunk beds, shelves, CRT towers as pillars; precise climbing with vertical shortcuts; tallest section, small/medium platforms.
3. **The Rec-Tape Void / VHS Canyon** (loop + descent): looping track of rewinding tape ribbons and floating cartridge plates over a drop; the loop returns the player near the Bedroom Stack for a shortcut, objective at the end.

Footprint target ≪ sky-city (≈ 250 × 700 m, i.e. > 10× smaller than 2.6×2.8 km), elevation band 0–120 m, ~250–450 platforms, wide + medium platforms. Objective: collect N "power cells" in any order across the three spaces, then reach the exit. **Greybox only first** (boxes/ramps/pads/checkpoints/exit; flat unlit colours). Perf budget for OD greybox: ≤ 1,200 solids, ≤ 60 draw calls static (batched), 0 enemies until Gate 2. If you dislike this fantasy, say so at Gate 0 — it is cheap to change now and expensive after greybox.

*Other five (blocked):* each must pass §7.1 against OD and each other. Seeds to keep them apart (not final): **Void Tower** = narrow vertical ascent shaft (footprint tiny, elevation huge); **Neon Foundry** = horizontal industrial compound with conveyor/piston loops (many loops/intersections); **Starfall** = sparse long-gap glide course between asteroids (few platforms, huge gaps, glide-dependent); **The Citadel** = vault/compound with inner keep and multi-key objective (hub-and-spoke); **Chaos Engine** = ring with rotating/blinking mover segments (movement-heavy loop). The signature tool will reject any two that land near each other.

### 7.3 Multiplayer arenas — fidelity rules

I can't open Unreal Tournament/Quake level data here, and I will not claim topology from memory. **Worker D/E's first task is verification** (published level overviews / community documentation fetched at work time, cited in each arena doc). My recollection, **[unverified]**: *Facing Worlds* (UT CTF) = two mirrored fortress towers on opposing rock bases over open space with a long central connection; *Deck16][* (UT DM) = compact tech complex with a central lift/open vertical core and tight corridors; *The Longest Yard* (Quake III DM17) = floating platforms over a void with jump pads and a central spiral; *The Campgrounds* (Quake III DM6) = a compact multi-level brick/stone arena with a central courtyard and rail/launch spots. Each arena doc must list: verified topology, what we reproduce (relationships, route lengths, vertical structure, weapon/pickup distribution), what we change, and why. **Original geometry/materials only**, no ripped meshes, textures, audio or map files.

Open question for you (§10): ship them under the original map names, or under original names with "inspired by" in docs only? Names are third-party trademarks; layout inspiration is generally fine but you should decide.

Two original arenas (identity sketches): **"Spindle"** — vertical cylinder arena, spiral ramps + central lift, strong vertical sightlines, close weapon spread; **"Twin Yards"** — two broad plateaus over a void joined by jump pads and one narrow bridge, long sightlines, rail/heavy weapon on the contested bridge head. Each needs its own sightline/spawn-safety analysis in its doc, and passes the same signature-distinctness test against the other arenas.

---------------------------------------------------------------------

## 8. Test harness plan (Worker F; independent of builders)

### 8.1 Infrastructure [feasibility measured]
- Playwright 1.63 + bundled Chromium (`/opt/pw-browsers/chromium-1243`) launched headless with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`. **Verified:** loads `index.html`, reaches `state:'play'`, 5,886 solids, no page errors (only the intentionally aborted voice/net fetches). Cold start to play ≈ 14 s.
- three.js served from a local copy via route interception (sandbox blocks jsdelivr).
- Product served over **HTTP** (`http-server`/Python) so `levels/*.js` imports work; additionally a run against the built `cf-public/` to catch `cf:prep` omissions.
- Harness-only debug exposure (like the old `perf/harness.cjs`): the harness string-injects a `__dbg` getter object (`solids, enemies, items, lvl, scene, renderer`) into the served HTML — **no product edit needed**. (Already used for the baseline numbers above.)
- Video: Playwright `recordVideo` (webm) + ffmpeg (present in `/opt/pw-browsers/ffmpeg-1011`) to trim/convert. Software GL runs slowly, so recordings are **reduced-FPS**; labelled as such.

### 8.2 Test matrix — verdict is PASS / FAIL / NOT TESTED with attached evidence; syntax checks never count

| ID | Test | Evidence required |
|---|---|---|
| T-REG | each registered spec: module loads, validates against contract, `build` ok, `activate` ok | JSON log |
| T-LIFE | load → respawn → checkpoint → exit → dispose → reload ×3, no exceptions | console log + counters |
| T-LEAK | after dispose+return to sky-city: `scene.children`, `renderer.info.memory.{geometries,textures}`, `solids.length`, heap vs baseline (tolerance stated) | before/after table |
| T-DET | geometry hash identical across 3 builds/page loads; unchanged by biome; changed by layout | hashes |
| T-SEP | SP levels absent from MP arena list/DOM, arenas absent from SP list/DOM, neither present in default co-op; sky-city rebuild identical to baseline hash | DOM dumps + hashes |
| T-SIG | structural signature per level (counts, bbox, elevation histogram, size histogram, branches/loops/intersections, gap distribution, route length) + §7.1 pairwise verdict vs sky-city and each other | signature JSON + comparison table |
| T-COLL | collision: (a) scripted **real-input** run: Playwright keyboard + `__ng.look` waypoint follower walks/jumps the declared main route from spawn to exit using the game's actual `physicsStep`; (b) edge probes: drop-test at N declared platform edges, wall-penetration probes (run into every wall from 8 directions), step-up/lip checks | per-edge pass table + failure screenshots |
| T-ROUTE | **one continuous recording** of full OD route completion (spawn → each checkpoint → objective → exit) + screenshots at each checkpoint | `.webm` + PNGs |
| T-VIEW | overhead orthographic + angled screenshots with start/checkpoints/objective marked (debug overlay rendered by harness via injected markers, not shipped) | PNGs |
| T-PERF | draw calls, triangles, scene objects, geometries, heap, load hitch (longest frame during build), vs sky-city baseline; software-GL flagged | table |
| T-NET2 | **two real browser clients** through a real relay on one arena: both build, `sig` equal, both see each other, a frag registers on both, pickup taken once, match timer agrees ±1 s, late-joiner receives state, disconnect/host-migration | two screenshots, log, `.webm` of each client |
| T-REG-EXIST | regression on sky-city (baseline hash/solids), Moon/Mars build, home towers, weapons switch/fire, vehicles mount, warp pad, co-op relay (two clients, enemies sync) | pass table; anything not automatable is marked **NOT TESTED**, not PASS |

**Relay used for T-NET2:** (1) preferred — local `wrangler dev` (Miniflare Durable Object, i.e. the real `cloudflare/worker.js`), (2) fallback — `server/server.js` (same protocol, Node `ws`). Both are *local*. Testing the **deployed** `skyjump3d.chimske.workers.dev` relay would write to production, so I will only do it with your OK, using a throwaway room name; evidence will say which relay was used.

**Honest limits:** structural signature + declared-graph checks are *necessary, not sufficient* (per brief): they prove nothing about collision, sync or feel. T-COLL/T-ROUTE/T-NET2 are the proof. No real-GPU hardware exists here: all frame-time numbers are software-GL and flagged; "feels good to play" is **never** claimed from automation — that needs your eyes.

---------------------------------------------------------------------

## 9. Parallelism decision

Hard truth: all runtime work funnels through shared symbols in `index.html` and the kit contract, so **only isolated-file work runs in parallel**; shared-symbol work is serial through me.

| Phase | Serial (lead, one at a time, test between each) | Parallel (isolated files / own git worktrees) |
|---|---|---|
| **Gate 1a** foundation | G1–G12 sentinel regions, `levels/registry.js`, kit, `cf:prep` edit, smoke level ("kit-selftest" — a throwaway 3-platform spec used only by tests, never registered in menus) | **F:** build harness + signature tool + baseline capture (touches only `tests/`). **B:** OD *design doc* only (docs). **D/E:** verification research docs only (no code). |
| **Gate 1b** OD greybox | merge `levels/od.js` after B passes its own checks; lead runs F's suite | **B:** `levels/od.js` (own worktree) ‖ **F:** T-COLL/T-ROUTE/T-VIEW against it |
| **Gate 2** | merge gameplay/art | B only (OD) |
| **Gate 3** | merge each SP level one at a time | **C:** the five levels in parallel in five worktrees, each only `levels/<id>.js` + doc; F verifies each; lead merges one at a time |
| **Gate 4** | `arenas/match.js` + MENU/NET hooks | **D/E** arenas in parallel worktrees once `match.js` API is frozen; F two-client tests |
| **Gate 5–6** | merges, regression, docs, deploy notes | — |

Git mechanics: workers use **local worktrees/branches** (`lvl/<worker>`); I merge `--no-ff` into the designated session branch `claude/festive-volta-coj7vi`, which is the only branch I push to. Any worker output is accepted only after I rerun its tests myself.

---------------------------------------------------------------------

## 10. Performance budgets (proposed; measured against §1 baseline)

- Spec-mode **build** ≤ 400 ms synchronous (or time-sliced via existing `jobs`); no frame > 150 ms during build (software GL).
- OD greybox: ≤ 1,200 solids, ≤ 60 static draw calls (merged per-cell like existing `buildChunkMeshes`), ≤ 8 MB geometry, 0 lights beyond the global three.
- Gate 2 OD full: ≤ 120 draw calls, ≤ 80 enemies alive, ≤ 4 dynamic lights.
- Arenas: ≤ 600 solids, ≤ 80 draw calls, 6 players' avatars included.
- Leaving any spec: `renderer.info.memory.geometries/textures` and JS heap return to within 5 % of the pre-entry value after sky-city rebuild (T-LEAK).
- Existing perf systems (batching, time-slicing, shader warm-up, culling, adaptive resolution, F2 HUD) must remain active in spec mode. Spec geometry registers with the cull/batch paths via `kit.cull.register`.

---------------------------------------------------------------------

## 11. Failure handling & revert plan (per worker)

Universal: no `git reset --hard`, no force-checkout, no discarding unrelated changes. Revert = `git revert -m 1 <merge-commit>` of exactly that worker's merge. Shared-region edits are committed **separately from level content** so level content can be reverted without disturbing the kit.

| Worker | What can go wrong | Detection | Revert unit |
|---|---|---|---|
| A / Lead (kit + hooks) | sky-city regression, hitch, `cf:prep` omission | T-SEP/T-REG-EXIST baseline hash, T-PERF, built-`cf-public` smoke | revert the 3 foundation commits (`STATE+KIT`, `HOOKS`, `package.json`); sentinel greps prove nothing else changed; **kill switch:** registry `ENABLED=false` hides all menus without a revert |
| B (OD) | uncollectable route, perf | T-COLL/T-ROUTE/T-PERF | revert merge of `levels/od.js` + registry line; game unaffected |
| C (5 levels) | reskin / near-identical signature | T-SIG pairwise | per-level merge revert; if a level can't be made distinct it is **not shipped** (no placeholders, no palette variants) and the handoff in this file says so |
| D / E (arenas) | desync, unfair spawns, fidelity claim not verified | T-NET2, doc review of verified topology | per-arena merge revert |
| F (tests) | flaky evidence | rerun ×3; flake rate reported | tests only; no product risk |

If a gate can't be finished in one run: leave a working tested increment + concrete handoff appended to §13 of this file; never fake completion.

---------------------------------------------------------------------

## 12. Gate deliverables (restated against this design)

- **Gate 1** (foundation + OD greybox): kit/hooks/registry merged and sentinel-isolated; sky-city baseline hash unchanged; OD greybox playable spawn → exit; overhead + angled marked screenshots; one continuous recording; §7.1 signature vs sky-city with real numbers; T-REG/T-LIFE/T-LEAK/T-DET/T-SEP/T-COLL/T-ROUTE/T-VIEW/T-PERF results. **Stop for approval.** No decoration, enemies or audio before that.
- Later gates as in the brief; this plan will be amended in place at each gate.

## 13. Handoff log (append-only, filled as gates complete)
_(empty — Phase 0)_

---------------------------------------------------------------------

## 14. Decisions I need from you at Gate 0

1. **Approve the mechanism** (replace-body hook + lazy ES-module specs + `kit`) — accepting that levels need an HTTP origin (not `file://`) and that `cf:prep` is extended. Alternative if you refuse module loading: inline everything in `index.html` (I advise against it; §2.2).
2. **Nostalgia Overdose fantasy** (§7.2): keep my "toy-scale Y2K childhood" concept, or give me yours.
3. **Anti-reskin thresholds** (§7.1): ratify or tighten (5-of-7 axes, listed numbers).
4. **Arena naming** (§7.3): original map names vs original names with "inspired by" docs only.
5. **Deploy surface**: which of Pages `sky-jump`, the Worker relay, and the root `wrangler.jsonc` project are live? (I can't check from here.)
6. **Relay for two-client QA**: local `wrangler dev`/Node relay only (my default), or may I also touch the deployed Worker with a throwaway room?
7. Return-from-level behaviour: exit → rebuild sky-city at the same `level` (my default), or a different return flow?
