# archive/ — HISTORICAL ONLY. DO NOT FOLLOW.

> ⛔ **Everything in here is a historical document, not an instruction.** The plans, handoffs, specs and
> reports in this folder describe *earlier states of the project* and rules that have since been
> **explicitly superseded by the user** (2026-10-31). New agents: **do not implement anything from this
> folder.** Every instruction-shaped doc below carries a ⛔ banner saying the same thing.
>
> Notably VOID everywhere in here: the below-zero depth banding (the old Caverns 1–14 → Horror/Hellscape →
> Psychosis ladder — the new rule is **caverns to -666, fire/hell ONLY below -666, never above the
> caverns anywhere**); fixed dungeon ring-node placements and level layouts (superseded by the
> LEVEL IDENTITY anti-clone rules in `TODO.md`); THE BETWEEN as a playable level (it stays behind its menu
> filter and is **reference material / harvest stock only**); multiplayer room size (**6 players**, not 8).

## New agents — the only active instruction sources are at the repo root

1. **`TODO.md`** — live task list / agent handoff channel. Read FIRST. Contains: LEVEL IDENTITY
   (user direction on what must stay shared vs per-level), the world-rules brief A–F, the audit-pass
   code anchors, P0/P1/P2 work lists, and the dated session log (append yours at the top).
2. `PERFORMANCE_PLAN.md` — the perf playbook: harness/protocol/measurement rules for optimisation commits.
3. `README.md` / `OVERVIEW.md` — what the game is, as currently built.

## handoffs/ — completed phase handoffs (THE BETWEEN)

One document per completed build phase of THE BETWEEN. Their checklists **are shipped and verified in
`index.html`** — historical record only. THE BETWEEN itself stays built behind its menu filter; its
D1–D6 dungeon kits, surreal uniques and bosses are harvest candidates for other levels (see
`TODO.md` LEVEL IDENTITY). `PHASE0_HANDOFF.md` … `PHASE4_HANDOFF.md`.

## plans/ — older plans, specs and reports

- `AGENT_INSTRUCTIONS.md` — stale agent briefing from the ~4,050-line era of `index.html` (~17,300 now).
- `PLAN.md` — vehicles plan (car / hover-bike) — **shipped** (`makeBuggyMesh`/`makeBikeMesh`/`updateVehicleFx` verified 2026-10-31).
- `PLAN-HOMEBASE.md` — home tower / Guide NPC / crafting / missions — **shipped**.
- `PLAN-INTERIORS-MP.md` — building interiors (Part 1 shipped 2026-10-21) + 6-player spawn-ring plan (Part 2 superseded by the six-world layout in code).
- `PLAN-UNIVERSES.md` — six spawn universes; six spawn slots exist in code; the plan's full per-universe generation never built.
- `NEW_LEVEL.md` — original one-new-level spec; superseded by the LEVEL IDENTITY rules (per-level dungeon geometry, tower rings, pass sequences — NOT clones).
- `DUNGEON_TEMPLATE.md` — old dungeon spec; the live framework is `commonsMidBuild` / `farDungeon` / `farMonument` in `index.html`.
- `CANOPY_CIRCUIT_MAP.md` — generated wiring graph of THE BETWEEN from an old `index.html` (line numbers long drifted; regenerate rather than trust).
- `ENEMY_CONSISTENCY_REPORT.md` — enemy audit from an earlier build (in-2026-10-31 annotated where its claims were false, e.g. the never-built split-on-death hook).
- `PERFORMANCE_AUDIT.md` — hypothesis-only perf doc; superseded by `PERFORMANCE_PLAN.md`.
- `AUDIT.md` — full game audit snapshot (2026-10-23) — **moved here from root 2026-10-31**: several of its
  bug claims are already fixed and its roadmap predates LEVEL IDENTITY. Historical measurements only.

## old_root_docs/ — previous versions of root files

- `todo.md.2026-10-31` — the previous 600+-line dated-session `todo.md`, archived when the clean current `TODO.md` was written.
- `nexsteps.md` — a snapshot plan that predates LEVEL IDENTITY; its content was folded into `TODO.md`. (An earlier variant lives here as `nexsteps.md.2026-10-31`.)
- `nexsteps.md.2026-10-31` — earlier snapshot, as above.

## levels/ — archived LEVEL content backlog (salvage vault, not void)

⛔ DO NOT treat as current levels — they are OUT of the game (menu filter is `['descent']` only).
BUT content here is explicitly meant for REUSE in future worlds built under the WORLD RULES in `../TODO.md`.

- `LEVELS-2-4-SALVAGE.md` — design summary + verbatim constants (zone palettes, garrison rosters, dungeon lists, shape walkers) for the archived Overgrowth/Ascent/Skyfall levels.
- `salvage_code.txt` — 55 verbatim code sections cut from `index.html` (2026-10-31): 18 dungeon exterior builders, 18 room-prop branches, branch families, dressSite layers, rockify()/cloudify(), boss rosters, MID_DIST/ELEV, label/color/hazard chains.
- `_l234_cut.cjs` / `_touchpoints.txt` / `_l234_probe.cjs` — the surgery script, its touchpoint map, and the archived probe.


- `err.log`, `out71.log`, `out72.log`, `out73.log`, `phase2_output.json` — console/environment dumps from past sessions.
- `freebuff-chat-2026-10-26T08-23-45.843Z.md` — exported chat transcript; historical session log.
