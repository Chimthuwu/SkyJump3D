// Throwaway spec used only by QA to prove the loader lifecycle. Not listed in any menu.
export default {
  id: 'kit-selftest', name: 'KIT SELFTEST', mode: 'sp', layout: 'selftest', biome: null, version: 1,
  build(kit) {
    kit.slab(0, 0, 0, 20, 20, 2, 0x667788);
    kit.node('a', 0, 0, 0, 20, 20);
    kit.slab(0, 0, 24, 8, 8, 2, 0x887766); kit.node('b', 0, 0, 24, 8, 8); kit.edge('a', 'b', 'jump');
    kit.checkpoint(0, 0, 24);
    kit.slab(0, 0, 44, 10, 10, 2, 0x778866); kit.node('c', 0, 0, 44, 10, 10); kit.edge('b', 'c', 'jump');
    kit.finish();
    this.exit = kit.marker(0, 0, 44, 0x55ff88, 30);
    kit.setSpawn(0, 0, -4, 0); kit.setBounds({ worldR: 200, killY: -60 });
    return { start: 'a', exit: 'c' };
  },
  activate(kit) { this.t = 0; },
  update(kit, dt) { const p = kit.player.pos; if (Math.hypot(p.x, p.z - 44) < 4 && p.y < 3) kit.complete('SELFTEST CLEAR', 'kit lifecycle ok'); },
  reset(kit) {},
  dispose(kit) { this.exit = null; },
};
