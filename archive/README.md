# archive/ — historical project documents

Everything in here is **superseded or completed** — kept for history, not for reference.
If you are a new agent looking for the current state of the game, read (from the repo root):

1. `todo.md` — the live task list / agent handoff channel (read first; newest entries at the top)
2. `AUDIT.md` — full game audit of 2026-10-23 (bug list, perf numbers, roadmap — the freshest global picture)
3. `PERFORMANCE_PLAN.md` — the active perf-optimisation playbook (measurement protocol + rules)
4. `OVERVIEW.md` / `README.md` — what the game is and what's in it

## handoffs/ — completed phase handoffs (2026-10-2x)

One document per completed build phase. Their checklists are all shipped and verified in `index.html`;
the corresponding progress notes live in `todo.md`.

- `PHASE0_HANDOFF.md` … `PHASE4_HANDOFF.md` — THE BETWEEN / canopy / co-op phase chain

## plans/ — older plans, specs and reports, largely implemented or overtaken by events

- `AGENT_INSTRUCTIONS.md` — stale agent briefing from the ~4,050-line era of `index.html` (now ~17,300 lines). Superseded by `OVERVIEW.md` + `todo.md`.
- `PLAN.md` — vehicles plan (car / hover-bike) — shipped, see README's Vehicles blurb.
- `PLAN-HOMEBASE.md` — home tower / Guide NPC / crafting / missions — shipped.
- `PLAN-INTERIORS-MP.md` — building interiors (Part 1 shipped 2026-10-21) + 6-player spawn-ring plan (Part 2 superseded by the six-world layout in code).
- `PLAN-UNIVERSES.md` — six spawn universes; partially superseded — six spawn slots exist in code, but the plan's full per-universe generation is not built (see AUDIT.md §5/§7 #13).
- `NEW_LEVEL.md` — original one-new-level spec; superseded by the four-level plan in `todo.md` (descent/overgrowth/ascent/skyfall).
- `DUNGEON_TEMPLATE.md` — old dungeon spec; the live framework is `commonsMidBuild` / `farDungeon` / `farMonument` in `index.html` (Lvl1 has 6 dungeons; Lvl2 built; Lvl3/4 pending).
- `CANOPY_CIRCUIT_MAP.md` — generated wiring graph of THE BETWEEN at line ~6778 of an old `index.html` (line numbers long drifted; regenerate rather than trust).
- `ENEMY_CONSISTENCY_REPORT.md` — enemy audit from an earlier build.
- `PERFORMANCE_AUDIT.md` — hypothesis-only perf doc; superseded by `AUDIT.md` (measured numbers) + `PERFORMANCE_PLAN.md`.

## logs/ — one-off run output, not documentation

- `err.log`, `out71.log`, `out72.log`, `out73.log`, `phase2_output.json` — console/environment dumps from past sessions
- `freebuff-chat-2026-10-26T08-23-45.843Z.md` — exported chat transcript; historical session log (its per-session notes were folded into `todo.md`)
