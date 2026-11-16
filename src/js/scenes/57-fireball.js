// Scene 7, fireball: ground-level section view, 60 m -> 3 km wide, log time 1 ms -> 2 s.
// The fireball (Sim.fireballR) and the luminous shock front (Sim.shockR, brightness Sim.frontGlow) share one centre: the
// tower top, 30 m up. A log-log inset plots Taylor's measured radii against the Taylor-Sedov line; photo-frame stamps at the
// published times are pure functions of t. Nothing here keeps state: every frame is drawn from f alone.
Scenes.register("fireball", (function () {
  var SPAN0 = 100, SPAN1 = 3000;            // m, hand-over from release and to cloud
  var LIGHT = "#ffb25a";

  // Photo times in seconds, read from the facts text "15, 25, 34, 53 and 62 ms (...)".
  function photoTimes() {
    var s = String(D.facts.photo_times.value).split("ms")[0], out = [], re = /\d+(\.\d+)?/g, m;
    while ((m = re.exec(s))) out.push(parseFloat(m[0]) * 1e-3);
    return out;
  }
  var PHOTOS = null;
  function measuredAt(t) {
    var a = Sim.measuredR, best = null;
    for (var i = 0; i < a.length; i++) if (Math.abs(Math.log(a[i][0] / t)) < 1e-6) best = i;
    return best;
  }

  function view(f) {
    var span = U.logAt(f.u, SPAN0, SPAN1), ppm = f.W / span, cyM = span * (f.H / f.W) * 0.3;
    var gy = f.H / 2 + cyM * ppm;
    return { span: span, ppm: ppm, cyM: cyM, gy: gy, cx: f.W / 2, cy: gy - World.LAYOUT.tower * ppm };
  }

  function panel(x, y, w, h, a) {
    ctx.save(); ctx.globalAlpha = a == null ? 1 : a; ctx.fillStyle = "rgba(11,14,20,0.84)"; Cv.rrect(x, y, w, h, 6); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }
  function fmtMs(t) { var v = t * 1e3; return (v < 1 ? v.toFixed(1) : String(Math.round(v * 10) / 10)) + " ms"; }

  // ---------- inset: log-log radius vs time ----------
  function drawInset(f, x, y, w, h, stampT) {
    var narrow = f.W < 640, M = Sim.measuredR, t = f.t, i, n = M.length;
    panel(x, y, w, h);
    Cv.label("RADIUS VERSUS TIME, LOG-LOG", x + 12, y + 19, C.fg, "left");
    var px0 = x + (narrow ? 52 : 50), py0 = y + 32, pw = w - (narrow ? 64 : 64), ph = h - 32 - (narrow ? 64 : 84);
    var t0 = M[0][0] * 0.8, t1 = M[n - 1][0] * 1.4, r0 = M[0][1] * 0.7, r1 = M[n - 1][1] * 1.35;
    function X(tt) { return px0 + pw * U.logPos(tt, t0, t1); }
    function Y(r) { return py0 + ph - ph * U.logPos(r, r0, r1); }
    ctx.save();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.fillStyle = "rgba(255,255,255,0.025)"; ctx.fillRect(px0, py0, pw, ph);
    // decade grid and tick labels
    var e;
    for (e = Math.ceil(Math.log(t0) / Math.LN10); Math.pow(10, e) <= t1; e++) {
      var tx = X(Math.pow(10, e)); ctx.beginPath(); ctx.moveTo(tx, py0); ctx.lineTo(tx, py0 + ph); ctx.stroke();
      Cv.text(fmtMs(Math.pow(10, e)), tx, py0 + ph + 13, { size: 10, color: C.muted, font: Cv.fonts.mono, align: "center" });
    }
    for (e = Math.ceil(Math.log(r0) / Math.LN10); Math.pow(10, e) <= r1; e++) {
      var ty = Y(Math.pow(10, e)); ctx.beginPath(); ctx.moveTo(px0, ty); ctx.lineTo(px0 + pw, ty); ctx.stroke();
      Cv.text(U.fmtDist(Math.pow(10, e)), px0 - 5, ty + 3.5, { size: 10, color: C.muted, font: Cv.fonts.mono, align: "right" });
    }
    ctx.strokeStyle = C.faint; ctx.strokeRect(px0, py0, pw, ph);
    ctx.restore();
    Cv.text(narrow ? "time" : "time since detonation", px0 + pw / 2, py0 + ph + 26, { size: 10, color: C.muted, align: "center" });
    ctx.save(); ctx.translate(x + 10, py0 + ph / 2); ctx.rotate(-Math.PI / 2);
    Cv.text("radius", 0, 0, { size: 10, color: C.muted, align: "center" }); ctx.restore();

    ctx.save(); ctx.beginPath(); ctx.rect(px0, py0, pw, ph); ctx.clip();
    // playhead
    if (t > t0 && t < t1) { ctx.strokeStyle = U.rgba(C.fg, 0.28); ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(X(t), py0); ctx.lineTo(X(t), py0 + ph); ctx.stroke(); ctx.setLineDash([]); }
    // Taylor-Sedov line (Sim.shockR) from the first point up to the playhead
    var tEnd = Math.min(t, t1);
    if (tEnd > M[0][0]) {
      ctx.strokeStyle = C.fire; ctx.lineWidth = 1.6; ctx.globalAlpha = 0.9; ctx.beginPath();
      for (i = 0; i <= 48; i++) { var tt = U.logAt(i / 48, M[0][0], tEnd), xx = X(tt), yy = Y(Sim.shockR(tt)); if (i) ctx.lineTo(xx, yy); else ctx.moveTo(xx, yy); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    // measured points appear as the playhead passes them
    var hi = stampT != null ? measuredAt(stampT.t) : null;
    for (i = 0; i < n; i++) {
      if (M[i][0] > t) break;
      ctx.fillStyle = C.neutron; ctx.beginPath(); ctx.arc(X(M[i][0]), Y(M[i][1]), 2.4, 0, 6.2832); ctx.fill();
    }
    if (hi != null && M[hi][0] <= t) {
      var hx = X(M[hi][0]), hy = Y(M[hi][1]);
      ctx.globalAlpha = stampT.a; ctx.strokeStyle = C.hot; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(hx, hy, 6.5, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = C.hot; ctx.beginPath(); ctx.arc(hx, hy, 3, 0, 6.2832); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
    // slope triangle: one decade of time, rise from the same line
    var ta = Math.pow(10, Math.log(t0 * t1) / Math.LN10 / 2 - 0.35), tb = ta * 10;
    if (tb < t1 * 4) {
      var sa = U.sstep(M[n - 1][0], M[n - 1][0] * 1.2, t), xa = X(ta), xb = X(tb);
      var ya = Y(Sim.shockR(ta)), yb = Y(Sim.shockR(tb)), xc = Math.min(xb, px0 + pw - 4);
      var ybc = ya + (yb - ya) * (xc - xa) / (xb - xa);
      ctx.save(); ctx.globalAlpha = 0.0 + 0.85 * U.sstep(0.15, 0.45, f.u); ctx.strokeStyle = C.hot; ctx.lineWidth = 1; ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(xa, ya); ctx.lineTo(xc, ya); ctx.lineTo(xc, ybc); ctx.stroke(); ctx.restore();
      Cv.text("slope 2/5", (xa + xc) / 2, ya + 13, { size: 11, weight: 600, color: C.hot, font: Cv.fonts.mono, align: "center", alpha: 0.85 * U.sstep(0.15, 0.45, f.u) });
    }
    // legend with provenance chips
    var ly = y + h - (narrow ? 38 : 46);
    ctx.fillStyle = C.neutron; ctx.beginPath(); ctx.arc(x + 18, ly + 6, 2.8, 0, 6.2832); ctx.fill();
    if (narrow) {
      Cv.text("measured", x + 24, ly + 10, { size: 10, color: C.fg }); Cv.tagChip("M", x + 72, ly - 1);
      ctx.strokeStyle = C.fire; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x + w / 2 + 4, ly + 6); ctx.lineTo(x + w / 2 + 16, ly + 6); ctx.stroke();
      Cv.text("Taylor line", x + w / 2 + 21, ly + 10, { size: 10, color: C.fg }); Cv.tagChip(D.facts.shock_law.tag, x + w - 24, ly - 1);
      return;
    }
    Cv.text("Taylor's measured radii", x + 28, ly + 10, { size: 11, color: C.fg });
    Cv.tagChip("M", x + w - 28, ly - 1);
    ctx.strokeStyle = C.fire; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(x + 12, ly + 26); ctx.lineTo(x + 24, ly + 26); ctx.stroke();
    Cv.text(D.facts.shock_law.value, x + 28, ly + 30, { size: 11, color: C.fg, font: Cv.fonts.mono });
    Cv.tagChip(D.facts.shock_law.tag, x + w - 28, ly + 17);
  }

  // ---------- photo-frame stamp: corner brackets, time and measured radius ----------
  function stampAt(f) {
    if (!PHOTOS) PHOTOS = photoTimes();
    var best = null, bx = 1e9, L = Math.log(f.phase.t1 / f.phase.t0);
    for (var i = 0; i < PHOTOS.length; i++) { var x = Math.abs(Math.log(f.t / PHOTOS[i])) / L; if (x < bx) { bx = x; best = PHOTOS[i]; } }
    var a = 1 - U.sstep(0.0035, 0.0095, bx);
    if (a <= 0.003) return null;
    var mi = measuredAt(best);
    return { t: best, a: a, R: mi == null ? null : Sim.measuredR[mi][1] };
  }
  function drawStamp(f, v, st, inset) {
    if (!st) return;
    var R = Math.max(Sim.fireballR(st.t), 0) * v.ppm, W = f.W, H = f.H, pad = 10;
    var x0 = Math.max(pad, v.cx - R * 1.14), x1 = Math.min(W - pad, v.cx + R * 1.14);
    var y0 = Math.max(pad, v.cy - R * 1.14), y1 = Math.min(v.gy - 6, v.cy + R * 1.14);
    if (inset && x1 > inset.x - 12 && y0 < inset.y + inset.h + 10) y0 = Math.min(inset.y + inset.h + 12, y1 - 60);
    var L = Math.min(34, (x1 - x0) * 0.2, (y1 - y0) * 0.2);
    ctx.save(); ctx.globalAlpha = st.a; ctx.strokeStyle = C.hot; ctx.lineWidth = 2; ctx.lineCap = "square";
    ctx.beginPath();
    ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
    ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
    ctx.moveTo(x0, y1 - L); ctx.lineTo(x0, y1); ctx.lineTo(x0 + L, y1);
    ctx.moveTo(x1 - L, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - L);
    ctx.stroke(); ctx.restore();
    // tag: time and measured radius, in a backed panel inside the lower left corner
    var l1 = (f.W < 640 ? "" : "FRAME  ") + fmtMs(st.t), l2 = st.R == null ? "" : "R = " + U.fmtDist(st.R) + (f.W < 640 ? "" : " measured");
    var w2 = Math.max(Cv.measure(l1, { size: 13, weight: 600, font: Cv.fonts.mono }), Cv.measure(l2, { size: 12, font: Cv.fonts.mono })) + 40, bh = l2 ? 44 : 28;
    var bx = x0 + 10, by = y1 - bh - 10;
    if (f.W < 640) { bx = 12; by = 12; }
    ctx.save(); ctx.globalAlpha = st.a; panel(bx, by, w2, bh);
    Cv.text(l1, bx + 10, by + 18, { size: 13, weight: 600, color: C.hot, font: Cv.fonts.mono });
    if (l2) { Cv.text(l2, bx + 10, by + 36, { size: 12, color: C.fg, font: Cv.fonts.mono }); Cv.tagChip("M", bx + w2 - 24, by + 22); }
    ctx.restore();
  }

  // ---------- ground effects ----------
  function dustSkirt(f, v, rS, a) {
    if (a < 0.01) return;
    var Rg = Math.sqrt(Math.max(0, rS * rS - 900)), W = f.W, N = f.W < 600 ? 22 : 34;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, v.gy); ctx.clip();
    for (var s = -1; s <= 1; s += 2) for (var i = 0; i < N; i++) {
      var q = (i + U.hash(i, 71 + s)) / N, xm = Rg * (0.42 + 0.58 * q), h = Rg * (0.012 + 0.05 * q) * (0.6 + 0.8 * U.hash(i, 73));
      var x = v.cx + s * xm * v.ppm, r = Math.max(4, Rg * (0.05 + 0.03 * U.hash(i, 74)) * v.ppm), y = v.gy - h * v.ppm * 0.5;
      if (x < -r || x > W + r) continue;
      var g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, U.rgba("#a8916c", 0.5 * a * (0.4 + 0.6 * q))); g.addColorStop(1, U.rgba("#6b5a43", 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, r * 1.2, Math.max(3, h * v.ppm), 0, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }
  // Mach stem hint (illustrative): near-vertical foot ahead of the incident front, joining it at a triple point.
  function machStem(f, v, rS, a) {
    if (a < 0.01) return null;
    var Rg = Math.sqrt(Math.max(0, rS * rS - 900)), phi = Math.asin(Math.min(1, 30 / rS)) + 0.12 + 0.18 * a;
    var gx = v.cx + Rg * v.ppm * 1.045, tx = v.cx + rS * v.ppm * Math.cos(phi), ty = v.cy - rS * v.ppm * Math.sin(phi) + 0;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, f.W, v.gy); ctx.clip();
    ctx.globalAlpha = a * 0.85; ctx.strokeStyle = "#e6f0ff"; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(gx, v.gy); ctx.quadraticCurveTo(gx + (tx - gx) * 0.2 + 3, (v.gy + ty) / 2, tx, ty); ctx.stroke();
    ctx.restore();
    return { x: (gx + tx) / 2, y: (v.gy + ty) / 2 };
  }

  function niceBar(ppm, W) {
    var c = [10, 100, 1000], best = c[0];
    for (var i = 0; i < c.length; i++) if (c[i] * ppm <= W * 0.22) best = c[i];
    return best;
  }

  return {
    draw: function (f) {
      var W = f.W, H = f.H, u = f.u, t = f.t, narrow = W < 640, v = view(f), mg = narrow ? 12 : 20;
      var rF = Sim.fireballR(t), rS = Sim.shockR(t), glow = Sim.frontGlow(t), rFp = rF * v.ppm, rSp = rS * v.ppm;
      var lightA = 0.25 + 0.65 * U.clamp(U.logPos(Sim.tempK(t), 3000, 1e5), 0, 1);
      var m = World.draw({ cx: 0, cy: v.cyM, span: v.span }, { dawn: 0.3, towerGone: true, light: { a: lightA, color: LIGHT, x: 0, y: World.LAYOUT.tower } });
      f.spanM = v.span;

      // dust skirt behind the front, only once the front is ahead of the glowing ball
      dustSkirt(f, v, rS, U.sstep(0.28, 0.55, u));

      // the fireball: glowing air, mottling grows with time
      var temp = Math.min(0.97, FX.heatPos(Sim.tempK(t)));
      FX.fireball(v.cx, v.cy, Math.max(rFp, 2), { temp: temp, rough: 0.25 + 0.65 * U.logPos(t, f.phase.t0, f.phase.t1), seed: 9, churn: Math.log(t / f.phase.t0) * 3, clipY: v.gy });

      // luminous front, then the faint refractive ring that remains
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, v.gy); ctx.clip();
      var gA = 0.9 * glow;
      if (gA > 0.01) Cv.glowArc(v.cx, v.cy, rSp, 0, 6.2832, C.hot, 1.7, gA);
      var ringA = 0.30 * (1 - 0.5 * glow);
      ctx.strokeStyle = U.rgba("#02030a", ringA * 0.9); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(v.cx, v.cy, rSp - 2.2, 0, 6.2832); ctx.stroke();
      ctx.strokeStyle = U.rgba("#d8e8ff", ringA); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(v.cx, v.cy, rSp, 0, 6.2832); ctx.stroke();
      ctx.restore();
      var stemPt = machStem(f, v, rS, U.sstep(0.52, 0.7, u));

      // ground-strip instruments
      var ground = v.gy;
      ctx.save(); ctx.fillStyle = "rgba(11,14,20,0.55)"; ctx.fillRect(0, ground + 2, W, H - ground); ctx.restore();
      var bar = niceBar(v.ppm, W), bl = U.fmtDist(bar), bpw = Math.max(bar * v.ppm, Cv.measure(bl, { size: 12, weight: 600, font: Cv.fonts.display })) + 20;
      Cv.scaleBar(mg, narrow ? ground - 14 : H - 20, bar, v.ppm, { alpha: 0.95 });
      var rx = mg, ry = ground + (narrow ? 18 : 22), sep = narrow ? 150 : 190;
      var lab = ["Fireball radius", "Shock-front radius"], val = [U.fmtDist(rF), U.fmtDist(rS)], tg = [Sim.tag("fireballR"), Sim.tag("shockR")];
      for (var k = 0; k < 2; k++) {
        var xx = rx + k * sep;
        Cv.readout(xx, ry, lab[k], val[k], { size: narrow ? 17 : 20 });
        Cv.tagChip(tg[k], xx + Cv.measure(lab[k].toUpperCase(), { size: 12, weight: 600, font: Cv.fonts.display }) + 6, ry - 11);
      }

      // inset
      var iw = narrow ? Math.min(W - 2 * mg, 200) : U.clamp(W * 0.3, 250, 400), ih = narrow ? 168 : iw * 1.02, ix = W - iw - mg, iy = mg;
      var st = stampAt(f);
      drawInset(f, ix, iy, iw, ih, st);
      drawStamp(f, v, st, { x: ix, y: iy, w: iw, h: ih });

      // callouts (content/07-fireball.json)
      var NY = iy + ih + 52, co = Scenes.callouts(f), cw = narrow ? 210 : 260, col = H * 0.5;
      function onFront(ang, r) { return [v.cx + Math.cos(ang) * r, v.cy + Math.sin(ang) * r]; }
      var p;
      if (narrow) {
        var pick = co.mach ? "mach" : co.ring ? "ring" : co.breakaway ? "breakaway" : co.taylor ? "taylor" : co.max ? "max" : null, keep = {};
        if (pick) keep[pick] = co[pick]; co = keep;
        cw = W - 2 * mg - 10;
      }
      if (co.taylor) { p = onFront(-2.35, rSp); Cv.callout(U.clamp(p[0], 8, W - 8), U.clamp(p[1], 20, ground - 20), mg, narrow ? NY : H * 0.42, co.taylor.text, { size: narrow ? 12 : 13, alpha: co.taylor.a, color: C.hot, maxW: cw, title: "G. I. Taylor" }); }
      if (co.breakaway) { p = onFront(-0.55, rSp); Cv.callout(U.clamp(p[0], 8, W - 8), U.clamp(p[1], 20, ground - 20), narrow ? mg : W - mg, narrow ? NY : H * 0.55, co.breakaway.text, { size: narrow ? 12 : 13, alpha: co.breakaway.a, color: C.fire, maxW: cw, title: "Breakaway" }); }
      if (co.ring) { p = onFront(-0.6, rSp); Cv.callout(U.clamp(p[0], 8, W - 8), U.clamp(p[1], 20, ground - 20), narrow ? mg : W - mg, narrow ? NY : H * 0.55, co.ring.text, { size: narrow ? 12 : 13, alpha: co.ring.a, color: "#cfe4ff", maxW: cw, title: "Shock ring" }); }
      if (co.mach && stemPt) Cv.callout(U.clamp(stemPt.x, 8, W - 8), U.clamp(stemPt.y, 20, ground - 6), narrow ? mg : W - mg, narrow ? NY : H * 0.55, co.mach.text, { size: narrow ? 12 : 13, alpha: co.mach.a, color: C.pu, maxW: cw, title: "Mach stem" });
      if (co.max) { p = onFront(-2.2, rFp); Cv.callout(U.clamp(p[0], 8, W - 8), U.clamp(p[1], 20, ground - 20), mg, narrow ? NY : H * 0.42, co.max.text, { size: narrow ? 12 : 13, alpha: co.max.a, color: C.fire, maxW: cw, title: "Largest" }); }
    },

    onEvent: function (ev, f) {
      var v = view(f);
      if (ev.id === "fireball-breakaway") FX.ping(v.cx, v.cy, C.hot, { r: 70, life: 1.1 });
    }
  };
})());
