// lenses: 32 detonators fire, one lens is drawn enlarged (fast outer explosive, shaped slow insert, the wave front from
// Sim.lensFront), then the whole Gadget shows the merged, converging wave via burn = f(Sim.implosionFront).
Scenes.register("lenses", (function () {
  var TAU = 6.2832, HALF = Math.PI / 12;                 // the section shows 12 lens sectors, each +-15 degrees
  var NOTCH0 = 0.26;                                     // Gadget draws its section notches at n/12*2pi + 0.26
  var FRAC_IN = 0.64;                                    // lens inner radius / outer radius (Gadget.LAYERS lens r0)
  var LK = 1 - FRAC_IN;                                  // lens thickness as a fraction of the outer radius
  var RS = 1 / LK;                                       // sphere radius in lens-length units
  var DEPTH = RS - FRAC_IN * RS * Math.cos(HALF);        // block depth along the axis, in lens lengths (corners)
  var HEIGHT = 2 * RS * Math.sin(HALF);                  // block height across the axis, in lens lengths
  // timeline (u)
  var P_FADE0 = 0.12, P_FADE1 = 0.18, SLIDE0 = 0.06, SLIDE1 = 0.14, BACK0 = 0.66, BACK1 = 0.78, P_OUT0 = 0.61, P_OUT1 = 0.67;
  var XF0 = 0.60, XF1 = 0.72;                            // cross-fade: per-lens fronts -> merged burn front

  function layout(W, H) {
    var o = { wide: W >= 620 && W >= H * 1.05 }, minWH = Math.min(W, H);
    o.A = { cx: 0.5 * W, cy: 0.52 * H, R: 0.36 * minWH };
    if (o.wide) {
      var R2 = Math.min(0.16 * W, 0.27 * H), gx = R2 + 24, LW = 190;
      var L = Math.min(0.6 * H / HEIGHT, (W - 16 - LW - 30 - (gx + R2 + 36)) / DEPTH);
      o.B = { cx: gx, cy: 0.5 * H, R: R2 };
      o.L = L; o.cyL = 0.46 * H;
      o.Dx = gx + R2 + 36 + DEPTH * L; o.Dy = o.cyL; o.ang = Math.PI; o.notch = 0;
      o.blockL = o.Dx - DEPTH * L; o.blockB = o.cyL + HEIGHT * L / 2;
      o.legX = o.Dx + 30; o.legY = o.cyL - HEIGHT * L / 2 + 14; o.legW = W - 16 - o.legX;
      o.capX = o.blockL; o.capY = o.blockB + 34; o.capW = W - 16 - o.blockL;
      o.picX = o.legX; o.picY = o.legY + 4 * 22 + 30; o.legStep = 22; o.picSc = 1;
    } else {                                            // compact: gadget and lens side by side on top, text and legend below
      var topM = 26, regionH = 0.36 * H, R3 = Math.min(0.12 * W, regionH / 2), g3 = 14 + R3, L2 = regionH / HEIGHT;
      o.B = { cx: g3, cy: topM + regionH / 2, R: R3 };
      o.L = L2; o.cyL = topM + regionH / 2; o.Dx = g3 + R3 + 18 + DEPTH * L2; o.Dy = o.cyL; o.ang = Math.PI; o.notch = 0;
      o.blockL = o.Dx - DEPTH * L2; o.blockB = o.cyL + regionH / 2;
      o.capX = 16; o.capY = topM + regionH + 30; o.capW = W - 32;
      o.legX = 16; o.legY = o.capY + 2 * 18 + 20; o.legW = 190; o.legStep = 20;
      o.picX = o.Dx + 16; o.picSc = U.clamp((W - 8 - o.picX) / 150, 0.5, 1); o.picY = o.cyL - 36;
    }
    return o;
  }

  // sector (one lens, +-15 degrees about angle phi) path around centre (cx, cy), outer radius R.
  function sectorPath(cx, cy, R, phi) {
    ctx.beginPath();
    ctx.arc(cx, cy, R, phi - HALF, phi + HALF);
    ctx.arc(cx, cy, R * FRAC_IN, phi + HALF, phi - HALF, true);
    ctx.closePath();
  }

  // Wave front of one lens on the Gadget section, from Sim.lensFront.
  function drawGadgetFronts(g, lf, alpha) {
    if (alpha <= 0.003) return;
    var Lg = g.R * LK, n, k;
    for (n = 0; n < 12; n++) {
      var phi = NOTCH0 + n * TAU / 12, dx = g.cx + Math.cos(phi) * g.R, dy = g.cy + Math.sin(phi) * g.R, pts = [], base = phi + Math.PI;
      for (k = 0; k < lf.th.length; k++) {
        var a = base + lf.th[k];
        pts.push([dx + Math.cos(a) * lf.r[k] * Lg, dy + Math.sin(a) * lf.r[k] * Lg]);
      }
      ctx.save(); ctx.globalAlpha = alpha;
      sectorPath(g.cx, g.cy, g.R, phi); ctx.clip();
      ctx.beginPath(); ctx.moveTo(dx, dy); for (k = 0; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); ctx.closePath();
      ctx.fillStyle = FX.heat(0.36, 0.55); ctx.fill();
      Cv.glowLine(pts, C.hot, Math.max(1, g.R * 0.007), 1);
      ctx.restore();
    }
  }

  // The enlarged lens. Local frame: detonator at the origin, wave travels along +x, unit = one lens length (L px).
  function drawLens(o, lf, tau, alpha, t) {
    if (alpha <= 0.003) return;
    var L = o.L, k, th;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.translate(o.Dx, o.Dy); ctx.rotate(o.ang); ctx.scale(L, L);
    var ox = RS, lw = 1 / L;                              // sphere centre at x = RS (lens units); 1 css px = lw units
    function block() {
      ctx.beginPath();
      ctx.arc(ox, 0, RS, Math.PI - HALF, Math.PI + HALF);
      ctx.arc(ox, 0, RS * FRAC_IN, Math.PI + HALF, Math.PI - HALF, true);
      ctx.closePath();
    }
    // fast outer explosive
    block();
    var bg = ctx.createLinearGradient(0, 0, DEPTH, 0);
    bg.addColorStop(0, U.mix(C.heFast, "#000000", 0.18)); bg.addColorStop(1, U.mix(C.heFast, "#000000", 0.42));
    ctx.fillStyle = bg; ctx.fill();
    ctx.save(); block(); ctx.clip();
    // slow insert
    var Lm = Sim.lens, ins = [], N = 24;
    for (k = 0; k <= N; k++) { th = -Lm.theta_max + 2 * Lm.theta_max * k / N; var r = Lm.insert_r0 + Sim.lensInsertW(th); ins.push([r * Math.cos(th), r * Math.sin(th)]); }
    for (k = N; k >= 0; k--) { th = -Lm.theta_max + 2 * Lm.theta_max * k / N; ins.push([Lm.insert_r0 * Math.cos(th), Lm.insert_r0 * Math.sin(th)]); }
    ctx.beginPath(); ctx.moveTo(ins[0][0], ins[0][1]); for (k = 1; k < ins.length; k++) ctx.lineTo(ins[k][0], ins[k][1]); ctx.closePath();
    ctx.fillStyle = C.heSlow; ctx.fill(); ctx.strokeStyle = U.rgba("#1a0f05", 0.7); ctx.lineWidth = 1.4 * lw; ctx.stroke();
    // consumed explosive behind the front
    ctx.beginPath(); ctx.moveTo(0, 0);
    var fp = [];
    for (k = 0; k < lf.th.length; k++) { var q = [lf.r[k] * Math.cos(lf.th[k]), lf.r[k] * Math.sin(lf.th[k])]; fp.push(q); ctx.lineTo(q[0], q[1]); }
    ctx.closePath();
    var rr = Math.max(0.05, tau * Sim.lens.fast_speed), hg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
    hg.addColorStop(0, FX.heat(0.2, 0.8)); hg.addColorStop(1, FX.heat(0.5, 0.88));
    ctx.fillStyle = hg; ctx.fill();
    // faint "without the insert" front: a plain circle from the detonator
    ctx.setLineDash([5 * lw, 5 * lw]); ctx.strokeStyle = U.rgba(C.fg, 0.5); ctx.lineWidth = 1.3 * lw;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(0.001, tau * Sim.lens.fast_speed), -1.5, 1.5); ctx.stroke(); ctx.setLineDash([]);
    // the real front
    ctx.save(); ctx.scale(1, 1);
    Cv.glowLine(fp, C.hot, 2.4 * lw, 1);
    ctx.restore();
    ctx.restore();                                        // end clip
    block(); ctx.strokeStyle = U.rgba("#8a96ad", 0.7); ctx.lineWidth = 1.3 * lw; ctx.stroke();
    // detonator at the outer face
    ctx.restore();
    ctx.save(); ctx.globalAlpha = alpha; ctx.translate(o.Dx, o.Dy);
    var dg = U.sstep(0, 0.04, 1) ;
    Cv.glow(0, 0, 22, "#fff1d0", 0.7 * (1 - U.sstep(0.5, 1.4, tau) * 0.6));
    ctx.fillStyle = "#fff4dc"; ctx.beginPath(); ctx.arc(0, 0, 4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // Light through a glass lens: a spreading bundle is turned into a converging one.
  function drawGlass(x, y, alpha, sc) {
    if (alpha <= 0.003) return 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc); x = 0; y = 0;
    var w = 150, h = 62, sx = x + 8, my = y + h / 2, lx = x + 64, f = x + w - 6, k;
    ctx.save(); ctx.globalAlpha = alpha;
    ctx.lineWidth = 1.2;
    for (k = -2; k <= 2; k++) {
      var yy = my + k * 11;
      ctx.strokeStyle = U.rgba(C.hot, 0.75); ctx.beginPath(); ctx.moveTo(sx, my); ctx.lineTo(lx, yy); ctx.stroke();
      ctx.strokeStyle = U.rgba(C.neutron, 0.75); ctx.beginPath(); ctx.moveTo(lx, yy); ctx.lineTo(f, my); ctx.stroke();
    }
    ctx.fillStyle = U.rgba(C.neutron, 0.18); ctx.strokeStyle = C.neutron; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(lx, my - 31); ctx.quadraticCurveTo(lx + 11, my, lx, my + 31); ctx.quadraticCurveTo(lx - 11, my, lx, my - 31); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#fff4dc"; ctx.beginPath(); ctx.arc(sx, my, 2.6, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.restore();
    return h * sc;
  }

  function legend(o, alpha) {
    if (alpha <= 0.003) return;
    var rows = [["Fast explosive", C.heFast, "box"], ["Slow insert", C.heSlow, "box"], ["Wave front", C.hot, "line"], ["Without the insert", C.fg, "dash"]];
    var x = o.legX, y = o.legY, i, sw = 18;
    ctx.save(); ctx.globalAlpha = alpha;
    for (i = 0; i < rows.length; i++) {
      var yy = y + i * o.legStep, r = rows[i];
      if (r[2] === "box") { ctx.fillStyle = r[1]; ctx.fillRect(x, yy - 10, sw, 12); }
      else if (r[2] === "line") { ctx.restore(); Cv.glowLine([[x, yy - 4], [x + sw, yy - 4]], r[1], 1.8, alpha); ctx.save(); ctx.globalAlpha = alpha; }
      else { ctx.strokeStyle = U.rgba(r[1], 0.55); ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(x, yy - 4); ctx.lineTo(x + sw, yy - 4); ctx.stroke(); ctx.setLineDash([]); }
      Cv.text(r[0], x + sw + 8, yy, { size: 13, color: C.fg });
    }
    ctx.restore();
  }

  return {
    draw: function (f) {
      var W = f.W, H = f.H, u = f.u, t = f.t, o = layout(W, H), co = Scenes.callouts(f), i;
      f.spanM = 2;
      var s = U.easeInOut(U.invLerp(SLIDE0, SLIDE1, u)) * (1 - U.easeInOut(U.invLerp(BACK0, BACK1, u)));
      var cx = U.lerp(o.A.cx, o.B.cx, s), cy = U.lerp(o.A.cy, o.B.cy, s), R = U.lerp(o.A.R, o.B.R, s);
      var detGlow = U.sstep(0, 0.04, u) * (1 - 0.65 * U.sstep(0.80, 0.95, u));
      var fr = Sim.implosionFront(t), burn = U.clamp((1 - fr) / (1 - 0.5), 0, 1);
      var bA = U.sstep(XF0, XF1, u);                      // weight of the merged (Sim.implosionFront) picture
      var lf = Sim.lensFront(t, 61, 1.45);

      // the Gadget: section, per-lens fronts first, merged burn front cross-fades in over them
      var g = Gadget.draw(cx, cy, R, { cut: 1, detGlow: detGlow, burn: 0 });
      drawGadgetFronts(g, lf, 1 - bA);
      if (bA > 0.003) {
        g = Gadget.draw(cx, cy, R, { cut: 1, detGlow: detGlow, burn: burn, alpha: bA });
        if (g.front != null && g.front < R - 1) Cv.glowArc(cx, cy, g.front, 0, TAU, C.hot, 1.2, bA * 0.6);
      }
      // mark the lens that is shown enlarged
      var pA = U.sstep(P_FADE0, P_FADE1, u) * (1 - U.sstep(P_OUT0, P_OUT1, u));
      if (pA > 0.003) {
        var phi = NOTCH0 + o.notch * TAU / 12;
        ctx.save(); ctx.globalAlpha = pA; sectorPath(cx, cy, R, phi);
        ctx.strokeStyle = C.hot; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
      }

      // enlarged lens, legend, analogy
      drawLens(o, lf, lf.tau, pA, t);
      legend(o, pA);
      var gh = drawGlass(o.picX, o.picY, pA, o.picSc);
      if (pA > 0.003) {
        var gl = Cv.wrap(o.wide ? "Like glass bending light, the insert reshapes a spreading wave" : "Like glass bending light", 150 * o.picSc, { size: 12 });
        for (i = 0; i < gl.length; i++) Cv.text(gl[i], o.picX, o.picY + gh + 18 + i * 15, { size: 12, color: C.muted, alpha: pA });
        Cv.label("ONE LENS, ENLARGED", o.blockL, o.cyL - HEIGHT * o.L / 2 - 10, C.muted, "left", pA);
      }

      // canvas captions from the content file
      var cw = o.wide ? o.capW : W - 32;
      ["lens-bulge", "lens-flat", "lens-concave"].forEach(function (id) {
        if (!co[id]) return;
        var ls = Cv.wrap(co[id].text, cw, { size: 14 });
        for (var j = 0; j < ls.length; j++) Cv.text(ls[j], o.capX, o.capY + j * 18, { size: 14, color: C.fg, alpha: co[id].a });
      });
      var tsz = o.wide ? 16 : 13, tlh = o.wide ? 22 : 17;
      ["lens-problem", "lens-merge"].forEach(function (id) {
        if (!co[id]) return;
        var ls = Cv.wrap(co[id].text, Math.min(W - 24, 640), { size: tsz });
        var topY = Math.max(tsz + 6, o.A.cy - o.A.R - 12 - (ls.length - 1) * tlh);
        for (var j = 0; j < ls.length; j++) Cv.text(ls[j], W / 2, topY + j * tlh, { size: tsz, color: C.hot, align: "center", alpha: co[id].a });
      });

      // provenance caption (bottom left), wrapped upward so it never leaves the canvas
      var cap = "Illustrative lens model: wave speeds and shapes are not measured", cl = Cv.wrap(cap, Math.min(W - 36, 460) - 22, { size: 12 });
      Cv.note(cap, 18, H - 18 - (cl.length - 1) * 15, { tag: "I", maxW: Math.min(W - 36, 460) });
    },
    onEvent: function (ev, f) {
      if (ev.id === "lenses-fire") FX.ping(f.W * 0.5, f.H * 0.52, C.hot, { r: 160 });
    }
  };
})());
