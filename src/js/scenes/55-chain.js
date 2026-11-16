// Scene 5, chain: eighty generations of doubling. Starts and ends at pose B (30 cm view, core at the centre).
// Pose B at u = 0 is the last frame of "implosion"; the core is at full incandescence (glow 1) at u = 1,
// which is where "release" starts.
Scenes.register("chain", (function () {
  var GLOW_B = 0.15;      // core incandescence at pose B start (implosion ends with the same value)
  var LIT = 10;           // generations drawn as literal tracks
  var LAST = 7;           // the "last doublings" that carry nearly all of the energy
  var NF = 40;            // spheres in the nucleus drawing
  var tree = null, ball = null, eGen = null, share = null;

  // ---------- constant data, built once from fixed seeds (not frame state) ----------
  function buildTree() {
    // A branching tree of neutron tracks that spreads over the whole core: generation g lands near radius rho(g), growing from the
    // centre toward the rim (0.92 of the core radius), each child at its parent's polar angle plus a random turn.
    if (tree) return tree;
    var n = Math.pow(2, LIT + 1) - 1, X = new Float32Array(n), Y = new Float32Array(n), id, g;
    var ang = new Float32Array(n);
    X[0] = 0; Y[0] = 0; ang[0] = 0;
    for (id = 1; id < n; id++) {
      g = Math.floor(Math.log(id + 1) / Math.LN2);
      var p = (id - 1) >> 1, rho = 0.93 * (1 - Math.pow(0.62, g)) * (0.82 + 0.3 * U.hash(id, 32));
      var a = (g === 1 ? U.hash(id, 31) * 6.2832 : ang[p] + (U.hash(id, 31) - 0.5) * 2.4 + ((id & 1) ? 0.5 : -0.5));
      ang[id] = a; X[id] = Math.cos(a) * Math.min(rho, 0.96); Y[id] = Math.sin(a) * Math.min(rho, 0.96);
    }
    tree = { X: X, Y: Y, n: n };
    return tree;
  }
  function buildBall() {
    if (ball) return ball;
    var pts = [], i, order;
    for (i = 0; i < NF; i++) {
      var yy = 1 - 2 * (i + 0.5) / NF, rad = Math.sqrt(1 - yy * yy), th = i * 2.39996, rr = Math.pow((i + 0.5) / NF, 1 / 3);
      pts.push({ x: Math.cos(th) * rad * rr, y: yy * rr, z: Math.sin(th) * rad * rr, g: 0 });
    }
    order = pts.slice().sort(function (a, b) { return a.x - b.x; });
    for (i = 0; i < NF; i++) order[i].g = i < 24 ? 0 : 1;   // unequal fragments: 24 and 16 spheres
    ball = { pts: pts, xc: (order[23].x + order[24].x) / 2 };
    return ball;
  }
  function energies(f) {
    if (eGen) return eGen;
    var P = Sim.params, g, t0 = f.phase.t0;
    eGen = [];
    for (g = 0; g <= P.generations; g++) eGen.push(Math.max(P.eFission, Sim.energyJ(t0 + g * P.genTime)));
    share = 1 - eGen[P.generations - LAST] / eGen[P.generations];
    return eGen;
  }

  // ---------- layout ----------
  function layout(f) {
    var W = f.W, H = f.H;
    if (W >= 640) {
      var m = 16, rw = 190;
      return {
        wide: true,
        inset: { x: m, y: m, w: 248, h: 262 },
        gen: { x: W - m - rw, y: m, w: rw, h: 126 },
        dbl: { x: W - m - rw, y: m + 136, w: rw, h: 214 },
        msg: { x: m + 248 + 16, y: m, w: W - 2 * m - 248 - rw - 32, h: 66 },
        chart: { x: m, y: H - m - 132, w: W - 2 * m, h: 132 }
      };
    }
    return {                                           // phone: counters on top, one message line, a small fission loop beside the core, chart below
      wide: false,
      strip: { x: 8, y: 8, w: W - 16, h: 56 },
      msg: { x: 8, y: 68, w: W - 16, h: 44 },
      inset: { x: 8, y: 118, w: 96, h: 96 },
      chart: { x: 8, y: H - 8 - 100, w: W - 16, h: 100 }
    };
  }
  function panel(r, a) {
    ctx.save();
    ctx.fillStyle = "rgba(11,14,20," + (a == null ? 0.84 : a) + ")";
    Cv.rrect(r.x, r.y, r.w, r.h, 6); ctx.fill();
    ctx.strokeStyle = U.rgba(C.line, 0.9); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  function pow10(x, y, e, color, size) {
    var w = Cv.measure("10", { size: size, font: Cv.fonts.mono });
    Cv.text("10", x - w - Cv.measure(String(e).replace("-", "−"), { size: size - 3, font: Cv.fonts.mono }), y, { size: size, color: color, font: Cv.fonts.mono });
    Cv.text(String(e).replace("-", "−"), x, y - size * 0.45, { size: size - 3, color: color, font: Cv.fonts.mono, align: "right" });
  }

  // ---------- atomic inset: one fission, looped as a pure function of f.play ----------
  function inset(r, f, alpha) {
    panel(r, 0.9);
    var s = r.w / 248, cx = r.x + r.w * 0.5, cy = r.y + 30 * s + (r.h - 30 * s - 64 * s) * 0.5 + 6 * s;
    var c = f.rm ? 0.8 : ((f.play % 6) / 6);
    var fade = f.rm ? 1 : U.sstep(0, 0.05, c) * (1 - U.sstep(0.94, 1, c));
    var Rn = r.w * 0.15, rs = Rn * 0.25, rn = rs * 0.7, i, B = buildBall();
    var mini = r.w < 140;      // phone: just the animation, the captions live in the explainer
    if (!mini) Cv.label("ONE FISSION, NOT TO SCALE", r.x + 12, r.y + 20, C.fg);
    ctx.save(); ctx.beginPath(); Cv.rrect(r.x + 1, r.y + (mini ? 1 : 28), r.w - 2, r.h - (mini ? 2 : 29), 5); ctx.clip();
    ctx.globalAlpha = alpha * fade;
    // phases of the cycle
    var tA = 0.24, tB = 0.55, tC = 0.68, tD = 0.94;
    var wob = c < tA ? 0.03 * Math.sin(c * 90) : 0.05 * Math.sin((c - tA) * 46) * (1 + 3 * U.sstep(tA, tB, c));
    var ex = c < tA ? wob : c < tC ? wob + 0.55 * U.sstep(tA + 0.05, tC, c) * U.sstep(tA + 0.05, tC, c) : 0.6 * (1 - U.sstep(tC, tC + 0.18, c));
    var pinch = U.sstep(tB, tC, c) * (c < tC ? 1 : 1 - U.sstep(tC, tC + 0.04, c));
    var sp = c > tC ? U.easeOutQuad(U.clamp((c - tC) / (tD - tC), 0, 1)) : 0;
    var sepA = sp * r.w * 0.2, sepB = sp * r.w * 0.32, hot = U.sstep(tC, tC + 0.07, c);
    var nrm = Math.sqrt(1 + ex), rot = c * 0.9;
    // energy halo at scission
    if (c > tC) Cv.glow(cx, cy, r.w * 0.34, FX.heat(0.72), 0.6 * (1 - U.sstep(tC, tC + 0.2, c)));
    // spheres, back to front
    var P3 = B.pts.map(function (p) {
      var xr = p.x * Math.cos(rot) + p.z * Math.sin(rot), zr = -p.x * Math.sin(rot) + p.z * Math.cos(rot);
      var x = xr * (1 + ex), y = p.y / nrm, z = zr / nrm;
      var neck = 1 - 0.7 * pinch * Math.exp(-Math.pow((x - B.xc * (1 + ex)) / 0.38, 2));
      y *= neck; z *= neck;
      var px = cx + x * Rn + (p.g === 0 ? -sepA : sepB), py = cy + y * Rn;
      return { x: px, y: py, z: z, g: p.g };
    }).sort(function (a, b) { return a.z - b.z; });
    for (i = 0; i < P3.length; i++) {
      var q = P3[i], depth = 0.65 + 0.35 * U.clamp((q.z + 1) / 2, 0, 1);
      var col = U.mix(U.mix(C.pu, "#2a2150", 1 - depth), FX.heat(0.5), 0.45 * hot);
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(q.x, q.y, rs, 0, 6.2832); ctx.fill();
      ctx.fillStyle = U.rgba("#ffffff", 0.22 * depth); ctx.beginPath(); ctx.arc(q.x - rs * 0.3, q.y - rs * 0.3, rs * 0.38, 0, 6.2832); ctx.fill();
    }
    // incoming neutron
    if (c < tA + 0.07) {
      var dist = U.lerp(r.w * 0.42, Rn * 0.95 + rn, U.easeIn(U.clamp(c / tA, 0, 1)));
      var nx = cx - dist, na = 1 - U.sstep(tA, tA + 0.07, c);
      Cv.glow(nx, cy, rn * 4, C.neutron, 0.7 * na);
      ctx.globalAlpha = alpha * fade * na; ctx.fillStyle = C.neutron; ctx.beginPath(); ctx.arc(nx, cy, rn, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = alpha * fade;
      ctx.strokeStyle = U.rgba(C.neutron, 0.35 * na); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(r.x + 10, cy); ctx.lineTo(nx - rn, cy); ctx.stroke();
      if (!mini) Cv.text("neutron", r.x + 14, cy - 12, { size: 11, color: C.neutron, alpha: na });
    }
    // new neutrons leaving the scission point
    if (c > tC) {
      var tt = U.clamp((c - tC) / (tD - tC), 0, 1), ang = [-0.62, 2.55, -2.2], k;
      for (k = 0; k < 3; k++) {
        var d = tt * r.w * (0.30 + 0.08 * k), sx = cx + (sepB - sepA) * 0.12, nx2 = sx + Math.cos(ang[k]) * d, ny2 = cy + Math.sin(ang[k]) * d;
        ctx.strokeStyle = U.rgba(C.neutron, 0.4); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx, cy); ctx.lineTo(nx2, ny2); ctx.stroke();
        Cv.glow(nx2, ny2, rn * 4, C.neutron, 0.7);
        ctx.fillStyle = C.neutron; ctx.beginPath(); ctx.arc(nx2, ny2, rn, 0, 6.2832); ctx.fill();
      }
    }
    // labels near the action
    if (mini) { /* no captions */ }
    else if (c < tA) Cv.text("Pu-239 nucleus", cx, cy + Rn + 18 * s + 4, { size: 11, color: C.pu, align: "center" });
    else if (c > tC + 0.1) {
      Cv.text("two unequal fragments", cx, cy + Rn + 22 * s + 6, { size: 11, color: C.fire, align: "center", alpha: U.sstep(tC + 0.1, tC + 0.2, c) });
    }
    ctx.restore();
    if (mini) return;
    // facts at the foot of the panel
    var fy = r.y + r.h - 40 * s - 4, hl = c > tC && c < tD ? 1 : 0.8;
    ctx.save(); ctx.globalAlpha = alpha;
    var wideI = r.w >= 200;
    Cv.text(D.facts.mev_per_fission.value + (wideI ? " released" : ""), r.x + 12, fy + 2, { size: wideI ? 12.5 : 11.5, weight: 600, color: C.hot, alpha: hl });
    Cv.text(D.facts.neutrons_per_fission.value + (wideI ? " new neutrons freed" : " neutrons"), r.x + 12, fy + 20, { size: wideI ? 12.5 : 11.5, weight: 600, color: C.neutron, alpha: hl });
    if (wideI) { Cv.tagChip(D.facts.mev_per_fission.tag, r.x + r.w - 28, fy - 10); Cv.tagChip(D.facts.neutrons_per_fission.tag, r.x + r.w - 28, fy + 8); }
    ctx.restore();
  }

  // ---------- generation counter and doubling readout ----------
  function genBlock(r, f, Gf, compact) {
    var gi = Math.floor(Gf + 1e-6), P = Sim.params;
    var x = r.x + 14, y = r.y + 22;
    Cv.label("GENERATION", x, y, C.muted);
    Cv.tagChip(Sim.tag("generation"), r.x + r.w - 30, y - 11);
    var sz = compact ? 34 : 54;
    Cv.text(String(gi), x, y + sz + 4, { size: sz, weight: 500, color: C.hot, font: Cv.fonts.mono });
    var w = Cv.measure(String(gi), { size: sz, font: Cv.fonts.mono, weight: 500 });
    if (compact) {
      Cv.text("of " + D.facts.generations.value, x + w + 8, y + sz + 4, { size: 12, color: C.muted });
    } else {
      Cv.text("of " + D.facts.generations.value, x, y + sz + 24, { size: 13, color: C.muted });
      Cv.text(D.facts.generation_time.value + " per generation", x, y + sz + 42, { size: 12, color: C.muted });
    }
  }
  function countText(gi) { // count of fissions in generation gi (2^gi) as plain digits or scientific text
    return Math.pow(2, gi);
  }
  function dblBlock(r, f, Gf, compact) {
    var gi = Math.floor(Gf + 1e-6), n = countText(gi), x = r.x + 14, y = r.y + 22, i;
    Cv.label("FISSIONS IN THIS GENERATION", x, y, C.muted);
    if (!compact) {
      var seq = "", lim = Math.min(gi, 3);
      for (i = 0; i <= lim; i++) seq += (i ? " → " : "") + Math.pow(2, i);
      if (gi > 3) seq += " → …";
      Cv.text(seq, x, y + 26, { size: 14, color: C.fg, font: Cv.fonts.mono });
    }
    var by = y + (compact ? 30 : 68), sz = compact ? 24 : 34;
    Cv.text("2", x, by, { size: sz, weight: 500, color: C.fire, font: Cv.fonts.mono });
    var w2 = Cv.measure("2", { size: sz, font: Cv.fonts.mono, weight: 500 });
    Cv.text(String(gi), x + w2 + 1, by - sz * 0.5, { size: Math.round(sz * 0.6), weight: 500, color: C.fire, font: Cv.fonts.mono });
    var wE = Cv.measure(String(gi), { size: Math.round(sz * 0.6), font: Cv.fonts.mono, weight: 500 });
    var ex, vy;
    if (compact) { ex = x + w2 + wE + 12; vy = by; Cv.text("=", ex, vy, { size: sz * 0.7, color: C.muted, font: Cv.fonts.mono }); ex += sz * 0.7 + 4; }
    else { ex = x + 22; vy = by + 34; Cv.text("=", x, vy, { size: 20, color: C.muted, font: Cv.fonts.mono }); }
    if (n < 1e4) Cv.text(String(n), ex, vy, { size: compact ? 19 : 26, color: C.hot, font: Cv.fonts.mono });
    else Cv.sciText(n, ex, vy, { size: compact ? 19 : 26, color: C.hot, digits: 1 });
    if (!compact) {
      Cv.note("Clean doubling is a simplification. Illustrative.", x, r.y + r.h - 46, { tag: "I", maxW: r.w - 28 });
    }
  }

  // ---------- energy by generation ----------
  function chart(r, f, Gf, compact) {
    var P = Sim.params, E = energies(f), G = P.generations, g;
    panel(r);
    var px0 = r.x + 46, px1 = r.x + r.w - 14, py0 = r.y + (compact ? 40 : 44), py1 = r.y + r.h - (compact ? 28 : 34);
    var bw = (px1 - px0) / (G + 1);
    Cv.label(compact ? "ENERGY BY GENERATION, LOG" : "ENERGY RELEASED SO FAR, BY GENERATION (LOG SCALE)", r.x + 14, r.y + 20, C.muted);
    // gridlines and axis labels
    var e, yy;
    for (e = -10; e <= 10; e += 10) {
      yy = py1 - (py1 - py0) * U.logPos(Math.pow(10, e), P.eFission, P.yieldJ);
      if (yy < py0 - 1 || yy > py1 + 1) continue;
      ctx.fillStyle = U.rgba(C.line, 0.9); ctx.fillRect(px0, yy, px1 - px0, 1);
      pow10(px0 - 6, yy + 4, e, C.muted, 11);
    }
    var cur = Math.floor(Gf + 1e-6), first = G - LAST + 1;
    for (g = 0; g <= G; g++) {
      var hgt = Math.max(1.5, (py1 - py0) * U.logPos(E[g], P.eFission, P.yieldJ)), bx = px0 + g * bw;
      var on = g <= cur, hi = g >= first;
      ctx.fillStyle = on ? (hi ? U.rgba(C.fire, 0.95) : U.rgba(C.neutron, 0.8)) : U.rgba(hi ? C.fire : C.neutron, 0.13);
      ctx.fillRect(bx + 0.5, py1 - hgt, Math.max(1, bw - 1), hgt);
    }
    // x labels
    for (g = 0; g <= G; g += 20) Cv.text(String(g), px0 + (g + 0.5) * bw, py1 + 12, { size: 10.5, color: C.muted, font: Cv.fonts.mono, align: "center" });
    if (!compact) Cv.text("generation", px0 + 50.5 * bw, py1 + 12, { size: 10.5, color: C.muted, align: "center" });
    // bracket and label for the last doublings
    var bx0 = px0 + first * bw, by = r.y + 31, pc = Math.round(share * 100);
    var lab = "last " + LAST + " generations: about " + pc + "% of the energy";
    if (Cv.measure(lab, { size: 12, weight: 600, font: Cv.fonts.display }) > px1 - (r.x + (compact ? 160 : 330))) lab = "last " + LAST + ": about " + pc + "% of the energy";
    ctx.strokeStyle = C.fire; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(bx0, by + 4); ctx.lineTo(bx0, by); ctx.lineTo(px1, by); ctx.lineTo(px1, by + 4); ctx.stroke();
    Cv.label(lab.toUpperCase(), px1, r.y + 20, C.fire, "right");
    // linear share strip
    var sy = r.y + r.h - 13, wShare = (px1 - px0) * (1 - share);
    ctx.fillStyle = U.rgba(C.neutron, 0.85); ctx.fillRect(px0, sy, Math.max(1.5, wShare), 6);
    ctx.fillStyle = U.rgba(C.fire, 0.9); ctx.fillRect(px0 + Math.max(1.5, wShare), sy, px1 - px0 - Math.max(1.5, wShare), 6);
    Cv.text("share", px0 - 6, sy + 6, { size: 10.5, color: C.muted, align: "right" });
  }

  // ---------- tracks and density field inside the core ----------
  function core(g, f, Gf, hp) {
    var T = buildTree(), cx = g.cx, cy = g.cy, rc = g.r.core[1], ri = g.r.init[1], P = Sim.params;
    var E = Math.max(Sim.energyJ(f.t), P.eFission), lf = U.logPos(E, P.eFission, P.yieldJ);
    var cool = 1 - U.sstep(0.35, 0.95, hp);
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rc, 0, 6.2832); ctx.clip();
    var gi, id;
    // initiator burst: the first event
    var burst = U.clamp(Gf / 1.2, 0, 1), bfade = 1 - U.sstep(1.2, 3.2, Gf), k;
    if (burst > 0 && bfade > 0) {
      for (k = 0; k < 14; k++) {
        var a = (k + U.hash(k, 61)) * (6.2832 / 14), l0 = ri * 1.2, l1 = l0 + rc * (0.18 + 0.2 * U.hash(k, 62)) * burst;
        Cv.glowLine([[cx + Math.cos(a) * l0, cy + Math.sin(a) * l0], [cx + Math.cos(a) * l1, cy + Math.sin(a) * l1]], "#49c7f0", 1.6, 0.9 * bfade * cool);
      }
    }
    // literal tracks, by generation
    var trackA = (0.9 - 0.65 * U.sstep(LIT, LIT + 10, Gf)) * cool;
    for (gi = 1; gi <= LIT; gi++) {
      var s = U.clamp(Gf - (gi - 1), 0, 1); if (s <= 0) break;
      var i0 = (1 << gi) - 1, i1 = (1 << (gi + 1)) - 1, w = gi <= 4 ? 1.5 : gi <= 7 ? 1.1 : 0.8;
      ctx.beginPath();
      for (id = i0; id < i1; id++) {
        var p = (id - 1) >> 1, x0 = cx + T.X[p] * rc, y0 = cy + T.Y[p] * rc;
        ctx.moveTo(x0, y0); ctx.lineTo(x0 + (T.X[id] - T.X[p]) * rc * s, y0 + (T.Y[id] - T.Y[p]) * rc * s);
      }
      ctx.strokeStyle = "#0b1626"; ctx.lineWidth = w + 2.2; ctx.globalAlpha = trackA * 0.5; ctx.stroke();
      ctx.strokeStyle = "#49c7f0"; ctx.lineWidth = w; ctx.globalAlpha = trackA * (gi >= Math.floor(Gf) ? 1 : 0.8); ctx.stroke();
      if (s < 1) { // heads of the neutrons still in flight
        ctx.fillStyle = "#ffffff"; ctx.globalAlpha = trackA; ctx.beginPath();
        for (id = i0; id < i1; id++) {
          var q = (id - 1) >> 1, hx = cx + (T.X[q] + (T.X[id] - T.X[q]) * s) * rc, hy = cy + (T.Y[q] + (T.Y[id] - T.Y[q]) * s) * rc;
          ctx.moveTo(hx + 1.6, hy); ctx.arc(hx, hy, 1.6, 0, 6.2832);
        }
        ctx.fill();
      }
    }
    // fissions: warm points where a neutron has found a nucleus
    ctx.globalAlpha = 0.9 * cool; ctx.fillStyle = FX.heat(0.4); ctx.beginPath();
    var maxId = Math.min(T.n, (1 << (Math.min(LIT, Math.floor(Gf)) + 1)) - 1);
    for (id = 0; id < maxId; id++) { ctx.moveTo(cx + T.X[id] * rc + 1.5, cy + T.Y[id] * rc); ctx.arc(cx + T.X[id] * rc, cy + T.Y[id] * rc, 1.5, 0, 6.2832); }
    ctx.fill();
    // density field beyond generation LIT: brightness follows log of the energy
    var fa = U.sstep(LIT - 3, LIT + 6, Gf) * cool, nF = Math.floor(1500 * Math.pow(lf, 1.2) * U.sstep(LIT - 4, LIT + 4, Gf));
    if (fa > 0 && nF > 0) {
      var tm = f.play * 0.6, j;
      ctx.fillStyle = "#2aa8d6"; ctx.globalAlpha = 0.5 * fa; ctx.beginPath();
      for (j = 0; j < nF; j++) {
        var ang = U.hash(j, 71) * 6.2832, rr = Math.sqrt(U.hash(j, 72)) * 0.97 * rc, ph = U.hash(j, 73) * 6.2832;
        var fx = cx + Math.cos(ang) * rr + 3 * Math.sin(tm + ph), fy = cy + Math.sin(ang) * rr + 3 * Math.cos(tm * 0.8 + ph), fz = 0.9 + 1.4 * U.hash(j, 74);
        ctx.moveTo(fx + fz, fy); ctx.arc(fx, fy, fz, 0, 6.2832);
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      Cv.glow(cx, cy, rc * 0.95, C.neutron, 0.32 * Math.pow(lf, 2) * fa);
    }
    ctx.restore();
  }

  function msgBox(r, text, a, compact) {
    if (a <= 0.003) return;
    ctx.save(); ctx.globalAlpha = a; panel(r, 0.86); ctx.restore();
    var size = compact ? 12.5 : 14, lines = Cv.wrap(text, r.w - 24, { size: size, weight: 500 }), i;
    for (i = 0; i < lines.length; i++) Cv.text(lines[i], r.x + 12, r.y + 24 + i * (size + 5), { size: size, color: C.fg, alpha: a });
  }

  return {
    draw: function (f) {
      var W = f.W, H = f.H, P = Sim.params, L = layout(f);
      var Gf = U.clamp(Sim.generation(f.t), 0, P.generations);
      var pose = Gadget.pose(W, H, 1 + f.u), R = pose.R, cx = pose.cx, cy = pose.cy;   // slow push-in from pose B0 to pose B1
      f.spanM = pose.span;
      energies(f);
      var hp = FX.heatPos(Sim.tempK(f.t));
      var glow = Math.max(GLOW_B, hp);
      var g = Gadget.draw(cx, cy, R, { cut: 1, burn: 1, compress: 1, glow: glow });
      core(g, f, Gf, hp);

      var co = Scenes.callouts(f);
      if (L.wide) {
        inset(L.inset, f, 1 - 0.35 * U.sstep(0.45, 0.7, f.u));
        panel(L.gen); genBlock(L.gen, f, Gf, false);
        panel(L.dbl); dblBlock(L.dbl, f, Gf, false);
        chart(L.chart, f, Gf, false);
      } else {
        panel(L.strip);
        genBlock({ x: L.strip.x, y: L.strip.y - 4, w: 140, h: L.strip.h }, f, Gf, true);
        dblBlock({ x: L.strip.x + 138, y: L.strip.y, w: L.strip.w - 138, h: L.strip.h }, f, Gf, true);
        inset(L.inset, f, 1 - 0.35 * U.sstep(0.45, 0.7, f.u));
        chart(L.chart, f, Gf, true);
      }
      var ids = ["initiator", "literal", "quiet", "last"], i;
      for (i = 0; i < ids.length; i++) if (co[ids[i]]) msgBox(L.msg, co[ids[i]].text, co[ids[i]].a, !L.wide);
    },
    onEvent: function (ev, f) {
      var pose = Gadget.pose(f.W, f.H, 1 + f.u), cx = pose.cx, cy = pose.cy;
      if (ev.id === "chain-initiator") FX.ping(cx, cy, C.neutron, { r: 70 });
      else if (ev.id === "chain-last") FX.ping(cx, cy, C.fire, { r: 110 });
    }
  };
})());
