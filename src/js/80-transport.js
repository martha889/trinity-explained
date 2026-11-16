
  // ============================================================================
  // 80-transport: Transport, play/pause, scrubber, speed, chapters and events, the single keydown listener,
  // and the location hash (read on load / hashchange, written back, throttled, while paused).
  // ============================================================================
  var Transport = (function () {
    var api = {};
    var bands = $("bands"), ticks = $("ticks"), scrub = $("scrub"), jump = $("jump");
    var appEl = $("app"), transport = document.querySelector(".transport");
    var GROUP = ["pre", "pre", "dev", "dev", "dev", "fire", "fire", "cloud", "cloud"];
    var tickEls = [], bandEls = [];

    PHASES.forEach(function (p, i) {
      var d = document.createElement("div");
      d.className = "g-" + GROUP[i];
      d.style.width = ((p.play1 - p.play0) / TOTAL * 100) + "%";
      d.title = (i + 1) + ". " + p.title;
      d.innerHTML = "<span>" + (i + 1) + "</span>";
      bands.appendChild(d); bandEls.push(d);
    });
    EVENTS.forEach(function (e) {
      if (!(e.major || e.u === 0)) return;     // ticks only for major events and chapter starts; the rest stay in the Jump menu and the arrow keys
      var x = e.play / TOTAL * 100;
      var t = document.createElement("i"); t.style.left = x + "%"; if (e.major) t.className = "major"; ticks.appendChild(t);
      tickEls.push({ el: t, p: e.play, id: e.id, on: false, x: x });
    });
    jump.innerHTML = PHASES.map(function (p, i) {
      var opts = EVENTS.filter(function (e) { return e.phase === p.id; }).map(function (e) {
        var ph = p, t = U.physT(ph, e.u);
        return '<option value="e:' + e.id + '">' + U.esc(U.fmtClock(t) + "  " + e.short) + "</option>";
      }).join("");
      return '<optgroup label="' + (i + 1) + ". " + U.esc(p.title) + '"><option value="p:' + p.id + '">' + (i + 1) + ". " + U.esc(p.title) + " (start)</option>" + opts + "</optgroup>";
    }).join("");
    jump.insertAdjacentHTML("afterbegin", '<option value="">Jump to&hellip;</option>');
    jump.value = "";
    scrub.max = TOTAL;

    // ----- play / seek -----
    api.setPlaying = function (p) {
      S.playing = !!p && S.play < TOTAL;
      $("play-text").textContent = S.playing ? "Pause" : "Play";
      $("play").setAttribute("aria-label", S.playing ? "Pause" : "Play");
      $("play").classList.toggle("is-playing", S.playing);
      if (!S.playing) S.hashDirty = true;
      S.dirty = true;
    };
    // Jump the clock. Playback continues if keepPlaying; the engine clears FX, resets the camera and
    // re-enters the scene without firing events.
    api.seek = function (play, keepPlaying) {
      S.play = U.clamp(play, 0, TOTAL); S.seeked = true; S.dirty = true; S.hashDirty = true;
      scrub.value = S.play;
      if (!keepPlaying) api.setPlaying(false);
    };
    api.seekPhase = function (id, keep) { var p = PHASES.filter(function (x) { return x.id === id; })[0]; if (p) api.seek(p.play0 + 0.002, keep); };
    api.seekEvent = function (id, keep) { var e = EVENTS.filter(function (x) { return x.id === id; })[0]; if (e) api.seek(Math.min(TOTAL, e.play + 0.002), keep); };
    api.stepEvent = function (dir) {
      var i, target = null;
      if (dir > 0) { for (i = 0; i < EVENTS.length; i++) if (EVENTS[i].play > S.play + 0.05) { target = EVENTS[i]; break; } }
      else { for (i = EVENTS.length - 1; i >= 0; i--) if (EVENTS[i].play < S.play - 0.6) { target = EVENTS[i]; break; } }
      if (target) api.seek(target.play + 0.002, S.playing); else if (dir < 0) api.seek(0, S.playing);
    };
    function togglePlay() { if (S.play >= TOTAL) api.seek(0, true); api.setPlaying(!S.playing); }
    $("play").addEventListener("click", togglePlay);
    $("prev").addEventListener("click", function () { api.stepEvent(-1); });
    $("next").addEventListener("click", function () { api.stepEvent(1); });
    var speedBtns = Array.prototype.slice.call(document.querySelectorAll(".speed button"));
    function setSpeed(s) { S.speed = s; speedBtns.forEach(function (o) { o.setAttribute("aria-pressed", parseFloat(o.getAttribute("data-s")) === s); }); }
    speedBtns.forEach(function (b) { b.addEventListener("click", function () { setSpeed(parseFloat(b.getAttribute("data-s"))); }); });
    jump.addEventListener("change", function () {
      var v = jump.value; jump.value = ""; jump.blur();
      if (v.indexOf("p:") === 0) api.seekPhase(v.slice(2), S.playing); else if (v.indexOf("e:") === 0) api.seekEvent(v.slice(2), S.playing);
    });
    scrub.addEventListener("input", function () { api.seek(parseFloat(scrub.value), S.playing); });

    // ----- hash: #t=<playback seconds>[&play[&adv=N]], #<phase-id>, #<phase-id>@<u> -----
    api.fromHash = function () {
      var h = (location.hash || "").slice(1).replace(/&rm(?=&|$)/, "");
      if (!h) return false;
      var m = /^t=([0-9]+(?:\.[0-9]+)?)(&play)?(?:&adv=([0-9]+))?$/i.exec(h);   // "&play" keeps playing; "&adv=N" steps N seconds of frames synchronously (tests)
      if (m) { api.seek(parseFloat(m[1]), !!m[2] && !RM); if (m[2] && !RM) api.setPlaying(true); S.advance = m[3] ? parseInt(m[3], 10) : 0; return true; }
      m = /^([a-z0-9-]+)(?:@([0-9.]+))?$/i.exec(h);
      var p = m && PHASES.filter(function (x) { return x.id === m[1]; })[0];
      if (p) { api.seek(p.play0 + (m[2] ? U.clamp(parseFloat(m[2]), 0, 1) * (p.play1 - p.play0) : 0.002), false); return true; }
      return false;
    };
    window.addEventListener("hashchange", api.fromHash);
    var lastHashWrite = 0;
    api.writeHash = function (now) { // called each frame; throttled; only while paused
      if (S.playing || !S.hashDirty || now - lastHashWrite < 400) return;
      lastHashWrite = now; S.hashDirty = false;
      try { history.replaceState(null, "", "#t=" + S.play.toFixed(2) + (RM && /[#&]rm(?:&|$)/.test(location.hash) ? "&rm" : "")); } catch (e) { /* file:// restrictions */ }
    };

    // ----- per-frame UI sync -----
    var uiQ = -1, uiPQ = -1;
    api.tick = function () {
      var pq = Math.round(U.clamp(S.play / TOTAL, 0, 1) * 2000);
      if (pq !== uiPQ) {
        uiPQ = pq;
        $("played").style.transform = "scaleX(" + (pq / 2000) + ")"; $("mbar").style.transform = "scaleX(" + (pq / 2000) + ")";
        $("progress").style.left = "calc(" + (pq / 20) + "% - 1px)";
      }
      for (var i = 0; i < tickEls.length; i++) { var t = tickEls[i], on = t.p <= S.play + 0.01; if (on !== t.on) { t.on = on; t.el.classList.toggle("passed", on); } }
      if (document.activeElement !== scrub) scrub.value = S.play;
    };
    api.setCurrentBand = function (idx) { bandEls.forEach(function (b, i) { b.classList.toggle("cur", i === idx); }); };

    // ----- scrubber tooltip and click targets -----
    var wrap = scrub.parentNode, tip = $("scrub-tip"), tipB = tip.querySelector("b"), tipS = tip.querySelector("span");
    var tipPending = null, tipRaf = 0, hoverBand = -1, down = null;
    function nearestTick(px, width, ry) {
      if (ry < 6 || ry > 30) return null;
      var best = null, bd = 6;
      for (var i = 0; i < tickEls.length; i++) { var d = Math.abs(tickEls[i].x / 100 * width - px); if (d <= bd) { bd = d; best = tickEls[i]; } }
      return best;
    }
    function flushTip() {
      tipRaf = 0; var m = tipPending; if (!m) return;
      var r = wrap.getBoundingClientRect(), w = r.width || 1;
      var px = U.clamp(m.x - r.left, 0, w), ry = m.y - r.top, p = px / w * TOTAL, bi = U.phaseIndexAt(p), tk = nearestTick(px, w, ry);
      var ev = tk ? EVENTS.filter(function (x) { return x.id === tk.id; })[0] : null;
      tipB.textContent = U.fmtClock(U.physAt(p));
      tipS.textContent = (tk && ev ? "▸ " + ev.short + " · " : "") + "Chapter " + (bi + 1) + " · " + PHASES[bi].title + (tk ? "  (click to jump)" : "");
      var half = tip.offsetWidth / 2; tip.style.left = U.clamp(px, half, w - half) + "px"; tip.classList.add("show");
      if (bi !== hoverBand) { if (bandEls[hoverBand]) bandEls[hoverBand].classList.remove("hover"); hoverBand = bi; bandEls[bi].classList.add("hover"); }
    }
    function moveTip(e) { tipPending = { x: e.clientX, y: e.clientY }; if (!tipRaf) tipRaf = requestAnimationFrame(flushTip); }
    function hideTip() { tipPending = null; tip.classList.remove("show"); if (bandEls[hoverBand]) bandEls[hoverBand].classList.remove("hover"); hoverBand = -1; }
    scrub.addEventListener("pointermove", moveTip); scrub.addEventListener("pointerenter", moveTip);
    scrub.addEventListener("pointerleave", hideTip); scrub.addEventListener("pointercancel", hideTip);
    scrub.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY }; moveTip(e); });
    scrub.addEventListener("pointerup", function (e) { if (e.pointerType && e.pointerType !== "mouse") setTimeout(hideTip, 600); });
    scrub.addEventListener("click", function (e) {
      var moved = down ? Math.abs(e.clientX - down.x) + Math.abs(e.clientY - down.y) : 99; down = null;
      if (moved > 4) { scrub.blur(); return; }
      var r = wrap.getBoundingClientRect(), tk = nearestTick(e.clientX - r.left, r.width, e.clientY - r.top);
      if (tk) api.seekEvent(tk.id, S.playing);
      scrub.blur();
    });

    // ----- help, theatre -----
    var pop = $("shortcuts"), helpBtn = $("help"), theatreBtn = $("theatre");
    function setHelp(on) { pop.classList.toggle("open", on); helpBtn.setAttribute("aria-expanded", on); }
    function setTheatre(on) { appEl.classList.toggle("theatre", on); theatreBtn.setAttribute("aria-pressed", on); S.dirty = true; setTimeout(function () { S.dirty = true; syncBar(); }, 60); }
    helpBtn.addEventListener("click", function (e) { e.stopPropagation(); setHelp(!pop.classList.contains("open")); });
    theatreBtn.addEventListener("click", function () { setTheatre(!appEl.classList.contains("theatre")); });
    document.addEventListener("click", function (e) { if (pop.classList.contains("open") && !pop.contains(e.target) && e.target !== helpBtn) setHelp(false); });
    var barH = -1;
    function syncBar() { var h = Math.ceil(transport.getBoundingClientRect().height); if (h > 0 && h !== barH) { barH = h; document.documentElement.style.setProperty("--bar-h", h + "px"); } }
    if (window.ResizeObserver) new ResizeObserver(syncBar).observe(transport);
    window.addEventListener("resize", syncBar); syncBar();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(syncBar);

    // ----- the single keydown listener -----
    var SPEED_KEY = { "1": 0.5, "2": 1, "3": 2, "4": 4 };
    document.addEventListener("keydown", function (e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      var tag = (e.target && e.target.tagName) || "";
      if (e.key === "Escape") { if (pop.classList.contains("open")) setHelp(false); else if (appEl.classList.contains("theatre")) setTheatre(false); return; }
      if (tag === "SELECT" || tag === "TEXTAREA" || (tag === "INPUT" && e.target !== scrub)) return;
      if (tag === "BUTTON" && (e.key === " " || e.key === "Enter")) return;
      if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); api.stepEvent(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); api.stepEvent(-1); }
      else if (SPEED_KEY[e.key]) setSpeed(SPEED_KEY[e.key]);
      else if (e.key === "f" || e.key === "F") { e.preventDefault(); setTheatre(!appEl.classList.contains("theatre")); }
      else if (e.key === "?") { e.preventDefault(); setHelp(!pop.classList.contains("open")); }
    });
    return api;
  })();
