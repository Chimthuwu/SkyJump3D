# PLAN.md — Make the vehicles LOOK much better (2 agents)

Goal: the **car and Hover-bike** should look like hard, chunky, retro low-poly "boomer-shooter / Unreal Tournament"
vehicles — solid polygons, bold colour blocking, glowing accents — not the original box-stack car and bare rider.

## Lead's updated car direction — DeLorean time machine

The car is now specifically a **Back to the Future DeLorean-inspired time machine**, not a generic arena/off-road buggy.
This direction overrides the older "arena buggy" silhouette/details below; retain its gameplay behavior and shared FX hooks.

- **Read instantly as a DeLorean:** low, long stainless-steel wedge coupe (about 2 m wide × 4 m long in game scale),
  angular hood, compact cabin, dark windows, and gull-wing doors raised clearly above the shoulder line. Keep the body
  solid and opaque; use flat-shaded silver/gunmetal panels with dark trim, not transparent glass or a glow shell.
- **Signature details:** rear louvres over the deck, squared rear fascia with red tail-light blocks, front bumper and
  square headlamps, side intake/trim, and chunky turbine-style wheels. Add the time-machine cues at the rear: a compact
  reactor/flux-capacitor detail and restrained cyan/blue-white energy accents. No need to reproduce tiny film-prop wiring.
- **Silhouette and restraint:** gull-wing doors, wedge nose, cabin, and louvred rear must still read at 20 m. Keep the
  existing ram/gameplay tell visible, keep the rider/camera eye clear, and stay within the few-dozen-mesh budget by
  sharing geometry and instancing repeated trim. Small exhaust/time-circuit effects may glow; body panels stay opaque.
- **Review checklist for Claude/lead:** from front, side, and rear, does it read as a low stainless gull-wing coupe rather
  than a buggy? Are the doors and rear louvres unmistakable at gameplay distance? Do the rear time-machine accents feel
  intentional but secondary to the metal silhouette? Verify parked, moving, boost, and landing views.

The `makeBuggyMesh(prop)`/`buggy` names remain for gameplay compatibility; don't rename the prop kind or API.
The lead asked me to review Claude's car against this direction when it lands. The current working tree still has the earlier low-poly buggy mesh, so the DeLorean makeover itself is not yet present.


Everything lives in `index.html` (single file, no build). Deploy target: `sky-jump.pages.dev`
(only the lead/user deploys — agents do **not** deploy or push).

## Ground rules (both agents)

- **Style:** flat-shaded low-poly, solid opaque materials. **No** additive/transparent "ghost" look on bodies
  (the user hates the washed-out/see-through look — see how weapons were fixed in `makeWeaponMeshes`).
  Use transparency/additive ONLY for small things: exhaust flames, thruster glow, headlight cones.
- **Materials:** body panels `lam(color)` (defined ~line 525; already flat-shaded + retro-patched).
  Glowing bits `new THREE.MeshBasicMaterial({ color })`. Keep colours deep and saturated, dark gunmetal
  base + one hot accent (buggy = orange `0xffa73a`, bike = cyan `0x36f6ff`, matching existing toasts/bursts).
- **Orientation:** the mesh group is rotated by `p.mesh.rotation.y = face`, so **+Z is forward**. Group origin
  is at the player's feet (`pos.y - 0.1`). DeLorean-inspired car footprint ≈ 2 × 4 m, bike ≈ 0.7 × 2 m. Keep the player's
  camera-eye clear: in first person nothing may sit around head height at the group origin
  (vehicles force third person on mount, but keep it sane anyway).
- **Perf:** a few dozen meshes per vehicle max. Share geometries (`const geo = ...` once, outside the builder).
- **Interfaces that must keep working** (do not rename/remove):
  - `addProp(kind, x, y, z)` returns `{ kind, gear, mesh, taken, wheels: [] }`; `prop.wheels` meshes get
    `rotation.x += ...` every frame in `updateStreet` — spin axis is local X, so build wheels with
    `rotation.z = Math.PI/2` cylinders (as now) or put them in a pivot Group and push the pivot.
  - the pickup pad/pillar block at the top of `addProp` (`isGear === false` branch) stays.
  - `onVehicle.mesh.rotation.x` is set from `vel.y` in the render loop (~line 4369) — don't fight it.
- **Test:** `window.__ng.prop('buggy' | 'bike', dist)` spawns one in front of you; `__ng.useProp()` mounts it.
  Open `index.html` locally (or via the dev hook in the console), check from third person, both parked
  (idle spin) and moving. Also check the `X` boost and a big drop-landing.
- **Do not touch** the other agent's region (below). Merge conflicts in a single 5k-line file are the main risk:
  add NEW top-level functions, and only edit the single call-site line listed for you.
- Update `TODO.md` when done (check off, add handoff notes).

## File regions / ownership

| Region | Owner |
|---|---|
| New `function makeBuggyMesh(prop)` + the `else if (kind === 'buggy') { ... }` branch inside `addProp` | **Agent A** |
| New `function makeBikeMesh(prop)` + the `kind === 'bike'` line inside `addProp` + `makeRiderVisual()` | **Agent B** |
| New `function updateVehicleFx(dt, p)` and its single call inside `updateStreet`'s `if (onVehicle) {...}` block (~line 4285) | **Agent B** (calls into hooks Agent A exposes, see below) |
| Boost-flame / landing-dust particle helpers | **Agent B** |

Agent A must expose its dynamic parts on the prop so the FX code can drive them (contract below).

## Shared contract (agree on this first, both read it)

Each builder attaches these optional fields to the `prop` object; `updateVehicleFx` null-checks all of them:

```js
prop.fx = {
  exhausts:   [Object3D, ...],   // local-space emitter points (flame spawns at their world position)
  lights:     [Mesh, ...],       // headlight/tail MeshBasicMaterial meshes (intensity pulsed on boost)
  glowMats:   [Material, ...],   // accent materials tinted brighter while boosting
  body:       Object3D,          // sub-group that squashes/rolls (suspension, lean) — wheels stay on the ground
  steer:      [Object3D, ...],   // front-wheel pivots (yaw with turn input)
};
```

## Agent A — DELOREAN-INSPIRED TIME-MACHINE CAR (model + silhouette)

Replace the current car visuals with the DeLorean-inspired coupe specified above, using shared low-poly
boxes/wedges/cylinders. Do not build an off-road buggy silhouette. Keep the gameplay kind/API as `buggy`.

1. **Body:** long, low stainless/silver wedge with dark gunmetal underbody, angular hood, compact cabin, and opaque
   dark windscreen. Model the hood, cabin and rear deck as distinct solid planes so the car's classic profile reads.
2. **Gull-wing doors:** two obvious silver door panels hinged at the cabin shoulders and angled upward/outward; frame the
   cabin without putting large geometry at the player's head/camera. Include a restrained dark window inset if useful.
3. **Wheels/trim:** turbine-style 8–10-sided wheels with readable hubs/lugs and visible rotation; dark side trim/intake
   blocks; simple fender lips. Front pair stay in `steer` pivot groups.
4. **Front:** square warm-white headlamps, simple grille and chunky bumper. Keep an orange/cyan ram accent as the same
   recognizable gameplay tell; it can be integrated as a bumper strip rather than a buggy bull-bar.
5. **Rear/time-machine cues:** louvred engine deck, squared rear fascia, red tail lamps, twin small exhausts or reactor
   outlets recorded in `fx.exhausts`, plus a compact flux-capacitor/reactor detail with restrained cyan/blue-white glow.
   Avoid a generic spoiler if it obscures the louvres or weakens the DeLorean silhouette.
6. **Interior:** simple seat and steering wheel visible through the dark opaque windscreen/door opening; no driver required.
7. **Perf/materials:** opaque flat-shaded silver `lam()` panels; only small lights/time-machine accents/exhaust effects glow.
   Share geometry, instance repeated slats/louvres, and stay within the few-dozen-mesh budget.

Deliver `fx.exhausts / lights / glowMats / body / steer` per the contract; retain `prop.wheels` update compatibility.

## Agent B — HOVER-BIKE (model) + shared vehicle FX/animation

**B1. Bike model.** Today `kind === 'bike'` only adds `makeRiderVisual()` — i.e. there is basically no bike.
Build `makeBikeMesh(prop)`: a light-cycle / speeder-bike hybrid.

1. **Frame:** long low wedge body, dark gunmetal with cyan neon stripe along the side, angular nose fairing,
   raised seat/hump, small windscreen (opaque dark blue-black, not glass).
2. **Hover pods:** two front and one/two rear thruster pods (cylinders/octagon prisms) with glowing cyan
   discs underneath — solid emissive, plus a small flat additive ring on the ground (this one *may* be
   transparent). They replace wheels: still fill `prop.wheels` with 2 small decorative spinning turbine
   discs so the existing spin code keeps working.
3. **Handlebars/fork:** blocky handlebar + front fork, headlight block, tail fin with red light.
4. **Rider:** keep `makeRiderVisual()` but verify it sits correctly on the new seat; tidy it if it clips
   (this function is B's to edit).
5. Fill `prop.fx` per the contract (`exhausts` = rear thrusters, `lights`, `glowMats`, `body`, `steer` = front fork).

**B2. Shared dynamic FX — `updateVehicleFx(dt, p)`** (called once per frame while `onVehicle`):

- **Boost (X held, `boosting === true`):** spawn flames/particles at each `fx.exhausts` world position,
  tint `fx.glowMats` and pulse `fx.lights`; widen FOV slightly (≤ +8°) and lerp back. Reuse `burst()` /
  small additive cones; cap particles per frame.
- **Suspension/lean:** `fx.body` rolls into turns (from lateral velocity vs facing) and pitches on
  accel/brake; on landing from a drop (hook the `onVehicle && speed > 14` branch in the landing code,
  ~line 2752) play a squash-and-rebound on `fx.body` (~0.25 s spring).
- **Steer:** yaw `fx.steer` pivots toward the input direction.
- **Hover bob (bike only):** gentle sine bob + pod glow flicker when airborne/gliding.
- **Dust/sparks** at wheel contact when grounded and fast (buggy) — tiny, cheap.

## Order of work

1. Both agents read this file and the "Shared contract". (5 min)
2. **A** and **B1** build their models in parallel (no shared lines touched).
3. **B2** writes `updateVehicleFx` against the contract using null checks, so it works before/after A lands.
4. **Integration pass (A then B, 10 min):** spawn both side by side with `__ng.prop`, compare scale/colour/
   brightness, fix clipping with the rider/camera, verify boost + drop landing + dismount all look right.
5. Syntax check: extract the main `<script>` and run `node --check` (see how earlier changes were verified).
6. Report to the lead with screenshots or a one-line description of each vehicle. Lead deploys.

## Definition of done

- [ ] Buggy and bike are clearly recognisable silhouettes from 20 m away, solid-looking, no see-through bodies.
- [ ] Wheels/turbines visibly spin; front wheels steer; body leans/squashes.
- [ ] Holding **X** shows exhaust flames + glow; landing a big drop shows a suspension squash + dust.
- [ ] No console errors; mount/dismount/boost/glide still work; frame rate unchanged on a mid GPU.
- [ ] `TODO.md` updated with handoff notes.

## Open questions

- Should vehicles have a few colour variants (random body colour per spawn)? Proposed: yes, cheap — Agent A picks
  3 palettes for the buggy, Agent B 3 for the bike, chosen in the builder from `prop` spawn order.
- Headlight beams (additive cones in front) — nice-to-have, only if perf stays fine.
