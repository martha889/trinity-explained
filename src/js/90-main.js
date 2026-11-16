
  // ============================================================================
  // 90-main: Main, the frame loop. Owns time advance, event-crossing detection, seeks, scene enter/draw,
  // the snapshot cross-fade, FX, the instruments and the DOM readouts, plus the data-* test hooks.
  // ============================================================================
  var Main = (function () {
    var api = {};
    var f = { t: 0, u: 0, play: 0, dt: 0, playing: false, phase: PHASES[0], W: 0, H: 0, spanM: null, rm: RM };
    api.frame = f;
    var last = performance.now(), evCursor = 0, lastPi = -1, lastScene = null, needEnter = true;
    var fadeTimer = 0, FADE_DUR = 0.45, drawn = 0, lastSec = -1, lastClock = "", lastWall = "", booted = false;
    var snap = document.createElement("canvas"), snapCtx = snap.getContext("2d");
    var html = document.documentElement;
    var toastTimer = null;

    function showToast(e, fresh) {
      var t = $("toast");
      t.innerHTML = "<b>" + U.esc(e.short) + '</b><span class="t">' + U.esc(U.fmtClock(U.physT(PHASES[U.phaseIndexAt(e.play + 1e-6)], e.u))) + "</span><span>" + U.esc(e.detail) + "</span>";
      t.title = e.detail; t.setAttribute("data-ev", e.id);
      if (fresh) {
        t.classList.add("new", "enter"); clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove("new", "enter"); }, 3500);
      } else t.classList.remove("new", "enter");
    }
    function hms(sec) { sec = Math.floor(sec + 1e-6); var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return U.pad(h, 2) + ":" + U.pad(m, 2) + ":" + U.pad(s, 2); }
    function wallClock(t) { return hms(5 * 3600 + 29 * 60 + 45 + Math.floor(t + 1e-9)) + " MWT"; }

    function sampleInk() {
      var sw = 96, sh = 60, ic = document.createElement("canvas"); ic.width = sw; ic.height = sh;
      var ix = ic.getContext("2d"); ix.drawImage(canvas, 0, 0, sw, sh);
      var d = ix.getImageData(0, 0, sw, sh).data, n = sw * sh, mr = 0, mg = 0, mb = 0, i;
      for (i = 0; i < d.length; i += 4) { mr += d[i]; mg += d[i + 1]; mb += d[i + 2]; }
      mr /= n; mg /= n; mb /= n;
      var ink = 0;
      for (i = 0; i < d.length; i += 4) if (Math.abs(d[i] - mr) + Math.abs(d[i + 1] - mg) + Math.abs(d[i + 2] - mb) > 30) ink++;
      return ink;
    }
    function guard(name, fn) {
      try { fn(); } catch (err) {
        html.setAttribute("data-draw-error", name + ": " + err.message);
        if (window.console) console.error(err);
        return err;
      }
    }

    function frame(now, noSchedule) {
      var dt = U.clamp((now - last) / 1000, 0, 0.1); last = now;
      if (S.playing) {
        S.play += dt * S.speed;
        if (S.play >= TOTAL) { S.play = TOTAL; Transport.setPlaying(false); }
        S.dirty = true;
      }
      var seeked = S.seeked;
      if (seeked) {
        S.seeked = false; FX.reset(); Cv.resetCam(); needEnter = true; S.dirty = true;
        evCursor = 0; while (evCursor < EVENTS.length && EVENTS[evCursor].play <= S.play + 0.01) evCursor++;
        var cur = U.eventAt(S.play); if (cur) showToast(cur, false);
      }
      var pi = U.phaseIndexAt(S.play), ph = PHASES[pi], u = U.phaseU(ph, S.play), t = U.physT(ph, u);
      f.t = t; f.u = u; f.play = S.play; f.dt = dt; f.playing = S.playing; f.phase = ph; f.W = W; f.H = H; f.rm = RM;
      // events crossed while playing (never on seek)
      while (evCursor < EVENTS.length && EVENTS[evCursor].play <= S.play + 1e-9) {
        var ev = EVENTS[evCursor++];
        if (S.playing && !seeked) {
          showToast(ev, true);
          var sc = Scenes.get(ev.phase);
          if (sc && sc.onEvent) guard(ev.phase + " onEvent", function () { sc.onEvent(ev, f); });
        }
      }
      // header readouts
      var clock = U.fmtClock(t);
      if (clock !== lastClock) { lastClock = clock; $("clock").textContent = clock; }
      var wall = wallClock(t);
      if (wall !== lastWall) { lastWall = wall; $("wall").textContent = wall; }
      if (Math.floor(S.play) !== lastSec) { lastSec = Math.floor(S.play); $("ptime").textContent = U.fmtPlay(S.play) + " / " + U.fmtPlay(TOTAL); }
      if (pi !== lastPi) {
        if (lastPi >= 0 && !RM) { [$("phase"), $("phase-step")].forEach(function (el) { el.classList.remove("swap"); void el.offsetWidth; el.classList.add("swap"); }); }
        lastPi = pi;
        $("phase").textContent = ph.title; $("phase-sub").textContent = ph.subtitle; $("phase-step").textContent = "Chapter " + (pi + 1) + " of " + PHASES.length;
        $("scene-title").textContent = ph.title; $("scene-frame").textContent = "View: " + ph.view;
        Inst.setChapter(pi); Transport.setCurrentBand(pi);
      }
      Transport.tick(); Transport.writeHash(now);
      var fxAlive = FX.tick(dt);
      if (fadeTimer > 0) fadeTimer = RM ? 0 : Math.max(0, fadeTimer - dt);

      if (S.dirty || S.playing || fxAlive || fadeTimer > 0 || Cv.moving || drawn < 3) {
        Cv.applyResize();
        f.W = W; f.H = H;
        if (ph.id !== lastScene) {
          if (lastScene !== null && !RM && !Cv.resized && canvas.width > 0 && canvas.height > 0) {
            if (snap.width !== canvas.width || snap.height !== canvas.height) { snap.width = canvas.width; snap.height = canvas.height; }
            snapCtx.clearRect(0, 0, snap.width, snap.height); snapCtx.drawImage(canvas, 0, 0); fadeTimer = FADE_DUR;
          }
          lastScene = ph.id; needEnter = true; Cv.resetCam();
        }
        Cv.resized = false;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
        ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
        ctx.save();
        if (FX.shakeX || FX.shakeY) ctx.translate(FX.shakeX, FX.shakeY);
        f.spanM = null;
        var scene = Scenes.get(ph.id);
        guard(ph.id, function () {
          if (!scene) throw new Error("no scene registered");
          if (needEnter) { needEnter = false; if (scene.enter) scene.enter(f); }
          scene.draw(f);
        });
        FX.draw();
        ctx.restore();
        if (fadeTimer > 0 && !RM) { var fa = fadeTimer / FADE_DUR; ctx.save(); ctx.globalAlpha = fa * fa * (3 - 2 * fa); ctx.drawImage(snap, 0, 0, W, H); ctx.restore(); }
        FX.vignette(); FX.overlay();
        guard("instruments", function () { Inst.draw(f); Inst.updateExplainer(u); });
        S.dirty = false; drawn++;
        html.setAttribute("data-frames", String(drawn)); html.setAttribute("data-phase", ph.id);
        html.setAttribute("data-play", S.play.toFixed(3)); html.setAttribute("data-overflow", String(html.scrollWidth - html.clientWidth)); html.setAttribute("data-clock", clock);
        html.setAttribute("data-scroll-w", String(html.scrollWidth)); html.setAttribute("data-inner-w", String(window.innerWidth)); html.setAttribute("data-rm", RM ? "1" : "0");
        var ce = U.eventAt(S.play); html.setAttribute("data-event", ce ? ce.id : ""); html.setAttribute("data-toast", $("toast").getAttribute("data-ev") || "");
        if (drawn < 3) { S.dirty = true; setTimeout(function () { if (drawn < 3) { S.dirty = true; frame(performance.now()); } }, 20); }
        if (drawn === 3) { html.setAttribute("data-canvas-ink", String(sampleInk())); html.setAttribute("data-ready", "1"); }
        if (window.parent !== window) { // inside the smoke tool's true-size iframe: report layout facts to the wrapper page
          try { window.parent.postMessage({ trinity: 1, ready: html.getAttribute("data-ready") || "", err: html.getAttribute("data-draw-error") || html.getAttribute("data-js-error") || "", ink: html.getAttribute("data-canvas-ink") || "", phase: ph.id, sw: html.scrollWidth, iw: window.innerWidth, ev: ce ? ce.id : "", toast: $("toast").getAttribute("data-ev") || "" }, "*"); } catch (e2) { /* ignore */ }
        }
      }
      if (!noSchedule) requestAnimationFrame(frame);
    }

    var hashed = Transport.fromHash();
    if (!hashed) { S.play = 0; S.seeked = true; Transport.setPlaying(!RM); }
    Transport.setCurrentBand(0);
    setTimeout(function () { booted = true; }, 620);
    requestAnimationFrame(frame);
    if (S.advance) { // test hook: step N seconds of frames synchronously so playback, events and FX are exercised
      setTimeout(function () {
        // luminance of a 24 x 15 thumbnail of the canvas each step, to count bright/dark reversals per second (flicker)
        var lc = document.createElement("canvas"); lc.width = 24; lc.height = 15; var lx = lc.getContext("2d"), lum = [], fl = [], mx = 0;
        for (var i = 0, n = S.advance * 60; i < n; i++) {
          frame(last + 16.67, true);
          if (i % 3 === 0) {
            lx.drawImage(canvas, 0, 0, 24, 15); var d = lx.getImageData(0, 0, 24, 15).data, sum = 0;
            for (var j = 0; j < d.length; j += 4) sum += 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2];
            lum.push(sum / (d.length / 4)); fl.push(FX.flashAlpha());
          }
        }
        // reversals: direction changes of the smoothed luminance whose swing exceeds 25 of 255, counted in the busiest 1 s window
        var ext = [], dir = 0, ref = lum[0], k;
        for (k = 1; k < lum.length; k++) {
          var dv = lum[k] - ref;
          if (dir >= 0 && dv < -25) { ext.push(k); dir = -1; ref = lum[k]; }
          else if (dir <= 0 && dv > 25) { ext.push(k); dir = 1; ref = lum[k]; }
          else if ((dir >= 0 && lum[k] > ref) || (dir <= 0 && lum[k] < ref)) ref = lum[k];
        }
        var worst = 0, e0; for (e0 = 0; e0 < ext.length; e0++) { var c = 0; for (k = e0; k < ext.length && ext[k] - ext[e0] <= 20; k++) c++; worst = Math.max(worst, c); }
        var st = FX.stats; mx = 0; for (k = 0; k < fl.length; k++) mx = Math.max(mx, fl[k]);
        html.setAttribute("data-flash", [st.n, st.ignored, st.peak.toFixed(3), st.rise.toFixed(2), st.decay.toFixed(2), mx.toFixed(3)].join(","));
        html.setAttribute("data-flicker", String(Math.max(0, worst - 1)));
        Transport.setPlaying(false);   // stop here, so the page does not keep playing for the rest of the virtual-time budget
        html.setAttribute("data-advanced", "1");
      }, 80);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { S.dirty = true; });
    return api;
  })();
})();
