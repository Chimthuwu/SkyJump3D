# CANOPY_CIRCUIT_MAP.md — Phase 1 Wiring Graph

Generated from `buildBetweenWiring()` at index.html line ~6778. All circuits are deterministic (seeded RNG, no `Math.random()`).

---

## Circuit Inventory (20 total, 3 global)

| # | Name | Type | Source Sector | Dest Sector | Global? | Signal Chain |
|---|------|------|---------------|-------------|---------|--------------|
| 1 | The Ladder | Archetype | 2 | 3 | No | Pulse→Hold→Pulse→Pulse |
| 2 | The Trapdoor | Archetype | 5 | 5 | No | Hold→Hold(gated) |
| 3 | The Nervous System | Archetype | 7 | 7,8 | No | Hold(activeFn)→Hold(gated)×2 |
| 4 | The Ruin | Archetype | 9 | 9 | No | Echo→Echo→Echo→Echo |
| 5 | The Lie | Archetype | Psychedelic* | — | No | Hold(fake) |
| 6 | Filler 0 (global) | Filler | 1 | 15 | **Yes** | Pulse→Hold(gated) |
| 7 | Filler 1 (global) | Filler | 1 | 15 | **Yes** | Hold→Hold(gated) |
| 8 | Filler 2 (global) | Filler | 1 | 15 | **Yes** | Toggle→Hold(gated) |
| 9 | Filler 3 | Filler | 4 | 5 | No | Delay→Hold(gated) |
| 10 | Filler 4 | Filler | 7 | 8 | No | Echo→Hold(gated) |
| 11 | Filler 5 | Filler | 10 | 11 | No | Pulse→Hold(gated) |
| 12 | Filler 6 | Filler | 13 | 14 | No | Hold→Hold(gated) |
| 13 | Filler 7 | Filler | 16 | 2 | No | Toggle→Hold(gated) |
| 14 | Filler 8 | Filler | 3 | 4 | No | Delay→Hold(gated) |
| 15 | Filler 9 | Filler | 6 | 7 | No | Echo→Hold(gated) |
| 16 | Filler 10 | Filler | 9 | 10 | No | Pulse→Hold(gated) |
| 17 | Filler 11 | Filler | 12 | 13 | No | Hold→Hold(gated) |
| 18 | Filler 12 | Filler | 15 | 1 | No | Toggle→Hold(gated) |
| 19 | Filler 13 | Filler | 2 | 3 | No | Delay→Hold(gated) |
| 20 | Filler 14 | Filler | 5 | 6 | No | Echo→Hold(gated) |

\* The Lie auto-detects the Psychedelic sector index (falls back to sector 10).

---

## Beacon IDs & Positions

| Beacon | Index | Name | Sector | X | Y | Z | Zone |
|--------|-------|------|--------|---|---|---|------|
| beacon0 | 0 | The Shallow Landing | 0 | `sectorCenterX(0)` | 120 | 0 | SKYCITY_ZONE (Shallows) |
| beacon1 | 1 | The Lattice Gate | 4 | `sectorCenterX(4)` | 120 | 0 | ALIEN_ZONE (Alien Void) |
| beacon2 | 2 | The Drowned Aisle | 12 | `sectorCenterX(12)` | 120 | 0 | HAUNTED_ZONE (HauntedHouse) |
| beacon3 | 3 | The Seam | 16 | `sectorCenterX(16)` | 120 | 0 | MARS_RUIN_ZONE (Seam) |

Each beacon has:
- `corruption` (0..1, +0.15 per death, decays at 0.005/s after 120s no deaths)
- `touched` (boolean, set when player enters 8m radius)
- `lastTouchTime` (for fast-travel cooldown)
- `downedPlayers` (Set of player indices, Phase 4 co-op)
- `beam` (visible light cylinder, opacity pulses when player grounded)
- `pad` (checkpoint slab, `.checkpoint=true`)
- `warpVis` (warp pad ring + column)

Fast-travel: **KeyR** at a touched beacon → warps to nearest other touched beacon (30s cooldown, breaks on damage).

---

## Five Combo Archetypes (Implemented)

### 1. The Ladder (Tutorial) — Sector 2→3
- **Nodes**: Trampoline → Orbit → Rail (mover) → Trampoline
- **Signals**: Pulse (land) → Hold (ride) → Pulse (land) → Pulse (land)
- **Behavior**: All platforms exist from start. Teaches wiring flow.
- **Vein**: Catmull-Rom spline through all 4 nodes, color = sector 2 plate.

### 2. The Trapdoor — Sector 5
- **Nodes**: Conveyor (Hold source) → Gate plate (gated by conveyor)
- **Signals**: Hold (while on conveyor) → Hold (gate solid only while held)
- **Behavior**: Gate plate **does not exist** (removed from `solids[]`, invisible) until conveyor actively ridden. Miss the jump and the plate despawns behind you.
- **Vein**: Conveyor → Gate.

### 3. The Nervous System — Sector 7→8
- **Nodes**: Pendulum (swing, autonomous clock) → Gate 1 → Gate 2
- **Signals**: Hold (activeFn = pendulum far side of swing) → Hold(gated) ×2
- **Behavior**: Phase plates solid only while pendulum is on far side. A moving-platform clock runs the local circuit — no player input needed.
- **Vein**: Pendulum → Gate1 → Gate2.

### 4. The Ruin — Sector 9
- **Nodes**: 4× Crumble slabs in a line
- **Signals**: Echo (on leaving) → extends next slab's crumble countdown
- **Behavior**: Each slab's Echo (fired on leaving) extends the next slab's `sp.t` (warn time) by `delay` (0.8s). Player must maintain the circuit while crossing — fall behind and the path crumbles.
- **Vein**: Through all 4 crumble slabs.

### 5. The Lie (Psychosis sector only) — Psychedelic sector
- **Nodes**: Fake Orbit (fake=true)
- **Signals**: Hold (fake) → no receivers
- **Behavior**: Convincing energy vein that **never brightens** (`fake: true` pins energy near 0). The tell: vein stays dim. No actual circuit function — pure deception.
- **Vein**: Orbit → phantom target 8 units away.

---

## Biome Sectors (17 total, left-to-right at Y=120)

| Sector | Zone | Native Platform Kind | Connector Types |
|--------|------|---------------------|-----------------|
| 0 | Shallows (SKYCITY) | static | orbit + mover |
| 1 | *shuffled* | *varies* | orbit + mover |
| 2 | *shuffled* | *varies* | orbit + mover |
| 3 | *shuffled* | *varies* | orbit + mover |
| 4 | Alien Void (ALIEN) | rail | orbit + mover |
| 5 | *shuffled* | *varies* | orbit + mover |
| 6 | *shuffled* | *varies* | orbit + mover |
| 7 | *shuffled* | *varies* | orbit + mover |
| 8 | *shuffled* | *varies* | orbit + mover |
| 9 | *shuffled* | *varies* | orbit + mover |
| 10 | *shuffled* | *varies* | orbit + mover |
| 11 | *shuffled* | *varies* | orbit + mover |
| 12 | HauntedHouse (HAUNTED) | crumble | orbit + mover |
| 13 | *shuffled* | *varies* | orbit + mover |
| 14 | *shuffled* | *varies* | orbit + mover |
| 15 | *shuffled* | *varies* | orbit + mover |
| 16 | Seam (MARS_RUIN) | pendulum | orbit + mover |

**Shuffled pool**: 11 ZONES (Psychedelic, Jungle, Frozen, Inferno, Storm, Hellscape, Glitch, Kaomoji, Beach, Rave, Horror) + FleshNest + Shroom = 13 zones distributed across sectors 1-3, 5-11, 13-15.

---

## Wiring System API (for Phase 2+)

```js
// Register a platform as a wiring node
wireRegister(solid, id, {
  signalType: 'pulse'|'hold'|'toggle'|'delay'|'echo',
  delay: 1, pulseLen: 0.4,
  receivers: ['nodeId2', ...],
  gatedBy: 'parentNodeId',      // this node only active while parent active
  fake: false,                  // Lie archetype: vein never brightens
  activeFn: () => boolean       // custom signal (e.g., pendulum phase)
});

// Register circuit for bookkeeping/debug
wireCircuit(name, sourceId, [nodeId1, nodeId2, ...]);

// Build visible energy vein (spline shader)
buildVein(name, sourceId, [[x,y,z], ...], colorHex);

// Call once after all nodes registered
resolveWiring();  // links string IDs → live objects

// Called every frame in main tick (betweenOn())
updateWiring(dt);  // evaluates signals, updates vein opacity/color
```

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

---

## Known Issues / Follow-ups

- **Performance**: 17 sectors × 3 rows × 5 platforms = 255 Canopy platforms + connectors + archetype platforms + filler = ~350 platforms. Draw calls OK but monitor F2 HUD.
- **Beam visual**: Beacon beams are simple cylinders; could add particle effects in Phase 2.
- **Downed state**: Stub only — full revive-by-looking mechanic in Phase 4 co-op pass.
- **Sanity reset**: Grounding anchor logic in beacon tick but `sanity` variable not yet implemented (Phase 2).
- **Circuit debug viz**: No dev overlay for wiring graph; add in Phase 2 if needed.