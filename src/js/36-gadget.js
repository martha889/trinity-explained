
  // ============================================================================
  // 36-gadget: Gadget, the labelled concentric cutaway of the device. Schematic and popular-science level:
  // what the layers are for, not how to build one. Layer proportions are illustrative.
  // ============================================================================
  var Gadget = (function () {
    // Layers outside in. r0/r1 are fractions of the outer radius.
    var LAYERS = [
      { id: "det", name: "Detonators", r0: 1.0, r1: 1.0, color: C.alarm, blurb: "32 detonators on the surface fire at the same instant" },
      { id: "lens", name: "Explosive lenses", r0: 0.64, r1: 1.0, color: C.heFast, blurb: "fast explosive with slower inserts shapes each wave" },
      { id: "charge", name: "Inner explosive charge", r0: 0.50, r1: 0.64, color: "#b87a42", blurb: "the merged wave drives this charge inward" },
      { id: "pusher", name: "Aluminium pusher", r0: 0.43, r1: 0.50, color: C.al, blurb: "smooths the shock and passes it to the tamper" },
      { id: "tamper", name: "Natural-uranium tamper", r0: 0.27, r1: 0.43, color: C.tamper, blurb: "reflects neutrons and holds the core together" },
      { id: "core", name: "Plutonium core", r0: 0.07, r1: 0.27, color: C.pu, blurb: "6.2 kg of plutonium, squeezed to more than twice its density" },
      { id: "init", name: "Polonium-beryllium initiator", r0: 0.0, r1: 0.07, color: C.neutron, blurb: "a burst of neutrons at maximum compression" }
    ];
    var ORDER = LAYERS.map(function (l) { return l.id; });
    var api = { LAYERS: LAYERS, ORDER: ORDER };
    var BY = {}; LAYERS.forEach(function (l) { BY[l.id] = l; });

    // 32 lens centres = 12 icosahedron vertices + 20 face centres (the truncated-icosahedron pattern).
    var PTS = (function () {
      var p = (1 + Math.sqrt(5)) / 2, v = [], s, a, b, c, i, j, k;
      [[0, 1, p], [1, p, 0], [p, 0, 1]].forEach(function (b0) {
        [1, -1].forEach(function (s1) { [1, -1].forEach(function (s2) {
          var q = b0.slice(); var idx = 0;
          for (var n = 0; n < 3; n++) if (q[n] !== 0) { q[n] *= (idx++ === 0 ? s1 : s2); }
          v.push(q);
        }); });
      });
      function nrm(q) { var l = Math.hypot(q[0], q[1], q[2]); return [q[0] / l, q[1] / l, q[2] / l]; }
      var pts = v.map(nrm);
      for (i = 0; i < 12; i++) for (j = i + 1; j < 12; j++) for (k = j + 1; k < 12; k++) {
        var d = function (x, y) { return Math.pow(v[x][0] - v[y][0], 2) + Math.pow(v[x][1] - v[y][1], 2) + Math.pow(v[x][2] - v[y][2], 2); };
        if (Math.abs(d(i, j) - 4) < 1e-6 && Math.abs(d(j, k) - 4) < 1e-6 && Math.abs(d(i, k) - 4) < 1e-6)
          pts.push(nrm([v[i][0] + v[j][0] + v[k][0], v[i][1] + v[j][1] + v[k][1], v[i][2] + v[j][2] + v[k][2]]));
      }
      return pts;
    })();
    var EDGES = (function () {
      var e = [];
      for (var i = 0; i < PTS.length; i++) for (var j = i + 1; j < PTS.length; j++) {
        var dt = PTS[i][0] * PTS[j][0] + PTS[i][1] * PTS[j][1] + PTS[i][2] * PTS[j][2];
        if (dt > 0.72) e.push([i, j]);
      }
      return e;
    })();
    api.detonatorCount = PTS.length;

    function revealOf(o, id, i) {
      var r = o.reveal;
      if (r == null) return 1;
      if (typeof r === "number") return U.clamp(r * (LAYERS.length + 0.6) - i, 0, 1);
      return r[id] == null ? 1 : U.clamp(r[id], 0, 1);
    }
    function annulus(cx, cy, r1, r0) {
      ctx.beginPath(); ctx.arc(cx, cy, r1, 0, 6.2832); if (r0 > 0.01) ctx.arc(cx, cy, r0, 0, 6.2832, true);
    }

    // Gadget.draw(cx, cy, rPx, opts) -> radii in px.
    // opts: reveal (0..1 sequential outside-in, or {layerId: 0..1}), highlight (layer id), compress (0..1 squeezes
    // the pusher, tamper and core), burn (0..1: how far the detonation wave has swept inward, consumed explosive
    // glows hot behind it), cut (0..1: 0 = closed sphere with the 32 detonator points, 1 = full cross-section,
    // between = a wedge opened at the upper right), rot (yaw of the surface pattern, rad), glow (0..1 core
    // incandescence), detGlow (0..1 detonators lit), alpha.
    // Returns {cx, cy, R, r: {id: [inner, outer]}, front (px or null), at(id, angle) -> {x, y}}.
    api.draw = function (cx, cy, R, o) {
      o = o || {};
      var c = U.clamp(o.compress || 0, 0, 1), burn = U.clamp(o.burn || 0, 0, 1), cut = o.cut == null ? 1 : U.clamp(o.cut, 0, 1);
      var hl = o.highlight || null, baseA = o.alpha == null ? 1 : o.alpha;
      function bnd(f) { // layer boundary fraction after compression
        if (f >= 0.64) return f;
        if (f > 0.35) return f * (1 - 0.3 * c);
        return f * (1 - 0.243 * c);
      }
      var rr = {};
      LAYERS.forEach(function (l) { rr[l.id] = [bnd(l.r0) * R, bnd(l.r1) * R]; });
      var res = { cx: cx, cy: cy, R: R, r: rr, front: null, count: PTS.length };
      res.at = function (id, ang) { var r = (rr[id][0] + rr[id][1]) / 2; return { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r }; };
      var front = burn > 0 ? R + (rr.pusher[1] - R) * burn : null;
      res.front = front;
      var i, id, l, a;

      ctx.save(); ctx.globalAlpha = baseA;
      // soft ground shadow / halo
      Cv.glow(cx, cy, R * 1.25, "#101826", 0.0);
      // ---------- cross-section interior, outside in ----------
      for (i = 1; i < LAYERS.length; i++) {
        l = LAYERS[i]; id = l.id;
        var ra = revealOf(o, id, i); if (ra <= 0.001) continue;
        var dim = hl && hl !== id ? 0.38 : 1, r0 = rr[id][0], r1 = rr[id][1];
        ctx.save(); ctx.globalAlpha = baseA * ra * dim;
        var sc = 1 + (1 - ra) * 0.04; // layers settle into place
        ctx.translate(cx, cy); ctx.scale(sc, sc); ctx.translate(-cx, -cy);
        var base = l.color;
        if (id === "core" && o.glow) base = U.mix(l.color, FX.heat(0.45 + 0.5 * o.glow), U.clamp(o.glow, 0, 1));
        var g = ctx.createRadialGradient(cx, cy, Math.max(0, r0), cx, cy, Math.max(r0 + 1, r1));
        g.addColorStop(0, U.mix(base, "#000000", 0.38)); g.addColorStop(0.55, U.mix(base, "#000000", 0.12)); g.addColorStop(1, U.mix(base, "#ffffff", 0.14));
        if (id === "core" && o.glow > 0.02) { // incandescent: a white-hot centre grading to orange at the rim, never a flat white disc
          var gl = U.clamp(o.glow, 0, 1);
          g = ctx.createRadialGradient(cx, cy, Math.max(0, r0), cx, cy, Math.max(r0 + 1, r1));
          g.addColorStop(0, U.mix(U.mix(l.color, "#000000", 0.38), FX.heat(0.80), gl)); g.addColorStop(0.55, U.mix(U.mix(l.color, "#000000", 0.12), FX.heat(0.66), gl));
          g.addColorStop(1, U.mix(U.mix(l.color, "#ffffff", 0.14), FX.heat(0.46), gl));
        }
        annulus(cx, cy, r1, r0); ctx.fillStyle = g; ctx.fill("evenodd");
        // texture
        ctx.save(); annulus(cx, cy, r1, r0); ctx.clip("evenodd");
        if (id === "lens") {
          var N = 10, mid = (r0 + r1) / 2, th = r1 - r0;
          ctx.strokeStyle = U.rgba("#1a0f05", 0.55); ctx.lineWidth = 1.2; ctx.beginPath();
          for (var s = 0; s < N; s++) { a = (s / N) * 6.2832 + 0.15; ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0); ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1); }
          ctx.stroke();
          ctx.fillStyle = U.rgba(C.heSlow, 0.95); ctx.strokeStyle = U.rgba("#1a0f05", 0.6);
          for (s = 0; s < N; s++) {
            a = ((s + 0.5) / N) * 6.2832 + 0.15;
            ctx.save(); ctx.translate(cx + Math.cos(a) * (r1 - th * 0.42), cy + Math.sin(a) * (r1 - th * 0.42)); ctx.rotate(a);
            ctx.beginPath(); ctx.ellipse(0, 0, th * 0.36, Math.max(2, mid * 6.2832 / N * 0.22), 0, 0, 6.2832); ctx.fill(); ctx.stroke(); ctx.restore();
          }
        } else if (id === "tamper" || id === "pusher") {
          ctx.strokeStyle = U.rgba("#000000", 0.18); ctx.lineWidth = 1; ctx.beginPath();
          var step = id === "tamper" ? 7 : 5;
          for (var h = -R * 2; h < R * 2; h += step) { ctx.moveTo(cx - R + h, cy + R); ctx.lineTo(cx + R + h, cy - R); }
          ctx.stroke();
        }
        ctx.restore();
        // boundary line
        ctx.strokeStyle = U.rgba("#000000", 0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r1, 0, 6.2832); ctx.stroke();
        ctx.restore();
      }
      // initiator glow
      var ri = revealOf(o, "init", 6);
      if (ri > 0.001) {
        var dimI = hl && hl !== "init" ? 0.38 : 1;
        Cv.glow(cx, cy, Math.max(6, rr.init[1] * 3.2), C.neutron, 0.55 * ri * dimI);
        ctx.fillStyle = U.rgba("#e6fbff", ri * dimI); ctx.beginPath(); ctx.arc(cx, cy, Math.max(1.5, rr.init[1] * 0.8), 0, 6.2832); ctx.fill();
      }
      if (o.glow > 0.01) Cv.glow(cx, cy, rr.core[1] * 2.2, FX.heat(0.5 + 0.4 * o.glow), 0.5 * o.glow);
      // ---------- consumed explosive: hot gas behind the detonation wave ----------
      if (front != null) {
        var lensA = revealOf(o, "lens", 1);
        ctx.save(); ctx.globalAlpha = baseA * lensA; annulus(cx, cy, R, Math.max(1, front)); ctx.clip("evenodd");
        var bg = ctx.createRadialGradient(cx, cy, Math.max(1, front), cx, cy, R);
        bg.addColorStop(0, FX.heat(0.5, 0.95)); bg.addColorStop(0.18, FX.heat(0.3, 0.9)); bg.addColorStop(1, "rgba(38,16,8,0.92)");
        ctx.fillStyle = bg; ctx.fillRect(cx - R - 2, cy - R - 2, R * 2 + 4, R * 2 + 4); ctx.restore();
        if (front < R - 1) Cv.glowArc(cx, cy, front, 0, 6.2832, FX.heat(0.72), 2.2, baseA * lensA);
      }
      // ---------- exterior skin with the 32 detonator points ----------
      var ra0 = revealOf(o, "det", 0);
      if (ra0 > 0.001 && cut < 0.999) {
        var dimD = hl && hl !== "det" && hl !== "lens" ? 0.5 : 1;
        ctx.save(); ctx.globalAlpha = baseA * ra0 * dimD;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.clip();
        if (cut > 0.001) { // open a wedge to show the layers: clip to the sphere first, then subtract the wedge (nothing leaks outside the limb)
          var wa = cut * 6.2832, mid2 = -0.8, a0 = mid2 - wa / 2, a1 = mid2 + wa / 2;
          ctx.beginPath(); ctx.rect(cx - R * 3, cy - R * 3, R * 6, R * 6);
          ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a0) * R * 2, cy + Math.sin(a0) * R * 2); ctx.arc(cx, cy, R * 2, a0, a1); ctx.closePath();
          ctx.clip("evenodd");
        }
        var sg = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
        sg.addColorStop(0, "#5c6678"); sg.addColorStop(0.65, "#2f3747"); sg.addColorStop(1, "#171c27");
        ctx.fillStyle = sg; ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
        var yaw = o.rot == null ? 0.5 : o.rot, tilt = 0.42, cy1 = Math.cos(yaw), sy1 = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt);
        var pr = PTS.map(function (p) {
          var x1 = p[0] * cy1 + p[2] * sy1, z1 = -p[0] * sy1 + p[2] * cy1, y1 = p[1];
          var y2 = y1 * ct - z1 * st, z2 = y1 * st + z1 * ct;
          return [cx + x1 * R, cy + y2 * R, z2];
        });
        ctx.lineWidth = 1; ctx.beginPath();
        ctx.strokeStyle = U.rgba("#aab7cf", 0.34);
        for (var e = 0; e < EDGES.length; e++) {
          var pa = pr[EDGES[e][0]], pb = pr[EDGES[e][1]];
          if (pa[2] > 0.02 && pb[2] > 0.02) { ctx.moveTo(pa[0], pa[1]); ctx.lineTo(pb[0], pb[1]); }
        }
        ctx.stroke();
        var dg = U.clamp(o.detGlow || 0, 0, 1), hot = hl === "det";
        for (var q = 0; q < pr.length; q++) {
          var pp = pr[q]; if (pp[2] <= 0.02) continue;
          var rad = Math.max(1.6, R * 0.022) * (0.5 + 0.5 * pp[2]);
          if (dg > 0.01 || hot) Cv.glow(pp[0], pp[1], rad * (hot ? 4 : 3 + 6 * dg), dg > 0.01 ? "#fff1d0" : C.alarm, 0.5 * Math.max(dg, hot ? 0.7 : 0) * pp[2]);
          ctx.fillStyle = dg > 0.5 ? "#fff4dc" : U.mix("#ff7a66", "#ffd9a0", dg); ctx.globalAlpha = baseA * ra0 * dimD * (0.45 + 0.55 * pp[2]);
          ctx.beginPath(); ctx.arc(pp[0], pp[1], rad, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
        // limb and wedge edges
        ctx.save(); ctx.globalAlpha = baseA * ra0; ctx.strokeStyle = U.rgba("#8a96ad", 0.6); ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke(); ctx.restore();
      } else if (ra0 > 0.001) { // pure section: detonator notches around the rim
        ctx.save(); ctx.globalAlpha = baseA * ra0 * (hl && hl !== "det" ? 0.4 : 1);
        ctx.strokeStyle = U.rgba("#8a96ad", 0.6); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.2832); ctx.stroke();
        var dgl = U.clamp(o.detGlow || 0, 0, 1);
        for (var n = 0; n < 12; n++) {
          a = (n / 12) * 6.2832 + 0.26; var dx = cx + Math.cos(a) * R, dy = cy + Math.sin(a) * R, rd = Math.max(2, R * 0.026);
          if (dgl > 0.01 || hl === "det") Cv.glow(dx, dy, rd * (3 + 5 * dgl), dgl > 0.01 ? "#fff1d0" : C.alarm, 0.55 * Math.max(dgl, hl === "det" ? 0.7 : 0));
          ctx.fillStyle = dgl > 0.5 ? "#fff4dc" : U.mix("#ff7a66", "#ffd9a0", dgl); ctx.beginPath(); ctx.arc(dx, dy, rd, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
      }
      // ---------- highlight outline ----------
      if (hl && BY[hl]) {
        var hr = rr[hl], hc = BY[hl].color;
        if (hl === "det") Cv.glowArc(cx, cy, R, 0, 6.2832, hc, 1.6, baseA * 0.7);
        else { Cv.glowArc(cx, cy, hr[1], 0, 6.2832, hc, 1.8, baseA); if (hr[0] > 2) Cv.glowArc(cx, cy, hr[0], 0, 6.2832, hc, 1.2, baseA * 0.8); }
      }
      ctx.restore();
      return res;
    };
    // Shared camera poses for the zoom chapters (lenses end, implosion, chain, release start), so the cuts between them match exactly.
    // s = 0: pose A (end of lenses, the whole Gadget). s = 1: pose B0 (end of implosion). s = 2: pose B1 (end of chain, start of
    // release, after a slow push-in). The Gadget drifts a little upward so the zoomed core sits in the free area between the panels.
    var Z0 = 3.4, Z1 = 3.8, CY_A = 0.52, CY_B = 0.47;
    api.pose = function (W, H, s) {
      var ra = 0.36 * Math.min(W, H), z = s <= 1 ? Math.pow(Z0, Math.max(0, s)) : Z0 * Math.pow(Z1 / Z0, Math.min(1, s - 1));
      if (W < 640) z = 1 + (z - 1) * 0.5;   // phones: less zoom, so the core fits between the readouts above and below
      return { cx: 0.5 * W, cy: H * U.lerp(CY_A, CY_B, U.sstep(0, 1, Math.min(1, Math.max(0, s)))), R: ra * z, zoom: z, span: 2 / z };
    };
    return api;
  })();
