// NOSTALGIA OVERDOSE — GREYBOX (Gate 1). Geometry, collision, routes, checkpoints, cells, exit. NO decoration, enemies or audio.
// A fever-dream of 90s/Y2K childhood at toy scale, told as three spaces on one east-west axis:
//   1. ARCADE MILE   (x -332..-62)  long strip, balcony loop, vent, ticket-stack tower      -> cell 1 (MARQUEE)
//   2. BEDROOM STACK (x -62..62)    huge plaza + 66 m core: spiral shelves OR bounce-pad column -> cell 2 (SUMMIT)
//   3. VHS CANYON    (x 20..330)    descending ribbon road / cartridge plates, island, REWIND ramp loop, final leap -> cell 3 (ISLAND) + EXIT
// Collect 3 power cells (any order reachable), then reach the exit. Pure function of this file: no Math.random, no level/seed reads.
const C = { floor: 0x7d8696, cab: 0xb9824a, vent: 0x5f9a86, bal: 0x8aa0c8, stair: 0x9aa5b8, tick: 0xd4a048, core: 0x4c5f94, shelf: 0x5878c4, spiral: 0x7f9ae0,
  pad: 0xffd23a, ribbon: 0xb06ac8, plate: 0x7a4fa0, island: 0x6a8a5a, rewind: 0xc86a8a, final: 0xe0e0f0, exit: 0x55ff88, plaza: 0x6a728a };

export default {
  id: 'nostalgia-overdose', name: 'NOSTALGIA OVERDOSE', mode: 'sp', layout: 'od-greybox-v1', biome: null, sky: true, version: 1,
  topology: 'horizontal-traverse-with-vertical-hub',
  perf: { maxSolids: 1200, maxMeshes: 60, maxEnemies: 0, buildMsBudget: 400 },
  cellsNeeded: 3,

  build(kit) {
    const N = {}, route = [];                                   // route = the main objective route (also the QA bot's waypoint list)
    const P = (id, cx, top, cz, w, d, color = C.floor, thick = 1) => { kit.slab(cx, top, cz, w, d, thick, color); kit.node(id, cx, top, cz, w, d); N[id] = { cx, top, cz, w, d }; return id; };
    const L = (a, b, kind = 'jump', extra) => kit.edge(a, b, kind, extra);
    const stairs = (id0, id1, x0, z0, x1, z1, y0, y1, width, color = C.stair) => {   // 0.5 m risers, >=1 m treads: climbable with the game's 0.55 m step-up
      const n = Math.ceil((y1 - y0) / 0.5), dx = (x1 - x0) / n, dz = (z1 - z0) / n, horiz = Math.abs(dx) > Math.abs(dz);
      for (let i = 0; i < n; i++) {
        const cx = x0 + dx * (i + 0.5), cz = z0 + dz * (i + 0.5), top = y0 + (i + 1) * ((y1 - y0) / n);
        kit.slab(cx, top, cz, horiz ? Math.abs(dx) : width, horiz ? width : Math.abs(dz), top - y0, color);   // each step is a column from the base height up to its tread
      }
      kit.node(id0, x0, y0, z0, horiz ? 0 : width, horiz ? width : 0); kit.node(id1, x1, y1, z1, horiz ? 0 : width, horiz ? width : 0);
      N[id0] = { cx: x0, top: y0, cz: z0 }; N[id1] = { cx: x1, top: y1, cz: z1 };
    };
    const CP = (x, top, z) => kit.checkpoint(x, top, z);

    // ================= 1. ARCADE MILE =================
    P('g0', -320, 0, 0, 24, 28, C.floor);                       // spawn plaza
    P('g1', -289, 0, 0, 38, 28); L('g0', 'g1', 'walk');
    P('g2', -246.5, 0, 0, 37, 28); L('g1', 'g2', 'jump');       // 5 m
    P('g3', -206, 0, 0, 32, 28); L('g2', 'g3', 'jump');         // 6 m
    P('g4', -167, 1, 0, 34, 28); L('g3', 'g4', 'jump');         // 6 m, +1
    P('g5', -135, 1, 0, 30, 40, C.plaza); L('g4', 'g5', 'walk');// marquee plaza
    for (const [x, z] of [[-252, 7], [-240, -7], [-212, 6], [-200, -6]]) kit.block(x, 0, z, 6, 1.5, 6, C.cab);        // arcade cabinets: low cover / stepping tops
    CP(-300, 0, 0);                                             // CP1 near spawn
    CP(-142, 1, -12);                                           // CP2 marquee plaza
    // vent: narrow raised line along the north... south edge of the strip, a straighter way to g4
    kit.block(-280, 0, -17, 6, 1.5, 6, C.cab); kit.node('vc1', -280, 1.5, -17, 6, 6); L('g1', 'vc1', 'jump');
    kit.block(-273, 0, -21, 5, 3, 5, C.cab); kit.node('vc2', -273, 3, -21, 5, 5); L('vc1', 'vc2', 'jump');
    P('v0', -262, 4.5, -23, 14, 3, C.vent); L('vc2', 'v0', 'jump');
    P('v1', -241, 4.5, -23, 20, 3, C.vent); L('v0', 'v1', 'jump');
    P('v2', -214, 4.5, -23, 24, 3, C.vent); L('v1', 'v2', 'jump');
    P('v3', -187, 4.5, -23, 24, 3, C.vent); L('v2', 'v3', 'jump');
    L('v3', 'g4', 'jump');
    // balcony loop: lane + 24 m of stairs up to a parallel walkway at y 12 that rejoins the marquee tower
    P('n0', -318, 0, 21, 28, 14); L('g0', 'n0', 'walk');
    stairs('st0', 'st1', -330, 21, -306, 21, 0, 12, 14); L('n0', 'st0', 'walk', { ramp: true });
    P('b0', -290, 12, 21, 32, 14, C.bal); L('st1', 'b0', 'walk');
    P('b1', -254, 12, 21, 28, 14, C.bal); L('b0', 'b1', 'jump');
    P('b2', -220, 12, 21, 28, 14, C.bal); L('b1', 'b2', 'jump');
    P('b3', -186, 12, 21, 28, 14, C.bal); L('b2', 'b3', 'jump');
    P('b4', -153, 12, 21, 26, 14, C.bal); L('b3', 'b4', 'jump');
    // ticket-stack tower around the marquee pillar (cell 1 on its top)
    const PX = -125, PZ = 0;
    kit.block(PX, 1, PZ, 8, 29, 8, C.core); kit.node('pillar', PX, 30, PZ, 8, 8);
    const T0A = -2.144, TR = 10, TSTEP = 0.9;
    for (let i = 0; i < 14; i++) {
      const a = T0A + TSTEP * i, x = PX + TR * Math.cos(a), z = PZ + TR * Math.sin(a), y = 3 + 2 * i;
      if (i === 0) { kit.block(x, 1, z, 6, y - 1, 6, C.tick); kit.node('t0', x, y, z, 6, 6); N.t0 = { cx: x, top: y, cz: z, w: 6, d: 6 }; }      // pedestal: a hovering tile would leave only 1 m of headroom over the plaza
      else P('t' + i, x, y, z, 6, 6, C.tick);
      L(i === 0 ? 'g5' : 't' + (i - 1), 't' + i, 'jump');
    }
    L('t13', 'pillar', 'jump'); L('b4', 't5', 'jump');         // balcony meets the tower at t5 (y 13)
    kit.bouncePad(-143, 1.5, 4, 4, 30); kit.node('padM', -143, 1.5, 4, 4, 4); L('g5', 'padM', 'walk'); L('padM', 't5', 'pad', { boost: 30 });   // shortcut: pad straight to t5
    // bridge to the Bedroom Stack (one 6 m gap)
    P('br1', -108, 1, 0, 24, 16); L('g5', 'br1', 'walk');
    P('br2', -76, 1, 0, 28, 16); L('br1', 'br2', 'jump');

    // ================= 2. BEDROOM STACK =================
    P('plaza', 0, 1, 0, 124, 124, C.plaza, 1); L('br2', 'plaza', 'walk');
    kit.block(0, 1, 0, 24, 63.5, 24, C.core);
    CP(-40, 1, -30);                                            // CP3 plaza (west)
    // route A: 34 spiral platforms, 1.9 m risers; rest shelves (10x10) at 8, 19 (east, canyon launch) and 27
    const SR = 26, STEP = 0.5, shelf = new Set([8, 19, 27]), sY = i => 2.9 + 1.9 * i, sA = i => Math.PI + STEP * i;
    for (let i = 0; i < 34; i++) {
      const x = SR * Math.cos(sA(i)), z = SR * Math.sin(sA(i));
      if (i === 0) { kit.block(x, 1, z, 8, sY(0) - 1, 8, C.spiral); kit.node('s0', x, sY(0), z, 8, 8); N.s0 = { cx: x, top: sY(0), cz: z, w: 8, d: 8 }; }      // pedestal (headroom, as t0)
      else P('s' + i, x, sY(i), z, shelf.has(i) ? 10 : 8, shelf.has(i) ? 10 : 8, shelf.has(i) ? C.shelf : C.spiral);
      L(i === 0 ? 'plaza' : 's' + (i - 1), 's' + i, 'jump');
    }
    CP(SR * Math.cos(sA(8)), sY(8), SR * Math.sin(sA(8)));      // CP4 (y 18)
    CP(SR * Math.cos(sA(19)), sY(19), SR * Math.sin(sA(19)));   // CP5 east shelf (y 39), canyon launch
    // summit roof: 28x28 top 66.5 (bottom 64.5 sits on the core)
    P('roof', 0, 66.5, 0, 28, 28, C.core, 2); L('s33', 'roof', 'jump');
    // route B: bounce-pad column on the north face, +11 m per hop, lands on spiral s28 (y 56)
    kit.bouncePad(-4, 1.5, -38, 4, 30); kit.node('pB0', -4, 1.5, -38, 4, 4); L('plaza', 'pB0', 'walk');
    let pb = 'pB0';
    for (let k = 1; k <= 5; k++) {
      const x = k % 2 ? 4 : -4, y = 1 + 11 * k, id = 'B' + k;
      P(id, x, y, -38, 8, 8, C.pad); L(pb, id, 'pad', { boost: 30 });
      kit.bouncePad(x, y + 0.5, -38, 4, 30); kit.node('pB' + k, x, y + 0.5, -38, 4, 4); L(id, 'pB' + k, 'walk'); pb = 'pB' + k;
    }
    L('B5', 's28', 'jump');

    // ================= 3. VHS CANYON =================
    // route A: 14 ribbons (12 x 4), zig-zag, ~4 m drop each, from the summit roof
    let pa = 'roof';
    for (let k = 0; k < 14; k++) {
      const id = 'A' + k; P(id, 26 + 16 * k, 66 - 4.5 * k, k % 2 ? 4 : -4, 12, 4, C.ribbon); L(pa, id, 'jump'); pa = id;
    }
    // route B: 14 cartridge plates (10 x 10), 2.5 m drop each, from the east shelf s19
    let pp = 's19'; const pz = [-4, -10, -16, -24, -20, -24, -20, -24, -20, -24, -18, -14, -10, -10];
    for (let k = 0; k < 14; k++) {
      const id = 'P' + k; P(id, 40 + (199 / 13) * k, 39 - 2.5 * k, pz[k], 10, 10, C.plate); L(pp, id, 'jump'); pp = id;
    }
    // island (cell 3), final leap, exit
    P('isl', 258, 6, 0, 28, 28, C.island); L('A13', 'isl', 'jump'); L('P13', 'isl', 'walk');
    CP(250, 6, 8);                                              // CP6 island
    P('f1', 281, 6.5, -4, 6, 6, C.final); L('isl', 'f1', 'jump');
    P('f2', 292, 8, 4, 6, 6, C.final); L('f1', 'f2', 'jump');
    P('f3', 303, 9.5, -3, 6, 6, C.final); L('f2', 'f3', 'jump');
    P('exit', 318, 10, 0, 14, 14, C.exit); L('f3', 'exit', 'jump');
    CP(318, 10, 5);                                             // CP7 beside the exit
    // REWIND loop: island -> long incline west (0.5 m risers) -> plates back to the east shelf s19
    P('rwp', 252, 6, 20, 12, 12, C.rewind); L('isl', 'rwp', 'walk');
    stairs('rw0', 'rw1', 246, 20, 160, 20, 6, 39.5, 12, C.rewind); L('rwp', 'rw0', 'walk', { ramp: true });
    let pr = 'rw1';
    for (let k = 0; k < 8; k++) { const id = 'R' + k; P(id, 155 - 15 * k, 39.5, 20, 10, 10, C.rewind); L(pr, id, k === 0 ? 'walk' : 'jump'); pr = id; }
    P('R8', 40, 39.5, 20, 10, 10, C.rewind); L('R7', 'R8', 'jump'); L('R8', 's19', 'jump');
    CP(95, 39.5, 20);                                           // CP8 mid-rewind

    // main route for QA / structural metrics (spawn -> marquee -> stack summit -> ribbons -> island -> exit). Cells 2/3 are on it.
    route.push('g0', 'g1', 'g2', 'g3', 'g4', 'g5', 't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7', 't8', 't9', 't10', 't11', 't12', 't13', 'pillar',
      { id: 'drop-to-plaza', pt: [-146, 1, 13, 2.5] }, 'g5', 'br1', 'br2', 'plaza');      // step off the pillar and glide down onto the plaza (29 m)
    for (let i = 0; i < 34; i++) route.push('s' + i);
    route.push('roof'); for (let k = 0; k < 14; k++) route.push('A' + k);
    route.push('isl', 'f1', 'f2', 'f3', 'exit');
    this.route = route; this.N = N;

    // cells
    this.cells = [
      { id: 'MARQUEE', x: PX, y: 30, z: PZ },
      { id: 'SUMMIT', x: 0, y: 66.5, z: 0 },
      { id: 'ISLAND', x: 262, y: 6, z: -6 },
    ];
    this.cellMarkers = this.cells.map(c => kit.marker(c.x, c.y, c.z, 0xffd23a, 36));
    this.exitMarker = kit.marker(318, 10, 0, 0xff4466, 46);

    kit.setSpawn(-322, 0, 0, -Math.PI / 2);
    kit.setBounds({ worldR: 460, killY: -40, far: 2500 });
    return { start: 'g0', exit: 'exit' };
  },

  activate(kit) { this.got = new Set(); this.msgT = 0; this.done = false; this.cellMarkers.forEach(m => { m.visible = true; }); this.exitMarker.children[0].material.color.setHex(0xff4466); },
  reset(kit) {},                                                // cells stay collected across deaths; the game respawns at the last checkpoint
  update(kit, dt) {
    const p = kit.player.pos; this.msgT = Math.max(0, this.msgT - dt);
    this.cells.forEach((c, i) => {
      if (this.got.has(i)) return;
      if (Math.hypot(p.x - c.x, p.z - c.z) < 3.2 && Math.abs(p.y - c.y) < 3.5) {
        this.got.add(i); this.cellMarkers[i].visible = false; kit.toast(`POWER CELL ${this.got.size}/${this.cellsNeeded} — ${c.id}`, 2400);
        if (this.got.size === this.cellsNeeded) { this.exitMarker.children[0].material.color.setHex(0x55ff88); kit.toast('ALL CELLS — THE EXIT IS OPEN', 3000); }
      }
    });
    if (!this.done && Math.hypot(p.x - 318, p.z) < 6 && Math.abs(p.y - 10) < 3) {
      if (this.got.size >= this.cellsNeeded) { this.done = true; kit.complete('NOSTALGIA OVERDOSE — CLEARED', 'Greybox complete · 3/3 power cells'); }
      else if (this.msgT <= 0) { this.msgT = 2.5; kit.toast(`THE EXIT NEEDS ${this.cellsNeeded} POWER CELLS (${this.got.size}/${this.cellsNeeded})`, 2200); }
    }
  },
  dispose(kit) { this.cellMarkers = this.exitMarker = null; },
};
