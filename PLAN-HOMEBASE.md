# PLAN-HOMEBASE.md — Home Base + the Guide + Mission Board (2 agents)

**Start only after the vehicle plan (`PLAN.md`) agents report done** — they are editing `index.html`
(`addProp`, `updateStreet`, landing code). Pull/re-read the file fresh before starting; do not overwrite
their work. Same rules as before: single file `index.html`, new top-level functions where possible,
agents do **not** deploy (lead deploys to `sky-jump.pages.dev`), update `TODO.md` when done.

## Vision

The spawn rooftop (the `kind: 'start'` hub at `x:0,z:0,top:TOP`, built in `buildNetwork` ~line 1711)
becomes a **safe HOME BASE**:

- **No hostile enemies on it** (nor on the first platforms leaving it — see `A.kind !== 'start' || k > 1`
  at ~line 1692; also check arena/ambush/spontaneous-arena code doesn't wake platforms on the roof).
- A friendly **NPC — "the Guide"**, modelled on Terraria's Guide — lives there. He is a helper first and a quest-giver
  second: talk to him with **E** (same prompt style as `[E] ride the BUGGY`) and get a Terraria-style menu:
  **HELP** (contextual tips), **RECIPES** (what can I craft with what I'm carrying?), **TASKS** (the Mission Board:
  optional objectives the player can accept, chase across the map, and turn in for rewards), **LEAVE**.
  He comments on the player's situation (low hearts, no weapons yet, just came back from a boss, carrying lots of ore...).
- A **crafting bench** on the roof (spend the stockpile already collected: `hotbarRes` = wood / stone /
  cyberite / leaf / ember) for upgrades and consumables.
- Nothing is forced. Ignore the NPC and the game plays exactly as today.

## Ground rules

- Style: solid, opaque, flat-shaded low-poly (`lam()`), chunky retro look, glowing accents via
  `MeshBasicMaterial`. NPC = blocky humanoid, friendly colours, name label via `makeLabel()`.
- Neutral to the existing systems: missions must not break level clear (`levelClear`), multiplayer
  (`net`). **Multiplayer decision:** every player gets their own home base, Guide and mission list (up to 6, see `PLAN-INTERIORS-MP.md`). Key all base/Guide/mission state by a `slot` index (`bases[slot]`) from day one — in single player `slot` is always 0 — so the multiplayer plan only adds slots instead of rewriting this,
  or the "NEEDS TO PLACE" / `E` key logic (E now means: use prop/vehicle → else talk/craft → else place block).
- Persistence: `localStorage` key `skyjump.base` (try/catch every access, like `towerdrop.best`). Store
  completed-mission count, credits/rewards, crafted upgrades.
- Missions are generated **per level from the level seed** using a *separate* RNG (do NOT call `rand()`
  at runtime — it would desync `seed`-based level generation; define a local PRNG such as `missionRand = mulberry(seed ^ 0xBA5E)`). There is no `mulberry` helper in the current file, so add one locally or inline the small PRNG; do not assume it exists.
- Test hooks: add to `window.__ng`: `missions()`, `acceptMission(i)`, `completeMission(i)`, `base()`.

## Current-code preflight notes (checked before implementation)

- The plan describes the start hub as `x:0,z:0`, but actual `start` is `{ x: 10, y: TOP, z: 0 }`; place Guide/base relative to the actual start/hub, not assumed origin. `buildLevelBody()` currently creates one roof guard every level and a second from level 3; remove those calls. Also audit `connect()`'s extra enemy-spawn clauses (`k % 4` / `k % 5`) and nearby `walkBranch()` decoration: `A.kind !== 'start' || k > 1` only protects one spawn path, not all enemies within 35 m. Use `__ng.foes()`'s `d` values to verify radius.
- `seed` is a mutable LCG state consumed throughout `buildLevelBody()`/`buildNetwork()`. Capture the initial per-level seed before world generation advances it, then derive the independent mission PRNG from that saved value; don't seed missions from the post-generation `seed` or call global `rand()`.
- A `collect` mission needs explicit pickup handling in `updateItems()` (currently it handles `coin`, `ore`, `weapon`, `lore`, `ammo`, and hearts); merely setting `it.taken` won't grant mission progress. Likewise, only create targets from actual reachable platforms/hubs after network/branch generation; `buildNetwork()` does not currently retain graph edges for a reachability query, so simplest safe v1 is selecting a built target with an existing portal/route connection.
- `buildNetwork()` keeps `hubs` local and currently returns nothing. Either return the built hubs and pass the `kind: 'start'` hub to `buildHomeBase(hub)`, or construct an equivalent explicit start-hub object; don't call it with an undefined hub.
- `setPaused()` freezes the entire animation `dt`, not just player input. The Guide dialogue must use its own modal/input gate (and keyboard routing) if NPC animation/world FX should continue; don't reuse global `paused` for this panel.
- E currently has a vehicle/prop handler on the first `keydown` listener and a separate builder `placeBlock()` listener. Give NPC talk a clear priority between prop/vehicle and block placement, suppress E camera yaw while the Guide hint/panel is active, and keep arrow/Enter/Escape UI input from triggering gameplay.
- `GLIDE_TIME` is a `const`, while boost drain and jump scaling are existing expressions/helpers. Persistent upgrades should add explicit multipliers at those use sites rather than trying to assign to `GLIDE_TIME`.
- `hotbarRes` uses keys `{ wood, stone, ore, leaf, ember }` (`ore` is the CYBERITE resource key); recipes/reward bundles must use these exact keys. `net.id` is an online connection ID, not yet a documented stable 0–5 base slot, so define slot assignment before relying on `bases[slot]` in co-op.

## Data model (shared contract — both agents read first)

```js
// one mission
{
  id, type: 'goto' | 'collect' | 'kill' | 'bossKill',
  title, desc,                 // "Reach the Jungle Roof", "Recover the data core from the Frozen arena"
  target: { x, y, z, r },      // world position + trigger radius
  zone,                        // zone name for flavour / difficulty
  count,                       // kill count / items needed (1 for goto/collect)
  state: 'offered' | 'active' | 'ready' | 'done',     // ready = objective done, return to base
  reward: { credits, ammo?, hearts?, weapon?, resources?: {wood:n,...} },
  progress: 0
}
const missions = [];            // rebuilt in buildLevel
let activeMission = null;       // only ONE active at a time in v1
const base = { credits: 0, upgrades: {}, done: 0 };   // persisted
```

Flow: **offered** (on board) → player accepts → **active** (HUD tracker + world marker) →
objective met → **ready** ("RETURN TO BASE") → talk to NPC → **done** (reward, board refreshes).

## Agent A — HOME BASE WORLD + NPC + DIALOGUE UI

A1. **Clear the roof of hostiles** (spawn hub + first platform of each outgoing path). Verify with
    `__ng.foes()` at spawn: zero enemies within ~35 m.
A2. **Build the base dressing** (new `buildHomeBase(hub)` called from `buildLevelBody` after the network is built; `buildNetwork()` currently returns no hubs, so return hubs or pass an explicit start hub):
    - crafting bench (anvil/forge blocks + glowing ember accent), storage crate, a banner/flag,
      lamp posts, a mission-board sign (a big panel mesh with neon header), a few barrels.
    - a small safe-zone ring on the floor; no coins/ore spam on the roof.
    - keep the existing level entry/exit glowing strips, lore terminal, weapons rack and vehicle props intact.
A3. **NPC "the Guide":** `makeNpc()` (blocky body, friendly colours, hood/cap, big visor, a book/clipboard prop);
    Terraria-guide behaviour: **wanders a short loop around the base** (idle → walk 3–6 m → idle; never leaves the roof,
    stays off the edge — clamp to the hub's `hw/hd`), faces the player within 12 m, waves on first approach, idles
    when the player is far. Non-hostile and **cannot be damaged** (shots/blade/pound pass him; make sure `damageEnemy`
    and splash code never targets him; keep him out of the `enemies` array). Floating `!` over his head when a task is
    ready to turn in, `?` when new tasks are on offer. Greets with short one-liners on approach ("Back already?").
    Floating `!` marker above him when a mission is *ready to turn in*, `?` when new ones are offered.
A4. **Interaction + UI:** extend the proximity-hint logic (`hintProp` / `updateStreet` ~line 4290) with
    `hintNpc`: show `[E] TALK TO THE GUIDE` within 3.5 m. E opens a **HUD dialogue panel** (DOM, styled like the existing
    `#menu` / `#hint` neon panels) with the Terraria-style tabs **HELP · RECIPES · TASKS · LEAVE** (↑/↓/Enter or mouse,
    Esc closes). HELP shows one tip at a time (Next button). TASKS lists missions (title, type icon, reward, difficulty)
    with Accept / Abandon / Turn in. Game pauses *player* input (not the world) while open: do not use the current global
    `setPaused()` because it freezes the whole animation/world; add a separate dialogue input gate.
A5. Crafting UI tab in the same panel **only calls Agent B's API** (`craftList()` / `craft(id)`); A builds the
    panel, B supplies the recipes. Until B lands, stub with an empty list.

## Agent B — MISSIONS, REWARDS, CRAFTING (logic) + WORLD MARKERS

B1. **Mission generator** `generateMissions()` (per level, separate RNG): 3–5 offers drawn from:
    - `goto`: reach a hub/platform/arena roof at distance X (pick from `hubs`/`platforms`, scale distance with level).
    - `collect`: place a glowing **data core** pickup (new item type, reuse the `items` / `weaponPickup` pattern) on a
      reachable platform far from base.
    - `kill`: defeat N enemies of a zone/variant (count kills via the existing enemy-death path; find it with
      `damageEnemy` / the death branch) or `bossKill` an arena Guardian.
    - Always verify the target is reachable (use chain endpoints already built by `connect()`).
B2. **Tracking:** `updateMissions(dt)` each frame: goto → within `r`; collect → item taken; kill → hook on enemy death.
    On completion switch to **ready** and toast `OBJECTIVE COMPLETE — RETURN TO BASE`. Hand-in = talk to the NPC
    near the base (A calls `turnIn()`); optionally allow auto-teleport-free return only (no fast travel in v1).
B3. **HUD + world markers:** a small tracker line under the stat panel (`▶ Reach the Jungle Roof · 412 m`), a
    vertical beam + floating diamond at the target (cheap additive cylinder like the prop pillar), and an edge-of-screen
    arrow/compass distance when off-screen. Distinct colours per type. Also mark the base when state = ready.
B4. **Rewards:** credits (new stat), ammo, hearts, `unlockWeapon(i)` (exists), resource bundles into `hotbarRes`,
    score. Show a reward popup + sound (`sfx.clear` / a new short jingle through the existing synth in `sfx`).
B5. **Crafting logic** `craftList()` / `craft(id)` using `hotbarRes` + credits. v1 recipes (tune numbers freely):
    - *Ammo pack* (stone+ore → shells/rails), *Medkit* (leaf+wood → +hearts), *Glide Tank* (ember+ore: +25% max glide, persistent),
    - *Vehicle Nitro* (ore+ember: longer `X` boost meter, persistent), *Jump Boots* (wood+stone: +jump height small, persistent).
    Persistent upgrades stored in `base.upgrades` and applied where the constants live (`GLIDE_TIME`, `boostE` drain, `jumpMul`).
B7. **Guide knowledge** (`guideTips()` / `guideGreeting()` — pure functions returning text, A's panel renders them):
    - ~25 tips covering the real mechanics: glide (hold SPACE), double-jump hoverboard, ground pound, wall climbing,
      vehicles (`E` to ride, hold `X` boost, suspension absorbs drops), rails/grinding, builder hand + ore, checkpoints,
      Guardians unlocking routes, the moon → Mars route, dread/horror zones, weapon unlocks.
    - **Context-sensitive priority:** pick tips from live state (`health`, `weaponOwned`, `hotbarRes`, `level`, deaths this run,
      whether the player has used a vehicle/hoverboard yet, whether a mission is ready) before falling back to random ones.
    - **RECIPES tab:** list every recipe with ✓/✗ per ingredient against the current `hotbarRes`, highlighting what is craftable now
      (Terraria crafting-guide feel). Selecting a craftable recipe crafts it via `craft(id)`.
B6. **Persistence + reset:** `saveBase()/loadBase()`; missions regenerate on `buildLevel`; deaths/respawn do not lose the
    active mission (it is cleared only on level change).

## Integration (A then B, together)

1. Hook `E` priority in the keydown handlers (~line 2534/2593): prop/vehicle → NPC talk → place block.
2. A's panel calls B's `missions`, `acceptMission`, `turnIn`, `craftList`, `craft`.
3. Playtest loop: spawn → verify no enemies → talk → accept a `goto` → walk there → return → reward → craft → reload page and
   confirm persistence → accept a `kill` and a `collect`.
4. Check: `node --check` on the extracted script; no console errors; level clear (moon → Mars) still works; vehicles/boost
   unaffected; first-person/third-person camera unaffected while the dialogue is open.

## Definition of done

Verified 2026-10-24 on the `live` build by `tests/t-homebase.cjs` + `tests/t-plans.cjs` (headless Chromium, software GL). `[x]` = automated evidence; `[~]` = partly evidenced; `[ ]` = needs a human.

- [~] Spawn roof is peaceful (0 enemies within the roof zone: evidence) — NPC + bench + board *look good / fit the style* is a human call.
- [~] `[E] TALK` opens the Guide dialog (evidence); HELP / RECIPES / TASKS / LEAVE tab contents, tips reacting to game state: not automated. Accept works (evidence: goto mission accepted, one active mission).
- [~] The Guide is not in `enemies` (evidence); wandering/invulnerability are by construction, not tested.
- [~] All 4 mission types are generated (bossKill, goto, collect, kill — evidence); reachability of every objective and marker/HUD distance: only `goto` was walked (teleported to target -> state `ready`).
- [x] Return-to-base turn-in pays out (+164 credits) and credits persist across a page reload (evidence).
- [~] 5 craft recipes exist (evidence); recipe effects / upgrades changing gameplay: not tested.
- [x] `TODO.md` updated; multiplayer behaviour documented (`PLAN-INTERIORS-MP.md` Part 2, verified with two clients via `tests/t-net2.cjs`).

## Later / open questions

- Radiant missions on the street (after the tower) — separate plan.
- Multiplayer: per-slot bases + missions → `PLAN-INTERIORS-MP.md` Part 2. `net.id` is currently a network ID, not yet a defined stable base slot; define the slot mapping before implementing keyed state.
- Should the Guide get voice lines through the existing TTS cache (`server/voice-lines.json`)?
- Faction / reputation, daily missions, mission difficulty tiers (bronze/silver/gold) with scaled rewards.
