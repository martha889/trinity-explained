
  // ============================================================================
  // 20-canvas: Cv, the main canvas, DPR/resize, camera spring, text and annotation helpers.
  // The main 2D context is the module-level `ctx` (DPR transform already applied each frame);
  // scenes draw in CSS pixels, origin top-left, W x H as given in the frame object f.
  // ============================================================================
  var canvas = $("scope"), ctx = canvas.getContext("2d");
  var Cv = { ctx: ctx, W: 0, H: 0, DPR: 1, resized: false, moving: false };
  var W = 0, H = 0, DPR = 1;
  var FONT_BODY = "IBM Plex Sans, Helvetica Neue, Arial, sans-serif";
  var FONT_DISP = "Barlow Condensed, Arial Narrow, sans-serif";
  var FONT_MONO = "IBM Plex Mono, monospace";
  Cv.fonts = { body: FONT_BODY, display: FONT_DISP, mono: FONT_MONO };

  // The size change is applied inside the frame loop, right before the redraw: assigning
  // canvas.width clears the bitmap, so doing it in the ResizeObserver callback would paint a blank frame.
  var resizePending = true;
  function markResize() { resizePending = true; S.dirty = true; }
  Cv.applyResize = function () {
    if (!resizePending) return;
    resizePending = false;
    var r = $("canvas-wrap").getBoundingClientRect();
    DPR = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    var cw = Math.round(W * DPR), ch = Math.round(H * DPR);
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; Cv.resized = true; }
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
    Cv.W = W; Cv.H = H; Cv.DPR = DPR;
  };
  if (window.ResizeObserver) new ResizeObserver(markResize).observe($("canvas-wrap"));
  window.addEventListener("resize", markResize);
  if (window.matchMedia) {
    var mqDpr = window.matchMedia("screen and (min-resolution: 2dppx)");
    if (mqDpr.addEventListener) mqDpr.addEventListener("change", markResize);
  }
  Cv.applyResize();

  // ---------- camera: critically damped spring ----------
  // Cv.smooth(target, key, dt, logKeys) -> the smoothed copy of `target` ({cx, cy, span, ...}).
  // Keys listed in logKeys (e.g. ["span"]) are smoothed in log space, so a 40 km -> 60 m push-in
  // eases evenly. The state resets when `key` changes, after any seek (Cv.resetCam), and under reduced motion.
  var camView = null, camVel = {}, camKey = null;
  Cv.resetCam = function () { camView = null; Cv.moving = false; };
  Cv.smooth = function (target, key, dt, logKeys) {
    logKeys = logKeys || [];
    function enc(k, v) { return logKeys.indexOf(k) >= 0 ? Math.log(Math.max(v, 1e-12)) : v; }
    function dec(k, v) { return logKeys.indexOf(k) >= 0 ? Math.exp(v) : v; }
    if (!camView || camKey !== key || RM) {
      camView = {}; camVel = {}; camKey = key;
      for (var k0 in target) { camView[k0] = enc(k0, target[k0]); camVel[k0] = 0; }
      Cv.moving = false;
      return JSON.parse(JSON.stringify(target));
    }
    var step = dt > 0 ? Math.min(0.1, dt) : 0.016, omega = 6.5, e = Math.exp(-omega * step), moving = false, out = {};
    for (var k in target) {
      var tg = enc(k, target[k]);
      if (camView[k] === undefined) { camView[k] = tg; camVel[k] = 0; }
      var d0 = camView[k] - tg, v0 = camVel[k] || 0, c1 = v0 + omega * d0;
      camView[k] = tg + (d0 + c1 * step) * e;
      camVel[k] = (v0 - c1 * omega * step) * e;
      var ref = logKeys.indexOf(k) >= 0 ? 1 : Math.max(1, Math.abs(tg));
      if (Math.abs(camView[k] - tg) > ref * 1e-4 || Math.abs(camVel[k]) > ref * 1e-3) moving = true;
      else { camView[k] = tg; camVel[k] = 0; }
      out[k] = dec(k, camView[k]);
    }
    Cv.moving = moving;
    return out;
  };

  // ---------- text and annotation helpers ----------
  // Cv.text(str, x, y, {size, weight, color, font, align, base, alpha})
  Cv.text = function (t, x, y, o) {
    o = o || {};
    ctx.font = (o.weight || 500) + " " + (o.size || 12) + "px " + (o.font || FONT_BODY);
    ctx.fillStyle = o.color || C.muted;
    ctx.textAlign = o.align || "left";
    ctx.textBaseline = o.base || "alphabetic";
    if (o.alpha != null) { var ga = ctx.globalAlpha; ctx.globalAlpha = ga * o.alpha; ctx.fillText(t, x, y); ctx.globalAlpha = ga; }
    else ctx.fillText(t, x, y);
  };
  Cv.label = function (t, x, y, color, align, alpha) { // condensed uppercase-style label
    Cv.text(t, x, y, { size: 12, weight: 600, color: color, font: FONT_DISP, align: align || "left", alpha: alpha });
  };
  Cv.mono = function (t, x, y, o) { o = o || {}; o.font = FONT_MONO; Cv.text(t, x, y, o); };
  Cv.measure = function (t, o) {
    o = o || {};
    ctx.font = (o.weight || 500) + " " + (o.size || 12) + "px " + (o.font || FONT_BODY);
    return ctx.measureText(t).width;
  };
  // Word-wrap to maxW px, returns an array of lines (uses the font in o).
  Cv.wrap = function (t, maxW, o) {
    var words = String(t).split(/\s+/), lines = [], cur = "";
    for (var i = 0; i < words.length; i++) {
      var tryS = cur ? cur + " " + words[i] : words[i];
      if (cur && Cv.measure(tryS, o) > maxW) { lines.push(cur); cur = words[i]; } else cur = tryS;
    }
    if (cur) lines.push(cur);
    return lines;
  };
  // Scientific number "8.8 x 10^13" with a raised exponent. Returns the drawn width.
  Cv.sciText = function (v, x, y, o) {
    o = o || {};
    var p = U.sci(v, o.digits), size = o.size || 12, font = o.font || FONT_MONO, w0 = (o.weight || 500);
    var head = p.m + " × 10";
    ctx.font = w0 + " " + size + "px " + font;
    var hw = ctx.measureText(head).width, ew;
    var es = Math.round(size * 0.68), et = String(p.e).replace("-", "−");
    ctx.font = w0 + " " + es + "px " + font; ew = ctx.measureText(et).width;
    var total = hw + ew, sx = x;
    if (o.align === "right") sx = x - total; else if (o.align === "center") sx = x - total / 2;
    Cv.text(head, sx, y, { size: size, weight: w0, color: o.color, font: font });
    Cv.text(et, sx + hw, y - size * 0.45, { size: es, weight: w0, color: o.color, font: font });
    return total;
  };
  function rrect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r); else ctx.rect(x, y, w, h);
  }
  Cv.rrect = rrect;
  // Provenance chip (M / C / I) at x, y (top-left). Returns its width.
  Cv.tagChip = function (tag, x, y, alpha) {
    var col = tag === "M" ? C.neutron : tag === "C" ? C.fire : C.pu;
    ctx.save(); ctx.globalAlpha = (alpha == null ? 1 : alpha);
    rrect(x, y, 16, 15, 3); ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.stroke();
    Cv.text(tag, x + 8, y + 11.5, { size: 12, weight: 700, color: col, font: FONT_DISP, align: "center" });
    ctx.restore();
    return 16;
  };
  // "Illustrative" style note: small italic-ish text with a tag chip, wrapped to maxW. Returns height used.
  Cv.note = function (text, x, y, o) {
    o = o || {};
    var maxW = o.maxW || 260, size = o.size || 12, lines = Cv.wrap(text, maxW - (o.tag ? 22 : 0), { size: size });
    var tx = x + (o.tag ? 22 : 0);
    if (o.tag) Cv.tagChip(o.tag, x, y - 11, o.alpha);
    for (var i = 0; i < lines.length; i++) Cv.text(lines[i], tx, y + i * (size + 3), { size: size, color: o.color || C.muted, alpha: o.alpha });
    return lines.length * (size + 3);
  };
  // Numeric readout: small caption above a large mono value. Returns nothing.
  Cv.readout = function (x, y, caption, value, o) {
    o = o || {};
    Cv.label(String(caption).toUpperCase(), x, y, o.captionColor || C.muted, o.align, o.alpha);
    Cv.text(value, x, y + (o.size || 20) + 2, { size: o.size || 20, weight: 500, color: o.color || C.hot, font: FONT_MONO, align: o.align, alpha: o.alpha });
  };
  // Scale bar: a bar spanning `metres` at pxPerM, with end ticks and a label ("100 m"). x,y = left end.
  Cv.scaleBar = function (x, y, metres, pxPerM, o) {
    o = o || {};
    var w = metres * pxPerM, col = o.color || C.fg;
    ctx.save();
    ctx.globalAlpha = o.alpha == null ? 0.9 : o.alpha;
    ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.lineCap = "butt";
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); ctx.moveTo(x + w, y - 5); ctx.lineTo(x + w, y + 5); ctx.stroke();
    ctx.restore();
    Cv.text(o.text || U.fmtDist(metres), x + w / 2, y - 9, { size: 12, weight: 600, color: col, font: FONT_DISP, align: "center", alpha: o.alpha });
  };
  // Callout: dot at the anchor (ax, ay), leader line, wrapped text box whose nearest corner sits at (tx, ty).
  // o = {title, color, alpha, maxW, size}. The box is kept inside the canvas.
  Cv.callout = function (ax, ay, tx, ty, text, o) {
    o = o || {};
    var a = o.alpha == null ? 1 : o.alpha;
    if (a <= 0.003) return;
    var col = o.color || C.fg, size = o.size || 13, maxW = o.maxW || 200, pad = 8;
    var lines = Cv.wrap(text, maxW - pad * 2, { size: size });
    var tw = 0, i;
    for (i = 0; i < lines.length; i++) tw = Math.max(tw, Cv.measure(lines[i], { size: size }));
    if (o.title) tw = Math.max(tw, Cv.measure(o.title.toUpperCase(), { size: 13, weight: 700, font: FONT_DISP }));
    var bw = tw + pad * 2, bh = lines.length * (size + 3) + pad * 2 - 2 + (o.title ? 15 : 0);
    var bx = tx < ax ? tx - bw : tx, by = ty - bh / 2;
    bx = U.clamp(bx, 8, W - bw - 8); by = U.clamp(by, 8, H - bh - 8);
    var ex = ax < bx ? bx : ax > bx + bw ? bx + bw : bx + bw / 2, ey = U.clamp(ay, by + 6, by + bh - 6);
    if (ax >= bx && ax <= bx + bw) ey = ay < by ? by : by + bh;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.strokeStyle = col; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ex, ey); ctx.globalAlpha = a * 0.75; ctx.stroke();
    ctx.globalAlpha = a; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ax, ay, 3, 0, 6.2832); ctx.fill();
    ctx.fillStyle = "rgba(11,14,20,0.82)"; rrect(bx, by, bw, bh, 4); ctx.fill();
    ctx.globalAlpha = a * 0.55; ctx.stroke();
    ctx.restore();
    var yy = by + pad + (o.title ? 11 : 9);
    if (o.title) { Cv.text(o.title.toUpperCase(), bx + pad, yy, { size: 13, weight: 700, color: col, font: FONT_DISP, alpha: a }); yy += 15; }
    for (i = 0; i < lines.length; i++) Cv.text(lines[i], bx + pad, yy + i * (size + 3), { size: size, color: C.fg, alpha: a });
  };
  // Small marker with a pill label (as in the Apollo viewer, without the pulsing halo under reduced motion).
  Cv.marker = function (x, y, color, name, o) {
    o = o || {};
    ctx.save();
    var g = ctx.createRadialGradient(x, y, 1, x, y, 15);
    g.addColorStop(0, color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.globalAlpha = 0.24; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 15, 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(x, y, 4.2, 0, 6.2832); ctx.fillStyle = color; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = C.bg; ctx.stroke();
    if (name) {
      var up = name.toUpperCase(), al = o.align || "left", lx = x + (o.dx || 10), ly = y + (o.dy || -10);
      var tw = Cv.measure(up, { size: 12, weight: 600, font: FONT_DISP }), px = 5;
      var bx = al === "right" ? lx - tw - px : al === "center" ? lx - tw / 2 - px : lx - px;
      ctx.save(); ctx.fillStyle = "rgba(11,14,20,0.78)"; rrect(bx, ly - 11.5, tw + px * 2, 15, 3); ctx.fill();
      ctx.strokeStyle = color; ctx.globalAlpha = 0.26; ctx.lineWidth = 1; ctx.stroke(); ctx.restore();
      Cv.label(up, lx, ly, color, al);
    }
  };
  // Multi-pass glow: pass a path-building function; it is stroked 3 times (wide faint -> thin bright).
  Cv.glowPath = function (pathFn, color, width, alpha) {
    var w = width || 2, a = alpha == null ? 1 : alpha;
    ctx.save(); ctx.strokeStyle = color; ctx.lineJoin = "round"; ctx.lineCap = "round";
    ctx.beginPath(); pathFn(ctx);
    ctx.lineWidth = w * 3.6; ctx.globalAlpha = a * 0.14; ctx.stroke();
    ctx.lineWidth = w * 1.9; ctx.globalAlpha = a * 0.28; ctx.stroke();
    ctx.lineWidth = w; ctx.globalAlpha = a; ctx.stroke();
    ctx.restore();
  };
  Cv.glowLine = function (pts, color, width, alpha) { // pts = [[x,y], ...]
    if (pts.length < 2) return;
    Cv.glowPath(function (c) { c.moveTo(pts[0][0], pts[0][1]); for (var i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]); }, color, width, alpha);
  };
  Cv.glowArc = function (x, y, r, a0, a1, color, width, alpha) {
    Cv.glowPath(function (c) { c.arc(x, y, Math.max(0.1, r), a0, a1); }, color, width, alpha);
  };
  // Soft additive radial glow.
  Cv.glow = function (x, y, r, color, alpha) {
    if (r <= 0 || alpha <= 0) return;
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    var g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, U.rgba(color, alpha)); g.addColorStop(0.4, U.rgba(color, alpha * 0.35)); g.addColorStop(1, U.rgba(color, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill(); ctx.restore();
  };

  // ---------- cached, seeded starfield ----------
  // Cv.stars(x, y, w, h, alpha, parallaxX): stars over a rectangle; the bitmap is cached per size.
  var starCache = null;
  var STARS = (function () {
    var r = U.rng(7), s = [], tints = ["#dbe3ef", "#cfe2ff", "#fff4dc", "#b8d4ff", "#ffe8c2"];
    for (var i = 0; i < 300; i++) s.push({ u: r(), v: Math.pow(r(), 0.8), b: r(), layer: i < 160 ? 0 : i < 250 ? 1 : 2, tint: tints[Math.floor(r() * tints.length)] });
    return s;
  })();
  function buildStars(w, h, dpr) {
    var pad = 24, pw = Math.ceil(w + pad * 2), ph = Math.ceil(h + pad * 2), layers = [];
    for (var l = 0; l < 3; l++) {
      var c = document.createElement("canvas"); c.width = Math.round(pw * dpr); c.height = Math.round(ph * dpr);
      var g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); layers.push(g);
    }
    for (var i = 0; i < STARS.length; i++) {
      var s = STARS[i], g2 = layers[s.layer], x = s.u * pw, y = s.v * ph;
      var a = s.layer === 0 ? 0.2 + s.b * 0.3 : s.layer === 1 ? 0.3 + s.b * 0.4 : 0.5 + s.b * 0.5;
      var sz = s.layer === 0 ? 0.7 + s.b * 0.3 : s.layer === 1 ? 0.9 + s.b * 0.4 : 1.1 + s.b * 0.7;
      if (s.layer === 2 && s.b > 0.6) {
        var gr = g2.createRadialGradient(x, y, 0, x, y, sz * 3.2);
        gr.addColorStop(0, s.tint); gr.addColorStop(1, "rgba(210,228,255,0)");
        g2.globalAlpha = a * 0.5; g2.fillStyle = gr; g2.beginPath(); g2.arc(x, y, sz * 3.2, 0, 6.2832); g2.fill();
      }
      g2.globalAlpha = a; g2.fillStyle = s.tint; g2.beginPath(); g2.arc(x, y, sz * 0.5, 0, 6.2832); g2.fill();
    }
    var band = layers[0]; // faint Milky Way band
    band.save(); band.globalAlpha = 1; band.translate(pw * 0.5, ph * 0.4); band.rotate(-0.42);
    var bh = Math.max(pw, ph) * 0.3, mg = band.createLinearGradient(0, -bh, 0, bh);
    mg.addColorStop(0, "rgba(120,150,210,0)"); mg.addColorStop(0.5, "rgba(170,190,240,0.05)"); mg.addColorStop(1, "rgba(120,150,210,0)");
    band.fillStyle = mg; band.fillRect(-pw, -bh, pw * 2, bh * 2); band.restore();
    return { w: w, h: h, dpr: dpr, pad: pad, pw: pw, ph: ph, layers: layers.map(function (g) { return g.canvas; }) };
  }
  Cv.stars = function (x, y, w, h, alpha, shift) {
    if (alpha <= 0.003) return;
    var cw = Math.round(w), ch = Math.round(h);
    if (!starCache || starCache.w !== cw || starCache.h !== ch || starCache.dpr !== DPR) starCache = buildStars(cw, ch, DPR);
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); ctx.globalAlpha = alpha;
    var pf = [0.25, 0.6, 1.0];
    for (var l = 0; l < 3; l++) ctx.drawImage(starCache.layers[l], x - starCache.pad + (shift || 0) * pf[l], y - starCache.pad, starCache.pw, starCache.ph);
    ctx.restore();
  };
