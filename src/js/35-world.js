
  // ============================================================================
  // 35-world: World, the section-view desert shared by every scene that shows the landscape.
  // World.draw(view, opts) works from a 40 km wide view down to a 60 m view.
  // ============================================================================
  var World = (function () {
    var LAYOUT = {
      tower: 30,            // m, top of the shot cab (facts tower_height)
      cabW: 3.6, cabH: 3.2, // m
      shelterX: 9100,       // m, observer shelters (facts shelter_dist); drawn at -x (west) and +x (south)
      campX: 16000          // m, base camp (facts base_camp_dist)
    };
    var api = { LAYOUT: LAYOUT };

    function n1(x, seed) { // smooth 1D value noise in [0,1)
      var i = Math.floor(x), f = x - i, a = U.hash(i, seed), b = U.hash(i + 1, seed);
      f = f * f * (3 - 2 * f); return a + (b - a) * f;
    }
    var SKY = {
      night: { z: "#03050b", m: "#0a1222", h: "#141d31" },
      dawn: { z: "#0d1a36", m: "#2a3a66", h: "#c8764c" },
      day: { z: "#3b6296", m: "#8fb0d0", h: "#f6c894" }   // full morning light, reached by opts.day 1
    };

    // Returns the mapping for this frame: {ppm, X(xm), Y(hm), groundY, W, H, view}.
    // view = {cx, cy, span}: cx = metres east of ground zero at the screen centre, cy = metres above the ground
    // at the screen centre, span = visible width in metres.
    // opts = {dawn 0..1, stars 0..1, clouds 0..1, tower 0..1 (1 = intact), towerBurn 0..1, towerGone bool,
    //         cabLight 0..1, bunkers bool, camp bool, labels bool, light {a, color, x, y}}
    api.draw = function (view, o) {
      o = o || {};
      var ppm = W / view.span;
      var m = {
        ppm: ppm, W: W, H: H, view: view, groundY: H / 2 + view.cy * ppm,
        X: function (xm) { return W / 2 + (xm - view.cx) * ppm; },
        Y: function (hm) { return H / 2 - (hm - view.cy) * ppm; }
      };
      var gy = m.groundY, dawn = U.clamp(o.dawn == null ? 0.2 : o.dawn, 0, 1);
      ctx.save();
      // sky
      var day = U.clamp(o.day || 0, 0, 1);
      var zc = U.mix(U.mix(SKY.night.z, SKY.dawn.z, dawn), SKY.day.z, day), mc = U.mix(U.mix(SKY.night.m, SKY.dawn.m, dawn), SKY.day.m, day), hc = U.mix(U.mix(SKY.night.h, SKY.dawn.h, dawn), SKY.day.h, day);
      var skyTop = gy - Math.max(H * 1.05, 200);
      var sg = ctx.createLinearGradient(0, skyTop, 0, gy);
      sg.addColorStop(0, zc); sg.addColorStop(0.62, mc); sg.addColorStop(1, hc);
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);
      // stars
      var sa = (o.stars == null ? 1 : o.stars) * Math.pow(1 - Math.max(dawn, day), 1.3) * (o.light ? 1 - U.sstep(0.02, 0.35, o.light.a) : 1);
      if (sa > 0.01 && gy > 0) Cv.stars(0, 0, W, Math.min(H, gy), sa, -view.cx / view.span * 30);
      // faint clouds left by the night's storm
      var ca = (o.clouds == null ? 0.5 : o.clouds);
      if (ca > 0.01) {
        for (var ci = 0; ci < 7; ci++) {
          var cxp = ((U.hash(ci, 21) * 1.3 - 0.15) * W - view.cx / view.span * W * 0.04 + W * 2) % (W * 1.3) - W * 0.15;
          var cyp = gy - (0.35 + U.hash(ci, 22) * 0.5) * Math.min(gy, H) * 0.9, cw = W * (0.14 + U.hash(ci, 23) * 0.18), chh = cw * 0.14;
          ctx.save(); ctx.translate(cxp, cyp); ctx.scale(1, chh / cw);
          var cg = ctx.createRadialGradient(0, 0, 0, 0, 0, cw);
          cg.addColorStop(0, U.rgba(U.mix(mc, "#9aa6c4", 0.35 + dawn * 0.3), 0.16 * ca)); cg.addColorStop(1, U.rgba(mc, 0));
          ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0, 0, cw, 0, 6.2832); ctx.fill(); ctx.restore();
        }
      }
      // horizon glow
      if (gy > 0 && gy < H + 400) {
        var hg = ctx.createLinearGradient(0, gy - H * 0.35, 0, gy);
        hg.addColorStop(0, U.rgba(SKY.dawn.h, 0)); hg.addColorStop(1, U.rgba(SKY.dawn.h, 0.10 + 0.28 * dawn));
        ctx.fillStyle = hg; ctx.fillRect(0, Math.max(0, gy - H * 0.35), W, Math.min(H, H * 0.35 + 2));
      }
      // mountains (screen-space backdrop: angular size does not change with zoom)
      if (gy > -20) {
        var layers = [
          { h: 0.19, seed: 31, par: 0.04, col: U.mix(hc, U.mix("#1d2742", "#6a6f90", day), 0.62), rim: 0.20 },
          { h: 0.125, seed: 41, par: 0.10, col: U.mix(hc, U.mix("#141c30", "#55506a", day), 0.78), rim: 0.12 },
          { h: 0.07, seed: 51, par: 0.20, col: U.mix(hc, U.mix("#0d1320", "#3e3a4c", day), 0.88), rim: 0.06 }
        ];
        for (var li = 0; li < layers.length; li++) {
          var L = layers[li], off = -view.cx / view.span * L.par * 6 + li * 7.3, base = L.h * Math.min(H, 700);
          ctx.beginPath(); ctx.moveTo(-5, gy + 2);
          for (var x = -5; x <= W + 5; x += 5) {
            var f = n1(x / (W * 0.34) + off, L.seed) * 0.58 + n1(x / (W * 0.10) + off, L.seed + 1) * 0.28 + n1(x / (W * 0.032) + off, L.seed + 2) * 0.14;
            ctx.lineTo(x, gy - base * (0.18 + 1.0 * Math.pow(f, 1.4)));
          }
          ctx.lineTo(W + 5, gy + 2); ctx.closePath();
          var mgr = ctx.createLinearGradient(0, gy - base * 1.2, 0, gy);
          mgr.addColorStop(0, U.mix(L.col, SKY.dawn.h, L.rim * dawn + 0.03)); mgr.addColorStop(1, L.col);
          ctx.fillStyle = mgr; ctx.fill();
        }
      }
      // ground
      if (gy < H + 2) {
        var g0 = Math.max(gy, -2), gg = ctx.createLinearGradient(0, gy, 0, Math.max(H, gy + 40));
        var gtop = U.mix(U.mix("#34291c", "#5a4630", dawn * 0.8), "#95784f", day), gbot = U.mix("#12100b", "#4a3a28", day);
        gg.addColorStop(0, gtop); gg.addColorStop(0.18, U.mix(gtop, gbot, 0.5)); gg.addColorStop(1, gbot);
        ctx.fillStyle = gg; ctx.fillRect(0, g0, W, H - g0 + 2);
        ctx.fillStyle = U.rgba(SKY.dawn.h, 0.10 + 0.25 * dawn); ctx.fillRect(0, gy, W, 1.2); // lit surface edge
        // scrub tufts, stable in world space
        if (ppm > 1.2) {
          var x0 = view.cx - view.span / 2 - 6, x1 = view.cx + view.span / 2 + 6, cell = 6;
          ctx.strokeStyle = U.mix("#3a3223", "#6a5638", dawn); ctx.lineWidth = Math.max(1, Math.min(2.4, ppm * 0.08)); ctx.beginPath();
          for (var cI = Math.floor(x0 / cell); cI <= Math.floor(x1 / cell); cI++) {
            if (U.hash(cI, 61) < 0.45) continue;
            var tx = m.X((cI + U.hash(cI, 62)) * cell), th = (0.25 + U.hash(cI, 63) * 0.6) * ppm;
            if (Math.abs((cI + 0.5) * cell) < 12 && o.tower !== 0) continue;
            ctx.moveTo(tx, gy); ctx.lineTo(tx - th * 0.4, gy - th); ctx.moveTo(tx, gy); ctx.lineTo(tx + th * 0.1, gy - th * 1.1); ctx.moveTo(tx, gy); ctx.lineTo(tx + th * 0.5, gy - th * 0.8);
          }
          ctx.stroke();
        } else { // distant streaks
          ctx.strokeStyle = U.rgba("#5a4a34", 0.10); ctx.lineWidth = 1; ctx.beginPath();
          for (var si = 0; si < 14; si++) {
            var sy = gy + 3 + Math.pow(U.hash(si, 71), 1.6) * (H - gy), sx = U.hash(si, 72) * W;
            ctx.moveTo(sx, sy); ctx.lineTo(sx + 20 + U.hash(si, 73) * 80, sy);
          }
          ctx.stroke();
        }
      }
      // bunkers and base camp, true distances, with minimum drawn sizes so they stay visible at 40 km
      if (o.bunkers !== false) { bunker(m, -LAYOUT.shelterX, dawn); bunker(m, LAYOUT.shelterX, dawn); }
      if (o.camp !== false) camp(m, LAYOUT.campX, dawn);
      if (o.towerGone) stumps(m);
      else if (o.tower !== 0) tower(m, o.tower == null ? 1 : o.tower, o.towerBurn || 0, o.cabLight == null ? 0.6 : o.cabLight, dawn);
      if (o.labels) labels(m);
      // fireball light: relights ground, mountains, tower and sky
      if (o.light && o.light.a > 0.003) {
        var lx = m.X(o.light.x == null ? 0 : o.light.x), ly = m.Y(o.light.y == null ? 0 : o.light.y), la = U.clamp(o.light.a, 0, 1), lc = o.light.color || "#ffb25a";
        var lr = Math.max(W, H) * 1.25;
        ctx.globalCompositeOperation = "lighter";
        var lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, lr);
        lg.addColorStop(0, U.rgba(lc, 0.55 * la)); lg.addColorStop(0.12, U.rgba(lc, 0.30 * la)); lg.addColorStop(0.45, U.rgba(lc, 0.10 * la)); lg.addColorStop(1, U.rgba(lc, 0));
        ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
        if (gy < H) { // grazing light along the desert floor
          ctx.save(); ctx.translate(lx, gy); ctx.scale(1, 0.12);
          var eg = ctx.createRadialGradient(0, 0, 0, 0, 0, lr * 1.2);
          eg.addColorStop(0, U.rgba(lc, 0.5 * la)); eg.addColorStop(1, U.rgba(lc, 0));
          ctx.fillStyle = eg; ctx.fillRect(-lr * 1.3, -lr * 1.3, lr * 2.6, lr * 2.6); ctx.restore();
        }
      }
      ctx.restore();
      return m;
    };

    function bunker(m, xm, dawn) {
      var x = m.X(xm); if (x < -40 || x > W + 40) return;
      var gy = m.groundY, w = Math.max(14, 14 * m.ppm), h = Math.max(5, 3.6 * m.ppm);
      ctx.save();
      ctx.fillStyle = U.mix("#1b1710", "#3a2e22", dawn * 0.7);
      ctx.beginPath(); ctx.moveTo(x - w / 2, gy); ctx.lineTo(x - w * 0.36, gy - h); ctx.lineTo(x + w * 0.36, gy - h); ctx.lineTo(x + w / 2, gy); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#06070a"; ctx.fillRect(x - w * 0.1, gy - h * 0.62, w * 0.2, h * 0.62);
      if (m.ppm < 0.2) { ctx.strokeStyle = U.rgba(C.fg, 0.55); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, gy - h); ctx.lineTo(x, gy - h - 6); ctx.stroke(); }
      ctx.restore();
    }
    function camp(m, xm, dawn) {
      var x0 = m.X(xm); if (x0 < -80 || x0 > W + 80) return;
      var gy = m.groundY, s = Math.max(1, m.ppm / 0.4);
      ctx.save();
      for (var i = 0; i < 6; i++) {
        var hx = x0 + (i - 2.5) * Math.max(6, 16 * m.ppm), hw = Math.max(4, 9 * m.ppm), hh = Math.max(3, (2.8 + (i % 2)) * m.ppm);
        ctx.fillStyle = U.mix("#241f17", "#4a3c2c", dawn * 0.7);
        ctx.beginPath(); ctx.moveTo(hx - hw / 2, gy); ctx.lineTo(hx - hw / 2, gy - hh * 0.8); ctx.lineTo(hx, gy - hh); ctx.lineTo(hx + hw / 2, gy - hh * 0.8); ctx.lineTo(hx + hw / 2, gy); ctx.closePath(); ctx.fill();
        if (m.ppm > 0.2 && i % 2 === 0) { ctx.fillStyle = U.rgba("#ffd9a0", 0.7); ctx.fillRect(hx - 1, gy - hh * 0.55, 2.2, 2); }
      }
      var fy = gy - Math.max(12, 10 * m.ppm), fx = x0 + Math.max(24, 30 * m.ppm);
      ctx.strokeStyle = U.rgba(C.fg, 0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(fx, gy); ctx.lineTo(fx, fy); ctx.stroke();
      ctx.fillStyle = U.rgba(C.fg, 0.5); ctx.fillRect(fx, fy, Math.max(4, 3 * m.ppm), Math.max(2, 1.8 * m.ppm));
      ctx.restore();
    }
    function stumps(m) {
      var gy = m.groundY, wpx = Math.max(6, 7 * m.ppm);
      ctx.save(); ctx.fillStyle = "#2b2418";
      ctx.fillRect(m.X(0) - wpx / 2, gy - 1.5, wpx, 3);
      ctx.restore();
    }
    // Lattice tower with the shot cab on top. burn 0..1 shortens it from the top and tints it hot.
    function tower(m, amount, burn, cabLight, dawn) {
      var x = m.X(0); if (x < -200 || x > W + 200) return;
      var gy = m.groundY, ppm = m.ppm;
      var th = Math.max(30 * ppm, 10), scale = th / (30 * ppm);       // exaggerate when far away, keep proportions
      var vis = 1 - U.clamp(burn, 0, 1);
      if (vis <= 0.001 || amount <= 0.001) return;
      var legTop = (LAYOUT.tower - LAYOUT.cabH) * ppm * scale, topY = gy - legTop * vis;
      var baseHW = 3.4 * ppm * scale, topHW = 1.8 * ppm * scale, lw = U.clamp(0.22 * ppm, 1, 3.2);
      var col = U.mix("#6a7384", "#c0a888", dawn * 0.5);
      ctx.save(); ctx.globalAlpha = amount;
      if (th < 24) { // distant: a stick with a dot
        ctx.strokeStyle = U.rgba(C.fg, 0.8); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, gy - th * vis); ctx.stroke();
        ctx.fillStyle = C.hot; ctx.fillRect(x - 1.5, gy - th * vis - 2, 3, 3);
      } else {
        ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = "butt";
        function hw(yy) { var k = (gy - yy) / Math.max(1, legTop); return baseHW + (topHW - baseHW) * k; }
        ctx.beginPath();
        ctx.moveTo(x - baseHW, gy); ctx.lineTo(x - hw(topY), topY); ctx.moveTo(x + baseHW, gy); ctx.lineTo(x + hw(topY), topY);
        var panels = 8, prev = gy;
        for (var i = 1; i <= panels; i++) {
          var yy = gy - legTop * vis * i / panels, a = hw(prev), b = hw(yy);
          ctx.moveTo(x - a, prev); ctx.lineTo(x + b, yy); ctx.moveTo(x + a, prev); ctx.lineTo(x - b, yy); // X bracing
          ctx.moveTo(x - b, yy); ctx.lineTo(x + b, yy);
          prev = yy;
        }
        ctx.stroke();
        // footings
        ctx.fillStyle = "#2b2418"; ctx.fillRect(x - baseHW - lw * 2, gy - 1, lw * 4, 3); ctx.fillRect(x + baseHW - lw * 2, gy - 1, lw * 4, 3);
      }
      // the shot cab
      if (vis > 0.2) {
        var cw = LAYOUT.cabW * ppm * scale, chh = LAYOUT.cabH * ppm * scale, cy0 = topY - chh, a2 = U.clamp((vis - 0.2) / 0.3, 0, 1);
        ctx.globalAlpha = amount * a2;
        ctx.fillStyle = U.mix("#4a5262", "#8a7a64", dawn * 0.5);
        ctx.beginPath(); ctx.moveTo(x - cw / 2, topY); ctx.lineTo(x - cw / 2, cy0 + chh * 0.12); ctx.lineTo(x, cy0); ctx.lineTo(x + cw / 2, cy0 + chh * 0.12); ctx.lineTo(x + cw / 2, topY); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = U.rgba(C.fg, 0.45); ctx.lineWidth = Math.max(1, lw * 0.6); ctx.stroke();
        if (cw > 10) { // corrugation, door, lit window
          ctx.strokeStyle = U.rgba(C.bg, 0.35); ctx.lineWidth = 1; ctx.beginPath();
          for (var k = 1; k < 6; k++) { ctx.moveTo(x - cw / 2 + cw * k / 6, topY); ctx.lineTo(x - cw / 2 + cw * k / 6, cy0 + chh * 0.15); }
          ctx.stroke();
          ctx.fillStyle = "#101319"; ctx.fillRect(x - cw * 0.12, topY - chh * 0.62, cw * 0.24, chh * 0.62);
          ctx.fillStyle = U.rgba("#ffd9a0", 0.85 * cabLight); ctx.fillRect(x + cw * 0.2, topY - chh * 0.7, cw * 0.18, chh * 0.28);
        } else if (cabLight > 0.05) { ctx.fillStyle = U.rgba("#ffd9a0", 0.9 * cabLight); ctx.fillRect(x - 1, topY - chh * 0.6, 2.2, 2); }
        if (cabLight > 0.05) Cv.glow(x + cw * 0.3, topY - chh * 0.55, Math.max(8, cw * 1.6), "#ffd9a0", 0.22 * cabLight);
      }
      if (burn > 0.001) { // vaporising: white-hot tint
        ctx.globalAlpha = U.clamp(burn * 1.6, 0, 1) * 0.55; ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = FX.heat(0.7 + 0.3 * burn); ctx.lineWidth = lw * 2.5;
        ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x, topY - LAYOUT.cabH * ppm * scale * vis); ctx.stroke();
      }
      ctx.restore();
    }
    // Labels sit above the objects at their true positions (never clamped to the bottom edge), are skipped when they would be
    // off-screen, use shorter text on narrow canvases, and stagger into rows so neighbours never collide.
    function labels(m) {
      var gy = m.groundY, narrow = W < 560, sh = U.fmtDist(LAYOUT.shelterX), items = [
        { x: 0, h: LAYOUT.tower, t: narrow ? "Tower" : "Tower " + U.fmtDist(LAYOUT.tower), left: true },
        { x: -LAYOUT.shelterX, h: 4, t: narrow ? "Shelter " + sh : "Observer shelter, " + sh },
        { x: LAYOUT.shelterX, h: 4, t: narrow ? "Shelter " + sh : "Observer shelter, " + sh },
        { x: LAYOUT.campX, h: 8, t: narrow ? "Camp " + U.fmtDist(LAYOUT.campX) : "Base camp, " + U.fmtDist(LAYOUT.campX) }
      ], rows = [], i, k;
      items.sort(function (a, b) { return m.X(a.x) - m.X(b.x); });
      for (i = 0; i < items.length; i++) {
        var it = items[i], up = it.t.toUpperCase(), w = Cv.measure(up, { size: 12, weight: 600, font: Cv.fonts.display }), x0 = m.X(it.x), x = x0 + (it.left ? 12 : 0);
        var lo = it.left ? x : x - w / 2, hi = lo + w;
        if (lo < 8 || hi > W - 8) continue;
        var by = gy - Math.max(it.h * m.ppm, 12) - 12;
        for (k = 0; k < 3; k++) {
          var clash = false;
          for (var j = 0; j < rows.length; j++) if (rows[j].k === k && lo < rows[j].hi + 8 && hi > rows[j].lo - 8) clash = true;
          if (clash) continue;
          var y = by - k * 15;
          if (y < 14 || y > H - 6) break;
          rows.push({ k: k, lo: lo, hi: hi });
          Cv.label(up, x, y, C.fg, it.left ? "left" : "center", 0.9);
          break;
        }
      }
    }
    return api;
  })();
