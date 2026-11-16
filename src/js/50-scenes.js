
  // ============================================================================
  // 50-scenes: Scenes, the explicit scene registry. Scene files call Scenes.register(id, {enter, draw, onEvent})
  // exactly once and declare nothing else at top level (keep locals inside a function scope).
  // ============================================================================
  var Scenes = (function () {
    var reg = {};
    var api = {
      register: function (id, def) {
        if (!def || typeof def.draw !== "function") throw new Error("Scenes.register(" + id + "): draw(f) is required");
        if (reg[id]) throw new Error("Scenes.register(" + id + "): registered twice");
        reg[id] = def;
      },
      get: function (id) { return reg[id] || null; },
      // Canvas callouts active at frame f, as {id: {text, a}} with a = fade alpha 0..1 (0.4 s fades at both ends).
      // Authored in content/NN-<id>.json as {id, u0, u1, text}.
      callouts: function (f) {
        var out = {}, list = D.content[f.phase.id].callouts, span = f.phase.play1 - f.phase.play0;
        for (var i = 0; i < list.length; i++) {
          var c = list[i], p0 = f.phase.play0 + c.u0 * span, p1 = f.phase.play0 + c.u1 * span;
          if (f.play < p0 - 1e-9 || f.play > p1 + 1e-9) continue;
          var a = RM ? 1 : Math.min(1, (f.play - p0) / 0.4 + 0.001, (p1 - f.play) / 0.4 + 0.001);
          if (c.u1 >= 0.999) a = RM ? 1 : Math.min(1, (f.play - p0) / 0.4 + 0.001);
          out[c.id] = { text: c.text, a: U.clamp(a, 0, 1) };
        }
        return out;
      }
    };
    return api;
  })();
