// Scene 8: the cloud. Buoyancy: a hot bubble rises, rolls into a vortex ring, draws a dust stem, cools, and stops at the
// height where it matches the air around it. Blast wave crosses the shelters and base camp; Fermi's paper-scrap inset.
// Everything is a pure function of f (t, u, W, H); the cloud is ~200 soft blobs drawn from a cached sprite atlas.
Scenes.register("cloud", (function () {
  var L = World.LAYOUT;
  var TA_SH = Sim.blastArrival(L.shelterX), TA_CP = Sim.blastArrival(L.campX);
  var TOP_END = Sim.cloudTopM(600);
  var LIGHT = [0.8, 0.6];                       // dawn light from the east, a little above the horizon
  var SPR = 72, NS = 6, NE = 4, NV = 3;         // sprite size, shade levels, emission levels, variants
  var RING_SEG = 20, SHELLS = [0.5, 0.8, 1.0];
  var STEM_N = 26, SKIRT_N = 12, HUB_N = 22;

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function mixc(a, b, k) { return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
  var DUST = [[0, U.hex("#7a4a34")], [0.3, U.hex("#6d4d3c")], [0.65, U.hex("#6f625a")], [1, U.hex("#aeaab0")]];
  var WARM = U.hex("#ffd0a0"), SHADOW_TINT = [10, 12, 26];

  // ---- fixed blob sets (stable, deterministic) ----
  function makeRing(seed) {
    var a = [], i, k;
    for (k = 0; k < SHELLS.length; k++) for (i = 0; i < RING_SEG; i++) {
      var id = seed + k * 50 + i;
      a.push({ phi0: ((i + 0.5 * k + (U.hash(id, 1) - 0.5) * 0.7) / RING_SEG) * 6.2832, dd: SHELLS[k] * (0.9 + 0.2 * U.hash(id, 2)),
        rk: 0.8 + 0.55 * U.hash(id, 3), al: 0.6 + 0.35 * U.hash(id, 4), v: Math.floor(U.hash(id, 5) * NV), hot: U.hash(id, 6),
        sp: 1.5 - 0.75 * SHELLS[k] });
    }
    return a;
  }
  var RING_R = makeRing(10), RING_L = makeRing(400);
  var HUB = [], STEM = [], SKIRT = [];
  (function () {
    var i;
    for (i = 0; i < HUB_N; i++) HUB.push({ ux: U.hash(i, 71) * 2 - 1, uy: U.hash(i, 72), rk: 0.8 + 0.5 * U.hash(i, 73), al: 0.6 + 0.3 * U.hash(i, 74), v: Math.floor(U.hash(i, 75) * NV), hot: U.hash(i, 76) });
    for (i = 0; i < STEM_N * 2; i++) STEM.push({ j: i >> 1, side: (i & 1) ? 1 : -1, ph: U.hash(i, 81) * 6.2832, rk: 0.9 + 0.5 * U.hash(i, 82), al: 0.55 + 0.35 * U.hash(i, 83), v: Math.floor(U.hash(i, 84) * NV), off: 0.15 + 0.5 * U.hash(i, 85) });
    for (i = 0; i < SKIRT_N; i++) SKIRT.push({ ux: (i / (SKIRT_N - 1)) * 2 - 1, rk: 0.8 + 0.5 * U.hash(i, 91), al: 0.45 + 0.3 * U.hash(i, 92), v: Math.floor(U.hash(i, 93) * NV), dy: U.hash(i, 94) });
  })();

  // ---- item pool ----
  var POOL = [], NPOOL = 330, items = [], nItems = 0;
  for (var pi = 0; pi < NPOOL; pi++) POOL.push({ x: 0, y: 0, rx: 0, ry: 0, s: 0, e: 0, v: 0, al: 1, key: 0 });
  function add(x, y, rx, ry, s, e, v, al, key) {
    if (nItems >= NPOOL) return;
    var o = POOL[nItems++]; o.x = x; o.y = y; o.rx = rx; o.ry = ry; o.s = s; o.e = e; o.v = v; o.al = al; o.key = key; items.push(o);
  }

  // ---- colour ----
  function dustMid(t) {
    var p = U.logPos(t, 2, 600), i = 0;
    while (i < DUST.length - 2 && p > DUST[i + 1][0]) i++;
    var a = DUST[i], b = DUST[i + 1];
    return mixc(a[1], b[1], clamp((p - a[0]) / (b[0] - a[0]), 0, 1));
  }
  function glowFade(t) { return 1 - U.sstep(0, 1, U.logPos(t, 3, 30)); }  // inner glow gone after ~20 s
  function colorFor(t, s, e) {
    var mid = dustMid(t), shadow = mixc([mid[0] * 0.42, mid[1] * 0.42, mid[2] * 0.42], SHADOW_TINT, 0.25), lit = mixc(mid, WARM, 0.55);
    var base = s < 0.5 ? mixc(shadow, mid, s * 2) : mixc(mid, lit, (s - 0.5) * 2);
    var em = glowFade(t) * (0.3 + 0.7 * e), hp = FX.heatPos(Sim.tempK(t));
    return mixc(base, FX.heatRGB(clamp(hp * (0.7 + 0.5 * e), 0, 1)), clamp(em * 1.1, 0, 1));
  }

  // ---- sprite atlas, rebuilt when the colour bucket changes or the context is new ----
  var atlas = null, atlasKey = -1;
  function buildAtlas(tq) {
    if (!atlas) { atlas = document.createElement("canvas"); atlas.width = SPR * NS * NV; atlas.height = SPR * NE; }
    var g = atlas.getContext("2d"), s, e, v, k;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, atlas.width, atlas.height);
    for (e = 0; e < NE; e++) for (s = 0; s < NS; s++) for (v = 0; v < NV; v++) {
      var c = colorFor(tq, s / (NS - 1), e / (NE - 1)), ox = (s * NV + v) * SPR, oy = e * SPR, h = SPR / 2;
      function rgba(cc, a) { return "rgba(" + (cc[0] | 0) + "," + (cc[1] | 0) + "," + (cc[2] | 0) + "," + a + ")"; }
      var gr = g.createRadialGradient(ox + h, oy + h, 0, ox + h, oy + h, h);
      gr.addColorStop(0, rgba(mixc(c, [255, 255, 255], 0.08), 0.95)); gr.addColorStop(0.5, rgba(c, 0.8)); gr.addColorStop(0.82, rgba(c, 0.3)); gr.addColorStop(1, rgba(c, 0));
      g.fillStyle = gr; g.fillRect(ox, oy, SPR, SPR);
      for (k = 0; k < 4; k++) {                 // mottling: small lighter and darker lumps, different per variant
        var id = s * 7 + v * 31 + e * 13 + k, px = ox + h + (U.hash(id, 301) - 0.5) * h * 1.0, py = oy + h + (U.hash(id, 302) - 0.5) * h * 1.0;
        var rr = h * (0.28 + 0.2 * U.hash(id, 303)), cc = mixc(c, k & 1 ? [255, 240, 225] : [0, 0, 0], 0.18);
        var g2 = g.createRadialGradient(px, py, 0, px, py, rr);
        g2.addColorStop(0, rgba(cc, 0.45)); g2.addColorStop(1, rgba(cc, 0));
        g.fillStyle = g2; g.beginPath(); g.arc(px, py, rr, 0, 6.2832); g.fill();
      }
    }
  }

  // ---- cloud geometry (metres) as a function of t ----
  function geom(t, u) {
    var top = Sim.cloudTopM(t), prog = clamp(top / TOP_END, 0, 1), wid = U.sstep(0.55, 1, prog);
    var a = Math.max(Sim.fireballR(t), 0.15 * top) * (1 + 0.95 * wid), b = a * (1 - 0.5 * wid);
    var w = U.sstep(0, 0.12, u);                // eases from the fireball dome (30 m up) onto the modelled cloud
    var hc = 30 + (top - b - 30) * w;
    return { top: top, a: a, b: b, hc: hc, topV: hc + b, w: w, wid: wid };
  }
  function shadeOf(nx, ny, wgt) {
    var d = Math.sqrt(nx * nx + ny * ny) || 1;
    return clamp(0.5 + 0.5 * wgt * (nx / d * LIGHT[0] + ny / d * LIGHT[1]), 0, 1);
  }
  function sIdx(s) { return Math.round(clamp(s, 0, 1) * (NS - 1)); }
  function eIdx(e) { return Math.round(clamp(e, 0, 1) * (NE - 1)); }

  function buildItems(t, g, roll, u) {
    nItems = 0; items.length = 0;
    var a = g.a, b = g.b, hc = g.hc, i, side, B;
    // stem and skirt (drawn first, unsorted, from the ground up)
    var Hs = Math.max(0, hc - 0.3 * b), Rs = Math.max(30, 0.13 * a), sv = U.sstep(0, 150 + 0.25 * b, hc - b);
    if (sv > 0.01 && Hs > 20) {
      for (i = 0; i < STEM.length; i++) {
        B = STEM[i]; var q = Math.pow((B.j + 0.5) / STEM_N, 1.3), h = Hs * q;
        var rs = Rs * (1 - 0.42 * Math.sin(Math.PI * Math.min(1, q * 1.15)) * 0.9) * (1 + 1.6 * Math.exp(-h / (0.06 * Hs + 30)));
        var x = Rs * 0.4 * Math.sin(q * 6.5 + roll * 0.5 + B.ph) * q + B.side * rs * B.off;
        var sh = shadeOf(B.side, 0.1, 0.8) - 0.1 * (1 - q);
        add(x, h, rs * B.rk * 0.75, rs * B.rk * 0.75 * (1.1 + 0.8 * (Hs / (Hs + 400))), sIdx(sh), eIdx(0.2 + 0.9 * q * q), B.v, B.al * sv, 0);
      }
      var spread = (1.6 * Rs + 0.5 * a * U.sstep(0, 0.5, g.top / TOP_END)) * (0.6 + 0.4 * sv);
      for (i = 0; i < SKIRT.length; i++) {
        B = SKIRT[i];
        add(B.ux * spread, 0.18 * Rs * B.dy, Rs * 1.4 * B.rk, Rs * 0.6 * B.rk, sIdx(0.5 + 0.25 * B.ux), 0, B.v, B.al * sv, 0);
      }
    }
    // cap: vortex ring (two cores in section) plus hub. Roll: up through the middle, out across the top, down the outside.
    var rho = 0.6 * a, rcx = 0.4 * a, rcy = 0.5 * b, coreY = hc + 0.5 * b, start = nItems;
    for (side = 0; side < 2; side++) {
      var S = side ? -1 : 1, arr = side ? RING_L : RING_R;
      for (i = 0; i < arr.length; i++) {
        B = arr[i];
        var phi = B.phi0 - roll * B.sp, cphi = Math.cos(phi), sphi = Math.sin(phi);
        var x2 = S * (rho + rcx * B.dd * cphi), y2 = coreY + rcy * B.dd * sphi;
        var nl = shadeOf(S * cphi, sphi, 1), nc = shadeOf(x2 / a, (y2 - hc - 0.4 * b) / b, 1);
        var s2 = 0.5 + (0.45 * (nl - 0.5) + 0.55 * (nc - 0.5)) * (0.35 + 0.65 * B.dd) * 2;
        add(x2, y2, 0.55 * rcx * B.rk, 0.55 * rcy * B.rk, sIdx(s2), eIdx(1.15 - B.dd + 0.4 * (B.hot - 0.5)), B.v, B.al, s2 + 0.15 * B.dd);
      }
    }
    for (i = 0; i < HUB.length; i++) {
      B = HUB[i];
      var hx = B.ux * 0.45 * a, hy = hc + (0.1 + 0.65 * B.uy) * b, hs = 0.5 + 0.4 * (shadeOf(hx / a, (hy - hc - 0.4 * b) / b, 1) - 0.5) * 2 - 0.12;
      add(hx, hy, 0.3 * a * B.rk, 0.34 * b * B.rk, sIdx(hs), eIdx(0.9 - 0.5 * Math.abs(B.ux) + 0.3 * (B.hot - 0.5)), B.v, B.al, hs);
    }
    var capItems = items.splice(start, items.length - start);
    capItems.sort(function (p, q) { return p.key - q.key; });
    for (i = 0; i < capItems.length; i++) items.push(capItems[i]);
  }

  // Swirl streaks along the toroidal flow (their phase follows the roll, so the rolling is visible when played)
  function drawSwirl(m, g, t, roll) {
    var a = g.a, b = g.b, rho = 0.6 * a, rcx = 0.4 * a, rcy = 0.5 * b, coreY = g.hc + 0.5 * b, S, k, j;
    var dk = colorFor(t, 0.05, 0.1), lt = colorFor(t, 0.98, 0.15), vis = U.sstep(0.05, 0.2, g.w);
    if (vis < 0.01) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, m.groundY + 1); ctx.clip(); ctx.lineCap = "round";
    for (S = -1; S <= 1; S += 2) for (k = 0; k < 2; k++) {
      var dd = k ? 0.82 : 0.52, sp = 1.5 - 0.75 * dd, cx = m.X(S * rho), cy = m.Y(coreY);
      var rx = rcx * dd * m.ppm, ry = rcy * dd * m.ppm;
      if (rx < 3) continue;
      for (j = 0; j < 3; j++) {
        var phi = (j / 3) * 6.2832 + k * 0.9 + (S > 0 ? 0 : 0.5) - roll * sp, th = S > 0 ? -phi : phi + Math.PI, len = 1.25;
        for (var pass = 0; pass < 2; pass++) {
          var c = pass ? lt : dk, off = pass ? 0.35 : 0;
          ctx.strokeStyle = "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + (pass ? 0.16 : 0.2) * vis + ")";
          ctx.lineWidth = Math.max(1.5, rcy * 0.2 * dd * m.ppm * (pass ? 0.6 : 1));
          ctx.beginPath(); ctx.ellipse(cx, cy, rx * (1 - 0.0), ry, 0, th + off * (S > 0 ? 1 : -1), th + len + off * (S > 0 ? 1 : -1)); ctx.stroke();
        }
      }
    }
    // lit eastern rim of the cap: a thin warm arc on the side facing the dawn
    var rx0 = m.X(0), ry0 = m.Y(g.hc + 0.5 * b), rrx = a * 1.02 * m.ppm, rry = b * 0.62 * m.ppm;
    if (rrx > 6) {
      ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.strokeStyle = "rgba(255,206,150," + (0.2 * vis) + ")"; ctx.lineWidth = Math.max(1.5, rry * 0.16);
      ctx.beginPath(); ctx.ellipse(rx0, ry0, rrx, rry, 0, -2.0, 0.15); ctx.stroke(); ctx.restore();
    }
    // darker underside of the cap
    var ux = m.X(0), uy = m.Y(g.hc + 0.12 * b), uw = a * 0.95 * m.ppm, uh = b * 0.38 * m.ppm;
    if (uw > 4) {
      ctx.translate(ux, uy); ctx.scale(1, uh / uw);
      var ug = ctx.createRadialGradient(0, 0, 0, 0, 0, uw);
      ug.addColorStop(0, "rgba(" + (dk[0] | 0) + "," + (dk[1] | 0) + "," + (dk[2] | 0) + "," + 0.34 * vis + ")"); ug.addColorStop(1, "rgba(" + (dk[0] | 0) + "," + (dk[1] | 0) + "," + (dk[2] | 0) + ",0)");
      ctx.fillStyle = ug; ctx.beginPath(); ctx.arc(0, 0, uw, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  function drawItems(m, qScale) {
    var ga = ctx.globalAlpha;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, m.groundY + 1); ctx.clip();
    for (var i = 0; i < items.length; i++) {
      var o = items[i], sx = m.X(o.x), sy = m.Y(o.y), rx = o.rx * m.ppm, ry = o.ry * m.ppm;
      if (rx < 0.5 || sx + rx < 0 || sx - rx > W || sy + ry < 0 || sy - ry > H) continue;
      ctx.globalAlpha = ga * clamp(o.al, 0, 1);
      ctx.drawImage(atlas, (o.s * NV + o.v) * SPR, o.e * SPR, SPR, SPR, sx - rx, sy - ry, rx * 2, ry * 2);
    }
    ctx.restore();
  }

  // ---- camera key frames: [u, span, cx] ----
  var KF_WIDE = [[0, 1000, 0], [0.38, 6000, 0], [0.449, 15000, 4500], [0.55, 26000, 6500], [1, 40000, 7000]];
  var KF_NARROW = [[0, 1000, 0], [0.38, 6000, 0], [0.449, 13000, 4300], [0.55, 21000, 6800], [1, 28000, 9000]];
  function camAt(kf, u) {
    var i = 0;
    while (i < kf.length - 2 && u > kf[i + 1][0]) i++;
    var a = kf[i], b = kf[i + 1], k = U.sstep(0, 1, clamp((u - a[0]) / (b[0] - a[0]), 0, 1));
    k = clamp((u - a[0]) / (b[0] - a[0]), 0, 1); k = k * 0.5 + 0.5 * k * k * (3 - 2 * k);
    return { span: Math.exp(Math.log(a[1]) + (Math.log(b[1]) - Math.log(a[1])) * k), cx: a[2] + (b[2] - a[2]) * k };
  }

  // ---- blast wave ----
  function drawBlast(m, t, u, f) {
    var R = Sim.shockR(t), rp = R * m.ppm, x0 = m.X(0), gy = m.groundY;
    var al = 0.38 * U.sstep(0, 0.05, u) * (1 - U.sstep(L.campX, L.campX * 1.8, R));
    if (al < 0.01 || rp > 40000) return;
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, gy + 1); ctx.clip();
    Cv.glowArc(x0, gy, rp, Math.PI, 2 * Math.PI, "#e6edfb", 1.3, al);
    ctx.restore();
    // dust ripple where the front meets the ground
    var w = clamp(rp * 0.035, 16, 90), k, sgn;
    for (sgn = -1; sgn <= 1; sgn += 2) {
      var px = m.X(sgn * R);
      if (px < -120 || px > W + 120 || gy > H) continue;
      for (k = 0; k < 3; k++) {
        var xx = px - sgn * k * w * 0.9, ww = w * (1 - 0.18 * k), aa = al * 0.9 * (1 - 0.3 * k);
        ctx.save(); ctx.translate(xx, gy - 1); ctx.scale(1, 0.32);
        var rg = ctx.createRadialGradient(0, 0, 0, 0, 0, ww);
        rg.addColorStop(0, "rgba(176,150,118," + (aa * 0.55) + ")"); rg.addColorStop(1, "rgba(176,150,118,0)");
        ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(0, 0, ww, 0, 6.2832); ctx.fill(); ctx.restore();
      }
    }
  }

  var lastM = null;

  function arrivalMarker(m, f, xm, ta, name, compact) {
    var x = m.X(xm), gy = m.groundY;
    if (x < 30 || x > W - 30 || gy > H - 4) return;
    var lt = Math.log(f.t / ta), y0 = gy - Math.max(14, 6 * m.ppm) - 6;
    function dxFor(nm) {
      var half = Cv.measure(nm.toUpperCase(), { size: 12, weight: 600, font: Cv.fonts.display }) / 2 + 9;
      return Math.max(half + 6 - x, Math.min(0, W - 6 - x - half));
    }
    Cv.marker(x, y0, C.muted, name, { align: "center", dx: dxFor(name), dy: -(compact ? 26 : 30) });
    var kr = clamp(lt / 0.55, 0, 1);
    if (lt > 0 && kr < 1) {                      // ping-style ring as the front passes
      ctx.save(); ctx.globalAlpha = (1 - kr) * 0.85; ctx.strokeStyle = C.hot; ctx.lineWidth = 2 - kr;
      ctx.beginPath(); ctx.arc(x, y0, 5 + U.easeOut(kr) * (compact ? 18 : 22), 0, 6.2832); ctx.stroke(); ctx.restore();
    }
    var la = U.sstep(-0.12, 0, lt) * (1 - U.sstep(0.7, 1.1, lt));
    if (la > 0.01) {
      ctx.save(); ctx.globalAlpha = la;
      var bl = "Blast  " + Math.round(ta) + " s";
      Cv.marker(x, y0, C.hot, bl, { align: "center", dx: dxFor(bl), dy: -(compact ? 48 : 54) });
      ctx.restore();
    }
  }

  // ---- altitude ruler (left edge) ----
  function drawRuler(m, f, g, compact) {
    var x0 = compact ? 18 : 34, gy = m.groundY, top = 78, steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000], st = 20000, i;
    for (i = 0; i < steps.length; i++) if (steps[i] * m.ppm >= 34) { st = steps[i]; break; }
    var cy = m.Y(g.topV), tk = Sim.cloudTopM(f.t);
    ctx.save();
    ctx.strokeStyle = U.rgba(C.fg, 0.5); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x0, Math.max(top, 0)); ctx.lineTo(x0, gy); ctx.stroke();
    ctx.beginPath();
    for (var h = 0; h * m.ppm < gy - top + 1; h += st) {
      var y = m.Y(h); if (y < top) break;
      ctx.moveTo(x0, y); ctx.lineTo(x0 + 5, y);
    }
    ctx.stroke(); ctx.restore();
    for (var h2 = st; h2 * m.ppm < gy - top; h2 += st) {
      var y2 = m.Y(h2);
      if (y2 < top + 6 || Math.abs(y2 - cy) < 14) continue;
      Cv.mono(U.fmtDist(h2), x0 + 9, y2 + 4, { size: compact ? 10 : 11, color: C.muted });
    }
    // dotted guide and marker for the cloud top
    if (cy > top - 6) {
      ctx.save(); ctx.strokeStyle = U.rgba(C.hot, 0.28); ctx.setLineDash([2, 5]); ctx.lineWidth = 1;
      var gx1 = Math.max(x0 + 8, m.X(0) - g.a * m.ppm * 1.1 - 6);
      ctx.beginPath(); ctx.moveTo(x0, cy); ctx.lineTo(gx1, cy); ctx.stroke(); ctx.restore();
      ctx.fillStyle = C.hot; ctx.beginPath(); ctx.moveTo(x0 - 1, cy); ctx.lineTo(x0 - 8, cy - 5); ctx.lineTo(x0 - 8, cy + 5); ctx.closePath(); ctx.fill();
      var lab = (compact ? "" : "CLOUD TOP ") + U.fmtDist(tk), tw = Cv.measure(lab, { size: 12, weight: 600, font: Cv.fonts.display }), lx = x0 + (compact ? 10 : 58);
      ctx.save(); ctx.fillStyle = "rgba(11,14,20,0.8)"; Cv.rrect(lx - 5, cy - 9, tw + 10, 17, 3); ctx.fill(); ctx.restore();
      Cv.label(lab, lx, cy + 4, C.hot);
    }
  }

  // ---- Fermi inset ----
  function drawFermi(f, compact) {
    var inA = U.sstep(0.46, 0.52, f.u) * (1 - U.sstep(0.95, 0.985, f.u));
    if (inA < 0.01) return;
    var pw = compact ? Math.min(190, W - 20) : 262, pad = compact ? 10 : 12, pich = compact ? 76 : 92, rowH = compact ? 16 : 18;
    var ph = 26 + pich + 30 + rowH * 3 + 12, px = W - pw - (compact ? 10 : 16), py = compact ? 10 : 16;
    var lt = Math.log(f.t / TA_CP), i;
    ctx.save(); ctx.globalAlpha = inA;
    ctx.fillStyle = "rgba(11,14,20,0.84)"; Cv.rrect(px, py, pw, ph, 6); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.globalAlpha = inA;
    Cv.label("FERMI'S PAPER SCRAPS", px + pad, py + 19, C.fire);
    Cv.tagChip("I", px + pw - pad - 16, py + 7, inA);
    // pictogram: figure, ground, scraps, ruler, blast front
    var gl = py + 26 + pich - 10, fx = px + pad + 22, handX = fx + 15, handY = gl - 50;
    ctx.save(); ctx.beginPath(); ctx.rect(px + 1, py + 26, pw - 2, pich + 14); ctx.clip();
    ctx.strokeStyle = U.rgba(C.fg, 0.55); ctx.lineWidth = 1.4; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(px + 4, gl); ctx.lineTo(px + pw - 4, gl); ctx.stroke();
    ctx.strokeStyle = C.fg; ctx.fillStyle = C.fg; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(fx, gl - 50, 4.6, 0, 6.2832); ctx.fill();     // head
    ctx.beginPath(); ctx.moveTo(fx, gl - 44); ctx.lineTo(fx, gl - 22); ctx.lineTo(fx - 5, gl); ctx.moveTo(fx, gl - 22); ctx.lineTo(fx + 5, gl);
    ctx.moveTo(fx, gl - 40); ctx.lineTo(handX, handY + 2); ctx.stroke();                                      // body, legs, raised arm
    var Dpx = (pw - 2 * pad - 58) * 0.78;
    for (i = 0; i < 6; i++) {
      var tr = -0.5 + 0.045 * i, fall = clamp((lt - tr) / 0.9, 0, 1), fy = handY + 2 + (gl - 3 - handY) * Math.pow(fall, 1.15);
      if (lt < tr) { fy = handY - 1; }
      var drift = Dpx * (0.8 + 0.2 * U.hash(i, 5)) * U.sstep(0, 0.42, lt), sway = lt < 0 ? Math.sin(lt * 7 + i * 1.7) * 1.6 * Math.min(1, fall * 3) : 0;
      var sx = handX + 6 + i * 1.5 + drift + sway, rot = (i * 0.7 + lt * 3 * (lt > 0 ? 1 : 0.3)) * (fall < 1 ? 1 : 0.2);
      ctx.save(); ctx.translate(sx, fy); ctx.rotate(rot); ctx.fillStyle = "#f2efe6"; ctx.fillRect(-3.6, -2.3, 7.2, 4.6); ctx.restore();
    }
    var fr = U.sstep(-0.06, 0.2, lt);               // blast front crossing the panel, left to right
    if (fr > 0.005 && fr < 0.995) {
      var bx = px + 6 + (pw - 12) * fr, bg = ctx.createLinearGradient(bx - 22, 0, bx, 0);
      bg.addColorStop(0, "rgba(230,237,251,0)"); bg.addColorStop(1, "rgba(230,237,251,0.32)");
      ctx.fillStyle = bg; ctx.fillRect(bx - 22, py + 28, 22, pich - 4);
      ctx.fillStyle = "rgba(230,237,251,0.85)"; ctx.fillRect(bx - 0.5, py + 28, 1.3, pich - 4);
    }
    // ruler under the scraps, labelled with Fermi's own displacement (facts fermi_displacement)
    var ry = gl + 8, rl = pw - 2 * pad - 36, rx0 = handX + 6;
    ctx.strokeStyle = U.rgba(C.fire, 0.8); ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(rx0, ry); ctx.lineTo(rx0 + rl, ry);
    for (i = 0; i <= 10; i++) { ctx.moveTo(rx0 + rl * i / 10, ry); ctx.lineTo(rx0 + rl * i / 10, ry + (i % 5 === 0 ? 6 : 3.5)); }
    ctx.stroke();
    ctx.restore();
    Cv.text("scraps shifted " + D.facts.fermi_displacement.value.replace("about ", ""), px + pad + 36, py + 26 + pich + 18, { size: 11, color: C.fire, alpha: inA });
    Cv.text("dropped from " + D.facts.fermi_drop_height.value.replace("about ", "").split(" (")[0], px + pw - pad, py + 40, { size: 11, color: C.muted, align: "right", alpha: inA });
    // estimate rows
    var rows = [["FERMI", "yield_fermi", C.fire, 0.3], ["OFFICIAL", "yield_1963", C.fg, 0.5], ["2021 STUDY", "yield_2021", C.fg, 0.7]], y = gl + 46;
    for (i = 0; i < rows.length; i++) {
      var fct = D.facts[rows[i][1]], ra = U.sstep(rows[i][3], rows[i][3] + 0.18, lt);
      if (ra > 0.01) {
        ctx.save(); ctx.globalAlpha = inA * ra;
        Cv.label(rows[i][0], px + pad, y + i * rowH, C.muted);
        Cv.mono(fct.value, px + pw - pad - 22, y + i * rowH, { size: compact ? 11 : 12, color: rows[i][2], align: "right" });
        Cv.tagChip(fct.tag, px + pw - pad - 16, y + i * rowH - 11, inA * ra);
        ctx.restore();
      }
    }
    ctx.restore();
    return { x: px, y: py, w: pw, h: ph };
  }

  // ---- note block bottom-left ----
  function drawNotes(f, compact) {
    var gy = lastM ? lastM.groundY : f.H * 0.78, x = compact ? 14 : 22, w = Math.min(compact ? f.W * 0.92 : 340, f.W - 2 * x);
    var n1 = "Cloud shape and rise are an illustrative model.";
    var lines1 = Cv.wrap(n1, w - 22, { size: 12 }).length, fa = U.sstep(0.8, 0.86, f.u);
    var fin = "Final height: " + D.facts.cloud_top.value, lines2 = Cv.wrap(fin, w - 22, { size: 12 }).length;
    var tot = lines1 * 15 + (fa > 0.01 ? 8 + lines2 * 15 : 0), y = f.H - 14 - tot + 12;
    var h1 = Cv.note(n1, x, y, { tag: Sim.tag("cloudTopM"), maxW: w, size: 12 });
    if (fa > 0.01) Cv.note(fin, x, y + h1 + 8, { tag: D.facts.cloud_top.tag, maxW: w, size: 12, color: C.fg, alpha: fa });
  }

  return {
    enter: function () { atlasKey = -1; lastM = null; },
    draw: function (f) {
      var W0 = f.W, H0 = f.H, t = f.t, u = f.u, compact = W0 < 560, asp = H0 / W0;
      var cam = camAt(compact ? KF_NARROW : KF_WIDE, u), g0 = geom(t, u);
      // The camera follows the cloud: its top sits at about 58% of the canvas height (headroom above) until the view has to widen
      // for the blast wave reaching the shelters and base camp (the key frames). It leaves the fireball scene's 3 km view smoothly.
      var need = g0.topV * 1.28 / (0.74 * asp), follow = Math.max(cam.span, need, 700);
      var span = Math.exp(U.lerp(Math.log(3000), Math.log(follow), U.sstep(0, 0.12, u))), cyk = 0.3 - 0.04 * U.sstep(0.3, 0.9, u);
      var v = Cv.smooth({ cx: cam.cx, cy: span * asp * cyk, span: span }, "cloud", f.dt, ["span"]);
      var g = geom(t, u);
      // same sky and ground lighting as the last frame of the fireball scene, then it fades as the fireball cools
      var lightEnd = 0.25 + 0.65 * U.clamp(U.logPos(Sim.tempK(f.phase.t0), 3000, 1e5), 0, 1);
      var light = lightEnd * (1 - U.sstep(0, 1, U.logPos(t, 2, 120)));
      var m = World.draw(v, { dawn: 0.3 + 0.55 * U.easeInOut(u), towerGone: true, tower: 0,
        light: { a: light, color: "#ffb25a", x: 0, y: U.lerp(30, g.hc, U.sstep(0, 0.12, u)) } });
      lastM = m; f.spanM = v.span;
      // the fireball scene dims the ground under its instrument strip: carry that over, then let it go
      var strip = 0.55 * (1 - U.sstep(0, 0.15, u));
      if (strip > 0.01 && m.groundY < H0) { ctx.save(); ctx.fillStyle = "rgba(11,14,20," + strip + ")"; ctx.fillRect(0, m.groundY + 2, W0, H0 - m.groundY); ctx.restore(); }
      drawBlast(m, t, u, f);
      // the fireball dome from the previous scene hands over to the modelled cloud
      var fa = 1 - U.sstep(0.02, 0.12, u);
      if (fa > 0.01) {
        FX.fireball(m.X(0), m.Y(30), Sim.fireballR(t) * m.ppm, { temp: Math.min(0.97, FX.heatPos(Sim.tempK(t))), rough: 0.9, seed: 9, churn: Math.log(t / 1e-3) * 3, clipY: m.groundY, alpha: fa });
      }
      // cloud
      var tq = U.logAt(Math.round(U.logPos(t, 2, 600) * 90) / 90, 2, 600), key = Math.round(U.logPos(t, 2, 600) * 90);
      if (key !== atlasKey || !atlas) { buildAtlas(tq); atlasKey = key; }
      var roll = 2.1 * Math.log(Math.max(t, 2) / 2);
      buildItems(t, g, roll, u);
      var ca = U.sstep(0.0, 0.1, u);
      ctx.save(); ctx.globalAlpha = ca; drawItems(m); ctx.restore();
      drawSwirl(m, g, t, roll);
      var em = glowFade(t) * ca;
      if (em > 0.02) { // inner glow still showing through the young cloud
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W0, m.groundY + 1); ctx.clip();
        Cv.glow(m.X(0), m.Y(g.hc + 0.4 * g.b), g.a * m.ppm * 1.3, FX.heat(clamp(FX.heatPos(Sim.tempK(t)) * 0.9, 0, 1)), 0.45 * em);
        ctx.restore();
      }
      // blast arrival markers
      arrivalMarker(m, f, L.shelterX, TA_SH, "Shelter " + U.fmtDist(L.shelterX), compact);
      arrivalMarker(m, f, L.campX, TA_CP, "Base camp " + U.fmtDist(L.campX), compact);
      drawRuler(m, f, g, compact);
      Cv.readout(compact ? 14 : 22, 22, "Since the flash", U.fmtClock(t), { size: compact ? 17 : 20 });
      var ins = drawFermi(f, compact);
      // callouts: buoyancy explained on the drawing
      var co = Scenes.callouts(f), cw = compact ? 150 : 210, bx = m.X(0) + g.a * m.ppm * 1.15 + 28, minTy = ins ? ins.y + ins.h + 40 : 0;
      function place(id, ax, ay, ty) {
        if (!co[id] || (compact && ins)) return;   // phones: the Fermi inset takes the room, the explainer carries the text
        var tx = Math.min(bx, W0 - cw - 12);
        Cv.callout(ax, ay, tx, Math.min(Math.max(ty, ins ? minTy : ty), m.groundY - 110), co[id].text, { alpha: co[id].a, maxW: cw, size: compact ? 12 : 13, color: C.fire });
      }
      place("bubble", m.X(0.2 * g.a), m.Y(g.hc + 0.8 * g.b), m.Y(g.hc + 0.5 * g.b));
      place("ring", m.X(0.9 * g.a), m.Y(g.hc + 0.5 * g.b), m.Y(g.hc + 0.5 * g.b));
      place("stem", m.X(Math.max(30, 0.13 * g.a) * 0.8), m.Y(Math.max(0, g.hc - g.b) * 0.5), m.Y(0.7 * g.hc));
      place("ceiling", m.X(0.8 * g.a), m.Y(g.hc + 0.9 * g.b), m.Y(g.hc + 0.5 * g.b));
      drawNotes(f, compact);
    },
    onEvent: function (ev, f) {
      if (!lastM) return;
      var gy = lastM.groundY - 20;
      if (ev.id === "cloud-shelter") FX.ping(lastM.X(L.shelterX), gy, C.hot, { r: 46 });
      else if (ev.id === "cloud-camp") FX.ping(lastM.X(L.campX), gy, C.hot, { r: 46 });
    }
  };
})());
