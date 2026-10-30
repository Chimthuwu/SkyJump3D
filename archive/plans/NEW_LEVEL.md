# THE BETWEEN — Level Design & Build Prompt

> **For Claude Code:** Build this level inside the existing `index.html` of **SkyJump3D**. Do not rewrite the engine. Reuse existing systems. Follow the implementation order in §11.

---

## 0. Your role and the task

You are a senior gameplay engineer working directly in the existing **SkyJump3D** repo. Build **one new playable level** called **"THE BETWEEN"** inside the existing `index.html`. Do **not** rewrite the engine. Reuse the existing systems: `buildLevel`, `buildNetwork`, `connect`, `makeSpecial`, `buildArena`, `spawnBiomeEnemy`, `setZone`, `updateEnv`, `WALKER_STATS`, the seeded RNG, and the co-op relay.

The level must feel completely different from the existing tower-drop / skyway / moon route while still being native to the game.

---

## 1. Hard repo constraints — read before designing

- **Single file:** everything goes into `index.html`. No new build step, no external assets. Textures, meshes, audio, and UI must be procedural.
- **Engine:** Three.js r160 via importmap. Use the existing `retroMaterial()` pipeline and `Object3D.add` monkey-patch.
- **Seeding:** the existing level is deterministic from `11 + level*97`. The new level must also be deterministic per seed and identical on every co-op client. **Do not send level geometry over the network.**
- **Co-op:** relay already supports rooms ≤8, host-authoritative enemies, 10 Hz snapshots, 15 Hz player poses. **This level is tuned for 4P**, but must not hard-crash if a 5th–8th joins; just clamp the four designated Beacons to the first four slots and let extras spawn at Beacon 1.
- **Physics:** AABB solids, 1/120 s substeps, coyote time, mantle, step-up ≤0.55 m. Do not replace the physics loop.
- **Existing special platforms:** `makeSpecial` already supports movers, crumblers, psychedelic (camera wobble / inverted controls). New wiring must **layer on top** of these, not fork them.
- **Existing zones:** `ZONES` currently includes Jungle, Frozen, Inferno, Storm, Horror, Psychedelic, plus newer Beach, Rave, Hellscape, Glitch, Kaomoji. **Use every biome currently defined** — plus any custom dungeon biomes present in your local branch (e.g. Mushroom, Haunted House, Pussy Palace). Do not invent a parallel biome enum.
- **Existing enemies:** Walker, Gunner, Charger, Shield, Bomber, Drone, Dinosaur, Gorilla, FrozenStalker, Infernal, StormWraith, Stalker, plus Kaomoji blobs. These must remain **behaviorally consistent** — only re-skin them.
- **Existing bosses:** Guardian mini-boss per arena. Reuse the Guardian framework for all six new bosses.
- **Y=0 is a hard floor.** No geometry below `y = 0`. The existing `VOID_Y = -160` loop must be disabled in this level; replace it with a hard `y=0` collider and spawn-clamp.

---

## 2. Level identity

**Name:** THE BETWEEN
**Theme:** Lovecraftian. The orbital ring between the Moon and Mars is a **seam** in reality. The six dungeons are **organs** of a thing older than the Moon. The Moon is its **eye**. The Gravity Well is its **pupil**.

**Tone:** cyclopean scale, sickly bioluminescence, unreadable script, geometry that almost closes, whispers that are almost words. The level should feel **wrong in a way that is beautiful**, not gory for shock value. Gore remains, but it is **ritualistic and wrong**, not slapstick.

**Critical:** this is **not** a re-skin of the existing sky-city. The skyline is gone. There is no tower. The player spawns on a **horizontal Canopy spine**, not a roof.

---

## 3. Macro layout

```
        ☾ MOON  (Gravity Well launch only — no skyway)

  ══════ SPAWN HEIGHT — THE CANOPY (horizontal spine) ══════
   [Biome sectors strung left-to-right]
     │        │        │        │        │        │
   ┌─┴──┐  ┌─┴──┐  ┌──┴─┐  ┌──┴─┐  ┌───┴──┐ ┌───┴───┐
   │ D1 │  │ D2 │  │ D3 │  │ D4 │  │  D5  │ │  D6   │  ← six monoliths
   │    │  │    │  │    │  │    │  │      │ │       │
   └─┬──┘  └─┬──┘  └──┬─┘  └──┬─┘  └──┬───┘ └───┬───┘
     ▼        ▼       ▼       ▼       ▼         ▼
  ══════════ Y = 0 — THE FOUNDATION ══════════
              ▓▓ GRAVITY WELL ▓▓
```

- **Canopy:** a left-to-right horizontal spine at spawn height. All six dungeon mouths branch off it. This is the only sane part of the level.
- **Six monoliths:** full-height vertical structures. Entry at the top (Canopy), boss at the bottom (a floor just above `y=0`). You **descend** through the dungeon.
- **Foundation:** a single massive platform at `y=0`. Every biome is present here in one scarred mosaic. The **Gravity Well** sits at the center.
- **Return geysers:** at the bottom of each dungeon, a low-gravity geyser launches the player back to the Canopy near their Beacon. This keeps the loop tight; players never climb back up manually.
- **Moon:** reached **only** via the Gravity Well after all six bosses are dead. **No skyway, no bounce-pad staircase, no platform chain.** The existing `buildSkyway` must not run in this level.

---

## 4. Permanent low gravity — global, not zone-only

The entire level must feel low-gravity, not just one biome.

- Introduce a level-scoped constant, e.g. `BETWEEN_GRAV_MULT = 0.35`. Apply it in the physics step **only while the player is in this level**, so existing levels are untouched.
- Retune `JUMP` and `JUMP2` proportionally so maximum jump height remains similar in **time-to-apex** but the **air time is much longer**. The goal is long, floaty, readable arcs — not moon-high jumps that overshoot platforms.
- Fall damage thresholds must scale down accordingly; otherwise every landing kills.
- The hoverboard glide, wall-climb, and double-jump remain exactly as they are. Low gravity should **amplify** them, not replace them.
- The existing `spaceK` gravity fade can remain for the Gravity Well launch, but the **base dungeon gravity** must already be low.

---

## 5. Platform network — the nervous system

Every platform is a node in a **wired graph**. Two families coexist:

### 5.1 Mechanical platforms (use existing `makeSpecial` variants + additions)

- **Trampoline** — bounce; exit vector = surface normal × force.
- **Conveyor** — pushes along its surface.
- **Vanisher** — phased cycle; must flicker/fade before despawning.
- **Growth** — pulses scale on a cycle.
- **Rail** — slides along a line, loops.
- **Orbit** — arc/circle around a hub.
- **Phase** — alternates solid / intangible; player can fall through.
- **Rotator** — spins; landing surface tilts.
- **Pendulum** — swings from an anchor.
- **Chaos-bounce** — high bounce, low accuracy.
- **Void** — not a platform; hazard or teleporter.
- **Unstable** — visibly randomized behavior.

**Do not change the existing colour definitions.** Behavior is identified by the colour/shape language already established. Hybrids use split/gradient colour.

### 5.2 Biome platforms

Every biome contributes a **native platform type**, skinned with that biome's material, but **behaving per the biome's existing gameplay effect** (e.g. Frozen = slippery, Jungle = weaker jumps, Psychedelic = low gravity already). Mechanical platforms keep their behaviour inside every biome sector; only the **skin** changes. This is how the mosaic stays readable.

### 5.3 Wiring system — mandatory

Each platform has optional `signalOut` and `receivers[]`:

- **Pulse** — fires once when the player lands.
- **Hold** — continuous while occupied.
- **Toggle** — flips receiver state on bounce.
- **Delay** — pulse, then N seconds.
- **Echo** — fires when the player **leaves**.

Signals travel along **visible energy veins** (a spline shader between linked nodes), coloured by source, brightening when active. Some platforms **do not exist until their parent is active** — this is the gating mechanism. Cascades are expected: one landing can trigger a trampoline → conveyor hold → delay → phase plate solid → rail arrives.

**Author at least 20 wired circuits in the Canopy and one local circuit per dungeon floor.** At least three circuits must be **global** (source and receiver on opposite ends of the Canopy).

### 5.4 Required combo archetypes

Implement at least these, using existing `makeSpecial` where possible:

- **The Ladder:** trampoline → orbit → rail → trampoline. No vanishing; tutorial circuit.
- **The Trapdoor:** vanisher is invisible until its parent conveyor is held. Miss the jump and the plate despawns behind you.
- **The Nervous System:** phase plates are solid only while a pendulum is on the far side of its swing. A moving-platform clock runs the local circuit.
- **The Ruin:** crumbling slabs that respawn via a vanisher delay. The player must maintain the circuit while crossing.
- **The Lie (Psychosis sector only):** a fake orbit with a convincing vein that leads nowhere. The tell is that the vein does not brighten.

---

## 6. The six monoliths — unique mechanics

Each dungeon is a **full-height vertical descent** from Canopy to `y=0`. Boss floor sits just above the Foundation. Each has a **unique player verb, system, and failure state**. None may share a core mechanic.

### D1 — GLITCH.EXE

- **Verb:** Distrust the game.
- **Mechanic:** platforms spawn/despawn on a cycle; some are momentum-gated. HUD lies; inputs swap for 2–3 s with a screen-tear tell. Fake "crash" freezes the game but the world keeps simulating.
- **Boss:** `null_pointer` — T-posing untextured humanoid. Teleports by crashing. Spawns fake platforms; its real platform has a wireframe tell.

### D2 — VHS REWIND

- **Verb:** Record / rewind.
- **Mechanic:** record your last ~6 s as a **solid ghost platform**; rewind only yourself, not the world. Finite tape. Fast-forward speeds the world.
- **Boss:** THE TAPE — records your attacks and replays them. Kill it by feinting so it replays the feint.

### D3 — THE GULLET

- **Verb:** Sync to the body.
- **Mechanic:** breath cycle (~4 s) narrows/pulls up on inhale, widens/pushes down on exhale. Digestion meter fills while still. Organic platforms recoil when hit. Sphincter doors cycle.
- **Boss:** THE UVULA — attacks on the heartbeat; off-beat windows are safe. Every hit gags the body and inverts gravity for 1 s.

### D4 — PSYCHOSIS

- **Verb:** Doubt the lie.
- **Mechanic:** **Sanity** drains as you descend. Hallucinations spawn **on top of** real content: fake enemies, fake platforms, fake death screens, fake UI, fake "Player 2", gaslighting geometry. The game **learns your habits** and targets them. Every hallucination has a **consistent 1-frame visual/audio tell** (colour channel shift, wrong shadow direction, off-key audio, mismatched reflection). Grounding anchors reset calibration. Lower sanity = subtler tells.
- **Boss:** THE OBSERVER — exists only while observed; heals when looked away. Fights using fake copies; the real one has the tell.

### D5 — LIMINAL POOLS

- **Verb:** Observe.
- **Mechanic:** platforms exist only while observed or recently observed; a **memory meter** drains as you move. Rooms shuffle when unobserved; "forward/down" is always guaranteed. Sound attracts entities; low gravity means you are often silent. Entities move only when unobserved.
- **Boss:** THE THING IN THE POOL — direct eye contact kills you. Fight it via water reflections while keeping your footing observed.

### D6 — FRACTAL DESCENT

- **Verb:** Reorient gravity.
- **Mechanic:** player ability rotates gravity 90° onto nearby surfaces. Non-Euclidean looping tower. **There is no bottom** — fall far enough and you loop to the top. The only failure is stopping.
- **Boss:** THE ARCHITECT — exists in all four orientations at once. Reorienting exposes one body and hides the others. Hit each body once in sequence.

---

## 7. Enemies — consistent, new, and surreal

### 7.1 Consistency rule

Every existing enemy family must behave exactly as it does elsewhere. Only **skin and palette** change. Do not fork `WALKER_STATS` or AI for existing types.

### 7.2 New common enemies (systemic, across sectors)

Add these to `WALKER_STATS` / `makeWalker`:

- **Watcher** — floating eye; only exists while observed, heals otherwise.
- **Crawler** — moves through corners; path bends at 90°.
- **Whisperer** — invisible; audio-only tell; fight by sound direction.
- **Spawn-swarm** — splits when damaged; lure off ledges.
- **Amalgam** — fused remains of killed enemies; inherits their attacks.
- **Shell** — harmless until ignored; grows into boss-tier threat.
- **Angle** — single-vertex silhouette; hurts to look at, closes distance when you don't.

### 7.3 Surreal uniques (one per dungeon, set-piece only)

Do **not** make these systemic; script them per dungeon:

- **GLITCH.EXE — `[Untitled]`:** untextured humanoid that teleports between frames of an unseen animation. Replaces your inputs for 2 s. Kill by doing something it cannot predict.
- **VHS REWIND — The Scrub:** visible only in rewind; right behind you. Rewinding past it lets it act.
- **THE GULLET — The Second Mouth:** mouth inside a mouth; swallows space; arena shrinks. Kill by feeding it a platform.
- **PSYCHOSIS — The Other Player:** perfect copy of you; completes objectives you didn't want. Dismiss by doing nothing for 30 s.
- **LIMINAL POOLS — The Resident:** always exactly one room away. Cannot be fought; only outrun downward. It is the dungeon's clock.
- **FRACTAL DESCENT — The Vertex:** more corners than possible; moves in directions your gravity forbids. Cannot be killed; reorient to lengthen its path.

### 7.4 Sanity and enemy presentation

A single global **sanity float** across the level. It drains with descent, enemy kills, geometry exposure, and whispers; it resets at Beacons and grounding anchors. At low sanity:

- Existing enemies gain **variant skins** (extra eyes, extra corners).
- The Psychosis hallucination rules bleed into other dungeons.
- Whispers enter the audio bed.
- Co-op: other players' enemies flicker into your view.

This is the Lovecraftian system; do not confine it to D4.

---

## 8. Four spawn Beacons (4P co-op)

Replace the existing "six home towers" logic for this level with **four Beacons**. Do not break the existing six-tower system for other levels; gate this behind the new level's build path.

| Beacon | Position | Biome anchor | Role |
|---|---|---|---|
| 1 **The Shallow Landing** | Far left | Sky-city / cloud | Tutorial-friendly, bright |
| 2 **The Lattice Gate** | Left-center | Alien void / mushroom | Wiring hub; visible circuitry |
| 3 **The Drowned Aisle** | Right-center | Liminal / haunted | Flooded, tense, loud whispers |
| 4 **The Seam** | Far right | Mars / ruined | Closest to monoliths; eye largest |

**Rules:**

- **Two lobby modes:** Team Drop (all 4 at one Beacon) and Scattered Drop (one player per Beacon).
- **Respawn at last-touched Beacon**, not at level start. Dying far from your Beacon is a real cost.
- **Beacon = grounding anchor.** Standing in its light resets sanity. It is the only thing the thing cannot fake.
- **Fast-travel** between touched Beacons on a 30 s cooldown; breaks on damage.
- **Beacon corruption:** repeated deaths at one Beacon corrupt it; corrupted Beacons reset less sanity and delay the Gravity Well. Four floats; cheap.
- **Downed state:** ~10 s. A teammate revives you **by looking at you**; if nobody looks, you ground out to your Beacon.
- **Return geysers** map D1/D2 → Beacon 1, D3/D4 → Beacon 2, D5/D6 → Beacon 3/4.

---

## 9. The Moon route — Gravity Well only

- Remove / disable `buildSkyway` for this level. **No platform chain to the moon.**
- At the center of the Foundation (`y=0`), build the **Gravity Well**: an inverted funnel.
- At the bottom of each of the six dungeons, place a **Gravity Anchor**. Each boss death activates its anchor and shoots a visible beam up the dungeon shaft.
- When **all six anchors are active**, the Well inverts and becomes a launch mechanism.
- **Launch is a skill sequence, not a cutscene:** a single colossal low-gravity pulse fires the player from `y=0` to the Moon. The ascent is a gauntlet of orbital debris, satellite fragments, and corruption bleed. The player steers with glide and must land precisely.
- Failure falls back to `y=0` and retries the Well; no death.
- Reaching the Moon triggers the ending: the eye **blinks**. No new scene required; a trigger volume + eye animation + credits/toast.

---

## 10. Lovecraftian presentation

- **Palette:** abyssal blue, pallid flesh, sickly green, void purple, rust. Mutate the existing biome palettes toward this.
- **Scale:** everything is too big and too old. Stairs for bodies that weren't ours.
- **Light:** bioluminescence in the deep; the Foundation is lit by things living in it.
- **Geometry:** corridors whose ends you can see but never reach; stairs that loop (this is a symptom, not just D6).
- **Text:** signage and HUD fragments render in a script that almost parses.
- **Audio:** whisper layer per enemy family; learn the whispers to fight in the dark.
- **Narrative:** you are a courier, not a hero. Killing the six bosses is **feeding it**, which is why the Well opens. The Moon is an invitation.
- **Existing gore:** keep it, but make it ritualistic and wrong, not comedic.

---

## 11. Implementation order (do not skip)

1. **Scaffold the level switch.** Add a new level branch so this level can be selected without breaking the existing tower-drop.
2. **Global low gravity.** Add `BETWEEN_GRAV_MULT`, retune jump/fall damage, verify traversal.
3. **Canopy spine.** Build the horizontal spine with biome sectors and the four Beacons. No dungeons yet.
4. **Platform wiring.** Add signal types, vein shader, and 20+ circuits. Verify the five combo archetypes.
5. **One dungeon end-to-end.** Build **GLITCH.EXE** first as the reference implementation: descent, mechanic, boss, anchor, return geyser.
6. **Clone the pattern for D2–D6**, each with its own mechanic script. Do not share mechanic code between dungeons.
7. **Enemy roster.** Add the seven common enemies and the six uniques. Consistency-check existing enemies.
8. **Sanity system.** Global float, grounding anchors, variant skins, whisper layer.
9. **Gravity Well + Moon launch.** Interlock with the six anchors. Add the steering gauntlet.
10. **Co-op pass.** 4 Beacons, team/scattered modes, downed state, fast travel, beacon corruption.
11. **Performance pass.** The repo's perf audit already flags platform draw calls and static matrices. Batch/instance where possible; keep the existing F2 HUD working.

---

## 12. Acceptance criteria

- The level is reachable from the menu / `buildLevel` path without editing any other level.
- A solo player can spawn at Beacon 1, traverse the Canopy horizontally, descend all six dungeons, kill all six bosses, and launch to the Moon.
- No geometry exists below `y=0`.
- Existing enemies behave identically; only skins differ.
- Every platform in the Canopy is part of at least one wired circuit.
- All six dungeon mechanics are playable and distinct; no two share a verb.
- Co-op with 4 players works in both Team Drop and Scattered Drop.
- The Moon cannot be reached by any route other than the Gravity Well.
- No new external assets; all procedural.
- The F2 perf HUD remains accurate and the level does not exceed the existing draw-call budget by more than 20%.

---

## 13. What not to do

- Do not rewrite `index.html` into modules.
- Do not add a bundler or new dependencies.
- Do not replace the existing physics loop.
- Do not change the existing colour language.
- Do not change existing enemy AI for the sake of the new level.
- Do not build the Moon as a skyway.
- Do not put anything below `y=0`.
- Do not make the six dungeons share a mechanic system.
- Do not make the level non-deterministic across co-op clients.

---

# Agent Plan — THE BETWEEN

## The Four-Agent Plan at a Glance

| Agent | Role | Owns | Why |
|---|---|---|---|
| Hermes | Lead Coordinator / Architect | Scaffold, global systems, sanity, integration, final merge | Persistent memory + orchestration — it's the tech lead |
| Claude Code | Senior Implementer / Reference Dungeon | GLITCH.EXE end-to-end, PSYCHOSIS, FRACTAL DESCENT | Best at complex, high-quality code; subagent orchestration for parallel work |
| Open Code | Systems & Platform Engine | Platform wiring, Canopy spine, performance batching | Terminal-native, LSP-aware, diagnostics-fed feedback loop |
| Freebuff | Parallel Grunt Work / Enemies & Bosses | Enemy roster, six boss reskins, simpler dungeon clones, presentation | Free, fast, specialized subagents for parallelizable work |

## Phase-by-Phase Assignment

### Phase 0 — Hermes: Plan & Scaffold
Goal: Get the level selectable and the repo prepped without touching anything else.

- Read the full design doc. Memorize the constraints and acceptance criteria.
- Create a BETWEEN branch and a `BETWEEN_NOTES.md` handoff log.
- Implement the level switch scaffold — a new branch in `buildLevel` that routes to `buildBetween()` without breaking the existing tower-drop.
- Add the global low-gravity constant (`BETWEEN_GRAV_MULT = 0.35`) gated behind the new level flag. Retune `JUMP`/`JUMP2`/fall-damage and verify traversal with a placeholder flat platform.
- Add the `y=0` hard floor and disable `VOID_Y` for this level only.
- Write a handoff doc (`PHASE0_HANDOFF.md`) describing exactly what changed, which functions were touched, and what the next agent should assume.

Output: Working level switch, low gravity, y=0 floor. No geometry yet.
Handoff to: Open Code.

### Phase 1 — Open Code: Spine & Wiring
- Build the Canopy spine — biome sectors strung left-to-right at spawn height. Use every biome from `ZONES`, plus Mushroom / Haunted / Pussy Palace if present.
- Build the four Beacons as scene instances with slot-tint parameters; spawn/respawn/fast-travel logic.
- Implement the wiring system: `signalOut` / `receivers[]`, Pulse/Hold/Toggle/Delay/Echo, visible energy-vein spline shader, interdependent spawns.
- Author 20+ circuits in the Canopy (≥3 global). Implement the five combo archetypes: Ladder, Trapdoor, Nervous System, Ruin, Lie.

Output: `PHASE1_HANDOFF.md` + `CANOPY_CIRCUIT_MAP.md`.
Handoff to: Claude Code.

### Phase 2 — Claude Code: The Reference Dungeon
- Build D1 — GLITCH.EXE end-to-end (descent, cycle mechanic, HUD lies, null_pointer boss, anchor + beam, geyser).
- Build D4 — PSYCHOSIS (sanity drain, hallucination spawner, 1-frame tells, habit learning, THE OBSERVER).
- Build D6 — FRACTAL DESCENT (gravity-reorient ability, looping tower, THE ARCHITECT).
- Write `DUNGEON_TEMPLATE.md` describing the pattern.

Handoff to: Freebuff.

### Phase 3 — Freebuff: Enemies, Bosses, and the Simple Dungeons
- Seven new common enemies (Watcher, Crawler, Whisperer, Spawn-swarm, Amalgam, Shell, Angle) in `WALKER_STATS`/`makeWalker`; six surreal uniques; consistency check.
- Three template dungeons: D2 — VHS REWIND, D3 — THE GULLET, D5 — LIMINAL POOLS.
- Boss reskins for D1/D4/D6; presentation layer (palette, bioluminescent lighting, whispers, script HUD).

Output: `PHASE3_HANDOFF.md` + `ENEMY_CONSISTENCY_REPORT.md`.

### Phase 4 — Hermes: Integration & Final Systems
- Sanity system global pass; corruption bleed; Gravity Well + Moon launch; steering gauntlet; Moon ending.
- Co-op pass: 4 Beacons, Team/Scattered Drop, downed state, fast-travel, beacon corruption, geyser mapping.
- Performance pass (batch/instance, F2 HUD, ≤20% draw-call budget); acceptance-criteria audit (§12).

Output: `BETWEEN_NOTES.md` final audit; merge to main.

## Coordination Protocol

| Handoff | Artifact | Format |
|---|---|---|
| Hermes → Open Code | `PHASE0_HANDOFF.md` | What changed, what to assume, open questions |
| Open Code → Claude | `PHASE1_HANDOFF.md` + `CANOPY_CIRCUIT_MAP.md` | Circuit graph, beacon IDs, archetype demos |
| Claude → Freebuff | `DUNGEON_TEMPLATE.md` + `PHASE2_HANDOFF.md` | The GLITCH.EXE pattern, boss-framework notes |
| Freebuff → Hermes | `PHASE3_HANDOFF.md` + `ENEMY_CONSISTENCY_REPORT.md` | Roster status, consistency-check results, dungeon completion |
| Hermes → You | `BETWEEN_NOTES.md` | Final audit, acceptance-criteria checklist, known issues |

Git discipline:
- A BETWEEN branch carries the work; sub-branches if convenient (`between/scaffold`, `between/spine`, `between/dungeons-claude`, `between/dungeons-freebuff`).
- Every session: build ONE time-slice, verify headless (`perf/_smoke.cjs` pattern + new between test), commit before the next session; single-file `index.html` — avoid parallel agents writing it in the same window.
