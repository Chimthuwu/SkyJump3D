# PERFORMANCE_AUDIT.md — what to investigate to maximise performance

Status: **planning only. Nothing here has been measured yet.** Every item is a hypothesis taken from reading
`index.html` (~6,400 lines, ~475 KB, single file, Three.js, no build step). The first job of the audit is to
turn guesses into numbers, then fix the top few offenders. Do not optimise anything that the profile does not flag.

## 0. Goal and budget

- Target: steady **60 fps** on a mid-range laptop iGPU (Intel Iris / Radeon 680M class) and a 2019 phone, at
  the default MODERN preset; **no hitches > 50 ms** (GC, level build, route build).
- Secondary: load time (< 3 s to menu on broadband), memory (< ~500 MB tab), level-rebuild time, and
  battery/thermals (mobile). Multiplayer (6 players, host simulating all enemies) must not blow the budget.
- Define three **reference scenes** and always measure those (so before/after is comparable):
  1. **Spawn roof** — start of level 1, looking out over the city (worst-case view distance, lots of buildings).
  2. **Arena fight** — a colosseum with ~15 enemies and weapons firing (CPU: AI + shots + particles).
  3. **Alien Void** — mid-route after the moon (900 platforms, 21 space cities, ~130 aliens/UFOs, instancing).

## 1. How to measure (do this first)

- Chrome DevTools **Performance** panel (CPU + GPU) with 4× CPU throttling and a 6-second capture per scene.
  Record: frame time, scripting vs rendering vs GC, long tasks.
- `renderer.info` (`render.calls`, `render.triangles`, `memory.geometries`, `memory.textures`, `programs.length`)
  logged every second behind a debug key. Expose it on `window.__ng.perf()`.
- A tiny in-game **per-system timer** (`performance.now()` around: `updateEnemies`, `updateShots`, `updateFx`,
  `updateSpecials`, `updatePortals`, `updateStreet`, `playerShadowTick`, physics/collision, `renderer.render`),
  averaged over 120 frames and printed to the existing debug overlay (`#dbg`). This tells us CPU time by system
  without needing the profiler.
- **Spector.js** (WebGL capture) for draw-call and state-change inspection; **chrome://gpu** to confirm hardware
  acceleration; **about:tracing** if GPU process time is suspect.
- Memory: DevTools Memory → heap snapshot before/after a level rebuild and after entering/leaving the Alien Void
  (leak check — see §6).
- Level build timing: `console.time` around `buildLevel()`, `buildStatic()`, `buildNetwork`, `buildAlienRoute()`.
- Test matrix: Chrome desktop (iGPU), Firefox, Safari/iOS, one low-end Android; presets PS1 / N64 / MODERN.

## 2. Rendering (GPU side)

Observed facts: the game renders to a **320×240 retro target** (`RETRO_WIDTH/HEIGHT`), upscaled; MODERN preset
enables antialiasing and `setPixelRatio(min(dpr, 2))`. A custom post/upscale pass exists (`depthTest:false` material at
~line 289). There is a CRT-style scanline/overlay look. No shadow maps are enabled (blob shadows only).

Investigate:
1. **Resolution scaling vs pixel ratio.** Is MODERN really rendering at full dpr (up to 2×)? On a 4K/retina screen that is
   up to 4× the pixels. Add an adaptive resolution scaler (target frame time → scale 0.5–1.0) and a Quality setting.
2. **Draw calls.** `new THREE.Mesh(` appears ~240 times and `scene.add(` ~100 times in source, but many are inside loops, so
   real counts are far higher: most platforms, props, enemies, items and decor are **individual meshes** (a platform from
   `addPlatform` = slab + plate + underside + decor + labels...). Measure `render.calls` in each reference scene.
   Candidates to merge or instance: platform slabs/plates, coins, ammo boxes, hearts, checkpoint banners, road segments
   (`tryRoad` makes ~4 meshes per 7 m segment), neon lane lines, building window panels, enemy parts.
   The Alien Void already uses `InstancedMesh`; use it as the pattern.
3. **Per-enemy cost.** Each walker is a `Group` of 25–60 child meshes with several unique `MeshLambertMaterial`s (`makeWalker`),
   each with aura torus, beacon, aggro arrow... Hundreds of enemies × dozens of meshes = thousands of draw calls.
   Investigate: shared materials per variant, merged static geometry per variant (bake into one `BufferGeometry` with
   vertex colours), skipping the aura/beacon beyond a distance, and hiding (`visible=false`) distant enemies entirely.
4. **Materials/programs.** Count distinct shader programs (`renderer.info.programs`). The retro patch uses
   `onBeforeCompile` + `customProgramCacheKey`; confirm materials with different flags aren't compiling many variants.
   Many materials are created per object (`lam(...)` in loops) — dedupe by colour/params via a small cache.
5. **Frustum / distance culling.** Only 7 explicit `frustumCulled` settings. Huge instanced meshes have
   `frustumCulled=false` (needed because bounds are wrong) — meaning they are always drawn in full. Investigate chunked
   instancing (per city/segment) or manual bounding spheres so off-screen chunks are skipped. Add distance culling /
   LOD for props, labels, rails, coins beyond ~150–250 m (fog far is ~200–260, so anything beyond is wasted).
6. **Fog / far plane.** `camera.far` is 2500 and is raised to ~14,000 for the Mars route. A huge depth range hurts depth
   precision and defeats culling. Check whether far can be lowered or split (separate near/far passes for planets).
7. **Transparency & overdraw.** Additive/transparent meshes: portal halos/cores, light beams, auras, tractor beams, clouds
   (sprites with large screen coverage), sky particles, weather, damage/CRT overlays. Large transparent sprites are
   fill-rate heavy on iGPUs. Measure with a "force opaque" toggle; reduce cloud sprite count/size; cap beams.
8. **Texture memory.** Canvas-generated textures (window texture, moon, Mars 512×256, sky canvas redrawn every 0.1 s in
   `drawSky`, label sprites each with its own 256×64 `CanvasTexture`, nameplates). Check count/size, mipmap use
   (recently enabled for MODERN), and whether `drawSky()` re-uploading a canvas texture 10×/second is costing GPU upload time.
9. **Post-processing / CSS.** The CRT/scanline look and any CSS `filter` on the canvas (`renderer.domElement.style.filter`
   is set during psychedelic effects) can force the compositor to do extra full-screen passes. Profile compositor time and
   try replacing CSS filters with in-shader effects or removing them on low quality.
10. **Antialiasing.** MSAA at upscaled resolution is expensive; evaluate FXAA/none given the pixel-art target.

## 3. CPU: simulation per frame

Hot loops to profile (all run every frame):
1. **Collision against `solids`.** `solids` is a flat array scanned linearly in ≥14 places (`for (const s of solids)`):
   player movement/landing, ground probing (`heightAbove`, `playerShadowTick`, vehicle shadow), shots (`inSolid`), enemy
   placement (`blocked`), rail latching, portal-pad checks, `spawn` checks. The Mars route adds ~1,000+ more solids
   (and the city rooftops), and roads/ramps add many small ones. **This is probably the #1 CPU risk.**
   Fix candidates: a uniform **spatial hash / grid** keyed by (x,z) cells (solids are AABBs), query only nearby cells;
   per-frame cache of "solids near the player"; make `inSolid` for projectiles use the grid.
2. **`playerShadowTick` / `heightAbove`** loop all solids every frame (and `blob` + `pShadow` both do it).
3. **`updateEnemies`.** ~300 enemies alive in the Alien Void. There is a distance early-out (230 m) but only after
   per-enemy emissive/aura updates run; reorder so far enemies do almost nothing. Walker AI checks players, platforms and
   solids per enemy; look for per-enemy allocations (`new THREE.Vector3` in `chest()`/`fireEnemyShot`/AI).
   Consider AI LOD: far enemies update at 10 Hz; sleep enemies outside ~80 m.
4. **Particles / FX.** `burst()` creates a new `Mesh` + `MeshBasicMaterial` per particle and disposes on death
   (`updateFx`). This allocates heavily (GC hitches) during gunfights, boosts (vehicle exhaust flames) and dust.
   Replace with a pooled `InstancedMesh`/`Points` system; share materials; cap total particles.
5. **Shots / beams / decals.** Same pattern (new meshes, `scene.add/remove`). Pool them. `decalMesh` is already an
   instanced pool — use it as the model.
6. **Specials (`updateSpecials`).** Movers, orbiters, pistons, breathing and crumbling platforms: each calls
   `moveSpecial`, which rewrites solid bounds and group position; `breath` scales geometry. 150+ of these on the Alien
   Void route. Update only those within ~120 m of the player; skip sleeping ones.
7. **Vehicle FX** (`updateVehicleFx`): per-frame material colour lerps via `WeakMap`, world-position lookups, particle spawns.
8. **Portals / proximity checks.** `updatePortals` and `updatePortalPreview` loop all portals twice per frame (67 portals)
   and loop all solids for the "bounce pad owns the footprint" check when standing on one.
9. **Allocation & GC.** Search for per-frame `new THREE.Vector3/Color/Object3D`, array `.filter/.map/.slice`, template-string
   building in the HUD (`updateHud` rebuilds strings every frame, `$('ride').textContent` etc.). Count GC pauses in the
   profiler's memory timeline. Introduce scratch vectors and string caching (only write the DOM when text changes).
10. **DOM/HUD cost.** Hint/HUD updates, the `#dbg` panel, toasts and subtitles trigger layout. Batch DOM writes; avoid
    reading layout (`offsetWidth`, `getBoundingClientRect`) in the frame loop.

## 4. Level generation and loading

- `buildLevel()` / `buildStatic()` / `buildNetwork()` / `connect()` / `tryRoad()` / `buildFlow()` / arenas: measure total
  ms (expect hundreds of ms to seconds on slow CPUs) and when it runs (blocking the main thread → frozen UI on every
  level change; multiplayer join triggers a rebuild too). Options: time-slice generation across frames with a loading bar,
  generate heavy decor lazily (like the Mars route and tower interiors are built on first landing), or move generation to a
  Web Worker (needs a plain-data output).
- `blocked()` is O(solids) and is called many times per placement attempt (up to 250 tries per hub, per-segment roads,
  clusters). A spatial grid (§3.1) speeds up generation too.
- The Mars/Alien Void route builds in ~0.1 s (measured once in a desktop browser) — re-measure on a phone.
- `buildLevel()` disposes only geometries (`lvl.traverse(o => o.geometry.dispose())`); **materials and textures created per
  level are never disposed** (see §6).
- Seeded determinism must be preserved by any optimisation (multiplayer relies on identical generation from the same seed).

## 5. Page weight, load and network

- Single 475 KB HTML file with all JS inline: no caching of code separate from markup, parse/compile time on mobile.
  Investigate: minify + gzip/brotli (Cloudflare Pages already compresses), splitting rarely used systems out, `defer`.
- Three.js is loaded from a CDN (confirm version/URL, `integrity`, and that it is cached; consider self-hosting the
  minimal build with tree-shaking via a bundler step).
- Audio: music/SFX are synthesised in WebAudio (no asset downloads) — check CPU cost of the music scheduler
  (`musicStep`, oscillator nodes created per note) and the number of live nodes; check the multiplayer TTS cache
  (`server/tts-cache`) only loads on demand.
- Cloudflare Pages caching headers for `index.html`, logos and any future assets; avoid re-deploying unchanged files.
- Multiplayer: snapshot size (`netSnapshot`, enemies indexed by array position: ~300 enemies in the Alien Void),
  send rate (`tSend/tSnap/tFull`), JSON overhead, relay server CPU with 6 clients (`server/server.js`).
  Consider delta snapshots and interest management (only send enemies within range).

## 6. Memory and leaks

- Heap snapshot before/after: start → rebuild level 5× → enter/leave Alien Void → die/respawn 20× → compare.
- Suspects: materials/textures created per object and never disposed (`lam()` inside loops, `CanvasTexture` per label,
  per-particle materials on `burst`, enemy materials), `retroMaterials`/`retroTextures` Sets that keep every material
  alive forever (`retroMaterial()` adds to a global Set — **a strong reference leak**), event listeners added per level,
  arrays that only grow (`decorSites`, `fx`, `gibsList`, `shots`, `routeLandmarks`, `specials`), closures in `setTimeout`.
- `THREE.Object3D.prototype.add` is monkey-patched to traverse and `retrofitObject` every added object (traversal cost on
  every `add`, including each particle). Check how often it runs during gameplay and whether it can be skipped for pooled/
  known-safe objects.
- GPU memory: `renderer.info.memory` growth across levels; dispose render targets and geometries of removed levels.

## 7. Gameplay-feature-specific risks (recent additions)

| Feature | Risk | What to check |
|---|---|---|
| Alien Void route (900 platforms + 21 cities) | 1,000+ solids, ~130 enemies, 8+ instanced meshes with `frustumCulled=false`, 71 saucers | solids scan cost, draw calls from `addPlatform` specials (~150), saucer mesh count, chunk culling |
| Road loops/ramps (`addRampDir`, `addRoadLoop`) | each ramp block = a `Mesh` + `Solid`; many ramps per level | merge into one instanced mesh per road |
| Vehicles (buggy/bike) | per-frame FX, many parts, instanced boxes + many materials | draw calls per vehicle (~30–50), `props` idle spinning for all parked vehicles even when far away |
| Portals (67, dormant) | hidden `Group`s still update each frame | skip dormant portals entirely (partially done) |
| Labels (`makeLabel` sprites) | one canvas texture + material each; `onBeforeRender` per sprite | share textures by text, atlas, cull by distance |
| Weapons viewmodel | 7 guns × detail meshes always in the scene graph | only add the active gun (`visible` is toggled, but the hierarchy is still traversed) |
| Mission/home base (in progress) | NPC, bench, markers, per-frame mission tracking | keep per-frame work O(active mission), reuse meshes |
| Multiplayer (6 players) | host simulates all enemies; snapshot every frame | profile host CPU with 6 peers, snapshot bytes/s |

## 8. Suggested investigation order (highest expected payoff first)

1. Add the perf HUD + `renderer.info` + per-system timers (1–2 hours). Capture the 3 reference scenes. **Decide from data.**
2. Spatial grid for `solids` (largest likely CPU win, also speeds generation).
3. Pool particles/shots/FX (kills GC hitches).
4. Reduce draw calls: instancing/merging for platforms, roads, items; per-variant merged enemy meshes; distance culling.
5. Adaptive resolution / quality presets (cheapest guaranteed fps on weak GPUs).
6. Time-sliced or lazy level generation + disposal fixes (load hitches, leaks).
7. Network delta snapshots and interest management.
8. Page weight: minify/bundle, cache headers.

## 9. Deliverables of the audit

- A table of measured numbers for the three reference scenes (fps, frame ms breakdown, draw calls, triangles, textures,
  geometries, JS heap) **before** any change.
- A ranked list of the top 10 offenders with measured cost and an estimated fix size.
- A small PR-sized change per fix with before/after numbers; never batch unrelated optimisations.
- A regression guard: keep the `perf()` hook and reference-scene scripts in the repo so future features can be checked.

## 10. Notes / constraints

- The game is a single HTML file edited by several agents at once; keep optimisations in **new, well-named functions**
  and avoid reformatting existing code to limit merge conflicts.
- Determinism: level generation uses a seeded RNG (`rand()` / `missionRandom`). Optimisations must not change the order or
  number of `rand()` calls.
- Visual style is part of the product (retro low-poly, flat shading, neon). LOD/merging must not change the look.
- Do not deploy performance experiments to `sky-jump.pages.dev` without the lead's go-ahead.
