# PLAN: Six spawn universes (one shared map)

Decisions (user, 2026-10-21):
- **Scope:** the early game is duplicated x6 (one "universe" per spawn); skyway, moon and Mars stay ONE shared endgame that every universe funnels into.
- **Spacing:** the six spawn centres sit on a ~600 m ring (target 500-700 m), evenly spaced at 60 degrees.
- **Far towers:** the far skyline buildings become the home towers for slots 2-6 (slot 1 keeps the current tower). Remaining far buildings stay solid and landable (done: `buildSurroundings` now adds collision + roof decor sites).
- **All six universes are ALWAYS built, solo or multiplayer, whether or not a slot has a player (user, 2026-10-21).** Solo player just spawns in slot 1 and can travel to the others. This replaces the old solo single-tower layout (`sixTowerLayout` becomes always true).
- Universes must feel like "mirrors" of the current map: same progression (home roof -> safe first platforms -> biome regions -> arenas/guardians), different seed.

## Current state (what exists)
- `syncStartLayout` places up to six homes on `SPAWN_RING_R = 150`; `buildHomeBase` dresses each; `applyNetSlot` rebuilds for a slot.
- `buildNetwork(exitAngle)` (index.html ~2003) places ALL hubs (arenas + buildings) in one disc of radius `75 + rand*(210+level*16)` around the origin, then `connect()`s them. `buildFlow`, `buildBranches`, `buildHubPortalLoop`, `spawnStreetRiders` run once over the whole hub list.
- `buildSkyway` (~1756) picks one bearing clear of the homes; moon and Mars hang off it. `WORLD_R = 640` clamps the player (~4805). `groundPad`/street target/boss arena sit near the origin.
- `buildSurroundings` (~2944) scatters render-only skyline towers at 520-1040 m (now with collision).

## Target design
1. **Universe centres.** `universeCentre(slot)` = ring point at radius `UNIVERSE_R` (600), angle `slot*60deg`. All six use the ring in every mode (solo too), and the origin becomes the shared hub (skyway base, street target, boss arena, moon launch).
2. **Per-universe generation.** Refactor the hub-placement loop in `buildNetwork` into `buildUniverse(slot, centre, rng)`: same arena/building counts (maybe 60-70% of today's so six fit the draw-call budget), placed around `centre` with radius ~260; each universe gets its own region/biome ordering rotated by slot so they differ. Seed per slot: `levelSeed ^ slot*0x9E3779B1`.
3. **Home towers from skyline.** Add a `homeTowerFrom(slot)` step: instead of the 150 m ring, `syncStartLayout` returns the universe centre; `buildHomeBase` already works at any (x,z). Drop the random far boxes within ~120 m of each centre so the home is not overlapped; the rest of `buildSurroundings` stays as backdrop but excludes universe footprints.
4. **Inter-universe bridges.** After all universes exist: for each adjacent pair (i, i+1) plus 3 long-diagonal pairs, `connect()` the nearest hub pair using a new `connectFar(A, B)` (same stepping-stone logic as `connect`, wider spacing, more trampolines/rails/checkpoints because the span is ~400-600 m, descending/ascending chain with a mid-way rest island and an arena guarding it). Bridges should be a real challenge but never a kill-floor-only path.
5. **Shared endgame.** Skyway base `colR` stays near the origin; every universe gets one "ascent" route to it (reuse `connectFar`). Moon/Mars unchanged. Mission/Guide logic already keys off `myMissionHub()`.
6. **World bounds.** `WORLD_R` -> `UNIVERSE_R + 400` (~1000) for rooms; raise `camera.far`, check fog distances, `voidLoop`, `spaceK`, and the clamps at ~3961/4805/2897.
7. **Netcode.** `server/server.js` + `cloudflare/worker.js` already assign slots 0-5 and relay seed; no change except sending `UNIVERSE_R` implicitly via the layout (clients derive from slot).
8. **Perf budget.** Measure `renderer.info` before/after; cap total platforms (~450) and total enemies (~300), share geometry/materials, use instancing for repeated dressing. Empty slots are built too, so the budget must hold for all six always; use lazy dressing (decorate/spawn enemies only when a player is within ~250 m) if needed.

## Work breakdown (agents)
- **A (layout/generation):** items 1-3, 6; `buildUniverse` refactor; remove the solo one-tower special case in `syncStartLayout`.
- **B (links/endgame):** items 4-5; `connectFar`; reachability test (graph BFS over `connect` results) so every universe reaches every other and the skyway.
- **C (verify/perf):** headless harness (`interior-test.cjs` style): six homes at 60 degree spacing, distance >= 500 m, no overlap with skyline, zero enemies near homes, BFS connectivity, draw calls/tris before vs after.

## Acceptance
- Room of six: six towers ring-spaced 500-700 m, each with its own surrounding mini-city and first routes; players can reach any other universe by platform paths; everyone can reach the shared skyway/moon/Mars.
- Solo and multiplayer build the identical six-universe world. Load time and frame rate must stay acceptable (measure; this is now the cost of every session).
- No clipping through skyline towers; no black discs / brown coins (done).

## Open questions
- PvP-style hazards on the bridges, or pure traversal?
