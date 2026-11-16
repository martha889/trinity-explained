
  // ============================================================================
  // 30-fx: FX, particle pool, pings, flash, shake, vignette, the heat colour ramp and the fireball.
  // The engine ticks and draws FX once per frame; scenes only spawn things.
  // Flash safety (PLAN section 6) is enforced inside FX.flash itself.
  // ============================================================================
  var FX = (function () {
    var MAX_P = 500;
    var pOn = new Uint8Array(MAX_P), pKind = new Uint8Array(MAX_P);
    var px = new Float32Array(MAX_P), py = new Float32Array(MAX_P), vx = new Float32Array(MAX_P), vy = new Float32Array(MAX_P);
    var pAge = new Float32Array(MAX_P), pLife = new Float32Array(MAX_P), pR0 = new Float32Array(MAX_P), pR1 = new Float32Array(MAX_P);
    var pHeat = new Float32Array(MAX_P);
    var cursor = 0, alive = 0;
    var rnd = U.rng(918273);
    var pings = [], nPings = 0;
    for (var i = 0; i < 16; i++) pings.push({ on: false, x: 0, y: 0, age: 0, life: 1, r: 40, color: "#ffa23a" });

    // Flash: one smooth rise and decay. Hard limits live here, scenes cannot change them.
    var FLASH_MAX = 0.85, FLASH_RISE_MIN = 0.18, FLASH_DECAY_MIN = 1.6, FLASH_COOLDOWN = 0.5;
    var fl = { t: 1e9, peak: 0, rise: FLASH_RISE_MIN, decay: FLASH_DECAY_MIN, color: "#fff4dc", cool: 0 };
    var shakeAmp = 0, shakeClock = 0;

    var api = { shakeX: 0, shakeY: 0 };

    // ---------- heat colour ramp: one black-body-like palette for everything hot ----------
    var HEAT_STOPS = [[0, "#2a0505"], [0.14, "#8f1a0b"], [0.30, "#e2481f"], [0.46, "#ffa23a"], [0.62, "#ffd58a"], [0.78, "#fff4dc"], [1, "#cfe4ff"]];
    var HEAT_LUT = (function () {
      var lut = [];
      for (var k = 0; k <= 255; k++) {
        var x = k / 255, j = 0;
        while (j < HEAT_STOPS.length - 2 && x > HEAT_STOPS[j + 1][0]) j++;
        var a = HEAT_STOPS[j], b = HEAT_STOPS[j + 1], f = U.clamp((x - a[0]) / (b[0] - a[0]), 0, 1);
        var ca = U.hex(a[1]), cb = U.hex(b[1]);
        lut.push([ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f]);
      }
      return lut;
    })();
    // x in 0..1 (0 deep red ... 0.46 orange ... 0.78 white-hot ... 1 blue-white) -> [r, g, b]
    api.heatRGB = function (x) { var c = HEAT_LUT[Math.round(U.clamp(x, 0, 1) * 255)]; return [c[0], c[1], c[2]]; };
    // -> css colour, with optional alpha
    api.heat = function (x, a) {
      var c = HEAT_LUT[Math.round(U.clamp(x, 0, 1) * 255)];
      return a == null || a >= 1 ? "rgb(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + ")" : "rgba(" + (c[0] | 0) + "," + (c[1] | 0) + "," + (c[2] | 0) + "," + U.clamp(a, 0, 1) + ")";
    };
    // Temperature (K) -> ramp position: 1000 K deep red, ~3500 K orange, ~6500 K white-hot, 15000+ K blue-white.
    api.heatPos = function (tempK) { return U.clamp(Math.log(Math.max(tempK, 1) / 1000) / Math.log(15), 0, 1); };
    api.heatK = function (tempK, a) { return api.heat(api.heatPos(tempK), a); };

    // ---------- particles ----------
    // kind 0 = spark (additive, coloured by heat position), 1 = dust (soft grey-brown, falls and drags).
    api.spawn = function (kind, x, y, svx, svy, life, r0, r1, heat) {
      if (RM) return;
      var k = cursor; cursor = (cursor + 1) % MAX_P;
      if (!pOn[k]) alive++;
      pOn[k] = 1; pKind[k] = kind; px[k] = x; py[k] = y; vx[k] = svx; vy[k] = svy; pAge[k] = 0; pLife[k] = life;
      pR0[k] = r0; pR1[k] = r1; pHeat[k] = heat == null ? 0.5 : heat;
    };
    // o = {angle (rad, default all round), spread (rad), speed, speedVar, life, r0, r1, heat, kind}
    api.burst = function (x, y, n, o) {
      o = o || {};
      for (var i = 0; i < n; i++) {
        var a = (o.angle == null ? rnd() * 6.2832 : o.angle + (rnd() - 0.5) * (o.spread == null ? 0.8 : o.spread));
        var sp = (o.speed || 60) * (1 - (o.speedVar == null ? 0.5 : o.speedVar) * rnd());
        api.spawn(o.kind || 0, x, y, Math.cos(a) * sp, Math.sin(a) * sp, (o.life || 0.8) * (0.6 + 0.8 * rnd()), o.r0 || 1.5, o.r1 || 0.5, o.heat);
      }
    };
    api.ping = function (x, y, color, o) {
      if (RM) return;
      o = o || {};
      for (var i = 0; i < pings.length; i++) {
        if (pings[i].on) continue;
        var p = pings[i]; p.on = true; p.x = x; p.y = y; p.age = 0; p.life = o.life || 0.9; p.r = o.r || 44; p.color = color || C.fire; nPings++;
        return;
      }
    };
    // Flash: strength 0..1. Peak is capped at 85% opacity, rise >= 180 ms, decay >= 1.6 s, retriggers are ignored
    // while a flash is running or cooling down, so luminance can never alternate faster than ~0.5 Hz.
    api.stats = { n: 0, ignored: 0, peak: 0, rise: 0, decay: 0 };   // test hook: what the flash actually did
    api.flash = function (strength, color, rise, decay) {
      if (RM) return;
      if (fl.t < fl.rise + fl.decay + FLASH_COOLDOWN) { api.stats.ignored++; return; }
      fl.peak = U.clamp(strength == null ? 1 : strength, 0, 1) * FLASH_MAX;
      fl.rise = Math.max(FLASH_RISE_MIN, rise || 0); fl.decay = Math.max(FLASH_DECAY_MIN, decay || 0);
      fl.color = color || "#fff4dc"; fl.t = 0;
      api.stats.n++; api.stats.peak = Math.max(api.stats.peak, fl.peak); api.stats.rise = fl.rise; api.stats.decay = fl.decay;
    };
    api.flashAlpha = function () {
      if (fl.t >= fl.rise + fl.decay) return 0;
      if (fl.t < fl.rise) return fl.peak * U.sstep(0, fl.rise, fl.t);
      return fl.peak * (1 - U.sstep(fl.rise, fl.rise + fl.decay, fl.t));
    };
    // Shake: px amplitude, capped at 10 px, exponential decay, off under reduced motion.
    api.shake = function (amp) { if (RM) return; shakeAmp = Math.min(10, Math.max(shakeAmp, amp)); };

    api.reset = function () {
      for (var i = 0; i < MAX_P; i++) pOn[i] = 0;
      alive = 0; for (var j = 0; j < pings.length; j++) pings[j].on = false; nPings = 0;
      fl.t = 1e9; shakeAmp = 0; api.shakeX = 0; api.shakeY = 0;
    };
    // Advance by real time dt. Returns true while anything is still animating.
    api.tick = function (dt) {
      if (RM) { if (alive || nPings || shakeAmp || fl.t < 1e8) api.reset(); return false; }
      var s = dt > 0 ? Math.min(0.1, dt) : 0;
      if (alive) {
        var n = 0;
        for (var i = 0; i < MAX_P; i++) {
          if (!pOn[i]) continue;
          pAge[i] += s;
          if (pAge[i] >= pLife[i]) { pOn[i] = 0; continue; }
          px[i] += vx[i] * s; py[i] += vy[i] * s;
          if (pKind[i] === 1) { vy[i] += 14 * s; vx[i] *= 1 - 1.4 * s; } else { vx[i] *= 1 - 1.1 * s; vy[i] *= 1 - 1.1 * s; }
          n++;
        }
        alive = n;
      }
      if (nPings) {
        var m = 0;
        for (var j = 0; j < pings.length; j++) { var p = pings[j]; if (!p.on) continue; p.age += s; if (p.age >= p.life) p.on = false; else m++; }
        nPings = m;
      }
      if (fl.t < 1e8) fl.t += s;
      if (shakeAmp > 0.05) {
        shakeClock += s * 24; shakeAmp *= Math.exp(-s * 4.5);
        api.shakeX = Math.sin(shakeClock * 1.7) * Math.cos(shakeClock * 0.9) * shakeAmp;
        api.shakeY = Math.cos(shakeClock * 2.1) * Math.sin(shakeClock * 1.3) * shakeAmp;
      } else { shakeAmp = 0; api.shakeX = 0; api.shakeY = 0; }
      return alive > 0 || nPings > 0 || shakeAmp > 0 || fl.t < fl.rise + fl.decay;
    };
    // Draw pooled particles and pings (called by the engine inside the shake transform).
    api.draw = function () {
      var i;
      if (alive) {
        ctx.save();
        for (i = 0; i < MAX_P; i++) {
          if (!pOn[i]) continue;
          var u = pAge[i] / pLife[i], r = Math.max(0.1, pR0[i] + (pR1[i] - pR0[i]) * u);
          if (pKind[i] === 0) {
            ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = (1 - u) * (1 - u) * 0.8;
            ctx.fillStyle = api.heat(pHeat[i] * (1 - 0.35 * u));
          } else {
            ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = (1 - u) * 0.35;
            ctx.fillStyle = U.mix("#8a7a66", "#4a4540", u);
          }
          ctx.beginPath(); ctx.arc(px[i], py[i], r, 0, 6.2832); ctx.fill();
        }
        ctx.restore();
      }
      if (nPings) {
        ctx.save();
        for (i = 0; i < pings.length; i++) {
          var p = pings[i]; if (!p.on) continue;
          var k = p.age / p.life;
          ctx.globalAlpha = (1 - k) * 0.8; ctx.strokeStyle = p.color; ctx.lineWidth = 2 - k * 1.2;
          ctx.beginPath(); ctx.arc(p.x, p.y, 4 + U.easeOut(k) * p.r, 0, 6.2832); ctx.stroke();
        }
        ctx.restore();
      }
    };
    var vigCache = null;
    api.vignette = function () {
      if (!vigCache || vigCache.w !== W || vigCache.h !== H) {
        var g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.hypot(W, H) * 0.62);
        g.addColorStop(0, "rgba(5,7,11,0)"); g.addColorStop(1, "rgba(5,7,11,0.5)");
        vigCache = { w: W, h: H, g: g };
      }
      ctx.save(); ctx.fillStyle = vigCache.g; ctx.fillRect(0, 0, W, H); ctx.restore();
    };
    // The flash overlay, drawn after everything else (and after the cross-fade).
    api.overlay = function () {
      var a = api.flashAlpha();
      if (a > 0.002) { ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = fl.color; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    };

    // ---------- fireball ----------
    var noiseCv = null, scratch = null;
    function vnoise(x, y, seed) {
      var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      var a = U.hash(xi + yi * 57, seed), b = U.hash(xi + 1 + yi * 57, seed), c = U.hash(xi + (yi + 1) * 57, seed), d = U.hash(xi + 1 + (yi + 1) * 57, seed);
      var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function buildNoise() {
      var n = 192, c = document.createElement("canvas"); c.width = c.height = n;
      var g = c.getContext("2d"), img = g.createImageData(n, n);
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var f = 0, amp = 0.5, fr = 4, tot = 0;
        for (var o = 0; o < 5; o++) { f += amp * vnoise(x / n * fr, y / n * fr, 11 + o); tot += amp; amp *= 0.5; fr *= 2; }
        f /= tot;
        var k = (y * n + x) * 4; img.data[k] = 20; img.data[k + 1] = 4; img.data[k + 2] = 0;
        img.data[k + 3] = Math.round(255 * U.clamp((0.58 - f) * 3.2, 0, 1));
      }
      g.putImageData(img, 0, 0);
      return c;
    }
    // FX.fireball(x, y, r, opts): glowing air sphere. opts = {temp: heat position at the centre (0..1, default 0.6),
    // rough: mottling 0..1 (0.5), seed: number, alpha: 0..1, churn: slow rotation phase (e.g. f.t-driven), clipY: only draw above this y}
    // The ball is drawn as an opaque body (not purely additive, so it can never saturate to a blank white sheet): a white-hot
    // centre that grades through pale yellow and orange to a defined, slightly darker limb, with mottling over it. The centre
    // colour is capped below blue-white, so even a ball much larger than the view shows its gradient and texture.
    api.fireball = function (x, y, r, o) {
      o = o || {};
      var temp = o.temp == null ? 0.6 : o.temp, alpha = o.alpha == null ? 1 : o.alpha, rough = o.rough == null ? 0.5 : o.rough;
      var cpos = Math.min(temp, 0.8);                       // centre position on the heat ramp (0.78 is white-hot)
      function at(d) { return api.heat(Math.max(0.16, cpos - d)); }
      function atA(d, a) { return api.heat(Math.max(0.16, cpos - d), a); }
      if (r < 0.5) { Cv.glow(x, y, 6, api.heat(cpos), 0.8 * alpha); return; }
      if (!noiseCv) { noiseCv = buildNoise(); scratch = document.createElement("canvas"); }
      ctx.save();
      if (o.clipY != null) { ctx.beginPath(); ctx.rect(-50, -50, W + 100, o.clipY + 50); ctx.clip(); }
      // outer halo (additive, soft)
      ctx.globalCompositeOperation = "lighter";
      var hr = r * 1.7, hg = ctx.createRadialGradient(x, y, r * 0.7, x, y, hr);
      hg.addColorStop(0, atA(0.30, 0.22 * alpha)); hg.addColorStop(1, atA(0.5, 0));
      ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, hr, 0, 6.2832); ctx.fill();
      // body: composed off-screen, then drawn normally
      ctx.globalCompositeOperation = "source-over";
      var S2 = Math.max(16, Math.min(640, Math.ceil(r * 2.3))), rr = S2 / 2 / 1.15;
      if (scratch.width !== S2) { scratch.width = S2; scratch.height = S2; }
      var g = scratch.getContext("2d"); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S2, S2);
      var rg = g.createRadialGradient(S2 / 2, S2 / 2, 0, S2 / 2, S2 / 2, rr);
      rg.addColorStop(0, at(0)); rg.addColorStop(0.22, at(0.06)); rg.addColorStop(0.5, at(0.17)); rg.addColorStop(0.78, at(0.30));
      rg.addColorStop(0.92, at(0.38)); rg.addColorStop(0.985, atA(0.47, 0.9)); rg.addColorStop(1, atA(0.5, 0));
      g.fillStyle = rg; g.beginPath(); g.arc(S2 / 2, S2 / 2, rr, 0, 6.2832); g.fill();
      g.save(); g.globalCompositeOperation = "source-atop"; g.globalAlpha = Math.min(1, 0.35 + rough * 0.65);
      g.translate(S2 / 2, S2 / 2); g.rotate((o.seed || 0) * 2.399 + (o.churn || 0) * 0.15);
      var ns = S2 * (1.3 + 0.5 * U.hash(o.seed || 0, 3));
      g.drawImage(noiseCv, -ns / 2, -ns / 2, ns, ns); g.restore();
      var sc = r / rr; ctx.globalAlpha = alpha; ctx.drawImage(scratch, x - S2 * sc / 2, y - S2 * sc / 2, S2 * sc, S2 * sc);
      // white-hot core, small and soft: it must not wash the whole disc out
      ctx.globalCompositeOperation = "lighter";
      var cr = r * 0.42, cg = ctx.createRadialGradient(x, y, 0, x, y, cr);
      cg.addColorStop(0, api.heat(Math.min(0.9, cpos + 0.08), 0.55 * alpha)); cg.addColorStop(1, api.heat(cpos, 0));
      ctx.globalAlpha = 1; ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, y, cr, 0, 6.2832); ctx.fill();
      ctx.restore();
    };
    return api;
  })();
