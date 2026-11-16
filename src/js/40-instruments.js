
  // ============================================================================
  // 40-instruments: Inst, the time microscope, the scale ladder, the energy bar and the Explainer panel.
  // Everything is driven by data (D.phases, Sim, f.spanM); nothing is typed in per scene.
  // ============================================================================
  var Inst = (function () {
    var api = {};
    var icv = $("inst"), ictx = icv.getContext("2d");
    var iw = 0, ih = 0, idpr = 1, iPending = true;
    function iResize() { iPending = true; S.dirty = true; }
    if (window.ResizeObserver) new ResizeObserver(iResize).observe(icv);
    function iApply() {
      if (!iPending) return; iPending = false;
      var r = icv.getBoundingClientRect(); idpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
      iw = Math.max(1, r.width); ih = Math.max(1, r.height);
      var cw = Math.round(iw * idpr), ch = Math.round(ih * idpr);
      if (icv.width !== cw || icv.height !== ch) { icv.width = cw; icv.height = ch; }
    }

    var PAD = 14, T_LO = 1e-9, T_HI = 600;
    var CH_COLOR = ["#2a6fa8", "#2a6fa8", "#7a6bd0", "#7a6bd0", "#7a6bd0", "#e2481f", "#ffa23a", "#b38a5a", "#b38a5a"];
    function tx(t) { return PAD + U.clamp(U.logPos(Math.max(t, T_LO), T_LO, T_HI), 0, 1) * (iw - 2 * PAD); }
    function hline(x0, x1, y, color, a, w) { ictx.save(); ictx.globalAlpha = a == null ? 1 : a; ictx.strokeStyle = color; ictx.lineWidth = w || 1; ictx.beginPath(); ictx.moveTo(x0, y); ictx.lineTo(x1, y); ictx.stroke(); ictx.restore(); }
    function vtick(x, y0, y1, color, a, w) { ictx.save(); ictx.globalAlpha = a == null ? 1 : a; ictx.strokeStyle = color; ictx.lineWidth = w || 1; ictx.beginPath(); ictx.moveTo(Math.round(x) + 0.5, y0); ictx.lineTo(Math.round(x) + 0.5, y1); ictx.stroke(); ictx.restore(); }
    function sec(label, y, right) {
      Cv.label(label, PAD, y, C.muted);
      if (right) Cv.text(right, iw - PAD, y, { size: 12, color: C.fg, font: FONT_MONO, align: "right", weight: 500 });
    }

    function timeMicroscope(f) {
      sec("TIME MICROSCOPE", 14, "log scale, 1 ns to 10 min");
      Cv.text(U.fmtClock(f.t).replace("T = 0", "T = 0"), PAD, 42, { size: 22, color: C.hot, font: FONT_MONO, weight: 500 });
      Cv.text(U.slowWords(f.play), PAD, 60, { size: 12.5, color: C.fire, weight: 500 });
      var yR = 84, k, d;
      // chapter bands on the ruler
      for (var i = 0; i < PHASES.length; i++) {
        var p = PHASES[i]; if (p.map === "hold" || p.t1 <= 0) continue;
        var x0 = tx(Math.max(p.t0, T_LO)), x1 = tx(p.t1), cur = p.index === f.phase.index;
        ictx.fillStyle = U.rgba(CH_COLOR[i], cur ? 0.9 : 0.4); ictx.fillRect(x0, yR - 12, Math.max(1, x1 - x0 - 1), 8);
        if (x1 - x0 > 14) Cv.text(String(i + 1), (x0 + x1) / 2, yR - 5.5, { size: 9.5, weight: 700, color: cur ? "#10141c" : "#aab4c2", font: FONT_MONO, align: "center" });
      }
      hline(PAD, iw - PAD, yR, C.faint, 1, 1);
      for (var e = -9; e <= 2; e++) {
        var x = tx(Math.pow(10, e)); vtick(x, yR, yR + (e % 3 === 0 ? 7 : 4), C.muted, 0.9);
        for (d = 2; d <= 9 && e < 2; d++) { var tm = d * Math.pow(10, e); if (tm <= T_HI) vtick(tx(tm), yR, yR + 2.5, C.faint, 0.8); }
      }
      var labs = [[1e-9, "1 ns"], [1e-6, "1 µs"], [1e-3, "1 ms"], [1, "1 s"]];
      for (k = 0; k < labs.length; k++) Cv.text(labs[k][1], tx(labs[k][0]), yR + 19, { size: 10.5, color: C.muted, font: FONT_MONO, align: k === 0 ? "left" : "center" });
      vtick(tx(600), yR, yR + 7, C.muted, 0.9); Cv.text("10 min", iw - PAD, yR + 19, { size: 10.5, color: C.muted, font: FONT_MONO, align: "right" });
      // cursor
      var cx = tx(f.t);
      var g = ictx.createLinearGradient(0, yR - 20, 0, yR + 12); g.addColorStop(0, U.rgba(C.fire, 0)); g.addColorStop(1, U.rgba(C.fire, 0.35));
      ictx.fillStyle = g; ictx.fillRect(cx - 4, yR - 20, 8, 32);
      vtick(cx, yR - 22, yR + 10, C.hot, 1, 2);
      ictx.fillStyle = C.hot; ictx.beginPath(); ictx.moveTo(cx - 5, yR - 24); ictx.lineTo(cx + 5, yR - 24); ictx.lineTo(cx, yR - 17); ictx.closePath(); ictx.fill();
      if (f.t <= 0) Cv.text(f.t < 0 ? "before the detonators fire" : "clock held at zero", iw - PAD, 42, { size: 11, color: C.muted, font: FONT_MONO, align: "right" });
    }

    var LAND = [ // metres, label, row, align
      [0.091, "Pu core", 0, "left"], [1.5, "Gadget", 1, "center"], [30, "Tower", 0, "center"],
      [9100, "Shelters", 0, "right"], [12000, "Cloud top", 1, "center"], [16000, "Base camp", 2, "right"]
    ];
    function scaleLadder(f) {
      var y0 = 146, yB = 198, lo = 0.01, hi = 1e5, w = iw - 2 * PAD;
      function sx(m) { return PAD + U.clamp(U.logPos(m, lo, hi), 0, 1) * w; }
      sec("SCALE LADDER", y0, f.spanM ? "view " + U.fmtDist(f.spanM) + " wide" : "");
      if (f.spanM) {
        var xv = sx(f.spanM);
        var g = ictx.createLinearGradient(PAD, 0, xv, 0); g.addColorStop(0, U.rgba(C.fire, 0.15)); g.addColorStop(1, U.rgba(C.fire, 0.85));
        ictx.fillStyle = g; ictx.fillRect(PAD, yB - 4, Math.max(1, xv - PAD), 7);
        vtick(xv, yB - 10, yB + 6, C.hot, 1, 2);
      }
      hline(PAD, iw - PAD, yB + 5, C.faint, 1, 1);
      var decs = ["1 cm", "10 cm", "1 m", "10 m", "100 m", "1 km", "10 km", "100 km"];
      for (var e = 0; e < decs.length; e++) {
        var x = sx(lo * Math.pow(10, e)); vtick(x, yB + 5, yB + 10, C.muted, 0.9);
        Cv.text(decs[e], e === 0 ? x : e === decs.length - 1 ? x : x, yB + 22, { size: 10, color: C.muted, font: FONT_MONO, align: e === 0 ? "left" : e === decs.length - 1 ? "right" : "center" });
      }
      for (var i = 0; i < LAND.length; i++) {
        var L = LAND[i], lx = sx(L[0]), ly = yB - 12 - L[2] * 11;
        vtick(lx, ly + 2, yB + 5, C.pu, 0.5);
        var near = f.spanM && L[0] <= f.spanM * 1.5 && L[0] >= f.spanM / 40;
        Cv.text(L[1], lx + (L[3] === "left" ? 3 : L[3] === "right" ? -3 : 0), ly, { size: 10.5, color: near ? C.hot : C.muted, font: FONT_BODY, weight: 500, align: L[3] });
      }
    }

    function energyBar(f) {
      var yB = 262, lo = 1e-11, hi = 1e14, w = iw - 2 * PAD, E = Sim.energyJ(f.t);
      sec("ENERGY RELEASED", 244, "");
      var tag = E <= 0 ? "none yet" : "";
      if (E > 0) {
        var kt = U.fmtKt(E), tail = kt ? " J \u2248 " + kt : " J";
        Cv.sciText(E, iw - PAD - Cv.measure(tail, { size: 12, font: FONT_MONO }), 244, { size: 12, color: C.hot, digits: 1, align: "right" });
        Cv.text(tail, iw - PAD, 244, { size: 12, color: C.hot, font: FONT_MONO, align: "right" });
      } else Cv.text(tag, iw - PAD, 244, { size: 12, color: C.muted, font: FONT_MONO, align: "right" });
      ictx.fillStyle = U.rgba(C.line, 0.7); ictx.fillRect(PAD, yB, w, 10);
      if (E > 0) {
        var wf = U.clamp(U.logPos(E, lo, hi), 0, 1) * w;
        var g = ictx.createLinearGradient(PAD, 0, PAD + w, 0); g.addColorStop(0, C.ember); g.addColorStop(0.6, C.fire); g.addColorStop(1, C.hot);
        ictx.fillStyle = g; ictx.fillRect(PAD, yB, Math.max(2, wf), 10);
        Cv.glow(PAD + wf, yB + 5, 14, C.fire, 0.5);
      }
      for (var e = -11; e <= 14; e++) {
        var x = PAD + U.logPos(Math.pow(10, e), lo, hi) * w; vtick(x, yB + 10, yB + (e % 5 === 0 ? 16 : 13), C.muted, 0.7);
      }
      [[-10, "10"], [-5, "10"], [0, "1"], [5, "10"], [10, "10"]].forEach(function (a) {
        var x = PAD + U.logPos(Math.pow(10, a[0]), lo, hi) * w;
        if (a[1] === "1") Cv.text("1 J", x, yB + 29, { size: 10, color: C.muted, font: FONT_MONO, align: "center" });
        else { Cv.text(a[1], x - 3, yB + 29, { size: 10, color: C.muted, font: FONT_MONO, align: "center" }); Cv.text(String(a[0]).replace("-", "−"), x + 6, yB + 24, { size: 7.5, color: C.muted, font: FONT_MONO, align: "left" }); }
      });
      var xf = PAD + U.logPos(3.2e-11, lo, hi) * w, xy = PAD + U.logPos(Sim.params.yieldJ, lo, hi) * w;
      vtick(xf, yB - 5, yB + 10, C.neutron, 0.9); Cv.text("one fission", xf + 3, yB - 4, { size: 10, color: C.neutron, font: FONT_BODY });
      vtick(xy, yB - 5, yB + 10, C.hot, 0.9); Cv.text("the yield", xy - 3, yB - 4, { size: 10, color: C.hot, font: FONT_BODY, align: "right" });
    }

    // Draw all three instruments for frame f ({t, play, phase, spanM}).
    api.draw = function (f) {
      iApply();
      var saved = ctx; ctx = ictx;
      try {
        ictx.setTransform(idpr, 0, 0, idpr, 0, 0); ictx.clearRect(0, 0, iw, ih);
        ictx.fillStyle = C.panel; ictx.fillRect(0, 0, iw, ih);
        timeMicroscope(f);
        hline(PAD, iw - PAD, 130, C.line, 0.6); hline(PAD, iw - PAD, 230, C.line, 0.6);
        scaleLadder(f);
        energyBar(f);
      } finally { ctx = saved; }
    };

    // ---------- Explainer panel ----------
    // Paragraphs appear (display) when their u is reached. The scroll area only ever contains revealed paragraphs, and it
    // scrolls to paragraph boundaries so the newest one is fully visible and no line is ever cut in half. Key-number rows live
    // in their own footer (pinned, never overlapping the text); only the newest few are shown so the footer stays compact.
    var exPhase = -1, paraEls = [], keyEls = [], shownPara = -1, shownKeys = -1, shownKeyN = -1;
    var elParas = $("ex-paras"), elKeys = $("ex-keys"), elScroll = $("ex-scroll"), elBody = $("ex-body");
    function placeScroll(instant) {
      var np = shownPara, sc = elScroll;
      elParas.style.paddingBottom = "0px";
      if (np < 0 || sc.scrollHeight <= sc.clientHeight + 1) { sc.scrollTop = 0; sc.classList.remove("scrolled"); return; }
      var nw = paraEls[np].el, bottom = nw.offsetTop + nw.offsetHeight + 4, h = sc.clientHeight, i = np;
      while (i > 0 && bottom - paraEls[i - 1].el.offsetTop <= h - 10) i--;
      var target = i === 0 ? 0 : Math.max(0, paraEls[i].el.offsetTop - 10), maxS = sc.scrollHeight - h;
      if (target > maxS) {  // not enough text below to reach a paragraph boundary: snap to a whole line instead, never a half line
        var lh = parseFloat(getComputedStyle(nw).lineHeight) || 21, y = maxS, snapped = y, k, el, top;
        for (k = 0; k <= np; k++) {
          el = paraEls[k].el; top = el.offsetTop;
          if (y > top - 1 && y < top + el.offsetHeight) { snapped = top + Math.ceil((y - top) / lh - 0.02) * lh; break; }
          if (top > y) { snapped = top; break; }
        }
        elParas.style.paddingBottom = Math.max(0, Math.ceil(snapped - maxS)) + "px";
        target = snapped;
      }
      sc.classList.toggle("scrolled", target > 0);
      if (instant || RM || !sc.scrollTo) sc.scrollTop = target; else sc.scrollTo({ top: target, behavior: "smooth" });
    }
    function keyRoom() { // how many key rows fit under at least ~130 px of text
      if (window.innerWidth <= 960) return 99;
      return U.clamp(Math.floor((elBody.clientHeight - 130 - 40) / 24), 2, 8);
    }
    function showKeys(nk, animateNew) {
      var room = keyRoom(), first = Math.max(0, nk - room + 1);
      for (var i = 0; i < keyEls.length; i++) {
        var on = i <= nk && i >= first, el = keyEls[i].el;
        if (on && !el.classList.contains("on") && animateNew && i === nk) el.classList.add("anim");
        el.classList.toggle("on", on);
      }
      shownKeyN = room;
    }
    if (window.ResizeObserver) {
      var exRo = new ResizeObserver(function () { placeScroll(true); if (shownKeys >= 0) showKeys(shownKeys); });
      exRo.observe(elBody); exRo.observe(elParas); exRo.observe(elScroll);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { placeScroll(true); });
    api.setChapter = function (idx) {
      if (idx === exPhase) return;
      exPhase = idx; shownPara = -1; shownKeys = -1;
      var ph = PHASES[idx], c = D.content[ph.id];
      $("ex-title").textContent = ph.title; $("ex-num").textContent = "Chapter " + (idx + 1) + " of " + PHASES.length;
      elParas.innerHTML = ""; elKeys.innerHTML = ""; paraEls = []; keyEls = [];
      c.paragraphs.forEach(function (p) {
        var el = document.createElement("p"); el.className = "rv"; el.innerHTML = p.html; elParas.appendChild(el); paraEls.push({ el: el, u: p.u });
      });
      c.keys.forEach(function (k) {
        var row = document.createElement("div"); row.className = "krow";
        var chip = k.url ? '<a class="chip" data-tag="' + k.tag + '" href="' + U.esc(k.url) + '" target="_blank" rel="noopener" title="Source: ' + U.esc(k.source) + '">' + k.tag + "</a>"
          : '<span class="chip" data-tag="' + k.tag + '" title="' + (k.source ? "Source: " + U.esc(k.source) : "") + '">' + k.tag + "</span>";
        row.innerHTML = '<span class="k">' + U.esc(k.label) + '</span><span class="v"><span class="val">' + U.esc(k.value) + "</span>" + chip + "</span>";
        elKeys.appendChild(row); keyEls.push({ el: row, u: k.u });
      });
      elScroll.scrollTop = 0; elScroll.classList.remove("scrolled");
    };
    // Reveal paragraphs and key rows whose u has been reached.
    api.updateExplainer = function (u) {
      var np = -1, i;
      for (i = 0; i < paraEls.length; i++) if (u >= paraEls[i].u - 1e-9) np = i;
      if (np !== shownPara) {
        var smooth = shownPara >= 0 && np === shownPara + 1;
        for (i = 0; i < paraEls.length; i++) { paraEls[i].el.classList.toggle("on", i <= np); paraEls[i].el.classList.toggle("old", i < np); paraEls[i].el.classList.toggle("anim", smooth && i === np); }
        shownPara = np; placeScroll(!smooth);
      }
      var nk = -1;
      for (i = 0; i < keyEls.length; i++) if (u >= keyEls[i].u - 1e-9) nk = i;
      if (nk !== shownKeys || shownKeyN !== keyRoom()) { var an = nk === shownKeys + 1 && shownKeys >= 0 && !RM; shownKeys = nk; showKeys(nk, an); placeScroll(true); }
    };
    return api;
  })();
