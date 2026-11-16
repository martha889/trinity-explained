# Trinity viewer: API for scene and content authors

Read `PLAN.md` for what each scene must teach and `src/js/scenes/5N-*.js` for working stub examples. This file is the
reference for everything a scene file or content file may use. Scene workers must not edit any shared module
(`00`-`50`, `80`, `90`); work around gaps locally in the scene file and report them.

All JS files are concatenated, in filename order, inside one IIFE. Every name below is therefore a plain variable
visible to scene code. A scene file declares nothing at top level except one `Scenes.register(...)` call whose locals
live inside a function scope (the stubs use `Scenes.register("id", (function () { ... return {...}; })());`).

Build and test:

```
python3 build.py --out /abs/scratch/x.html          # validates content, facts, sim; fails loudly
python3 tools/smoke.py --file /abs/scratch/x.html --at 3,60,120 --shots /abs/scratch/shots
python3 tools/smoke.py --file ... --sweep 12 --size 390x844 --shots ...
python3 tools/smoke.py --file ... --play --phases   # also runs #t=3&play&adv=8 and every #<phase-id> deep link
```

Deep links (the page opens paused): `#t=<playback seconds>`, `#<phase-id>`, `#<phase-id>@<u>`. The hash is written back
(`#t=...`) while paused. Test-only: `#t=3&play&adv=8` plays and steps 8 s of frames synchronously.

## 1. Time model

Playback seconds (`S.play`) are the master clock. Phases are laid end to end (`D.phases`, 230 s total). Each has
`{id, index, title, subtitle, play0, play1, t0, t1, map, view}`. Local progress `u = (play - play0) / (play1 - play0)`.
`map` converts `u` to physical time `t` (seconds from the instant the detonators fire): `lin`, `log` (geometric,
`t0 * (t1/t0)^u`) or `hold` (`t = t0`). Phase 1 runs T-10 s to 0 (`t` is negative there).

| id | play s | t mapping |
|---|---|---|
| countdown | 14 | -10 s to 0, lin |
| anatomy | 30 | held at 0 |
| lenses | 26 | 0 to 45 us, lin |
| implosion | 18 | 45 to 60 us, lin |
| chain | 30 | 60 to 60.8 us, lin |
| release | 16 | 60.8 us to 1 ms, log |
| fireball | 35 | 1 ms to 2 s, log |
| cloud | 37 | 2 s to 600 s, log |
| aftermath | 24 | held at 600 s |

## 2. Scene contract

```js
Scenes.register("fireball", {
  enter:   function (f) {},       // optional; scene change and after every seek (reset local caches here)
  draw:    function (f) {},       // required; immediate mode: redraw everything from f alone
  onEvent: function (ev, f) {}    // optional; fired once when PLAYBACK crosses an event (never on seek)
});
```

`f` (the same object each frame, do not keep references to its contents):

| field | meaning |
|---|---|
| `t` | physical time in seconds (negative before the detonators fire) |
| `u` | phase progress 0..1 |
| `play` | playback seconds |
| `dt` | real seconds since the last frame (0..0.1) |
| `playing` | true while playing |
| `phase` | the phase object (`phase.id`, `.play0`, `.play1`, `.t0`, `.t1`, `.map`, `.title`) |
| `W`, `H` | canvas size in CSS px (origin top-left, DPR transform already applied) |
| `rm` | reduced-motion preference |
| `spanM` | **you must set this**: current view width in metres (feeds the scale ladder) |

Rules:

* Scrub-safe: any frame must be drawable from `f` alone. No accumulating state in scenes. Use `U.hash(i, seed)`
  or `U.rng(seed)` re-seeded each frame for random-looking detail, never `Math.random()`. The only allowed hidden
  state is cosmetic and resets on seek: the camera spring (`Cv.smooth`) and the FX pool.
* The engine detects event crossings, clears FX and resets the camera on seeks, calls `enter`, cross-fades between
  scenes (0.45 s snapshot), applies camera shake, draws pooled particles (`FX.draw`), the vignette and the flash
  overlay after your `draw`, and catches errors into `data-draw-error` on `<html>`.
* Use `ctx` (the main 2D context) directly. It is already scaled by DPR; draw in CSS pixels. Wrap changes to
  `globalAlpha`, `globalCompositeOperation`, `lineDash` in `ctx.save()/restore()`.
* Numbers come from `Sim` and `D.facts`, never typed in. Show provenance (`Cv.tagChip`, `Cv.note`) for anything
  illustrative (`Sim.tag(name)`).
* Reduced motion: `RM` (or `f.rm`) is true. `Cv.smooth` snaps, `FX` does nothing; keep the static frame meaningful.
* Keep the device at popular-science level: concentric labelled layers, no dimensions, no how-to detail.

## 3. Globals

* `C`: palette, read from CSS: `bg panel panel2 line fg muted faint hot fire ember neutron pu heFast heSlow al tamper
  trinitite alarm` (`C["panel-2"]`, `C["he-fast"]`, `C["he-slow"]` also exist). Values: bg `#0b0e14`, panel `#11161f`,
  fg `#dde3ec`, muted `#8792a5`, hot `#fff4dc`, fire `#ffa23a` (accent), ember `#e2481f`, neutron `#7fe3ff`,
  pu `#b6a4ff`, he-fast `#d08a4e`, he-slow `#8b7355`, al `#aab4c2`, tamper `#6f9480`, trinitite `#8ed6a2`, alarm `#ff5a4f`.
* `D`: build data: `D.phases`, `D.events`, `D.content[phaseId]`, `D.facts[key]` (`{label, value, tag, num?, unit?, note?, source, url}`),
  `D.sim`, `D.meta`. `PHASES`, `EVENTS`, `TOTAL` are shortcuts. `S`: engine state (`play`, `playing`, `speed`); scenes only read it.
* `RM`: reduced motion. `W`, `H`, `DPR`, `canvas`, `ctx`: main canvas. `$(id)` is `getElementById`.

## 4. `U`: utilities (00-core)

Math: `clamp(x,a,b)`, `lerp(a,b,x)`, `invLerp(a,b,x)`, `remap(x,a0,a1,b0,b1,clampFlag)`,
`sstep(a,b,x)` (GLSL smoothstep, 0..1), `easeIn(x)`, `easeOut(x)`, `easeInOut(x)` (cubic), `easeOutQuad(x)`, `easeOutExpo(x)`
(inputs clamped to 0..1).
Log scales: `logPos(v,v0,v1)` gives 0..1 position of `v` on a log axis (v0, v1 > 0); `logAt(x,v0,v1)` is the inverse
(geometric interpolation, `logLerp` is an alias).
Random: `rng(seed)` returns a function giving floats in [0,1) (mulberry32); `hash(i,seed)` is a stateless [0,1) noise.
Colour: `hex(c)` to `[r,g,b]`, `rgba(c,a)`, `mix(c1,c2,x)` returns `rgb(...)`.
Misc: `pad(n,w)`, `esc(s)` (HTML escape), `bsearch(arr,x)` (last index with arr[i] <= x).
Formatting: `fmtDist(m)` -> "4.5 cm", "30 m", "9.1 km"; `sci(v,digits)` -> `{m:"8.8", e:13}`;
`fmtClock(t)` -> "T − 4.200 s", "T + 60.31 µs", "T + 16.00 ms", "T + 3 min 10 s", "T = 0" (unit chosen automatically);
`fmtDurWords(s)` -> "22 nanoseconds"; `fmtPlay(sec)` -> "2:23"; `fmtKt(joules)` -> "21 kt" ("" below 1 kg TNT).
Time model: `phaseIndexAt(play)`, `phaseU(ph,play)`, `physT(ph,u)`, `physAt(play)`, `slowRate(play)` (physical s per screen s,
numeric derivative, 0 when held), `slowWords(play)` ("1 second on screen = 22 nanoseconds"), `eventAt(play)`.

## 5. `Sim`: physics (10-sim)

Pure functions of physical time `t` in seconds; unknown `t` clamps to the table ends. Each series has a provenance tag:
`Sim.tag(name)` is `"C"` (calculated from a stated formula) or `"I"` (illustrative); helpers that are not tabulated (`puFissionedKg` C, `blastArrival` C, the lens helpers I) answer too; `Sim.note(name)` is the one-line source;
`Sim.unit(name)`.

| function | returns | tag |
|---|---|---|
| `coreRadius(t)` | plutonium core radius, m (about 4.5 cm, squeezed, then expanding) | I |
| `density(t)` | core density / normal (1 to ~2.3, then falling) | I |
| `k(t)` | multiplication factor: below 1, rises through 1 near 55 us, peaks ~2.3, falls below 1 again after 60.8 us | I |
| `generation(t)` | 0..80 (10 ns per generation from t = 60 us) | C |
| `energyJ(t)` | joules released so far; 0 before 60 us, ends exactly at `params.yieldJ` (8.786e13 J) | C |
| `tempK(t)` | hottest-region temperature, K (300 to 5e7 at 60.8 us, then falling) | I |
| `shockR(t)` | blast-wave radius, m: Taylor-Sedov `(E t^2/rho0)^(1/5)` until ~1.1 c, then sound speed | C |
| `fireballR(t)` | glowing-sphere radius, m: core, then follows the shock to breakaway at 15 ms (~100 m), then grows slowly to ~235 m by ~1 s | C |
| `frontGlow(t)` | visibility of the luminous shock front: 1 before 15 ms, 0 by 60 ms | I |
| `cloudTopM(t)` | cloud top above ground, m (~12 km by ~300 s, stable by 600 s) | I |
| `blastArrival(d)` | seconds after the flash at which the blast reaches distance `d` m (9.1 km ~26 s, 16 km ~46 s) | C |
| `puFissionedKg(t)` | kg of plutonium fissioned so far | C |
| `measuredR` | array `[[t_seconds, R_metres], ...]`: Taylor's 25 measured radii (for the log-log inset) | M |
| `params` | constants: `yieldJ rho0 cSound eFission genTime generations tShock tPeak tInit tDisassembly peakCompression tBreakawayShock rBreakawayShock tBreakawayFireball rCore0 lens` | |

Lens helpers (scene 3), in normalised lens coordinates: detonator at the origin, lens exit at radius 1, front speed in
the fast explosive = 1: `lensTau(t)` (0..1.6, 1 = the on-axis front, delayed by the slow insert, reaches the lens exit at `lens.t_lens` = 30 us, exactly when the merged converging front leaves the lenses; `lens.fast_speed` is the free front speed in lens lengths per unit tau, about 1.18),
`lensInsertW(theta)` (slow-insert thickness at angle theta), `lensRadius(theta, tau)`,
`lensFront(t, n=41, halfAngle=0.9)` -> `{tau, th[], r[], rAxis, exited}` (polyline of the wave front, angles from the lens axis),
`lens` = `{vS, insert_r0, insert_w, theta_max, t_lens, exit_frac, pusher_frac}`; `implosionFront(t)` is the converging
wave's radius as a fraction of the Gadget's outer radius (1 at the detonators, `lens.exit_frac` at lens exit, `lens.pusher_frac`
at 45 us, then inward to the core; use it to drive `Gadget.draw`'s `burn`).

## 6. Canvas helpers `Cv` (20-canvas)

All draw on the main `ctx` in CSS px. `Cv.fonts = {body, display, mono}` are font-family strings.

* `Cv.smooth(target, key, dt, logKeys)` -> smoothed copy of `target` (an object of numbers, e.g. `{cx, cy, span}`):
  critically damped spring (omega 6.5). Keys in `logKeys` (e.g. `["span"]`) are smoothed in log space. Resets when `key`
  changes, after seeks and under reduced motion. `Cv.resetCam()` forces a reset. `Cv.moving` is true while settling.
* `Cv.text(str, x, y, {size=12, weight=500, color, font, align="left", base="alphabetic", alpha})`;
  `Cv.label(str, x, y, color, align, alpha)` (12 px condensed, 600; use upper case); `Cv.mono(str, x, y, opts)`;
  `Cv.measure(str, {size, weight, font})` width; `Cv.wrap(str, maxW, {size, weight, font})` -> lines.
* `Cv.sciText(value, x, y, {size, color, digits, align, font})` draws "8.8 × 10" with a raised exponent, returns the width.
* `Cv.tagChip(tag, x, y, alpha)` M/C/I chip, top-left at x,y (16 x 15 px); `Cv.note(text, x, y, {tag, maxW, size, color, alpha})`
  wrapped note with optional chip, returns height used (use for "Illustrative" captions).
* `Cv.readout(x, y, caption, value, {size=20, color, align, alpha})` small caption above a large mono value.
* `Cv.scaleBar(x, y, metres, pxPerM, {text, color, alpha})` bar with end ticks and a label (default `U.fmtDist`), x,y = left end.
* `Cv.callout(ax, ay, tx, ty, text, {title, color, alpha, maxW=200, size=13})` dot at the anchor (ax,ay), leader line,
  wrapped box whose nearest edge is at (tx,ty); the box is kept inside the canvas. Skips drawing when `alpha` is about 0.
* `Cv.marker(x, y, color, name, {dx, dy, align})` dot with a pill label.
* `Cv.glowPath(pathFn(ctx), color, width, alpha)`, `Cv.glowLine([[x,y],...], color, width, alpha)`,
  `Cv.glowArc(x, y, r, a0, a1, color, width, alpha)`: three-pass glow strokes. `Cv.glow(x, y, r, color, alpha)`: soft additive radial glow.
* `Cv.rrect(x, y, w, h, r)` builds a rounded-rect path. `Cv.stars(x, y, w, h, alpha, shiftPx)` cached seeded starfield in a rect
  (used by `World`).

## 7. `FX` (30-fx)

The engine ticks and draws FX; scenes only spawn.

* `FX.heat(x, alpha?)` -> css colour on the one shared black-body ramp: x 0 deep red, 0.30 ember, 0.46 orange, 0.62 pale
  yellow, 0.78 white-hot, 1 blue-white. `FX.heatRGB(x)`, `FX.heatPos(tempK)` (1000 K -> 0, ~3500 K -> 0.4, ~6500 K -> 0.7,
  15000 K+ -> 1), `FX.heatK(tempK, alpha?)`. Use these for everything hot so temperature reads consistently.
* `FX.fireball(x, y, r, {temp=0.6, rough=0.5, seed=0, alpha=1, churn=0, clipY})`: glowing air sphere: layered additive radial
  gradients, cached fbm-noise mottling (`rough` 0..1, `seed` rotates/scales it, `churn` slowly rotates it), white-hot core.
  `temp` is the ramp position at the centre (use `FX.heatPos(Sim.tempK(t))`). `clipY` draws only above that y (ground line).
  r in px. Under 0.5 px it draws a small glow.
* `FX.spawn(kind, x, y, vx, vy, life, r0, r1, heat)` (kind 0 spark, additive, coloured by `heat`; kind 1 dust),
  `FX.burst(x, y, n, {angle, spread, speed, speedVar, life, r0, r1, heat, kind})`, `FX.ping(x, y, color, {r, life})`. Velocities
  px/s. Pool of 500; no-ops under reduced motion; cleared on seek.
* `FX.flash(strength 0..1, color?)`: full-canvas white-out. Safety is enforced inside: peak capped at 85% opacity, rise
  >= 180 ms, decay >= 1.6 s, retriggers ignored while running or cooling down (so never faster than ~0.5 Hz), nothing under
  reduced motion. `FX.flashAlpha()` reads the current alpha (use it to dim a scene during the flash).
* `FX.shake(px)`: camera shake, capped at 10 px, exponential decay, off under reduced motion.
* Engine-only: `FX.tick`, `FX.draw`, `FX.overlay`, `FX.vignette`, `FX.reset`, `FX.shakeX/Y`.

## 8. `World` (35-world)

`World.draw(view, opts)` draws the whole section-view desert, 40 km wide down to 60 m, and returns the mapping `m`.

* `view = {cx, cy, span}`: `cx` = metres east of ground zero at the screen centre, `cy` = metres above the ground at the screen
  centre, `span` = visible width in metres. Pixels per metre `m.ppm = W / span`.
* Returned `m`: `{ppm, W, H, view, groundY, X(xMetres) -> px, Y(heightMetres) -> px}`. The ground is the horizontal line at
  `m.groundY` (may be off-screen when `cy` is large). Ground zero is x = 0; the tower is at x = 0.
* `opts`: `dawn` 0..1 (night to dawn sky; default 0.2; stars fade as it rises), `stars` 0..1, `clouds` 0..1 (faint storm
  remnants, default 0.5), `tower` 0..1 (0 hides it; default 1), `towerBurn` 0..1 (vaporising: shortens from the top, white-hot
  tint), `towerGone` true (footings only), `cabLight` 0..1 (lit window), `bunkers` false to hide the shelters, `camp` false to hide
  the base camp, `labels` true to print "Tower 30 m / Observer shelter 9.1 km / Base camp 16 km" (at true positions, skipped when off-screen, staggered in rows, shorter text under 560 px), `day` 0..1 (full morning light beyond `dawn`; used by the aftermath),
  `light: {a 0..1, color, x, y}` relights ground, mountains, tower and sky from a point (x metres east, y metres up; use
  `{x: 0, y: 30}` for the fireball).
* `World.LAYOUT = {tower: 30, cabW, cabH, shelterX: 9100, campX: 16000}` (metres). Shelters are drawn at x = -9100 and +9100,
  base camp at +16000. Tower, shelters and camp keep a minimum on-screen size so they stay visible at 40 km (true size when zoomed).
* Mountains are a screen-space backdrop (three parallax layers) anchored on the horizon.

## 9. `Gadget` (36-gadget)

`Gadget.draw(cx, cy, rPx, opts)`: the labelled concentric cutaway, schematic only. `rPx` is the outer radius in px.

* `opts`: `reveal` (0..1 sequential outside-in over the seven layers, or `{layerId: 0..1}`), `highlight` (layer id: dims the others,
  outlines this one), `compress` (0..1: pusher, tamper and core squeeze inward; core radius reaches 0.757 of normal at 1, matching
  ~2.3x density), `burn` (0..1: how far the detonation wave has swept inward, from the outside to the pusher; consumed explosive
  glows hot behind a bright front; for scene 3 use `burn = clamp((1 - Sim.implosionFront(t)) / (1 - 0.5), 0, 1)`),
  `cut` (0..1, clipped to the sphere: 0 = closed sphere with the 32 detonator points in a truncated-icosahedron web, 1 = full cross-section with
  detonator notches, between = a wedge opened at the upper right; default 1), `rot` (yaw of the surface pattern, rad),
  `glow` (0..1: core incandescence), `detGlow` (0..1: detonators lit), `alpha`.
* Layers (`Gadget.LAYERS`, outside in, ids in `Gadget.ORDER`): `det` Detonators, `lens` Explosive lenses (fast outer explosive with
  slower inserts), `charge` Inner explosive charge, `pusher` Aluminium pusher, `tamper` Natural-uranium tamper, `core` Plutonium core,
  `init` Polonium-beryllium initiator. Each has `{id, name, r0, r1, color, blurb}` (r0/r1 are fractions of the outer radius).
  Proportions are illustrative, not to scale.
* Returns `{cx, cy, R, r: {id: [innerPx, outerPx]}, front (px radius of the burn front or null), count: 32, at(id, angleRad) -> {x, y}}`.
  Radii already include `compress`. Use `r` for callout anchors (`at`) and for drawing your own wave fronts.

## 10. Instruments and explainer (40-instruments, engine-driven)

Scenes do not draw these. `Inst.draw(f)` is called by the engine each frame:

* Time microscope: log ruler 1 ns to 10 min with the chapter bands, a cursor at `f.t`, the clock (`U.fmtClock`) and the slow-motion
  factor in words (`U.slowWords`).
* Scale ladder: log ruler 1 cm to 100 km, a bar for the current view width (`f.spanM`; hidden when you leave it null) and landmarks.
* Energy bar: log ruler 1e-11 to 1e14 J filled to `Sim.energyJ(f.t)`.
* Explainer panel (DOM): chapter title, paragraphs that reveal when `u >= p.u`, key-number rows with M/C/I chips (linked to the source
  when the fact has a `url`).

## 11. Content files

`content/NN-<phase-id>.json` (NN = 01..09 in storyboard order; `build.py` fails if a file is missing, extra, or its `phase` differs).

```json
{
  "phase": "fireball",
  "summary": "One sentence; used as the detail of the automatic chapter-start event.",
  "paragraphs": [
    { "u": 0.0, "text": "Plain English, <= 90 words. Numbers come from facts: {{shock_law}}, {{shock_r_25ms}}." },
    { "u": 0.5, "text": "A second paragraph that appears when u reaches 0.5." }
  ],
  "keys": [
    { "fact": "shock_r_25ms", "u": 0.3, "label": "optional label override" }
  ],
  "events": [
    { "id": "breakaway", "u": 0.55, "short": "Shock breakaway", "detail": "One or two sentences.", "major": false }
  ],
  "callouts": [
    { "id": "ring", "u0": 0.4, "u1": 0.9, "text": "The shock front outruns the fireball" }
  ]
}
```

* `paragraphs[].text`: `{{fact_key}}` is replaced by the fact's `value` and rendered with its tag chip (M/C/I superscript). Unknown keys fail the
  build. Other text is HTML-escaped. Sorted by `u`; each reveals when `u` is reached and stays.
* `keys[]`: a key-number row `label / value / chip`, revealed at `u`. `fact` must exist in `data/facts.json`; label defaults to the fact's label.
* `events[]`: sorted by `u` (0..1), ids unique across ALL files. Appear as ticks on the transport bar, in the Jump menu, in the event strip, and
  fire `onEvent(ev, f)` once when playback crosses them (`ev = {id, phase, u, play, short, detail, major}`). `major: true` makes a taller tick.
  If no event has `u: 0`, the build adds a chapter-start event with id = the phase id (use it for `#<phase-id>` deep links).
  `detail` may use `{{fact}}` (plain value, no chip). Use `onEvent` for cosmetic effects only (FX flash, ping, shake).
* `callouts[]`: canvas annotations. In `draw`, `var co = Scenes.callouts(f)` returns `{id: {text, a}}` for the callouts active at `f.play` with fade
  alpha `a` (0.4 s fades), e.g. `if (co.ring) Cv.callout(ax, ay, tx, ty, co.ring.text, {alpha: co.ring.a})`. `text` may use `{{fact}}` (plain value).
* `data/facts.json` is owned by the fact-check worker. Read `D.facts[key]` (`value`, `tag`, `num`, `unit`, `label`, `source`, `url`).

Facts used in the stubs: `date_time place tower_height shelter_dist base_camp_dist detonators core_mass layers implosion_time compression
mev_per_fission neutrons_per_fission generation_time generations yield_kt yield_j pu_fissioned mass_converted core_temp shock_law shock_r_25ms
photo_times blast_base_camp blast_shelter cloud_top crater trinitite_extent split_* breakaway_time breakaway_radius fireball_max_radius`.
Check the file for the full current list.

## 12. Worked example

```js
// src/js/scenes/57-fireball.js (abridged): fireball at Sim.fireballR, shock ring at Sim.shockR, scale bar, callout.
Scenes.register("fireball", (function () {
  return {
    draw: function (f) {
      var span = U.logAt(f.u, 60, 3000);                                          // 60 m -> 3 km, geometric
      var v = Cv.smooth({ cx: 0, cy: span * f.H / f.W * 0.3, span: span }, "fireball", f.dt, ["span"]);
      var m = World.draw(v, { dawn: 0.3, tower: f.t > 1e-3 ? 0 : 1, light: { a: 0.8, x: 0, y: 30 } });
      f.spanM = v.span;                                                           // feeds the scale ladder
      var rF = Sim.fireballR(f.t), rS = Sim.shockR(f.t);
      FX.fireball(m.X(0), m.groundY, rF * m.ppm, { temp: FX.heatPos(Sim.tempK(f.t)), rough: 0.6, seed: 9, clipY: m.groundY });
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, f.W, m.groundY); ctx.clip();
      Cv.glowArc(m.X(0), m.groundY, rS * m.ppm, Math.PI, 2 * Math.PI, C.hot, 1.5, 0.35 + 0.5 * Sim.frontGlow(f.t));
      ctx.restore();
      Cv.scaleBar(24, f.H - 30, 100, m.ppm);                                      // pick a length that fits
      var co = Scenes.callouts(f);                                                // from content/07-fireball.json
      if (co.ring) Cv.callout(m.X(rS * 0.7), m.groundY - rS * 0.7 * m.ppm, f.W * 0.7, 80, co.ring.text, { alpha: co.ring.a });
    },
    onEvent: function (ev, f) { if (ev.id === "breakaway") FX.ping(f.W / 2, f.H * 0.5, C.hot, { r: 80 }); }
  };
})());
```

Flash example (detonation, scene 6 start): `onEvent` -> `FX.flash(1, "#fff4dc"); FX.shake(8);`. Both are rate- and size-limited
by the engine; calling them more often is harmless.

## 13. Additions in the integration pass

* `Gadget.pose(W, H, s)` -> `{cx, cy, R, zoom, span}`: the shared camera pose for the zoom chapters. `s` = 0 end of lenses (whole Gadget), 1 end of
  implosion, 2 end of chain / start of release (slow push-in from 1 to 2 during chain). The Gadget drifts slightly upward so the zoomed core sits
  between the side panels; on phones (W < 640) the zoom is halved. Implosion, chain and release all use it, so their cuts match.
* `FX.fireball` draws an opaque body (white-hot centre, orange limb, mottling), capped below blue-white, so it can never saturate to a blank sheet.
  `FX.stats` and the `data-flash` / `data-flicker` attributes are test hooks.
* Explainer: only revealed paragraphs are laid out; the scroll area snaps to paragraph (or whole-line) boundaries, older paragraphs are dimmed, and
  the key-number rows plus the M/C/I legend sit in a pinned footer showing the newest rows that fit.
* Transport ticks: only `major` events and chapter starts get a tick; every event stays in the Jump menu and on the arrow keys.
* Test hooks: `&rm` in the hash forces reduced motion (`smoke.py --rm`); `html[data-scroll-w]`, `[data-inner-w]`, `[data-event]`, `[data-toast]`;
  `smoke.py` runs sizes under 500 px in a true-size iframe that reports its own scroll width; `--play --phases` plays a 4 s window across every
  chapter boundary and asserts no errors, one flash within PLAN section 6, and no bright/dark flicker.
* New facts: `fermi_drop_height`, `fermi_displacement`, `sun_surface_temp`, `sun_core_temp`.
