// Scene 1: countdown. Wide pre-dawn desert, a held establishing view, one geometric push to the shot cab, then
// through the cab wall to the closed Gadget (handoff pose for the anatomy scene). Every value derives from f.
Scenes.register("countdown", (function () {
  var HOLD = 0.24, PUSH_END = 0.915;      // u where the push starts and where the wall begins to fade
  var CAB_H = 27;                         // m above ground at the screen centre when the push ends

  function sizeFor(f) { return f.W < 560 ? 0.72 : f.W < 900 ? 0.86 : 1; }

  // Camera for this frame, a pure function of u (log-span push, centre drops from ground-level framing to the cab).
  function camera(f) {
    var span0 = f.W < 560 ? 52000 : 40000, span1 = 60;
    var p = U.sstep(0, 1, U.clamp((f.u - HOLD) / (PUSH_END - HOLD), 0, 1));
    p = 0.5 * p + 0.5 * U.clamp((f.u - HOLD) / (PUSH_END - HOLD), 0, 1);   // mostly linear in log span: calm, continuous
    var span = U.logAt(p, span0, span1);
    var base = 0.2 * f.H * span / f.W;                                       // ground about 70% down while wide
    var k = U.sstep(0.45, 1, p);
    return { cx: 0, cy: U.lerp(base, CAB_H, k), span: span, p: p };
  }

  function readout(f, a) {
    var s = sizeFor(f), x = Math.max(20, f.W * 0.04), y = Math.max(26, f.H * 0.06);
    Cv.label("TIME TO THE FIRING SIGNAL", x, y, C.muted, "left", a);
    var txt = f.t > -1e-6 ? "T = 0" : "T − " + (-f.t).toFixed(-f.t < 1 ? 2 : 1) + " s";
    Cv.text(txt, x, y + Math.round(46 * s), { size: Math.round(46 * s), weight: 500, color: C.hot, font: Cv.fonts.mono, alpha: a });
  }

  return {
    draw: function (f) {
      var cam = camera(f);
      var wallK = U.sstep(PUSH_END, 1, f.u);                                 // 0 until the last ~1.2 s, 1 at u = 1
      var dawn = 0.15 + 0.05 * U.sstep(0.4, 1, f.u);
      var m = World.draw({ cx: cam.cx, cy: cam.cy, span: cam.span }, { dawn: dawn, labels: true, cabLight: 0.7 });
      f.spanM = cam.span;

      // scale bar (a nice length near a fifth of the view)
      var target = cam.span / 5, pow = Math.pow(10, Math.floor(Math.log(target) / Math.LN10)), best = pow;
      [1, 2, 5, 10].forEach(function (q) { if (Math.abs(q * pow - target) < Math.abs(best - target)) best = q * pow; });
      Cv.scaleBar(Math.max(20, f.W * 0.04), f.H - 30, best, m.ppm, { alpha: 0.85 * (1 - wallK) });

      var co = Scenes.callouts(f);
      if (co.where && wallK < 0.5) {
        var ax = m.X(0), ay = m.Y(CAB_H + 2.5);
        Cv.callout(ax, ay, ax + Math.max(60, f.W * 0.1), ay - Math.max(40, f.H * 0.12), co.where.text, { alpha: co.where.a * (1 - wallK * 2), color: C.fire, maxW: Math.min(220, f.W * 0.5) });
      }

      // through the cab wall: the world dims to the dark interior while the closed Gadget grows out of the cab into the handoff pose
      if (wallK > 0) {
        var cabX = m.X(0), cabY = m.Y(CAB_H + 1);
        var pose = { x: 0.5 * f.W, y: 0.52 * f.H, r: 0.36 * Math.min(f.W, f.H) };
        var e = U.easeInOut(wallK);
        ctx.fillStyle = U.rgba("#07090e", U.sstep(0, 0.75, wallK)); ctx.fillRect(0, 0, f.W, f.H);
        var gx = U.lerp(cabX, pose.x, e), gy = U.lerp(cabY, pose.y, e), gr = U.lerp(0.04 * pose.r, pose.r, e);
        Cv.glow(gx, gy, gr * 1.5, "#ffd9a0", 0.10 * Math.min(1, e * 2));
        Gadget.draw(gx, gy, gr, { cut: 0, rot: 0.5, alpha: U.sstep(0.05, 0.6, wallK) });
      }
      readout(f, 1);
    }
  };
})());
