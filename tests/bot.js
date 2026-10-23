// In-page route bot (QA only). Drives the game with REAL keyboard events (keydown/keyup on window) and camera yaw, exactly like a player:
// W + Shift to run, Space tap to jump, second tap to double-jump, hold Space to glide down long drops. It never teleports and never edits physics.
// window.__bot.run(waypoints, opts) -> Promise<{ok, log, deaths, reached, timeMs}>.  waypoint: {id,x,y,z,hw,hd,kind,point?}
//   platform waypoint: reached when the player is on the ground inside its footprint (+-0.2) at its top height.   point waypoint: reached within r metres.
(() => {
  const D = () => window.__dbg, key = (code, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));
  const held = new Set(); const set = (code, on) => { if (on && !held.has(code)) { held.add(code); key(code, true); } else if (!on && held.has(code)) { held.delete(code); key(code, false); } };
  const releaseAll = () => { for (const c of [...held]) set(c, false); };
  const inside = (p, w, m = 0.2) => w.hw !== undefined && Math.abs(p.x - w.x) <= w.hw + m && Math.abs(p.z - w.z) <= w.hd + m;
  window.__bot = {
    stop: false,
    run(wps, opts = {}) {
      const maxDeaths = opts.maxDeaths ?? 3, legTimeout = opts.legTimeout ?? 90000, log = [], t0 = performance.now();
      let i = 1, deaths = 0, legT = performance.now(), jumpedAt = -1, jumpTap = 0, lastState = 'play', reached = [wps[0].id], wasGround = true;
      return new Promise(resolve => {
        const fin = (ok, why) => { releaseAll(); resolve({ ok, why, log, deaths, reached, timeMs: Math.round(performance.now() - t0), at: { x: +D().pos.x.toFixed(1), y: +D().pos.y.toFixed(1), z: +D().pos.z.toFixed(1) }, target: wps[i] && wps[i].id }); };
        const frame = () => {
          if (window.__bot.stop) return fin(false, 'stopped');
          const p = D().pos, v = D().vel, mv = __ng.mv(), st = D().state, now = performance.now();
          if (jumpTap && now - jumpTap > 60) { set('Space', false); jumpTap = 0; }
          if (st === 'clear') return fin(true, 'level clear');
          if (st === 'dead' || mv.st === 'dead') { releaseAll(); if (lastState !== 'dead') { deaths++; log.push(`died near ${wps[i - 1].id}->${wps[i].id} at ${p.x.toFixed(0)},${p.y.toFixed(0)},${p.z.toFixed(0)}`); } lastState = 'dead'; if (deaths > maxDeaths) return fin(false, 'too many deaths'); return requestAnimationFrame(frame); }
          if (lastState === 'dead') { lastState = 'play'; i = Math.max(1, i - 1); for (let k = i; k > 0; k--) { if (!wps[k].point && inside(p, wps[k], 1)) { i = Math.min(k + 1, wps.length - 1); break; } } legT = now; log.push(`respawned; retargeting ${wps[i].id}`); }
          if (mv.paused) { releaseAll(); return requestAnimationFrame(frame); }
          let T = wps[i];
          // arrival
          const og = mv.onG;
          const arrived = T.point ? Math.hypot(p.x - T.x, p.z - T.z) < (T.r || 1.6) && Math.abs(p.y - T.y) < 3.5 : (og && inside(p, T, 0.0) && Math.abs(p.y - T.y) < 0.8);
          if (arrived) { reached.push(T.id); log.push(`+${T.id} t=${Math.round(now - t0)}ms`); i++; legT = now; if (i >= wps.length) return fin(true, 'route complete'); T = wps[i]; }
          if (now - legT > legTimeout) return fin(false, `timeout heading to ${T.id}`);
          const A = wps[i - 1];
          let dx = T.x - p.x, dz = T.z - p.z, dh = Math.hypot(dx, dz) || 1; const ux = dx / dh, uz = dz / dh;
          D().camYaw = Math.atan2(-dx, -dz);
          set('KeyW', true);
          set('ShiftLeft', dh > 3.5 || !og);
          // jumping
          const cur = A && !A.point ? A : null;
          const rise = (T.y || 0) - p.y;
          if (og && T.kind !== 'walk' && T.kind !== 'pad') {
            let go = false;
            if (cur && !inside({ x: p.x + ux * 1.0, z: p.z + uz * 1.0 }, cur, 0)) go = true;                      // about to leave the current platform
            if (!T.point && rise > 0.4 && Math.hypot(Math.max(0, Math.abs(p.x - T.x) - T.hw), Math.max(0, Math.abs(p.z - T.z) - T.hd)) < 1.1) go = true;   // climbing onto an overlapping/adjacent higher platform
            if (!cur && !T.point && Math.hypot(Math.max(0, Math.abs(p.x - T.x) - T.hw), Math.max(0, Math.abs(p.z - T.z) - T.hd)) < 4 && rise < -1) go = false;
            if (go && now - jumpedAt > 250) { set('Space', true); jumpTap = now; jumpedAt = now; }
          } else if (!og) {
            const edgeD = T.point ? dh : Math.hypot(Math.max(0, Math.abs(p.x - T.x) - T.hw), Math.max(0, Math.abs(p.z - T.z) - T.hd));
            if (mv.jumps === 1 && v.y <= 0.3 && p.y < T.y + 0.7 && edgeD > 0.6 && !jumpTap) { set('Space', true); jumpTap = now; }                    // double jump when we'd otherwise fall short
            else if (!jumpTap) set('Space', v.y < -11 && rise < -8 && mv.jumps >= 1);                                                              // hold Space = glide on long drops
          } else if (!jumpTap) set('Space', false);
          requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
      });
    },
  };
})();
