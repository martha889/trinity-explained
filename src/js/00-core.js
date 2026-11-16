(function () {
  "use strict";
  // ============================================================================
  // 00-core: data, palette C, state S, and the shared utility namespace U.
  // All source files are concatenated, in filename order, inside this one IIFE.
  // ============================================================================
  window.addEventListener("error", function (e) {
    document.documentElement.setAttribute("data-js-error", (e && e.message) || "error");
  });
  var D = JSON.parse(document.getElementById("trinity-data").textContent);
  var $ = function (id) { return document.getElementById(id); };
  // Reduced motion: the OS preference, or "&rm" in the hash (for testing, e.g. #t=120&rm).
  var RM = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || /[#&]rm(?:&|$)/.test(location.hash);

  // ---------- palette C (CSS custom properties, read once) ----------
  var C = {};
  (function () {
    var css = getComputedStyle(document.documentElement);
    ["bg", "panel", "panel-2", "line", "fg", "muted", "faint", "hot", "fire", "ember", "neutron", "pu",
      "he-fast", "he-slow", "al", "tamper", "trinitite", "alarm"].forEach(function (k) {
      C[k] = css.getPropertyValue("--" + k).trim();
    });
    C.panel2 = C["panel-2"]; C.heFast = C["he-fast"]; C.heSlow = C["he-slow"];
  })();

  // ---------- shared mutable state ----------
  // play: playback seconds (master clock); seeked: set by anything that jumps the clock.
  var S = { play: 0, playing: false, speed: 1, dirty: true, seeked: true, hashDirty: false };
  var TOTAL = D.meta.total;
  var PHASES = D.phases, EVENTS = D.events;

  // ---------- U: utilities shared by every module and scene ----------
  var U = {};
  U.clamp = function (x, a, b) { return x < a ? a : x > b ? b : x; };
  U.lerp = function (a, b, x) { return a + (b - a) * x; };
  U.invLerp = function (a, b, x) { return a === b ? 0 : (x - a) / (b - a); };
  U.remap = function (x, a0, a1, b0, b1, clamp) {
    var k = U.invLerp(a0, a1, x); if (clamp) k = U.clamp(k, 0, 1);
    return b0 + (b1 - b0) * k;
  };
  // Hermite smoothstep of x between edges a and b (GLSL semantics), 0..1.
  U.sstep = function (a, b, x) { var k = U.clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
  U.easeIn = function (x) { x = U.clamp(x, 0, 1); return x * x * x; };
  U.easeOut = function (x) { x = U.clamp(x, 0, 1); var k = 1 - x; return 1 - k * k * k; };
  U.easeInOut = function (x) { x = U.clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  U.easeOutQuad = function (x) { x = U.clamp(x, 0, 1); return 1 - (1 - x) * (1 - x); };
  U.easeOutExpo = function (x) { x = U.clamp(x, 0, 1); return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x); };
  // Log-scale helpers: position 0..1 of value v on a log axis from v0 to v1 (all > 0), and back.
  U.logPos = function (v, v0, v1) { return (Math.log(Math.max(v, 1e-300)) - Math.log(v0)) / (Math.log(v1) - Math.log(v0)); };
  U.logAt = function (x, v0, v1) { return Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * x); };
  U.logLerp = U.logAt;
  // Seeded PRNG (mulberry32). rng(seed) returns a function giving floats in [0, 1).
  U.rng = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  // Stateless hash noise: U.hash(i, seed) in [0, 1). Use it for scrub-safe per-index randomness.
  U.hash = function (i, seed) {
    var h = (Math.imul((i | 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ Math.imul((seed | 0) + 0x7F4A7C15, 0xC2B2AE35)) >>> 0;
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D) >>> 0; h ^= h >>> 12; h = Math.imul(h, 0x297A2D39) >>> 0; h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  };
  U.pad = function (n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; };
  U.esc = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); };
  U.bsearch = function (arr, x) { // last index with arr[i] <= x, or -1
    var lo = 0, hi = arr.length - 1, r = -1;
    while (lo <= hi) { var m = (lo + hi) >> 1; if (arr[m] <= x) { r = m; lo = m + 1; } else hi = m - 1; }
    return r;
  };
  U.hex = function (c) { // "#rrggbb" or "rgb(r,g,b)" -> [r,g,b]
    if (c.charAt(0) === "#") {
      if (c.length === 4) c = "#" + c[1] + c[1] + c[2] + c[2] + c[3] + c[3];
      return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    }
    var m = c.match(/[\d.]+/g) || [0, 0, 0];
    return [+m[0], +m[1], +m[2]];
  };
  U.rgba = function (c, a) { var v = U.hex(c); return "rgba(" + (v[0] | 0) + "," + (v[1] | 0) + "," + (v[2] | 0) + "," + U.clamp(a, 0, 1) + ")"; };
  U.mix = function (c1, c2, x) { // blend two colours, returns "rgb(r,g,b)"
    var a = U.hex(c1), b = U.hex(c2);
    return "rgb(" + Math.round(a[0] + (b[0] - a[0]) * x) + "," + Math.round(a[1] + (b[1] - a[1]) * x) + "," + Math.round(a[2] + (b[2] - a[2]) * x) + ")";
  };

  // ---------- number formatting ----------
  // Distance in metres -> "4.5 cm", "30 m", "9.1 km".
  U.fmtDist = function (m) {
    var a = Math.abs(m);
    function g(v) { return v >= 100 ? String(Math.round(v)) : v >= 10 ? String(+v.toFixed(1)) : String(+v.toFixed(2)); }
    if (a < 1e-3) return g(a * 1e6) + " µm";
    if (a < 1) return g(a * 100) + " cm";
    if (a < 1000) return g(a) + " m";
    return g(a / 1000) + " km";
  };
  // Scientific notation parts: 8.8e13 -> {m: "8.8", e: 13}
  U.sci = function (v, digits) {
    if (!(v > 0)) return { m: "0", e: 0 };
    var e = Math.floor(Math.log10(v)), m = v / Math.pow(10, e);
    m = +m.toFixed(digits == null ? 1 : digits);
    if (m >= 10) { m /= 10; e += 1; }
    return { m: String(m), e: e };
  };
  // Time units for the clock: [seconds, short, long singular, long plural]
  var UNITS = [[1e-9, "ns", "nanosecond", "nanoseconds"], [1e-6, "µs", "microsecond", "microseconds"],
    [1e-3, "ms", "millisecond", "milliseconds"], [1, "s", "second", "seconds"], [60, "min", "minute", "minutes"]];
  function sig4(v) { return v >= 1000 ? String(Math.round(v)) : v >= 100 ? v.toFixed(1) : v >= 10 ? v.toFixed(2) : v.toFixed(3); }
  // Clock text for physical time t (seconds from the instant the detonators fire), unit chosen automatically:
  // "T − 4.200 s", "T + 60.31 µs", "T + 16.00 ms", "T + 3 min 10 s". t = 0 gives "T = 0".
  U.fmtClock = function (t) {
    var a = Math.abs(t);
    if (a < 5e-13) return "T = 0";
    var sign = t < 0 ? "T − " : "T + ";
    if (a >= 60) {
      var s = Math.floor(a + 1e-9), mn = Math.floor(s / 60);
      return sign + mn + " min " + (s % 60) + " s";
    }
    var i = 0;
    while (i < 3 && a >= UNITS[i + 1][0] * 0.99995) i++;
    var v = a / UNITS[i][0], txt = sig4(v);
    if (parseFloat(txt) >= 1000 && i < 3) { i++; v = a / UNITS[i][0]; txt = sig4(v); }
    return sign + txt + " " + UNITS[i][1];
  };
  // Pure-seconds duration in words: 22e-9 -> "22 nanoseconds"
  U.fmtDurWords = function (s) {
    var i = 0;
    while (i < 4 && s >= UNITS[i + 1][0] * 0.99995) i++;
    var v = s / UNITS[i][0], txt = v >= 100 ? String(Math.round(v)) : v >= 10 ? String(Math.round(v)) : String(+v.toFixed(1));
    if (parseFloat(txt) >= 1000 && i < 4) return U.fmtDurWords(UNITS[i][0] * 1000);
    return txt + " " + (parseFloat(txt) === 1 ? UNITS[i][2] : UNITS[i][3]);
  };
  U.fmtPlay = function (p) { p = Math.max(0, Math.floor(p)); return Math.floor(p / 60) + ":" + U.pad(p % 60, 2); };
  // Energy in joules as TNT equivalent ("21 kt", "3.4 t"); "" when below one kilogram of TNT.
  U.fmtKt = function (j) { var kt = j / 4.184e12; return kt >= 10 ? Math.round(kt) + " kt" : kt >= 0.1 ? kt.toFixed(1) + " kt" : kt >= 1e-3 ? (kt * 1000).toFixed(kt >= 0.01 ? 0 : 1) + " t" : ""; };

  // ---------- time model ----------
  U.phaseIndexAt = function (play) {
    for (var i = 0; i < PHASES.length; i++) if (play < PHASES[i].play1) return i;
    return PHASES.length - 1;
  };
  U.phaseU = function (ph, play) { return U.clamp((play - ph.play0) / (ph.play1 - ph.play0), 0, 1); };
  // Physical time (s) for local progress u of phase ph, following the phase's map.
  U.physT = function (ph, u) {
    if (ph.map === "log") return ph.t0 * Math.pow(ph.t1 / ph.t0, u);
    if (ph.map === "lin") return ph.t0 + (ph.t1 - ph.t0) * u;
    return ph.t0;
  };
  U.physAt = function (play) { var ph = PHASES[U.phaseIndexAt(play)]; return U.physT(ph, U.phaseU(ph, play)); };
  // Physical seconds per screen second at a playback time, numerically (0 when the clock is held).
  U.slowRate = function (play) {
    var ph = PHASES[U.phaseIndexAt(play)], dur = ph.play1 - ph.play0;
    var e = dur * 1e-3, a = Math.max(ph.play0, play - e), b = Math.min(ph.play1, play + e);
    if (b <= a) return 0;
    return Math.abs(U.physT(ph, U.phaseU(ph, b)) - U.physT(ph, U.phaseU(ph, a))) / (b - a);
  };
  // "1 second on screen = 22 nanoseconds"
  U.slowWords = function (play) {
    var r = U.slowRate(play);
    if (r < 1e-12) return "Clock held: no time passes";
    return "1 second on screen = " + U.fmtDurWords(r);
  };
  U.eventAt = function (play) { // last event with event.play <= play (within a hair), or null
    var r = null;
    for (var i = 0; i < EVENTS.length; i++) if (EVENTS[i].play <= play + 0.01) r = EVENTS[i]; else break;
    return r;
  };
