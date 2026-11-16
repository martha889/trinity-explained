
  // ============================================================================
  // 10-sim: Sim, interpolators over the build-time physics tables (sim/trinity_sim.py).
  // Every function is a pure function of physical time t (seconds from the firing signal).
  // ============================================================================
  var Sim = (function () {
    var T = D.sim.t, SER = D.sim.series, P = D.sim.params, N = T.length;
    var A_TS = Math.pow(P.yieldJ / P.rho0, 0.2);

    function sample(name, t) {
      var s = SER[name], v = s.v;
      if (t <= T[0]) return v[0];
      if (t >= T[N - 1]) return v[N - 1];
      var i = U.bsearch(T, t), ta = T[i], tb = T[i + 1], va = v[i], vb = v[i + 1];
      if (s.interp === "log" && va > 0 && vb > 0) {
        var f = ta > 0 ? Math.log(t / ta) / Math.log(tb / ta) : (t - ta) / (tb - ta);
        return Math.exp(Math.log(va) + f * (Math.log(vb) - Math.log(va)));
      }
      return va + (vb - va) * (t - ta) / (tb - ta);
    }
    // Derived helpers that are not tabulated still carry a provenance tag.
    var EXTRA = {
      puFissionedKg: { tag: "C", unit: "kg", note: "Fissions = energy / 200 MeV, times the mass of one Pu-239 atom" },
      blastArrival: { tag: "C", unit: "s", note: "Taylor-Sedov to ~1.1 c, then sound speed" },
      measuredR: { tag: "M", unit: "m", note: "Taylor 1950, Table 1, from Mack's film" },
      _lens: { tag: "I", unit: "", note: "Illustrative lens model: two wave speeds, not a hydrocode" }
    };
    function fn(name) { return function (t) { return sample(name, t); }; }

    var api = {
      params: P,
      measuredR: P.measuredR,         // Taylor's measured points [[t_s, R_m], ...]
      lens: P.lens,
      // Provenance: Sim.tag("shockR") -> "C" | "I"; Sim.note("shockR") -> one-line source.
      tag: function (name) { return SER[name] ? SER[name].tag : (EXTRA[name] || EXTRA._lens).tag; },
      note: function (name) { return SER[name] ? SER[name].note : (EXTRA[name] || EXTRA._lens).note; },
      unit: function (name) { return SER[name] ? SER[name].unit : (EXTRA[name] || EXTRA._lens).unit; },
      coreRadius: fn("coreRadius"),   // m, plutonium core
      density: fn("density"),         // core density / normal density
      k: fn("k"),                     // multiplication factor
      generation: fn("generation"),   // 0..80
      energyJ: fn("energyJ"),         // J released so far (0 before the neutron burst)
      tempK: fn("tempK"),             // K, hottest region
      shockR: fn("shockR"),           // m, Taylor-Sedov then sound speed
      fireballR: fn("fireballR"),     // m, glowing sphere (stalls after breakaway)
      frontGlow: fn("frontGlow"),   // 1 before 15 ms (luminous shock front), 0 by 60 ms
      cloudTopM: fn("cloudTopM"),     // m above ground
      // Seconds after the flash at which the blast front reaches a given distance (m).
      blastArrival: function (d) {
        if (d <= 0) return 0;
        if (d <= P.rBreakawayShock) return Math.pow(d / A_TS, 2.5);
        return P.tBreakawayShock + (d - P.rBreakawayShock) / P.cSound;
      },
      // Kilograms of plutonium fissioned by time t.
      puFissionedKg: function (t) { return sample("energyJ", t) / P.eFission * 239.05e-3 / 6.022e23; },
      // Lens model, normalised: detonator at the origin, front speed in the fast explosive = 1,
      // lens exit at radius 1. t=0 .. lens.t_lens spans tau 0..1.
      lensTau: function (t) { return U.clamp(t / P.lens.t_lens, 0, 1.6); },
      // Thickness of the slow insert at angle theta from the lens axis.
      lensInsertW: function (theta) {
        var L = P.lens, a = Math.abs(theta);
        if (a >= L.theta_max) return 0;
        var c = Math.cos(Math.PI * a / (2 * L.theta_max));
        return L.insert_w * c * c;
      },
      // Front radius at angle theta and normalised time tau (1 = the on-axis front reaches the lens exit), through fast, then
      // slow, then fast explosive. lens.fast_speed = lens lengths per unit tau in the fast explosive (about 1.18), so that the
      // delayed on-axis front reaches radius 1 at tau = 1, exactly when the merged converging front leaves the lenses.
      lensRadius: function (theta, tau) {
        var L = P.lens, w = api.lensInsertW(theta), s = tau * L.fast_speed;
        if (w <= 0 || s <= L.insert_r0) return s;
        var dt = s - L.insert_r0;
        if (dt <= w / L.vS) return L.insert_r0 + dt * L.vS;
        return L.insert_r0 + w + (dt - w / L.vS);
      },
      // Front polyline for t in seconds: {tau, th[], r[], rAxis, exited}. angles span [-halfAngle, halfAngle].
      lensFront: function (t, n, halfAngle) {
        n = n || 41; halfAngle = halfAngle || 0.9;
        var tau = api.lensTau(t), th = [], r = [];
        for (var i = 0; i < n; i++) { var a = -halfAngle + 2 * halfAngle * i / (n - 1); th.push(a); r.push(api.lensRadius(a, tau)); }
        return { tau: tau, th: th, r: r, rAxis: api.lensRadius(0, tau), exited: tau >= 1 };
      },
      // Radius (fraction of the Gadget's outer radius) of the converging wave: 1 at the detonators,
      // lens.exit_frac when it leaves the lenses, lens.pusher_frac at t = 45 us, then inward to the core.
      implosionFront: function (t) {
        var L = P.lens;
        if (t <= L.t_lens) return 1 - (1 - L.exit_frac) * U.clamp(t / L.t_lens, 0, 1);
        if (t <= P.tShock) return U.lerp(L.exit_frac, L.pusher_frac, (t - L.t_lens) / (P.tShock - L.t_lens));
        return Math.max(0.12, L.pusher_frac - (L.pusher_frac - 0.12) * U.clamp((t - P.tShock) / (P.tPeak - P.tShock), 0, 1));
      }
    };
    return api;
  })();
