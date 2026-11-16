// Scene 9: aftermath. A dawn landscape at about 1 km (crater, trinitite, footings, cloud remnant), then a calm
// ledger drawn on the canvas, then two plain closing lines. Pure function of f; no accumulating state.
Scenes.register("aftermath", (function () {
  var U_DIM0 = 0.29, U_DIM1 = 0.325;      // landscape dims
  var U_ROWS = [0.32, 0.39, 0.46, 0.53, 0.61]; // reveal start of: energy, material, mass, estimates, split
  var U_LEDGER_OUT0 = 0.745, U_LEDGER_OUT1 = 0.79;
  var U_CLOSE = [0.775, 0.875];            // fade-in start of closing line 1, 2

  function rowA(u, i) { return U.easeOut(U.sstep(U_ROWS[i], U_ROWS[i] + 0.05, u)); }

  // ---- numbers, all taken from D.facts ----
  function facts() {
    var F = D.facts, v1945 = /([\d.]+)\s*kt\s*\(1945\)/.exec(F.yield_1945.value), pm = /±\s*([\d.]+)/.exec(F.yield_2021.value);
    var mon = { January: 0, February: 1, March: 2, April: 3, May: 4, June: 5, July: 6, August: 7, September: 8, October: 9, November: 10, December: 11 };
    function dt(s) { var m = /(\d+)\s+([A-Za-z]+)\s+(\d{4})/.exec(s); return m ? Date.UTC(+m[3], mon[m[2]], +m[1]) : 0; }
    return {
      est: [
        { name: "Fermi", sub: "paper scraps", kt: F.yield_fermi.num, err: 0, col: C.pu, side: -1 },
        { name: "1945", sub: "radiochemistry", kt: v1945 ? parseFloat(v1945[1]) : 0, err: 0, col: C.al, side: 1 },
        { name: "1963", sub: "revision", kt: F.yield_1963.num, err: 0, col: C.fire, side: -1 },
        { name: "2021", sub: "re-analysis", kt: F.yield_2021.num, err: pm ? parseFloat(pm[1]) : 0, col: C.neutron, side: 1 }
      ],
      days: Math.round((dt(F.nagasaki_date.value) - dt(F.date_time.value)) / 86400000),
      fallout: F.fallout_note.value.split(";")[0]
    };
  }
  function fmtKt(n) { return (Math.round(n * 10) / 10).toString(); }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------------------------------------------------------------- landscape
  function landscape(f) {
    var narrow = f.W < 560, span = narrow ? 320 : 420;
    var ppm0 = f.W / span, v = { cx: 0, cy: 0.19 * f.H / ppm0, span: span };
    // dawn carries on from the cloud scene (0.85) and the light keeps growing to a proper morning over the first seconds
    var m = World.draw(v, { dawn: U.lerp(0.85, 1, U.sstep(0, 0.2, f.u)), day: 0.75 * U.sstep(0, 0.28, f.u), towerGone: true, clouds: 0.3, bunkers: false, camp: false });
    var g = m.groundY, ppm = m.ppm, x0 = m.X(0);
    f.spanM = span;

    // cloud remnant: high, thin, drifting east out of frame as u runs 0..1 of the whole scene (cosmetic, from f.u only)
    ctx.save();
    var drift = f.u * 2.1 * f.W;
    for (var i = 0; i < 6; i++) {
      var cxp = f.W * (0.30 + 0.1 * i * 0.9) + drift * (0.8 + 0.1 * U.hash(i, 5)), cyp = g - f.H * (0.50 + 0.07 * U.hash(i, 6) + 0.012 * i);
      var rw = f.W * (0.10 + 0.06 * U.hash(i, 7)), rh = rw * 0.22;
      ctx.save(); ctx.translate(cxp, cyp); ctx.scale(1, rh / rw);
      var gr = ctx.createRadialGradient(0, 0, 0, 0, 0, rw);
      gr.addColorStop(0, U.rgba("#d9a79a", 0.34)); gr.addColorStop(0.5, U.rgba("#8e7c8a", 0.16)); gr.addColorStop(1, U.rgba("#6a6f8a", 0));
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(0, 0, rw, 0, 6.2832); ctx.fill(); ctx.restore();
    }
    ctx.restore();

    // crater: a shallow bowl cut into the ground. The depth is exaggerated about eight times (and captioned as such) so it reads.
    var cw = 60 * ppm, cd = U.clamp(1.8 * ppm * 8, 14, 34), hw = cw / 2;
    function yc(x) { var q = Math.abs(x - x0) / hw; return q >= 1 ? 0 : cd * (1 - q * q) * (1 - 0.15 * q); }
    ctx.save();
    ctx.beginPath(); ctx.moveTo(x0 - hw, g);
    for (var cxp = -hw; cxp <= hw; cxp += 2) ctx.lineTo(x0 + cxp, g + yc(x0 + cxp));
    ctx.lineTo(x0 + hw, g); ctx.closePath();
    var cgr = ctx.createLinearGradient(0, g, 0, g + cd); cgr.addColorStop(0, "#3a2c1c"); cgr.addColorStop(1, "#1a130b");
    ctx.fillStyle = cgr; ctx.fill();
    // trinitite: a green glass layer on the surface, out to the radius in facts, thickest at the centre where it lines the bowl
    var R = D.facts.trinitite_extent.num * ppm, thC = 9, thE = 2.2;
    var gg = ctx.createLinearGradient(x0 - R, 0, x0 + R, 0);
    gg.addColorStop(0, U.rgba(C.trinitite, 0.0)); gg.addColorStop(0.15, U.rgba(C.trinitite, 0.7)); gg.addColorStop(0.5, U.rgba("#a8f0b8", 1));
    gg.addColorStop(0.85, U.rgba(C.trinitite, 0.7)); gg.addColorStop(1, U.rgba(C.trinitite, 0.0));
    var xa = Math.max(-4, x0 - R), xb = Math.min(f.W + 4, x0 + R), xs;
    function bandTh(x) { var k = 1 - Math.min(1, Math.abs(x - x0) / R); return thE + (thC - thE) * Math.pow(k, 0.7); }
    ctx.beginPath();
    for (xs = xa; xs <= xb; xs += 3) { var yy0 = g + yc(xs) - 1.5; xs === xa ? ctx.moveTo(xs, yy0) : ctx.lineTo(xs, yy0); }
    for (xs = xb; xs >= xa; xs -= 3) ctx.lineTo(xs, g + yc(xs) + bandTh(xs));
    ctx.closePath(); ctx.fillStyle = gg; ctx.fill();
    ctx.strokeStyle = U.rgba("#d8ffe2", 0.7); ctx.lineWidth = 1.2; ctx.beginPath();
    for (xs = xa; xs <= xb; xs += 3) { var yy1 = g + yc(xs) - 1.5; xs === xa ? ctx.moveTo(xs, yy1) : ctx.lineTo(xs, yy1); }
    ctx.stroke();
    ctx.globalCompositeOperation = "lighter";
    var gl = ctx.createLinearGradient(x0 - R, 0, x0 + R, 0);
    gl.addColorStop(0, U.rgba(C.trinitite, 0)); gl.addColorStop(0.5, U.rgba(C.trinitite, 0.2)); gl.addColorStop(1, U.rgba(C.trinitite, 0));
    ctx.fillStyle = gl; ctx.fillRect(x0 - R, g - 14, 2 * R, 18);
    for (i = 0; i < 40; i++) { // glints, fixed in world space
      var gx = x0 + (U.hash(i, 81) * 2 - 1) * R, fall = 1 - Math.abs(gx - x0) / R;
      if (fall < 0.08 || gx < 0 || gx > f.W) continue;
      ctx.fillStyle = U.rgba("#d8ffe2", 0.6 * fall); ctx.fillRect(gx, g + yc(gx) - 3 - U.hash(i, 82) * 2.5, 1.8, 1.8);
    }
    ctx.restore();
    var th = thC;

    // footings where the tower stood
    var fw = Math.max(5, 1.6 * ppm), fh = Math.max(4, 1.2 * ppm), foot = 6 * ppm;
    ctx.save(); ctx.fillStyle = "#463a28"; ctx.strokeStyle = U.rgba("#c9b48c", 0.7); ctx.lineWidth = 1;
    [-1, 1].forEach(function (s) { var fy = g + yc(x0 + s * foot) - fh; ctx.fillRect(x0 + s * foot - fw / 2, fy, fw, fh); ctx.strokeRect(x0 + s * foot - fw / 2, fy, fw, fh); });
    ctx.restore();

    // scale bar and callouts
    var fade = 1 - U.sstep(U_DIM0, U_DIM1, f.u), bx0 = Math.max(20, f.W * 0.04);
    Cv.scaleBar(bx0, f.H - 28, 100, ppm, { alpha: 0.9 * fade });
    var co = Scenes.callouts(f), bw = Math.min(210, f.W * 0.46);
    if (co.cloud) Cv.callout(f.W * 0.66, f.H * 0.14, f.W * 0.66 - (narrow ? 0 : 30), f.H * 0.09, co.cloud.text, { alpha: co.cloud.a, color: C.muted, maxW: bw });
    if (co.glass) Cv.callout(x0 + R * 0.62, g - th * 0.5, x0 + R * 0.62 + (narrow ? 0 : 20), g - f.H * 0.14, co.glass.text, { alpha: co.glass.a, color: C.trinitite, maxW: bw });
    if (co.crater) Cv.callout(x0 - cw * 0.12, g + cd * 0.6, x0 - cw * 0.5 - 30, g + f.H * (narrow ? 0.1 : 0.09), co.crater.text, { alpha: co.crater.a, color: C.fg, maxW: bw });
    if (co.footings) Cv.callout(x0 + foot, g + yc(x0 + foot) - fh / 2, x0 + 30, g + f.H * (narrow ? 0.1 : 0.2), co.footings.text, { alpha: co.footings.a, color: C.fire, maxW: bw });
    var nx = bx0 + 100 * ppm + 24;
    Cv.note("Schematic section. The crater and the glass layer are drawn about eight times too deep.", nx, f.H - 31, { tag: "I", maxW: Math.min(320, f.W - nx - 16), size: 11, alpha: 0.9 * fade });
  }

  // ---------------------------------------------------------------- ledger
  function ledger(f, a) {
    var F = D.facts, X = facts(), u = f.u, W = f.W, H = f.H, narrow = W < 600;
    var mx = Math.max(18, W * (narrow ? 0.05 : 0.07)), iw = W - 2 * mx;
    // block heights: scaled to fit on desktop, fixed pixel sizes on phones (the canvas is only about 370 px tall there)
    var gap, hRow, hEst, hSplit, s;
    if (narrow) { s = 1; gap = 10; hRow = 3 * 42; hEst = 108; hSplit = 96; }
    else {
      var sc = 112 + 156 + 128 + 52 + 24;
      s = U.clamp(Math.min(H * 0.92 / sc, 1.15, W / 640 + 0.25), 0.5, 1.15); gap = 26 * s; hRow = 112 * s; hEst = 156 * s; hSplit = 128 * s;
    }
    var sz = function (n) { return narrow ? n : Math.max(10, Math.round(n * s)); };
    var total = hRow + hEst + hSplit + gap * 2;
    var y = Math.max(8, (H - total) / 2) + (narrow ? 8 : 12 * s);
    var slide = function (r) { return (1 - r) * 8; };

    // ---- headline numbers: the big numeral is built from the fact's num and unit ----
    var rows = [
      { cap: F.yield_kt.label, big: fmtKt(F.yield_kt.num) + " " + F.yield_kt.unit, sub: F.yield_j.value, tag: F.yield_kt.tag },
      { cap: F.pu_fissioned.label, big: fmtKt(F.pu_fissioned.num) + " " + F.pu_fissioned.unit, sub: F.pu_fissioned.value, tag: F.pu_fissioned.tag },
      { cap: F.mass_converted.label, big: fmtKt(F.mass_converted.num * 1000) + " g", sub: "mass lost, by E = mc²", tag: F.mass_converted.tag }
    ];
    var i, r, q, colW = iw / 3, capW = function (t) { return Cv.measure(t.toUpperCase(), { size: 12, weight: 600, font: Cv.fonts.display }) + 8; };
    for (i = 0; i < 3; i++) {
      r = rowA(u, i); if (r <= 0) continue;
      var rw = rows[i], al = a * r, yy, xx;
      if (!narrow) {
        xx = mx + i * colW; yy = y + slide(r);
        Cv.label(rw.cap.toUpperCase(), xx, yy + 10 * s, C.muted, "left", al);
        Cv.tagChip(rw.tag, xx + capW(rw.cap), yy - 2 * s, al);
        Cv.text(rw.big, xx, yy + 10 * s + sz(46) + 6 * s, { size: sz(46), weight: 500, color: i === 0 ? C.hot : C.fg, font: Cv.fonts.mono, alpha: al });
        var lines = Cv.wrap(rw.sub, colW - 16, { size: sz(13) });
        for (q = 0; q < lines.length && q < 2; q++) Cv.text(lines[q], xx, yy + 10 * s + sz(46) + 28 * s + q * sz(16), { size: sz(13), color: C.muted, alpha: al });
      } else {
        yy = y + i * 42 + slide(r);
        Cv.label(rw.cap.toUpperCase(), mx, yy + 10, C.muted, "left", al);
        Cv.tagChip(rw.tag, mx + capW(rw.cap), yy - 2, al);
        Cv.text(Cv.wrap(rw.sub, iw * 0.6, { size: 11 })[0], mx, yy + 26, { size: 11, color: C.muted, alpha: al });
        Cv.text(rw.big, W - mx, yy + 30, { size: 30, weight: 500, color: i === 0 ? C.hot : C.fg, font: Cv.fonts.mono, align: "right", alpha: al });
      }
    }
    y += hRow + gap;

    // ---- four yield estimates on one axis ----
    r = rowA(u, 3);
    if (r > 0) {
      var al2 = a * r, yy2 = y + slide(r), cap2 = "FOUR ESTIMATES OF THE YIELD, KT OF TNT";
      var maxKt = 0; X.est.forEach(function (e) { maxKt = Math.max(maxKt, e.kt + e.err); });
      var axMax = Math.ceil(maxKt / 10) * 10, ax0 = mx + 6, ax1 = W - mx - (narrow ? 12 : 36), ay = yy2 + (narrow ? 52 : sz(86));
      var kx = function (kt) { return U.lerp(ax0, ax1, kt / axMax); };
      Cv.label(cap2, mx, yy2 + 10, C.muted, "left", al2);
      Cv.tagChip("M", mx + capW(cap2), yy2 - 2, al2);
      ctx.save(); ctx.globalAlpha = al2; ctx.strokeStyle = U.rgba(C.fg, 0.35); ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(ax0, ay); ctx.lineTo(ax1, ay);
      for (var tk = 0; tk <= axMax; tk += 10) { ctx.moveTo(kx(tk), ay - 4); ctx.lineTo(kx(tk), ay + 4); }
      ctx.stroke(); ctx.restore();
      for (tk = 0; tk <= axMax; tk += 10) Cv.mono(String(tk), kx(tk), ay + 17, { size: sz(10), color: C.faint, align: "center", alpha: al2 });
      for (i = 0; i < X.est.length; i++) {
        var e = X.est[i], ri = U.easeOut(U.sstep(U_ROWS[3] + 0.02 + i * 0.015, U_ROWS[3] + 0.07 + i * 0.015, u)); if (ri <= 0) continue;
        var ex = kx(e.kt), alp = a * ri, up = e.side < 0;
        if (e.err) {
          ctx.save(); ctx.globalAlpha = alp; ctx.strokeStyle = e.col; ctx.lineWidth = 3; ctx.lineCap = "butt";
          ctx.beginPath(); ctx.moveTo(kx(e.kt - e.err), ay); ctx.lineTo(kx(e.kt + e.err), ay);
          ctx.moveTo(kx(e.kt - e.err), ay - 6); ctx.lineTo(kx(e.kt - e.err), ay + 6); ctx.moveTo(kx(e.kt + e.err), ay - 6); ctx.lineTo(kx(e.kt + e.err), ay + 6); ctx.stroke(); ctx.restore();
        }
        var stem = narrow ? 8 : sz(20), stemDn = narrow ? 24 : sz(30);
        ctx.save(); ctx.globalAlpha = alp; ctx.strokeStyle = U.rgba(e.col, 0.6); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(ex, ay); ctx.lineTo(ex, ay + (up ? -stem : stemDn)); ctx.stroke();
        ctx.fillStyle = e.col; ctx.beginPath(); ctx.arc(ex, ay, 5, 0, 6.2832); ctx.fill(); ctx.restore();
        var val = fmtKt(e.kt) + (e.err ? " ± " + fmtKt(e.err) : "") + " kt";
        var al = "center";
        if (!up && narrow) al = i === 1 ? "right" : "left";
        var lx = ex + (al === "right" ? 6 : al === "left" ? -6 : 0), nm = narrow ? e.name : e.name + ", " + e.sub;
        var vs = narrow ? 12 : sz(13), ns = narrow ? 11 : sz(12);
        if (up) { var tl = ay - stem - 4; Cv.text(nm, lx, tl, { size: ns, color: C.muted, align: al, alpha: alp }); Cv.mono(val, lx, tl - ns - 3, { size: vs, weight: 500, color: e.col, align: al, alpha: alp }); }
        else { var bl = ay + stemDn + vs + 2; Cv.mono(val, lx, bl, { size: vs, weight: 500, color: e.col, align: al, alpha: alp }); Cv.text(nm, lx, bl + ns + 3, { size: ns, color: C.muted, align: al, alpha: alp }); }
      }
    }
    y += hEst + gap;

    // ---- stacked bar: typical air-burst split ----
    r = rowA(u, 4);
    if (r > 0) {
      var al3 = a * r, yy3 = y + slide(r), cap3 = "WHERE THE ENERGY GOES, TYPICAL AIR BURST", parts = [
        { n: "Blast", v: F.split_blast.num, col: C.fire }, { n: "Heat", v: F.split_heat.num, col: C.ember }, { n: "Radiation", v: F.split_radiation.num, col: C.neutron }], tot = 0;
      parts.forEach(function (p) { tot += p.v; });
      Cv.label(cap3, mx, yy3 + 10, C.muted, "left", al3);
      Cv.tagChip("I", mx + capW(cap3), yy3 - 2, al3);
      var by = yy3 + (narrow ? 20 : 24 * s), bh = narrow ? 20 : sz(26), grow = U.easeOut(U.sstep(U_ROWS[4] + 0.01, U_ROWS[4] + 0.07, u)), cx0 = mx;
      parts.forEach(function (p, pi) {
        var w = iw * p.v / tot * grow, last = pi === parts.length - 1;
        ctx.save(); ctx.globalAlpha = al3; ctx.fillStyle = U.rgba(p.col, 0.82); ctx.fillRect(cx0, by, Math.max(0, w - 2), bh); ctx.restore();
        if (grow > 0.9) Cv.text(p.n + " " + p.v + "%", last ? cx0 + w - 2 : cx0, by + bh + (narrow ? 14 : sz(17)), { size: narrow ? 12 : sz(13), color: p.col, weight: 600, align: last ? "right" : "left", alpha: al3 });
        cx0 += w;
      });
      Cv.note("Rule of thumb for an air burst, not a Trinity measurement. Trinity was a low shot, so less energy went into heat.", mx, by + bh + (narrow ? 31 : sz(40)), { tag: "I", maxW: Math.min(iw, 560), size: narrow ? 11 : sz(12), alpha: al3 });
    }
  }

  function closing(f) {
    var a1 = U.sstep(U_CLOSE[0], U_CLOSE[0] + 0.045, f.u), a2 = U.sstep(U_CLOSE[1], U_CLOSE[1] + 0.045, f.u);
    if (a1 <= 0) return;
    var X = facts(), narrow = f.W < 600, size = Math.round(narrow ? 19 : U.clamp(f.W * 0.026, 20, 28)), mw = Math.min(f.W - 48, 640), lh = size * 1.45;
    var t1 = "Fallout drifted over ranches and villages downwind. The people who lived there were not warned or evacuated.";
    var t2 = X.days + " days later, on " + D.facts.nagasaki_date.value + ", the same design was dropped on Nagasaki.";
    var l1 = Cv.wrap(t1, mw, { size: size, weight: 500 }), l2 = Cv.wrap(t2, mw, { size: size, weight: 500 });
    var tot = (l1.length + l2.length) * lh + 54, y0 = (f.H - tot) / 2 + size, cx = f.W / 2, i, y = y0;
    for (i = 0; i < l1.length; i++, y += lh) Cv.text(l1[i], cx, y, { size: size, color: C.fg, align: "center", alpha: a1 });
    var small = X.fallout.charAt(0).toUpperCase() + X.fallout.slice(1) + ".";
    var sy = y - lh + Math.round(size * 1.25);
    Cv.text(small, cx, sy, { size: Math.round(size * 0.58), color: C.muted, align: "center", alpha: a1 * 0.9 });
    y = sy + lh * 1.2;
    if (a2 > 0) {
      ctx.save(); ctx.globalAlpha = a2 * 0.5; ctx.strokeStyle = C.faint; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - 28, y - lh * 0.5 - 6); ctx.lineTo(cx + 28, y - lh * 0.5 - 6); ctx.stroke(); ctx.restore();
      y += 4;
      for (i = 0; i < l2.length; i++, y += lh) Cv.text(l2[i], cx, y, { size: size, color: C.fg, align: "center", alpha: a2 });
    }
  }

  return {
    draw: function (f) {
      landscape(f);
      var dim = U.sstep(U_DIM0, U_DIM1, f.u);
      if (dim > 0) { ctx.fillStyle = U.rgba("#07090e", 0.9 * dim); ctx.fillRect(0, 0, f.W, f.H); }
      var la = 1 - U.sstep(U_LEDGER_OUT0, U_LEDGER_OUT1, f.u);
      if (dim > 0.4 && la > 0.002) ledger(f, la);
      closing(f);
    }
  };
})());
