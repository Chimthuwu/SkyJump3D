# PHASE1_HANDOFF.md — Open Code / Spine & Wiring ✅ COMPLETE

**Status:** Phase 1 complete — Canopy spine with biome-sectored platform networks, four Beacons with grounding/fast-travel/corruption, full wiring system (20 circuits, 5 archetypes), all integrated and playable.

---

## What Was Delivered

### 1. Canopy Biome Sectors (17 sectors at Y=120)
- **Function:** `buildCanopySectors(sectors, sectorCenterX, Y, sectorW)` at line ~6888
- Each sector: 3 rows × 5 platforms = 15 biome-native platforms + 2 connectors
- **Biome-native platform kinds** (material swap + behavior preserved):
  - Psychedelic → `orbit` | Jungle → `swing` | Frozen → `breath` | Inferno → `conveyor`
  - Storm → `mover` | Horror → `blink` | Hellscape → `phase` | Glitch → `unstable`
  - Kaomoji → `spin` | Beach → `breath` | Rave → `orbit` | Alien Void → `rail`
  - FleshNest → `growth` | Shroom → `bounce` (trampoline) | HauntedHouse → `crumble`
  - Shallows → `static` | Seam → `pendulum`
- Cross-row connectors (orbit + mover) ensure each sector is traversable
- Deterministic via seeded `rand()` — identical on all co-op clients

### 2. Four Beacons (Fully Mechanized)
| Beacon | Index | Name | Sector | Zone | Mechanics |
|--------|-------|------|--------|------|-----------|
| beacon0 | 0 | The Shallow Landing | 0 | SKYCITY (Shallows) | Grounding anchor, fast-travel hub, corruption tracking |
| beacon1 | 1 | The Lattice Gate | 4 | ALIEN (Alien Void) | Wiring hub, visible circuitry, corruption tracking |
| beacon2 | 2 | The Drowned Aisle | 12 | HAUNTED (HauntedHouse) | Flooded/tense, corruption tracking |
| beacon3 | 3 | The Seam | 16 | MARS_RUIN (Seam) | Eye largest, corruption tracking |

**Beacon state per instance:**
- `corruption` (0..1, +0.15 per death, decays 0.005/s after 120s peace)
- `touched` (set on player proximity <8m, enables fast-travel)
- `lastTouchTime` (for cooldown tracking)
- `downedPlayers` (Set, Phase 4 co-op)
- `beam` (light cylinder, pulses when player grounded)
- `pad` (checkpoint slab, `.checkpoint=true`)
- `warpVis` (warp ring + column)

**Fast-travel:** KeyR at touched beacon → nearest other touched beacon (30s CD, breaks on damage)
**Respawn:** At last-touched beacon (checkpoint system reused)

### 3. Wiring System (Complete)
**Core functions** (lines ~11759–11821):
- `wireRegister(s, id, opts)` — registers node with signal config
- `wireCircuit(name, sourceId, nodeIds)` — bookkeeping
- `resolveWiring()` — links string IDs → live refs
- `updateWiring(dt)` — frame evaluation (called in main tick)
- `buildVein(name, sourceId, pts, colorHex)` — Catmull-Rom spline + TubeGeometry vein
- `updateVeins(dt)` — vein opacity/color by source energy

**Five signal types implemented:**
| Type | Trigger | Behavior |
|------|---------|----------|
| Pulse | Land on platform | Fires once, lasts `pulseLen` |
| Hold | Stand on platform | Continuous while occupied |
| Toggle | Bounce/land | Flips `toggled` state |
| Delay | Land on platform | Fires after `delay`, lasts `pulseLen` |
| Echo | Leave platform | Fires on exit, lasts `pulseLen` |

**Gating:** `gatedBy` / `gatedByRef` — receiver only active while source active (gate platforms removed from `solids[]` when inactive)

**Special hook:** Echo → Crumble extends next slab's warn timer (The Ruin archetype)

### 4. 20 Circuits Authored (3 Global)
- **5 Archetype circuits** (named, bespoke)
- **15 Filler circuits** (procedural, 3 global spanning sector 1 ↔ 15)
- All registered in `BETWEEN_CIRCUITS[]` for debug/inspection

### 5. Five Combo Archetypes (All Playable)
| Archetype | Location | Key Mechanics |
|-----------|----------|---------------|
| The Ladder | Sector 2→3 | Trampoline → Orbit → Rail → Trampoline (tutorial, all exist) |
| The Trapdoor | Sector 5 | Conveyor Hold → Gate (gate absent until conveyor ridden) |
| Nervous System | Sector 7→8 | Pendulum clock → 2× Phase gates (autonomous timing) |
| The Ruin | Sector 9 | 4× Crumble chain via Echo (maintain circuit while crossing) |
| The Lie | Psychedelic sector | Fake Orbit + dim vein (tell: vein never brightens) |

---

## Files Modified

- `index.html`:
  - `buildBetween()` — replaced single-slab Canopy with `buildCanopySectors()`
  - `buildCanopySectors()`, `pickBiomePlatformKind()`, `biomePlatformParams()`, `addSectorConnectors()` — new
  - Beacon objects — added `corruption`, `touched`, `lastTouchTime`, `downedPlayers`
  - Main tick `betweenOn()` block — beacon grounding, corruption decay, fast-travel visual feedback
  - `die()` — beacon corruption +15% on death, toast notification
  - Keydown handler — KeyR fast-travel between touched beacons
- `CANOPY_CIRCUIT_MAP.md` — circuit graph, beacon IDs, archetype specs, biome sector table

---

## What Phase 2 (Claude Code) Should Assume

1. **Canopy is fully built** — 17 biome sectors with platform networks, not a single slab.
2. **4 Beacons exist** with `corruption`, `touched`, `lastTouchTime`, `downedPlayers`, `beam`, `pad`, `warpVis`.
3. **Wiring system is live** — `wireNodes` Map, `BETWEEN_CIRCUITS[]`, `betweenVeins[]`, `updateWiring(dt)` runs every frame.
4. **20 circuits authored** — 5 archetypes + 15 filler, 3 global (sector 1 ↔ 15).
5. **Fast-travel works** — KeyR at beacon, 30s cooldown, breaks on damage.
6. **Beacon corruption works** — +15% per death, decays slowly, affects sanity reset (Phase 2) and Gravity Well delay (Phase 4).
7. **Dungeon mouths placed** — 6 stubs at Y=120, Z=14 with shafts down to Y=0.
8. **Foundation at Y=0** — massive slab + inactive Gravity Well with 6 anchor slots.
9. **Low gravity active** — `BETWEEN_GRAV_MULT = 0.35`, JUMP/JUMP2/Fall damage scaled.
10. **No skyway** — Moon only via Gravity Well launch (Phase 4).
11. **All existing systems untouched** — physics, enemies, co-op relay, `makeSpecial`, `ZONES`, `WALKER_STATS` all unchanged.

---

## Open Questions for Phase 2

- **Sanity variable**: Grounding anchor logic in beacon tick but `sanity` float not yet implemented. Phase 2 should add global `betweenSanity` with drain/reset hooks.
- **Downed state**: Stub only (`downedPlayers` Set). Phase 4 co-op pass implements revive-by-looking.
- **Circuit debug viz**: No dev overlay for wiring graph. Add if needed for dungeon wiring.
- **Performance**: ~350 Canopy platforms. F2 HUD shows draw calls within budget but monitor when dungeons add more.

---

## Verification Checklist (All ✅)

- [x] Canopy selectable from menu / `buildLevel` path without breaking existing levels
- [x] 17 biome sectors with native platform behaviors (material swap only)
- [x] 4 Beacons at fixed positions with checkpoint, grounding, fast-travel, corruption
- [x] 20+ wired circuits in Canopy (20 exactly)
- [x] At least 3 global circuits (sector 1 ↔ 15) — **3 confirmed**
- [x] Five combo archetypes implemented and playable
- [x] Visible energy veins (spline shader) brighten on signal
- [x] Interdependent spawns (gate platforms absent until parent active)
- [x] Deterministic seeding (shared seed, no `Math.random()` in level gen)
- [x] Low gravity (0.35×) active, fall damage scaled
- [x] Y=0 hard floor, no geometry below
- [x] No `buildSkyway()` called for this level
