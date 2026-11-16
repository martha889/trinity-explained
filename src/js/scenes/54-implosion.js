// Scene 4, implosion: the converging shock squeezes the core, k rises through 1.
// Pose A (u = 0) is the last frame of "lenses"; pose B (u = 1) is the first frame of "chain".
Scenes.register("implosion", (function () {
  var GLOW_B = 0.15;          // core incandescence at pose B (chain starts from the same value)
  var K_MAX = 2.5;            // gauge range
  var tCross = null;          // physical time at which k = 1 (bisection on Sim.k, constant)
  var dots = null;            // pictogram atom positions in the unit disc (constant)

  function crossing(f) {
    if (tCross != null) return tCross;
    var a = f.phase.t0, b = f.phase.t1, i;
    for (i = 0; i < 48; i++) { var m = (a + b) / 2; if (Sim.k(m) < 1) a = m; else b = m; }
    tCross = b;
    return tCross;
  }
  function buildDots() {
    if (dots) return dots;
    var s = 0.4, rowH = s * 0.866, out = [], j, i;
    for (j = -3; j <= 3; j++) for (i = -3; i <= 3; i++) {
      var x = (i + (j & 1 ? 0.5 : 0)) * s, y = j * rowH;
      x += (U.hash(i * 13 + j * 7 + 40, 3) - 0.5) * 0.06; y += (U.hash(i * 5 + j * 11 + 90, 4) - 0.5) * 0.06;
      if (Math.hypot(x, y) < 0.86) out.push([x, y]);
    }
    dots = out;
    return dots;
  }

  function layout(f) {
    var W = f.W, H = f.H, m = 16, wide = W >= 640;
    if (wide) {
      var rw = 176, kph = Math.min(380, H - m - 102 - m);
      return {
        wide: true, m: m,
        dens: { x: W - m - rw, y: m, w: rw, h: 92 },
        kp: { x: W - m - rw, y: m + 102, w: rw, h: kph },
        pict: { x: m, y: m, w: 176, h: 304 },
        call: { x: m, y: m + 314, w: 176, h: 96 }
      };
    }
    return {
      wide: false, m: 8,
      strip: { x: 8, y: 8, w: W - 16, h: 56 },
      call: { x: 8, y: H - 70, w: W - 16, h: 62 }
    };
  }

  function panel(r, alpha) {
    ctx.save();
    ctx.fillStyle = "rgba(11,14,20," + (alpha == null ? 0.84 : alpha) + ")";
    Cv.rrect(r.x, r.y, r.w, r.h, 6); ctx.fill();
    ctx.strokeStyle = U.rgba(C.line, 0.9); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }

  // ---------- density readout ----------
  function densityBlock(x, y, w, d, peak, compact) {
    var share = U.clamp((d - 1) / (peak - 1), 0, 1);
    Cv.label("CORE DENSITY", x, y, C.muted);
    Cv.tagChip(Sim.tag("density"), x + w - 16, y - 11);
    var vy = y + (compact ? 24 : 34);
    var vs = compact ? 20 : 30;
    Cv.text(d.toFixed(2), x, vy, { size: vs, weight: 500, color: C.hot, font: Cv.fonts.mono });
    var tw = Cv.measure(d.toFixed(2), { size: vs, font: Cv.fonts.mono, weight: 500 });
    Cv.text("× normal", x + tw + 6, vy, { size: compact ? 12 : 13, weight: 500, color: C.muted });
    if (!compact) {
      var by = y + 50;
      ctx.fillStyle = U.rgba(C.line, 1); Cv.rrect(x, by, w, 5, 2.5); ctx.fill();
      ctx.fillStyle = FX.heat(0.3 + 0.35 * share); Cv.rrect(x, by, Math.max(5, w * share), 5, 2.5); ctx.fill();
      Cv.text("1", x, by + 19, { size: 11, color: C.muted, font: Cv.fonts.mono });
      Cv.text(peak.toFixed(1), x + w, by + 19, { size: 11, color: C.muted, font: Cv.fonts.mono, align: "right" });
    }
  }

  // ---------- k gauge, vertical (wide) ----------
  function kGaugeV(r, f, k, pulse, tc) {
    var x = r.x + 14, y = r.y + 20;
    Cv.label("MULTIPLICATION FACTOR k", x, y, C.muted);
    Cv.tagChip(Sim.tag("k"), r.x + r.w - 30, y - 11);
    var up = k > 1;
    Cv.text(k.toFixed(2), x, y + 40, { size: 30, weight: 500, color: up ? C.fire : C.neutron, font: Cv.fonts.mono });
    var gx = x + 6, gw = 26, g0 = y + 62, g1 = r.y + r.h - 64, h = g1 - g0;
    function Y(v) { return g1 - h * U.clamp(v / K_MAX, 0, 1); }
    var y1 = Y(1), i;
    // zones
    ctx.fillStyle = U.rgba(C.neutron, 0.10); ctx.fillRect(gx, y1, gw, g1 - y1);
    ctx.fillStyle = U.rgba(C.fire, 0.12); ctx.fillRect(gx, g0, gw, y1 - g0);
    // fill to current k
    var yk = Y(k);
    ctx.fillStyle = U.rgba(C.neutron, 0.9); ctx.fillRect(gx + 3, Math.max(yk, y1), gw - 6, g1 - Math.max(yk, y1));
    if (up) { ctx.fillStyle = U.rgba(C.fire, 0.95); ctx.fillRect(gx + 3, yk, gw - 6, y1 - yk); }
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, g0 + 0.5, gw - 1, h - 1);
    // ticks
    for (i = 0; i <= 2; i++) {
      ctx.fillStyle = C.faint; ctx.fillRect(gx - 5, Y(i), 5, 1);
      Cv.text(String(i), gx - 8, Y(i) + 4, { size: 11, color: C.muted, font: Cv.fonts.mono, align: "right" });
    }
    // k = 1 line
    if (pulse > 0) Cv.glow(gx + gw / 2, y1, 46, C.hot, 0.55 * pulse);
    ctx.strokeStyle = C.hot; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(gx - 6, y1); ctx.lineTo(gx + gw + 10, y1); ctx.stroke();
    var lx = gx + gw + 16;
    Cv.label("MULTIPLIES", lx, y1 - 9, C.fire);
    Cv.label("DIES OUT", lx, y1 + 19, C.neutron);
    // current marker
    ctx.fillStyle = up ? C.fire : C.neutron;
    ctx.beginPath(); ctx.moveTo(gx + gw + 1, yk); ctx.lineTo(gx + gw + 8, yk - 4); ctx.lineTo(gx + gw + 8, yk + 4); ctx.closePath(); ctx.fill();
    // event mark: the instant k crossed 1
    if (f.t >= tc) {
      var ey = y1 + 40;
      Cv.text("passed 1 at", lx, ey + 2, { size: 11, color: C.muted });
      Cv.text(U.fmtClock(tc), lx, ey + 16, { size: 12, color: C.hot, font: Cv.fonts.mono });
    }
  }

  // ---------- k gauge, horizontal (narrow) ----------
  function kGaugeH(r, f, k, pulse, tc) {
    var x = r.x + 138, w = r.x + r.w - 14 - x, y = r.y + 30, up = k > 1;
    Cv.label("MULTIPLICATION FACTOR k", x, r.y + 16, C.muted);
    Cv.text(k.toFixed(2), x + w, r.y + 18, { size: 16, weight: 500, color: up ? C.fire : C.neutron, font: Cv.fonts.mono, align: "right" });
    function X(v) { return x + w * U.clamp(v / K_MAX, 0, 1); }
    ctx.fillStyle = U.rgba(C.neutron, 0.12); ctx.fillRect(x, y, X(1) - x, 8);
    ctx.fillStyle = U.rgba(C.fire, 0.14); ctx.fillRect(X(1), y, x + w - X(1), 8);
    ctx.fillStyle = up ? C.fire : C.neutron; ctx.fillRect(x, y + 2, Math.max(1, X(k) - x), 4);
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 7);
    if (pulse > 0) Cv.glow(X(1), y + 4, 30, C.hot, 0.55 * pulse);
    ctx.strokeStyle = C.hot; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(1), y - 4); ctx.lineTo(X(1), y + 12); ctx.stroke();
    Cv.label("DIES OUT", X(1) - 6, y + 24, C.neutron, "right");
    Cv.label("MULTIPLIES", X(1) + 6, y + 24, C.fire, "left");
    ctx.fillStyle = up ? C.fire : C.neutron;
    ctx.beginPath(); ctx.moveTo(X(k), y - 1); ctx.lineTo(X(k) - 4, y - 7); ctx.lineTo(X(k) + 4, y - 7); ctx.closePath(); ctx.fill();
  }

  // ---------- pictogram pair ----------
  function pictogram(r, f, d, peak) {
    panel(r);
    var D = buildDots(), cx = r.x + r.w / 2;
    Cv.label("WHY SQUEEZING WORKS", r.x + 12, r.y + 20, C.muted);
    var rb = 40, rs = rb / Math.sqrt(peak), dr = 3.2, nr = 2.2, i;
    var cells = [
      { cy: r.y + 92, rad: rb, cap: "NORMAL DENSITY", sub: "neutron escapes", hit: false },
      { cy: r.y + 214, rad: rs, cap: "SQUEEZED", sub: "neutron hits an atom", hit: true }
    ];
    // choose a chord that misses every atom in the big circle but strikes one in the small one
    var best = 0, bestScore = 1e9, o, c, mb, ms, hitDot = null;
    for (o = -0.5 * rs; o <= 0.5 * rs; o += 0.25) {
      mb = 1e9; ms = 1e9;
      for (i = 0; i < D.length; i++) { mb = Math.min(mb, Math.abs(D[i][1] * rb - o)); ms = Math.min(ms, Math.abs(D[i][1] * rs - o)); }
      if (mb > dr + nr + 1.5 && ms < dr + nr - 0.5) { var sc = Math.abs(o); if (sc < bestScore) { bestScore = sc; best = o; } }
    }
    var loop = f.rm ? 0.78 : ((f.play % 3.2) / 3.2);
    var active = U.clamp((d - 1) / (peak - 1), 0, 1);
    cells.forEach(function (cell, ci) {
      var rad = cell.rad, yy = cell.cy, hot = ci === 1;
      var al = ci === 0 ? 1 - 0.35 * active : 0.55 + 0.45 * active;
      ctx.save(); ctx.globalAlpha = al;
      Cv.label(cell.cap, r.x + 12, yy - rb - 8, hot ? C.fire : C.neutron);
      ctx.fillStyle = U.rgba(C.pu, 0.06); ctx.strokeStyle = U.rgba(C.pu, 0.5); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(cx, yy, rad, 0, 6.2832); ctx.fill(); ctx.stroke();
      var hx = null, hy = best + yy;
      for (i = 0; i < D.length; i++) {
        var px = cx + D[i][0] * rad, py = yy + D[i][1] * rad;
        if (hot && Math.abs(D[i][1] * rad - best) < dr + nr - 0.5) { if (hx == null || px < hx) hx = px; }
        ctx.fillStyle = U.rgba(C.pu, 0.95); ctx.beginPath(); ctx.arc(px, py, dr, 0, 6.2832); ctx.fill();
      }
      // neutron path
      var x0 = r.x + 18, x1 = r.x + r.w - 18, xe = hot ? (hx != null ? hx - dr - 1 : cx) : x1;
      ctx.strokeStyle = U.rgba(C.neutron, 0.75); ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(x0, hy); ctx.lineTo(xe, hy); ctx.stroke(); ctx.setLineDash([]);
      var nx = x0 + (xe - x0) * U.clamp(loop / 0.7, 0, 1);
      Cv.glow(nx, hy, 7, C.neutron, 0.8);
      ctx.fillStyle = C.neutron; ctx.beginPath(); ctx.arc(nx, hy, nr, 0, 6.2832); ctx.fill();
      if (hot && hx != null && loop > 0.7) { // a hit: short burst of rays
        var b = U.clamp((loop - 0.7) / 0.3, 0, 1);
        for (i = 0; i < 6; i++) {
          var a = i * 1.047 + 0.3, l = 5 + 9 * b;
          ctx.strokeStyle = U.rgba(C.fire, 0.9 * (1 - b)); ctx.beginPath();
          ctx.moveTo(hx, hy); ctx.lineTo(hx + Math.cos(a) * l, hy + Math.sin(a) * l); ctx.stroke();
        }
      } else if (!hot) {
        ctx.fillStyle = U.rgba(C.neutron, 0.9);
        ctx.beginPath(); ctx.moveTo(x1 + 2, hy); ctx.lineTo(x1 - 5, hy - 3.5); ctx.lineTo(x1 - 5, hy + 3.5); ctx.closePath(); ctx.fill();
      }
      Cv.text(cell.sub, r.x + r.w - 12, yy + rb + 17, { size: 11, color: C.fg, align: "right" });
      ctx.restore();
    });
    Cv.text("Same atoms in both. Illustrative.", r.x + 12, r.y + r.h - 8, { size: 10.5, color: C.muted });
  }

  // ---------- callout slot (tamper's two jobs) ----------
  function jobBox(L, f, W, H, g, co, which, text, a) {
    var s = L.call, title = which === 0 ? "Tamper, job 1" : "Tamper, job 2", col = C.tamper;
    // anchor on the tamper where it is on screen and not covered by a panel
    var base = which === 0 ? Math.PI - 0.35 : Math.PI + 0.45, best = null, bd = 9, k, ang, p, free;
    for (k = -12; k <= 12; k++) {
      ang = base + k * 0.1; p = g.at("tamper", ang);
      free = L.wide ? (p.x > L.pict.x + L.pict.w + 10 && p.x < L.dens.x - 10 && p.y > 10 && p.y < H - 10)
                    : (p.x > 10 && p.x < W - 10 && p.y > L.strip.y + L.strip.h + 8 && p.y < s.y - 10);
      if (free && Math.abs(k) < bd) { bd = Math.abs(k); best = p; }
    }
    ctx.save(); ctx.globalAlpha = a;
    panel(s, 0.9);
    ctx.restore();
    var pad = 10, lines = Cv.wrap(text, s.w - pad * 2, { size: 12.5 });
    if (best) {
      var ex = L.wide ? s.x + s.w : s.x + s.w / 2, ey = L.wide ? s.y + 30 : s.y;
      ctx.save(); ctx.globalAlpha = a * 0.8; ctx.strokeStyle = col; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(best.x, best.y); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(best.x, best.y, 3.2, 0, 6.2832); ctx.fill(); ctx.restore();
    }
    Cv.text(title.toUpperCase(), s.x + pad, s.y + 20, { size: 13, weight: 700, color: col, font: Cv.fonts.display, alpha: a });
    for (var i = 0; i < lines.length; i++) Cv.text(lines[i], s.x + pad, s.y + 38 + i * 16, { size: 12.5, color: C.fg, alpha: a });
  }

  return {
    draw: function (f) {
      var W = f.W, H = f.H, u = f.u, i;
      var peak = Sim.params.peakCompression, d = Sim.density(f.t);
      var c = U.clamp((d - 1) / (peak - 1), 0, 1);
      var e = U.easeInOut(u), pose = Gadget.pose(W, H, e), R = pose.R, cx = pose.cx, cy = pose.cy;
      f.spanM = pose.span;
      var tc = crossing(f), k = Sim.k(f.t);
      var L = layout(f);

      var g = Gadget.draw(cx, cy, R, { cut: 1, burn: 1, compress: c, glow: GLOW_B * c });

      // the converging shock: thin bright ring, position from Sim.implosionFront
      var fr = Sim.implosionFront(f.t) * R;
      if (fr > 1) {
        Cv.glowArc(cx, cy, fr * 1.035, 0, 6.2832, FX.heat(0.62), 3, 0.28);
        Cv.glowArc(cx, cy, fr, 0, 6.2832, FX.heat(0.82), 2.2, 0.95);
      }

      // pulse on the k = 1 line, a smooth 1.6 s fade after playback crosses it
      var span = f.phase.play1 - f.phase.play0, playC = f.phase.play0 + (tc - f.phase.t0) / (f.phase.t1 - f.phase.t0) * span;
      var pulse = f.rm ? 0 : (f.play >= playC ? 1 - U.sstep(0, 1.6, f.play - playC) : 0);

      var co = Scenes.callouts(f);
      if (L.wide) {
        panel(L.dens); densityBlock(L.dens.x + 14, L.dens.y + 22, L.dens.w - 28, d, peak, false);
        panel(L.kp); kGaugeV(L.kp, f, k, pulse, tc);
        Cv.note("Density and k are illustrative curves, not a calculation.", L.kp.x + 12, L.kp.y + L.kp.h - 34, { tag: "I", maxW: L.kp.w - 24 });
        pictogram(L.pict, f, d, peak);
      } else {
        panel(L.strip);
        densityBlock(L.strip.x + 12, L.strip.y + 16, 110, d, peak, true);
        kGaugeH(L.strip, f, k, pulse, tc);
      }
      if (co.reflect) jobBox(L, f, W, H, g, co, 0, co.reflect.text, co.reflect.a);
      if (co.inertia) jobBox(L, f, W, H, g, co, 1, co.inertia.text, co.inertia.a);
      if (!L.wide) Cv.text("Illustrative curves", 12, 78, { size: 10.5, color: C.muted, alpha: 0.9 });
    },
    onEvent: function (ev, f) {
      if (ev.id === "implosion-critical") {
        var L = layout(f);
        if (L.wide) FX.ping(L.kp.x + 40, L.kp.y + L.kp.h * 0.55, C.hot, { r: 50 });
        else FX.ping(f.W - 80, 40, C.hot, { r: 40 });
      }
    }
  };
})());
