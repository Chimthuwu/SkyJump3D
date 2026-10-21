# PLAN-INTERIORS-MP.md — Hollow tower interiors + 6-player spawn towers (2 agents)

Two independent features. **Part 1 (interiors) → Agent A. Part 2 (multiplayer spawn towers) → Agent B.**
Both depend on `PLAN-HOMEBASE.md` being finished first (Part 2 needs the per-slot base/Guide/missions;
Part 1 can start earlier but shares `index.html` — coordinate by only adding NEW top-level functions and
touching the single call-sites listed). Same rules: single file `index.html`, agents never deploy,
solid opaque flat-shaded polygons (`lam()` / `MeshBasicMaterial` accents), update `TODO.md` when done.

---

## Part 1 — Hollow rooftop towers with unique interiors (Agent A)

### Idea
Land on the roof of one of the big tower buildings (`kind: 'building'` hubs from `buildBuildingHub`, and
optionally the big arenas) and the tower **wakes up**: a roof hatch irises open, the solid block turns
into a hollow shell, and you can drop/climb inside to a **dramatically different interior environment**
(its own lighting, fog, palette, sounds, enemies and loot). Same "lazy build on first landing" trick as
`buildMarsRoute()` — nothing is built until the player actually lands, so there is no cost for unvisited towers.

### Hook points (existing code)
- Landing handler (~line 2740, where `sol.moon → buildMarsRoute()`): add `if (sol.building && !sol.hub.opened) openTower(sol.hub)`.
  Mark roof solids from `buildBuildingHub` with `sol.building = true; sol.hub = hub`.
- Building mesh/solid creation: `buildBuildingHub` / `boxMesh()` / `buildingBoxes`. The building is currently ONE solid +
  ONE box mesh. `openTower` must **replace** the solid with a shell: remove the big solid from `solids`, add 4 wall slabs,
  a floor, and 1–3 interior floors (slabs with ramps or bounce-pad links), plus a hatch hole in the roof (split the roof
  into 4 slabs around a square opening). Hide/shrink the outer box mesh and show a thin shell mesh so the exterior still
  looks like the same building. Add new meshes to `lvl` (not `scene`) so they are cleaned up on level rebuild.
- Zone/environment system: `setZone()` / `ZONES` / `MOON_ZONE` palette objects (`top/mid/bot/fog/hemi/sun/...`).
  Add an **interior zone** concept: when the player is inside the hull, `setZone(interiorZone)` and the sky dome is replaced
  by a ceiling (tight fog `near/far`, low hemi light, coloured accent lights).
- Dread/horror, weather, wind (`envWind`) and the skyline must be suppressed inside (`inInterior` flag).
- "Opened" state lives per level only (rebuilt on `buildLevel`).

### Interior themes (pick by hub zone / seed; build 5 in v1)
1. **Server Farm** — rows of humming racks, cyan/green LED grids, cable trenches to jump, hacked turrets, data-core loot.
2. **Overgrown Atrium** — a dead garden inside a glass tower: trees through the floors, vines to climb, Jungle enemies.
3. **Flooded Reactor** — glowing coolant (damage/slow plane), catwalks, a reactor core as a boss arena.
4. **Neon Club** — pulsing dance-floor tiles, light beams, a stage, tough bouncers and a DJ guardian.
5. **Cold Vault** — frozen archive: ice floors (reuse `iceUnderfoot`), cryo pods, slippery ledges, frozen loot.
(Later: Museum of the Dead, Casino, Hangar with a parked vehicle, Library maze.)

Each theme = a builder `buildInterior_<name>(hub, floors)` returning `{ solids, enemies, loot, zone, ambient }`.
Shared helpers: `interiorShell(hub, floorCount)`, `addFloor`, `addCatwalk`, `addPillar`, `neonStrip`, and a small pool of
real lights (max 4; fake the rest with emissive meshes). Use `InstancedMesh` for repeated racks/pillars (see `buildMarsRoute`).

### Gameplay glue
- Every interior has **one guaranteed reward** (weapon / big ammo / heart / resource haul) and 0–1 mini-boss
  (reuse `makeWalker(..., isBoss, variant)` and the Guardian/arena-lock pattern).
- **Missions:** expose `interiorTargets` so the mission generator (`PLAN-HOMEBASE.md`) can put `collect` and `kill` targets
  inside towers ("Recover the data core from the Server Farm").
- Exits: the roof hatch (ladder / bounce pad back up) and a ground-side hatch that drops you out the bottom into the sky-city.
  Falling out must never kill the player unfairly.
- Audio: interior ambience swaps through the existing `sfx` / music bus (muffled wind, theme hum).

### Agent A checklist
- [x] `openTower` converts a building into a hollow shell with a working roof hatch; collision correct (no invisible walls, no falling through).
- [x] 5 themes with distinct palette, geometry and enemies; interior lighting/fog clearly different from outside.
- [x] Reward + (optional) mini-boss in each; leaving restores the outside environment (`setZone`, fog, sky) cleanly.
- [x] No cost until a tower is opened; no frame-rate drop.
- [x] `window.__ng.openTower(i)` / `__ng.towers()` debug hooks to test every theme quickly.
- [x] `node --check` on the extracted script; `TODO.md` handoff notes.

**Status (2026-10-21, BUFFY / Agent A):** Part 1 shipped in `index.html`. Landing on a building roof
calls `openTower(sol.hub)`; the tower's single solid is removed from `solids`, the box mesh is hidden and the
volume is rebuilt as a shell (`interiorShell`): four collision walls, a street-level slab, 1–14 staggered floor
rings with a carved hatch, a bounce-pad under every hatch so the shaft can be climbed upward, a doorway bridge
and a launch ledge on the ground side, emissive wall trim and an iris-ing roof hatch. Themes are `server`,
`atrium`, `reactor`, `club`, `vault` (`INTERIOR_THEMES` + `interiorDecor` + `buildInterior_<name>`); the theme
is picked by hub zone (`towerThemeFor`). Every interior spawns 2–3 biome enemies, a mini-boss (reactor/club),
a weapon + ammo reward, a mission data core and a `collect` contract. Deviations from the plan: floor rings
are square rings with one hatch each (not ramps), the light budget is **one shared key light** for all
interiors (parked at y=-10000 outside, so the city never pays for extra lights), and the ground-side exit is a
doorway + launch ledge rather than a drop-out hatch. Verified in headless Edge — see `TODO.md`.
Debug: `__ng.towers()`, `__ng.openTower(i, 'server')`, `__ng.interiors()`.

---

## Part 2 — Up to 6 players, each with their own spawn tower + Guide (Agent B)

### Idea
Multiplayer lobbies of **up to 6**. Instead of one central spawn tower, the world has **6 identical home-base towers evenly
spaced on a ring** (60° apart). Every player spawns on *their own* tower with *their own* Guide NPC and mission list. The sky-city,
skyway/moon→Mars route, arenas and street target are shared and sit between/around the towers.

### Layout rules
- `SPAWN_RING_R` ≈ 120–160 m (tune so towers are visibly separate but their first platforms don't collide). Slot `i` angle =
  `i * 2π/6` (+ fixed phase so slot 0 matches today's direction). Each tower is the existing start hub (`kind: 'start'`,
  `hw/hd = TH`) at `(cos a * R, TOP, sin a * R)`.
- **Single player keeps today's layout** (one tower at 0,0). In multiplayer, always build all 6 so late joiners have a home and
  the world is identical for everyone (empty towers stay dressed and calm; their Guides idle).
- Replace the single `start` object (`const start = {x:10,y:TOP,z:0}` ~line 553) with `starts[]` + `mySlot`; every `start.x/start.z`
  use (base dressing ~1926–1930; respawn/spawn code ~2450, 2784, 4559, 5587) must use `starts[mySlot]`. Grep `start\.` first.
- `buildNetwork` hub list: `hubs = [start × 6, ...]`; the hub sorter assumes "the start roof is the highest point and sorts first" —
  keep all 6 at `TOP` and fix that assumption. Paths: each start hub gets its own outgoing chains (`connect(A=start_i, B)` to 2–3 hubs),
  with *different* first targets so players fan out, and the graph must stay fully connected.
- `keepOut` / `buildSkyway`: the moon skyway column is placed at a random angle at `colR=210`; it must not overlap the ring
  (add keepOut circles around each tower) and must be reachable from every tower.
- Per-slot content: weapons rack, board/skates, one bike + buggy, lore terminal, **Guide + crafting bench + mission board**
  (call `buildHomeBase(hub, slot)` once per tower). Missions are generated per slot with `mulberry(seed ^ slot ^ 0xBA5E)`;
  kill/collect *targets are shared world objects* but each slot's mission list/progress is private.
- Anyone can walk to someone else's tower; the Guide there only talks to its owner ("This is somebody else's post").

### Networking (`server/server.js` + client `net`)
- Server assigns `slot` (0–5) on join, rejects the 7th player with a clear "lobby full" message, frees and reuses slots on leave.
  Send `{t:'welcome', slot, level, seed}`; clients `buildLevel()` identically (seeded) then `pos.set(starts[slot])`.
- Relay messages: per-slot `mission` state (accept/progress/complete — informational for teammates' HUD). `craft`/`base` stays
  local + persisted per player. Shared pickup/kill events already exist — mission kill counts only the owner's kills, item
  pickups remove the item for everyone.
- Host still simulates enemies; NO enemies near any of the 6 towers (generalise the "peaceful roof" rule from the Homebase plan).
- Respawn/death → return to **own** tower checkpoint.
- `levelClear` unchanged (everyone advances together); each player keeps their own base state/credits.
- Reconnect: same name → same slot if still free (stretch).

### Agent B checklist
- [ ] `starts[]` / `mySlot` refactor done; single player behaves exactly as before.
- [ ] 6 evenly spaced towers, all reachable, no overlap with arenas/skyway/ride park; each fully dressed (base + Guide + bench + board).
- [ ] Server slot assignment (max 6, clear "lobby full"), join/leave/reuse tested with 2–6 browser tabs.
- [ ] Per-slot mission lists deterministic; progress private; shared world targets consistent.
- [ ] `node --check` on extracted script and `node server/server.js` boots; no console errors with 6 clients.
- [ ] `TODO.md` handoff notes.

---

## Order of work
1. `PLAN.md` (vehicles) → 2. `PLAN-HOMEBASE.md` (base / Guide / missions, **slot-keyed from day one**) → 3. this plan, A and B in parallel
(A's interiors don't touch spawn/network code; B doesn't touch building shells).
Shared touch-points to coordinate: the landing handler (A adds the `openTower` call), the `buildNetwork` hub list (B), mission
target generation (A exposes `interiorTargets`; the Homebase mission code consumes it).

## Open questions
- Single player: keep the one central tower (proposed) or also use the ring?
- Should the 6 spawn towers themselves have an interior room? Proposed: no, they stay open rooftops.
- Keep the ground-side exit hatch from interiors in v1?
- Ring radius: tune after the first playtest if six towers crowd the central skyline.
