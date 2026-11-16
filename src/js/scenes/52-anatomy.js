// anatomy: the closed sphere turns, a wedge opens to a full section, seven layers are walked outside in, then the question.
Scenes.register("anatomy", (function () {
  var U_OPEN0 = 0.10, U_OPEN1 = 0.20, U_WALK0 = 0.20, U_STEP = 0.09, U_WALK1 = 0.83;
  var LAYER_ANGLE = { det: 0.2618 };           // anchor angle (rad) per layer; default 0 (due right)

  function layerAt(u) {
    if (u < U_WALK0 || u >= U_WALK1) return -1;
    return U.clamp(Math.floor((u - U_WALK0) / U_STEP), 0, Gadget.ORDER.length - 1);
  }

  return {
    draw: function (f) {
      var W = f.W, H = f.H, u = f.u, minWH = Math.min(W, H);
      f.spanM = 3;
      var R = 0.36 * minWH;
      // layout: callout column on the right when there is room, otherwise below the sphere
      var slideDx = 0.16 * W;
      var colX = 0.5 * W - slideDx + R + 30;
      var wide = W - colX - 16 >= 220;
      var s = U.sstep(U_WALK0 - 0.02, U_WALK0 + 0.05, u) * (1 - U.sstep(U_WALK1 - 0.02, U_WALK1 + 0.04, u));
      var cx = 0.5 * W - (wide ? slideDx * s : 0), cy = 0.52 * H, pcy = cy, pR = R;
      if (!wide) { R = U.lerp(R, Math.min(0.24 * H, 0.22 * W), s); cy = U.lerp(cy, R + 16, s); }

      var cut = U.easeInOut(U.invLerp(U_OPEN0, U_OPEN1, u));
      var li = layerAt(u), id = li >= 0 ? Gadget.ORDER[li] : null;
      var g = Gadget.draw(cx, cy, R, { cut: cut, highlight: id, rot: 0.5 + 4 * U.easeInOut(U.invLerp(0.015, U_OPEN1, u)) });   // starts exactly at the countdown's pose (rot 0.5), then turns

      var co = Scenes.callouts(f), i, L, k;
      // layer callouts: one slot, one at a time
      for (i = 0; i < Gadget.LAYERS.length; i++) {
        L = Gadget.LAYERS[i]; k = "anat-" + L.id;
        if (!co[k]) continue;
        var ang = LAYER_ANGLE[L.id] != null ? LAYER_ANGLE[L.id] : 0;
        if (wide) {
          var p = g.at(L.id, ang), maxW = Math.min(340, W - colX - 16);
          Cv.callout(p.x, p.y, colX, cy, co[k].text, { title: L.name, color: L.color, alpha: co[k].a, maxW: maxW });
        } else {
          var p2 = g.at(L.id, Math.PI / 2), mw = W - 24;
          var lines = Cv.wrap(co[k].text, mw - 16, { size: 13 }), bh = lines.length * 16 + 14 + 15;
          Cv.callout(p2.x, p2.y, 12, cy + R + 20 + bh / 2, co[k].text, { title: L.name, color: L.color, alpha: co[k].a, maxW: mw });
        }
      }
      // closing question
      if (co["anat-question"]) {
        var qa = co["anat-question"].a, qw = Math.min(W - 40, wide ? 760 : W - 24), qs = wide ? 18 : 13;
        var ql = Cv.wrap(co["anat-question"].text, qw, { size: qs, weight: 500 }), lh = qs + (wide ? 6 : 3);
        var qy = Math.max(qs + 6, pcy - pR - (wide ? 24 : 12) - (ql.length - 1) * lh);
        for (i = 0; i < ql.length; i++) Cv.text(ql[i], W / 2, qy + i * lh, { size: qs, color: C.hot, align: "center", alpha: qa });
      }
      // caption
      var cap = Cv.measure("Schematic, not to scale", { size: 12 });
      Cv.note("Schematic, not to scale", 18 + 0, H - 18, { tag: "I", maxW: Math.min(W - 36, cap + 40) });
    },
    onEvent: function (ev, f) {
      if (ev.id === "anatomy-open") FX.ping(f.W * 0.5, f.H * 0.52, C.al, { r: 120 });
    }
  };
})());
