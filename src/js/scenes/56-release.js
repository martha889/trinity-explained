// Scene 6, release: the core flies apart, the chain stops, X-rays heat the surrounding air and the fireball is born.
// Log time 60.8 us -> 1 ms. Beat 1 (u 0..~0.1): the core expands and k falls through 1. Beat 2: X-ray streaks, the glowing
// air sphere grows (Sim.fireballR) and the camera pulls back through the Gadget, cab and tower top to a 60 m wide view.
// Everything is a pure function of f (no accumulating state); the only hidden state is cosmetic (FX pool, flash).
Scenes.register("release", (function () {
  var SPAN_END = 100;                      // m, hand-over to the fireball scene
  var BALL_FRAC = 0.62;                    // pose B: the core is this fraction of the view wide (see geo)
  // Comparison marks on the thermometer, from facts.json (NASA Sun fact sheet).
  var REF = { sunSurface: D.facts.sun_surface_temp.num, sunCore: D.facts.sun_core_temp.num };
  var TLO = 1000, THI = 1e8;               // thermometer log range, K

  var cache = { key: "", cap: 0 };

  function ballM(t) { return Math.max(Sim.fireballR(t), Sim.coreRadius(t)); }

  // Camera geometry for this frame. The glowing ball stays about BALL_FRAC of the view wide (smooth-min against the
  // hand-over span so the zoom never reverses), then the centre slides to the world-camera convention of the fireball scene.
  function geo(f) {
    var W = f.W, H = f.H, t0 = f.phase.t0, t1 = f.phase.t1;
    var pB = Gadget.pose(W, H, 2), Rg0 = pB.R;                         // pose B1 Gadget radius, px (end of chain)
    var core = Gadget.LAYERS[5], P0 = core.r1 * 0.757 * Rg0;          // pose B core radius, px (compress 1 = 0.757)
    var k = 0.3, key = f.phase.id + W + "x" + H, Pend = Math.min(P0, 0.5 * BALL_FRAC * Math.min(W, H));
    var Pk = P0 + (Pend - P0) * U.sstep(0, 0.12, f.u);                 // ball radius in px: pose B core, then BALL_FRAC of the short side
    if (cache.key !== key) {                                           // constants only, derived from the tables
      var a1 = Math.log(ballM(t1) * W / Pend), L = Math.log(SPAN_END);
      cache.cap = -k * Math.log(Math.exp(-L / k) - Math.exp(-a1 / k)); cache.key = key;
    }
    var follow = ballM(f.t) * W / Pk;
    var span = Math.exp(-k * Math.log(Math.exp(-Math.log(follow) / k) + Math.exp(-cache.cap / k)));
    var span0 = ballM(t0) * W / P0, ppm = W / span, u = f.u;
    var yEnd = 0.8 * H - (World.LAYOUT.tower / SPAN_END) * W;                                     // fireball centre on screen at hand-over
    var sy = U.lerp(pB.cy, yEnd, U.sstep(0.62, 1, u));
    var cy = 30 - (H / 2 - sy) / ppm;                                  // 30 m = tower height = core height
    return { span: span, span0: span0, ppm: ppm, cy: cy, sy: sy, Rg0: Rg0, P0: P0, pB: pB };
  }

  function panel(x, y, w, h, a) {
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = "rgba(11,14,20,0.80)"; Cv.rrect(x, y, w, h, 6); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
  }

  // beat 1 panel: multiplication factor gauge + material fissioned
  function drawK(f, x, y, w, a) {
    if (a < 0.01) return;
    var h = 166, kMax = Sim.k(f.phase.t0) * 1.08, k = Sim.k(f.t), pu = Sim.puFissionedKg(f.t), core = D.facts.core_mass.num;
    panel(x, y, w, h, a);
    var ix = x + 14, iw = w - 28;
    Cv.label("MULTIPLICATION FACTOR  k", ix, y + 22, C.muted, "left", a);
    Cv.tagChip(Sim.tag("k"), x + w - 30, y + 9, a);
    Cv.text(k.toFixed(2), ix, y + 50, { size: 22, weight: 500, color: k >= 1 ? C.hot : C.neutron, font: Cv.fonts.mono, alpha: a });
    Cv.text(k >= 1 ? "above 1: the chain grows" : "below 1: the chain dies out", ix + 70, y + 49, { size: 12, color: k >= 1 ? C.fire : C.neutron, alpha: a });
    var gy = y + 68, gx1 = ix + iw * (1 / kMax);
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(255,255,255,0.07)"; Cv.rrect(ix, gy, iw, 7, 3.5); ctx.fill();
    ctx.fillStyle = k >= 1 ? C.fire : C.neutron; Cv.rrect(ix, gy, Math.max(3, iw * U.clamp(k / kMax, 0, 1)), 7, 3.5); ctx.fill();
    ctx.strokeStyle = C.fg; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(gx1, gy - 4); ctx.lineTo(gx1, gy + 11); ctx.stroke();
    ctx.restore();
    Cv.text("k = 1", gx1, gy + 26, { size: 11, color: C.fg, font: Cv.fonts.mono, alpha: a * 0.85 });
    var fy = y + 128;
    Cv.label("PLUTONIUM FISSIONED SO FAR", ix, fy - 8, C.muted, "left", a);
    Cv.tagChip(Sim.tag("energyJ"), x + w - 30, fy - 20, a);
    var by = fy, fw = iw - 70;
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(255,255,255,0.07)"; Cv.rrect(ix, by, fw, 7, 3.5); ctx.fill();
    ctx.fillStyle = C.pu; Cv.rrect(ix, by, Math.max(3, fw * U.clamp(pu / core, 0, 1)), 7, 3.5); ctx.fill();
    ctx.restore();
    Cv.text(pu.toFixed(1) + " kg", ix + fw + 8, by + 8, { size: 13, color: C.hot, font: Cv.fonts.mono, alpha: a });
    Cv.text("of " + D.facts.core_mass.value + " in the core", ix, by + 22, { size: 11, color: C.muted, alpha: a });
  }

  // beat 2: temperature thermometer, log scale, with the Sun's surface and core as comparison marks
  function drawTemp(f, x, y, w, h, a) {
    if (a < 0.01) return;
    var T = Sim.tempK(f.t);
    panel(x, y, w, h, a);
    Cv.label("TEMPERATURE", x + 14, y + 22, C.muted, "left", a);
    Cv.tagChip(Sim.tag("tempK"), x + w - 30, y + 9, a);
    var wv = Cv.sciText(T, x + 14, y + 48, { size: 20, color: C.hot });
    Cv.text(" K", x + 14 + wv, y + 48, { size: 20, color: C.hot, font: Cv.fonts.mono });
    var top = y + 66, bot = y + h - 16, bx = x + 22, bw = 14;
    function py(v) { return bot - (bot - top) * U.logPos(U.clamp(v, TLO, THI), TLO, THI); }
    ctx.save(); ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(255,255,255,0.07)"; Cv.rrect(bx, top, bw, bot - top, 4); ctx.fill();
    var g = ctx.createLinearGradient(0, bot, 0, top);
    g.addColorStop(0, FX.heat(0.1)); g.addColorStop(0.5, FX.heat(0.5)); g.addColorStop(1, FX.heat(0.95));
    ctx.fillStyle = g; Cv.rrect(bx, py(T), bw, bot - py(T), 4); ctx.fill();
    ctx.restore();
    var marks = [[REF.sunCore, "Sun's core", D.facts.sun_core_temp.value], [REF.sunSurface, "Sun's surface", D.facts.sun_surface_temp.value]];
    for (var i = 0; i < 2; i++) {
      var my = py(marks[i][0]);
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = C.fg; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(bx - 5, my); ctx.lineTo(bx + bw + 7, my); ctx.stroke(); ctx.restore();
      Cv.label(marks[i][1].toUpperCase(), bx + bw + 12, my - 1, C.fg, "left", a * 0.9);
      Cv.text(marks[i][2].replace("about ", ""), bx + bw + 12, my + 12, { size: 11, color: C.muted, font: Cv.fonts.mono, alpha: a });
    }
    // the fireball's own marker
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = C.hot; ctx.beginPath();
    var ty = py(T); ctx.moveTo(bx - 4, ty); ctx.lineTo(bx - 11, ty - 5); ctx.lineTo(bx - 11, ty + 5); ctx.closePath(); ctx.fill(); ctx.restore();
  }

  function niceLen(maxM) { // largest 1, 2 or 5 x 10^n not above maxM
    var e = Math.floor(Math.log(maxM) / Math.LN10), best = 1e-3, c = [1, 2, 5];
    for (var d = e - 1; d <= e; d++) for (var i = 0; i < 3; i++) { var v = c[i] * Math.pow(10, d); if (v <= maxM && v > best) best = v; }
    return best;
  }

  // X-ray streaks: thin, fast, faint radial lines from the core surface, fading within a short distance (absorbed by air).
  function drawXrays(f, cx, cy, rc, rb, a) {
    if (a < 0.01) return;
    var n = f.W < 600 ? 44 : 72, ph = f.rm ? 0 : f.play * 2.6, L0 = Math.max(rb - rc, rb * 0.12);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.lineCap = "round";
    for (var i = 0; i < n; i++) {
      var ang = (i + U.hash(i, 31)) / n * 6.2832, len = L0 * (0.55 + 0.7 * U.hash(i, 32)), p = (ph * (0.8 + 0.5 * U.hash(i, 33)) + U.hash(i, 34)) % 1;
      var s0 = rc + len * p * 0.9, s1 = s0 + len * 0.16 + 6, env = Math.sin(Math.PI * p);
      var ca = Math.cos(ang), sa = Math.sin(ang);
      var g = ctx.createLinearGradient(cx + ca * s0, cy + sa * s0, cx + ca * s1, cy + sa * s1);
      g.addColorStop(0, "rgba(207,228,255,0)"); g.addColorStop(0.7, "rgba(207,228,255,0.85)"); g.addColorStop(1, "rgba(207,228,255,0)");
      ctx.globalAlpha = a * 0.34 * env * (0.5 + 0.5 * U.hash(i, 35)); ctx.strokeStyle = g; ctx.lineWidth = 1.1;
      ctx.beginPath(); ctx.moveTo(cx + ca * s0, cy + sa * s0); ctx.lineTo(cx + ca * s1, cy + sa * s1); ctx.stroke();
    }
    ctx.restore();
  }

  return {
    draw: function (f) {
      var W = f.W, H = f.H, u = f.u, t = f.t, narrow = W < 640;
      var g = geo(f), cx = W / 2, cy = g.sy, ppm = g.ppm;
      var rbPx = ballM(t) * ppm, rcPx = Sim.coreRadius(t) * ppm;
      var temp = Math.min(0.97, FX.heatPos(Sim.tempK(t)));

      // backdrop: black, then the lit desert world fades in as the view widens
      ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
      var worldA = U.sstep(0.05, 0.22, u);
      var m = null;
      if (worldA > 0.003) {
        m = World.draw({ cx: 0, cy: g.cy, span: g.span }, {
          dawn: 0.3, towerBurn: U.clamp(ballM(t) / (World.LAYOUT.tower - World.LAYOUT.cabH), 0, 1), cabLight: 0.6 * (1 - U.sstep(0.05, 0.15, u)),
          light: { a: 0.9 * U.sstep(0.1, 0.7, u), x: 0, y: 30 }
        });
        ctx.save(); ctx.globalAlpha = 1 - worldA; ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
      var groundY = H / 2 + g.cy * ppm;

      // beat 1: the Gadget cutaway as at the end of the chain scene, fading as the core blows it apart
      var gadA = 1 - U.sstep(0, 0.08, u);
      if (gadA > 0.003) Gadget.draw(cx, cy, g.Rg0 * g.span0 / g.span, { cut: 1, burn: 1, compress: 1, glow: 1, alpha: gadA });
      if (u === 0) { /* pose B exactly: nothing else is drawn on top */ }

      // the glowing air sphere, and the white-hot core inside it
      var ballA = U.sstep(0, 0.02, u);
      if (ballA > 0.003) {
        FX.fireball(cx, cy, Math.max(rbPx, 3), { temp: temp, rough: 0.35 + 0.3 * U.sstep(0.2, 0.9, u), seed: 3, alpha: ballA, churn: Math.log(t / f.phase.t0) * 2, clipY: groundY });
        FX.fireball(cx, cy, Math.max(rcPx, 3), { temp: 1, rough: 0.12, seed: 5, alpha: ballA * (1 - 0.6 * U.sstep(0.1, 0.5, u)), clipY: groundY });
      }
      drawXrays(f, cx, cy, rcPx * 0.98, rbPx, U.sstep(0, 0.03, u) * (1 - U.sstep(0.35, 0.7, u)));

      // instruments and captions (all pure functions of f)
      var mg = narrow ? 12 : 20, pw = narrow ? Math.min(W - 24, 240) : 262;
      drawK(f, mg, mg, pw, narrow ? 1 - U.sstep(0.06, 0.12, u) : 1 - U.sstep(0.28, 0.42, u));
      var tw = narrow ? 158 : 170, th = narrow ? 190 : 220, tA = narrow ? U.sstep(0.08, 0.14, u) : U.sstep(0.0, 0.06, u);
      drawTemp(f, W - tw - mg, mg, tw, th, tA);

      var co = Scenes.callouts(f), ang = -0.62, ax = cx + Math.cos(ang) * rbPx * 0.9, ay = cy + Math.sin(ang) * rbPx * 0.9;
            var nsz = narrow ? 12 : 13, ny = H - 96;
      if (co.core) Cv.callout(cx - rcPx * 0.5, cy + rcPx * 0.3, mg, narrow ? ny : H * 0.62, co.core.text, { alpha: co.core.a, color: C.pu, maxW: narrow ? W - 24 : 250, size: nsz });
      if (co.xray) Cv.callout(ax, ay, narrow ? mg : W - tw - mg - 20, narrow ? ny : H * 0.62, co.xray.text, { alpha: co.xray.a, color: C.neutron, maxW: narrow ? W - 24 : 250, title: "X-rays", size: nsz });
      if (co.air) {
        var a2 = 2.5, ex = cx + Math.cos(a2) * rbPx * 0.85, ey = cy + Math.sin(a2) * rbPx * 0.85;
        Cv.callout(ex, Math.min(ey, H - 30), mg, narrow ? ny : H * 0.8, co.air.text, { alpha: co.air.a, color: C.fire, maxW: narrow ? W - 24 : 300, title: "Glowing air", size: nsz });
      }

      // scale bar of the current view
      f.spanM = g.span * Math.pow(g.pB.span / g.span0, 1 - U.sstep(0, 0.35, u));   // starts at the chain scene's view width, then true width
      var ppmN = W / f.spanM, bar = niceLen(W * 0.2 / ppmN);
      var bw = bar * ppmN, bl = U.fmtDist(bar), bpw = Math.max(bw, Cv.measure(bl, { size: 12, weight: 600, font: Cv.fonts.display })) + 20;
      ctx.save(); ctx.fillStyle = "rgba(11,14,20,0.72)"; Cv.rrect(mg - 10, H - 50, bpw, 36, 5); ctx.fill(); ctx.restore();
      Cv.scaleBar(mg, H - 26, bar, ppmN, { alpha: 0.95 });
    },

    onEvent: function (ev) {
      if (ev.id === "release-flash") { FX.flash(1, C.hot); FX.shake(8); }
    }
  };
})());
