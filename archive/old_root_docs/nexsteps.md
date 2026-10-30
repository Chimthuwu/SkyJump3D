⛔ **ARCHIVED 2026-10-31 — HISTORICAL ONLY. DO NOT FOLLOW.**

> This document is kept for history, not as instruction. The ONLY active instruction sources are:
> 1. `TODO.md` (repo root) — LEVEL IDENTITY + the user's world-rules brief + P0/P1/P2 work lists and the dated session log.
> 2. `PERFORMANCE_PLAN.md` — the perf playbook. 3. `OVERVIEW.md` / `README.md` — describe the game as built.
>
> Everything below that contradicts those files is VOID — notably: THE BETWEEN is reference material only; the below-zero banding (Caverns 1–14 → Horror/Hellscape → Psychosis) is obsolete (caverns to -666, fire/hell ONLY below -666, never above); dungeon ring-node placement and level layouts are superseded by the LEVEL IDENTITY anti-clone rules; multiplayer rooms are 6, not 8.

---

# NEXT STEPS — SkyJump3D (plan written 2026-10-31, after the doc audit)

Status baseline: all 4 levels built and headless-verified (descent / overgrowth / ascent / skyfall),
6 dungeons + real room props each, asteroid set-piece on every planet leg, doc audit + archive
reorg committed (`9217d7c`). Everything below is ranked by (impact ÷ effort), verified by grep
against `index.html` today. Working doc names in this file are approximate line anchors —
search by function name; `index.html` is a single ES module ~17,320 lines.

---

## P0A — LEVEL IDENTITY REWORK (new top priority, user 2026-10-31) — "mechanics translate, architecture doesn't"

User's bottom line: levels 2–4 still read as clones of Lvl1; configuration re-arrangements aren't enough. THE BETWEEN will likely go unused as a level; harvest its parts (D1–D6 dungeon kits / VHS+GULLET+LIMINAL+FRACTAL zones / surreal uniques + bosses) into other levels when they fit.

**World rules (user 2026-10-31 brief, all levels):**
- All biomes on every level; **fire/hell only below depth 1** (hard gate in `zoneFor`/`pickAmbientZone`, not just the ladder); **caverns run to -666, then hell** (rework `depthZoneFor` ~12832 — caverns are only rungs 1–14 today and Horror/Hellscape start around 15).
- **Spawn differs per level:** different height, different location, different surrounding biomes (own start-height landmark + per-level seeded start-zone neighbourhood; `universeCentre` x/z stays for netcode).
- **Invariants:** moon, space planets, 6 dungeons, all four retained on every level.
- **Platform shape/size variety per biome** (per-zone weighted shape pools in the platform builders — `addSlab` accepts w/d/h today).
- **Marker decision:** biomes are colour-dictated; the wild post-moon space platforms are every colour AND shape without affecting biome. Proposal: **truth lives on the underside + rim; top face is decoration.** Biome platforms = zone-coloured underside + thin zone-coloured edge glow. Neutral/wild platforms = stone/steel-grey underside + hazard-stripe rim + no coloured glow, at ANY shape. Material-based → scales to any shape mix; applies retroactively to the space-route builder.
- **Randomize the bottom-ladder extension:** `ladderExtend` (~13538) adds a **fixed 14** rungs per landing → roll 14–112 (current = min, 8× = max) from the existing seeded `R()` chain (co-op determinism holds), built via the sliced/job pattern so 112 platforms don't hitch in one tick.

---

**Clone vectors (verified in code):** movement/physics, weapons, enemy AI + `WALKER_STATS`/`AI_ALIAS`, biome flag system, vehicles, co-op `universeCentre(slot)` spawn contracts, 6-dungeon count, moon/space/hell ladder.

**Stop sharing (the verified clone vectors):**
1. fixed dungeon ring-node slots — same slots as Lvl1 everywhere → per-level dungeon geometry (branch knots / ridge caves / island clusters)
2. identical `UNIVERSE_R = 600` six-tower ring (~937) → per-level ring radius/angles/tower styles, netcode untouched
3. the same `buildFlow`→`buildCommons`→`buildHubPortalLoop` pass chain (~5697) → per-level pass order/replacements
4. same platform histogram everywhere → per-level platform mix (conveyor-heavy / ledge-run-heavy / drifting-crumble)

**Process:** one level first as the pattern (Overgrowth recommended), verified by `perf/_layout_diff.cjs` + a new sameness probe (dungeon-anchor geometry, hub-angle histogram, pass-sequence fingerprint), then roll out per level.

---

## P0 — quick wins (each ~1 session or less, no risk to worldgen)

~~1. Biome music table~~ — **DROPPED 2026-10-31:** the user added their own music
(`music/`, `music_raw/` directories) — nothing to plan against the `MUSIC` table for now.

**1. VOICE table completion** — `VOICE` (`index.html` ~16590) covers 8 kinds only; every newer
enemy variant (demon, skeleton, glitchling, kaomoji, dinosaur, stalker, alien, duck, tapehead,
crthead, cabinet, pixelghost, popstar, grandpa…) silently falls back to `walker` voice /
colour / name via `voiceKind` (~16597). Add one line per variant: pitch, rate, `col`, `who`.
The `col` value should match the variant's kit colour (see `biomeAccent` map ~1243 for hints).
Audio-only — no worldgen risk. (Related but separate: the USER's own music tracks in `music/`
are fine as-is — do not touch; but if per-zone *volumes* feel off later, `MUSIC_VOL` ~13717 is
the only knob to turn.)

**2. Human-eyeball debt sweep (playtest pass, no code)** — everything recent is only
headless-verified. One sitting in a real browser, checking:
- the 18 new dungeon room props (do Overgrowth/Ascent/Skyfall rooms read as themed?)
- Pussy Palace cloud-parting at ~15 m (reveal ramp feel, does it re-close)
- level macro-shapes in hand (Overgrowth boughs, Ascent switchbacks, Skyfall cluster bridges)
- the asteroid set-pieces from 5a5dfd0 (hop-stone pacing, loot density, beacon visibility)
- the viewmodel framing after the `vmScene`/`vmCamera` near-clip fix
- **the user's new music in context** (how the own tracks sit in levels vs. the synth
  `musicTick` layer — since `musicTick` also plays its procedural drums/bass over whatever is
  on the `musicBus`, make sure the two layers don't fight before assuming the song choice is wrong)
Log findings into `todo.md` per session convention so the next agent starts there.

**3. Toast/banner polish + copy** — "KeyE" raw-keycode leak in block-placer toast; HUD banner
overlaps the stats panel top-left (audit bugs #2/#3, both trivial). Also toasts + label tables
(`clusterThemes` ~1732, `zoneLabel` ~1778) still lack the newer zones → generic "ZONE" labels.

---

## P1 — performance foundation (the big wins; measure every step)

**Protocol (from PERFORMANCE_PLAN.md, non-negotiable):** one change per commit, before/after
numbers from the same device + same 3 reference scenes (spawn roof / arena fight / Alien Void),
save baselines as `perf/baseline-<sha>.json`. Real-GPU F2 captures still missing for every claim
so far — do one before starting (press F2 on a real GPU browser, send the panel) to have an
honest baseline.

**4. Freeze static matrices (full)** — partially done: `scene` + `lvl` roots are frozen
(~842, ~934). The remaining win is per-object: after each `buildLevel`, set
`matrixAutoUpdate=false; updateMatrix()` for every non-animated object. Determine the exempt
list empirically (run 60 frames headless, record whose position/rotation/scale changes — movers,
enemies, spinning pickups) instead of hard-coding it. `updateMatrixWorld` measured 19.5 ms/call
at 65k objects; this is the single biggest CPU item.

**5. Instance the static world** — ~59k meshes / 28.9k unique materials / 44.7k geometries.
- Platforms (slab/plate/under-cone/bullseye/springs) → 4–5 `InstancedMesh` + `setColorAt`
  (the Alien route + asteroid debris already do this — pattern exists at ~3086, ~2758).
- Coins / ammo / hearts / weapon pickups (~8,242 items) → one InstancedMesh per type,
  update near-player instances only, `taken` hides the instance.
- Rails, road segments, halo boxes, ground pads → `mergeGeometries` per ~250 m cell
  (per-cell frustum culling stays free). One merged chunk already exists at ~14895 (`noCull`).
- Payoff: delete the platform distance-cull (CULL_R 290 / CULL_BIG_R 450) and keep the full
  silhouette draw distance — that was the design goal all along.

**6. Enemy streaming** — ~1,157 enemies alive at boot (~19 meshes each). Region budget
(e.g. ~120 live within ~450 m): spawn on approach, despawn behind, keep per-arena
`cleared` flags so it persists. Also fixes multiplayer snapshot weight (host simulates all).
Cheap pre-step while in there: shared per-variant materials (currently per-enemy `lam(...)`)
and instanced aura/beacon/aggro-cone sets.

**7. Adaptive resolution scaler** — target 60 fps from the F2 frame-time ring: drop render
scale 0.6–1.0 when avg > 18 ms for 1 s, recover slowly. `setPixelRatio(Math.min(dpr,2))*scale`
already exists (~788) — this just automates the dial. Consider FXAA when scaled instead of MSAA.

**8. CDN fallback / robustness** — Three.js comes from jsdelivr with no fallback (offline =
blank page). Vendoring it (esbuild is already in node_modules) also enables minification and
module splitting; at minimum, add a second importmap fallback or inline error state.

---

## P2 — design & feel (after perf, or interleaved when context-switching would help)

**9. Kaomoji / Glitch / Hellscape become real mechanics biomes** — currently cosmetic-only
(AUDIT §3.2/3.3 has full designs). Highest-value items: mochi squash-and-stretch bounce +
face-mood escalation tied to HP/deaths (Kaomoji); beat-reactive flickering/ghost platforms
(Glitch); heat line + brimstone vents (Hellscape). These ship as small mechanics attached to the
existing zone flags (precedent: `weakJump`/`lowGrav`/`thermal`/`wind` already added for
the 9 new zones — extend the same matchers).

**10. Warp destination list UI** — Q-cycling works up to ~8 destinations, is painful beyond.
A small panel (list + nearest-first ordering) at the warp pad, plus a cap of ~1 checkpoint
per region (they're no longer respawn-fast-travel, they're chapter gates).

**11. Style meter** — unify bullseye / trick / kill combos into one multiplier with rank
letters, banked on landing. Feeds from systems that already exist; no new verbs.

**12. Death marker / banked-at-checkpoint** — souls-like one-shot warp to retrieve dropped
loot; makes deaths interesting without softening the punishment.

**13. Authored set-pieces + far landmarks** — readable route rhythm (reveal → gauntlet →
climb → breather → boss) per chapter, plus 2–3 giant lit silhouettes visible from spawn
(silhouettes are free perf-wise once item 5 is done — static, fog-exempt, few and large).

**14. Biome-mechanics backlog / hybrids** — AUDIT §3.4 (two overlapping noise fields, 6–8
curated hybrids, unify zoneFor/biomeForRegion/planet biomes[] into one `biomeAt(x,y,z)`).
Design debt from three duplicated systems migrating toward one.

---

## Later / opportunistic

- Boss-as-level, grapple/zipline, daily seeded run + leaderboard, photo/replay mode.
- Full `PLAN-UNIVERSES` per-universe generation (six spawn slots exist; distinct mirror
  universes don't — decide if this survives contact with the 4-level plan or gets retired).
- `localStorage` key migration off `towerdrop.*` (cosmetic, only do when names are stable).
- Deploy: push when the next playable milestone is ready, then `npm run deploy:pages`
  (`git push` alone does NOT deploy — the Pages project is direct-upload; see README).

---

## Standing rules (repeated from the repo's own docs — they keep getting broken)

- Read `todo.md` top entry before starting; append a dated log entry at the TOP when done.
- `node perf/_synchk.cjs` after every edit; `node perf/_brace_scan.cjs` for brace balance;
  boot a headless page through a `perf/_asteroid_smoke.cjs`-style harness for anything touching
  buildLevel/multiplayer; never trust a "works" claim that has no probe output in the entry.
- Determinism is sacred: no `Math.random()` in seeded worldgen paths (checked 2026-10-31 —
  currently clean, keep it that way).
- Everything not yet eyeballed on a real GPU is explicitly marked as such above.
- Leave the user's own music alone unless they ask (`music/` is theirs now — no per-zone
  music table work without an explicit request).
