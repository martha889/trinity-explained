# Trinity, explained — build plan

A single-page, dependency-free animated explainer of the Trinity test (16 July 1945): how an
implosion device works, from the firing signal to the mushroom cloud, on a clock that spans
nanoseconds to minutes. Sibling of `../apollo-11-explained/explained/live/` and built the same
way: Canvas 2D + vanilla JS modules, assembled by a Python script into one offline HTML file.

This file is the contract. Workers implement it; they do not redesign it. If something here is
wrong or impossible, say so in your report instead of silently diverging.

## 1. Principles

1. **The physics drives the picture.** Radii, times, energies and counts come from `Sim`
   (section 5), never from numbers typed into a scene. Where we have no real model, the drawing is
   labelled *Illustrative*.
2. **Every number carries a provenance tag**: `M` measured/documented, `C` calculated from a
   stated formula, `I` illustrative. The tag is shown in the UI as a small chip.
3. **Schematic, not engineering.** The device is drawn as a labelled concentric cutaway at
   popular-science level (what the layers are for). No dimensioned drawings, no materials detail
   beyond section 4, no "how to build" framing.
4. **Sober tone.** This is the first nuclear explosion; 24 days later the same design was used
   on Nagasaki. No triumphal language, no sound effects, no jokes. The final scene says so plainly.
5. **Scrub-safe.** Any frame must be drawable from scratch from its time alone. Scenes keep no
   accumulating state (the shared particle pool is the only exception and is cosmetic).
6. **Honour `prefers-reduced-motion`**: no autoplay, no shake/flash/particles, camera snaps.
   The white-out flash is capped (section 7) for photosensitivity regardless of that setting.

## 2. Two signature instruments

The event covers ~11 orders of magnitude in time and ~6 in space. Two always-visible instruments
make that legible and are the visual identity of the piece:

- **Time microscope** — a log ruler from 1 ns to 10 min with a cursor at the current physical
  time, the clock (`T − 4.2 s`, `T + 60.31 µs`, `T + 16 ms`, `T + 3 min 10 s`), and the current
  slow-motion factor in words: "1 second on screen = 22 nanoseconds".
- **Scale ladder** — a log ruler from 1 cm to 100 km showing the width of the current view, with
  landmarks (plutonium core, the Gadget, the tower, a bunker 9 km away, cloud top).

## 3. Storyboard

Nine phases, one scene each, ~3 min 50 s at 1×. `t` is physical time in seconds from the instant
the detonators fire (05:29:45 Mountain War Time, as officially recorded). `u` is progress 0..1 through the phase.

| # | id | Title | Play s | Physical time (mapping) | View width |
|---|---|---|---|---|---|
| 1 | `countdown` | Jornada del Muerto, 05:29 | 14 | −10 s → 0 (linear) | 40 km → 60 m |
| 2 | `anatomy` | Inside the Gadget | 30 | held at 0 | 3 m |
| 3 | `lenses` | Thirty-two waves become one | 26 | 0 → 45 µs (linear) | 2 m |
| 4 | `implosion` | The squeeze | 18 | 45 → 60 µs (linear) | 2 m → 59 cm |
| 5 | `chain` | Eighty generations | 30 | 60 → 60.8 µs (linear) | 59 cm → 53 cm, with an atomic inset |
| 6 | `release` | A star for a millionth of a second | 16 | 60.8 µs → 1 ms (log) | 53 cm → 100 m |
| 7 | `fireball` | The fireball and the shock | 35 | 1 ms → 2 s (log) | 100 m → 3 km |
| 8 | `cloud` | The cloud | 37 | 2 s → 600 s (log) | 3 km → 40 km (camera follows the cloud) |
| 9 | `aftermath` | What was left | 24 | held at 600 s | 420 m, then ledger |

What each scene must teach (one idea each) and how it should look:

1. **countdown** — Where and when. Pre-dawn desert in section view: mountains, 30 m steel tower
   with the shot cab on top, observer bunkers at 9 km, base camp at 16 km, to scale on the scale
   ladder. The camera pushes in from the wide landscape to the cab as the clock runs down linearly.
   Stars, faint cloud after the night's storm. Last second: the view passes through the cab wall.
2. **anatomy** — What the layers are for. Clock held. A cutaway sphere assembles from outside in,
   each layer highlighted with a callout and one sentence: detonators (32 points on the surface) →
   explosive lenses (fast outer explosive with shaped slow inserts) → inner explosive charge →
   aluminium pusher → natural-uranium tamper → plutonium core → polonium–beryllium initiator.
   End on the question the next scene answers: 32 separate explosions make expanding waves; how do
   you get one perfectly round wave moving *inward*?
3. **lenses** — The lens idea. All 32 detonators fire together. Show one lens enlarged beside the
   whole sphere: the wave in the fast explosive bulges outward; the slow insert holds back its
   middle so the front flattens and then curves the other way, like light through a glass lens.
   Then all 32 fronts merge into a single converging sphere. Draw the fronts as bright thin arcs
   computed from two wave speeds (`Sim.lensFront`), with burnt explosive behind them.
4. **implosion** — Compression makes criticality. The converging shock crosses pusher and tamper
   and squeezes the core to more than twice its normal density. A dial shows the multiplication
   factor *k* rising through 1: below 1 a stray neutron's descendants die out, above 1 they
   multiply. The core is visibly smaller and brighter; the same atoms, closer together, so a
   neutron is more likely to hit one before escaping. The tamper's two jobs: reflect neutrons back,
   and hold the core together by its inertia.
5. **chain** — The doubling. The crushed initiator releases a burst of neutrons at the moment of
   maximum compression. Left: an atomic-scale inset — a neutron strikes a Pu‑239 nucleus, which
   splits into two fragments and 2–3 new neutrons (~200 MeV). Right/behind: the core filling with
   branching neutron tracks. A generation counter climbs 1 → 80, each generation ~10 ns; a log
   energy bar climbs from a single fission to 8.8×10¹³ J. The point to land: the last ~7 generations
   release ~99% of the energy, so for most of this microsecond nothing appears to happen.
6. **release** — Why it stops, and what the energy does first. The core is now at tens of millions
   of kelvin and millions of atmospheres; it expands, density falls, *k* drops back below 1 after
   only about 1 kg of material has fissioned. The energy leaves first as X-rays, which air absorbs
   within metres: a sphere of air heats to incandescence — the fireball is born mostly as glowing air,
   mixed with vaporised bomb and tower, not as burning material. Camera pulls back out through the vaporising cab and tower. Log time
   begins here; the time microscope cursor starts visibly sweeping decades.
7. **fireball** — The blast wave and Taylor's scaling. Ground-level section view with a 100 m
   scale bar. Fireball radius follows `Sim.shockR(t)` (Taylor–Sedov, R ∝ (E t²/ρ)^⅕). Freeze-frame
   ticks at measured frames from Mack's film — 15, 25, 34, 53, 62 ms — each stamped on a small
   R-versus-t log-log inset, plotted with all of Taylor's measured points from `facts.json`
   (`fireball_r_vs_t`); they fall on a straight line of slope 2/5. Taylor read the bright outer
   edge of the ball as the shock front, and that line is how he estimated the secret yield from
   published photos. Then *breakaway*: from about 15 ms the
   shock front cools below incandescence, fades (gone by ~60 ms) and outruns the fireball, which
   keeps growing slowly to ~235 m radius by about 1 s; show it as a faint
   refracting ring racing across the desert, with the reflected wave and dust skirt at the ground.
8. **cloud** — Buoyancy. The fireball is a bubble of very hot, low-density gas; it rises, rolls
   into a vortex ring, draws a stem of dust up behind it, cools from white through orange to
   grey-brown, and stops rising once it has cooled to the temperature of the surrounding air, about 12 km up
   after roughly 5 minutes. Meanwhile the blast
   wave reaches the 9 km bunkers and then base camp at 16 km about 40 s after the flash, where
   Fermi drops scraps of paper from about 6 ft and estimates the yield from how far they are blown
   (about 2.5 m). Dawn sky.
9. **aftermath** — The ledger. Shallow crater, green glass (trinitite) where sand melted, the
   tower gone. Then a calm full-canvas ledger: energy ≈ 21 kt TNT; ≈ 1 kg of plutonium fissioned;
   ≈ 1 g of mass converted to energy; four yield estimates (Fermi's scraps ~10 kt; 18.6 kt official in 1945;
   21 kt after the 1963 revision; 24.8 ± 2 kt in the 2021 re-analysis); the typical air-burst
   split between blast, heat and radiation, captioned as typical (Trinity was a low shot, so more
   went into the ground and less into heat). Closing lines on what followed: fallout drifted over
   ranches and villages whose residents were not warned or evacuated, and 24 days later, on
   9 August 1945, the same design was dropped on Nagasaki.

## 4. Facts table (single source of truth)

These live in `data/facts.json` and are the only numbers scenes and copy may use. The fact-check
worker verifies each against primary/secondary sources and corrects `data/facts.json` and this
table; nobody else edits them.

| Key | Value | Tag |
|---|---|---|
| Date, time | 16 July 1945, 05:29:45 Mountain War Time (UTC−6); official time, some accounts give 05:29:21 ± 15 s | M |
| Place | Jornada del Muerto, Alamogordo Bombing Range, New Mexico | M |
| Tower height | 100 ft (30 m) | M |
| Observer shelters | 10,000 yd (9.1 km) N, W, S; base camp about 10 miles (16 km) | M |
| Detonators / lenses | 32 | M |
| Core | ~6.2 kg plutonium, about the size of an orange | M |
| Layers (outside in) | detonators, explosive lenses, inner charge, aluminium pusher, natural-uranium tamper, plutonium core, Po–Be initiator | M |
| Detonation to wave at pusher | ~45 µs | I |
| Peak compression | > 2× normal density, at ~60 µs | I |
| Energy per fission | ~200 MeV (3.2e-11 J) | M |
| Neutrons per Pu‑239 fission | ~3 (2.9 slow, ~3.0 fast) | M |
| Generation time | ~10 ns ("one shake"; order of magnitude) | M |
| Generations | ~80 (2⁸¹ ≈ 2.4e24 fissions; 21 kt needs 2.7e24) | C |
| Yield used by `Sim` | 21 kt = 8.8e13 J (official figure since the 1963 revision) | M |
| Yield estimates | Fermi ~10 kt (1945); 18.6 kt (1945 official), 21 kt (1963); 2021 re-analysis 24.8 ± 2 kt (Selby et al.) | M |
| Material fissioned | ~1.1 kg of the 6.2 kg core (~18%); part of the yield came from the tamper, so say "about 1 kg" | C |
| Mass converted to energy | ~1 g (0.98 g, E/c²) | C |
| Core temperature at peak | tens of millions of K | M (order of magnitude) |
| Shock radius | R = (E t²/ρ₀)^⅕ (constant taken as 1), ρ₀ = 1.2 kg/m³; 136 m at 25 ms vs 130 m measured | C |
| Measured radii (Taylor) | 25 points, 0.10 ms 11.1 m … 4.61 ms 67.3 m, 15 ms 106.5 m, 25 ms 130 m, 34 ms 145 m, 53 ms 175 m, 62 ms 185 m; see `fireball_r_vs_t` | M |
| Photo timestamps | 15, 25, 34, 53, 62 ms are in Taylor's table; 16 ms is a published frame; 6 and 90 ms unconfirmed (interpolated ~74 m, ~215 m) | M |
| Breakaway / thermal | breakaway ~15 ms at ~100 m; first minimum ~11 ms; second maximum ~0.15 s; max fireball radius ~235 m after ~1 s | C |
| Blast at shelters / base camp | ~26 s at 9.1 km (calculated); ~40 s at base camp (Fermi, Groves) | C / M |
| Cloud top | ~12 km above sea level (~11 km above ground), reached in ~5–7 min | M |
| Crater / trinitite | shallow, ~1.4–1.8 m deep, ~40–80 m across (sources differ); glass out to ~300 m | M |
| Energy split | ~50% blast, ~35% heat, ~15% nuclear radiation: air-burst rule of thumb, not a Trinity measurement (low shot: less heat) | I |

## 5. Architecture

Copy the Apollo viewer's approach; fix its known weak points (one implicit global closure with
per-scene duplicated helpers, monkey-patched scenes, per-scene edge detection, tests tied to one
output path).

```
trinity/
  PLAN.md
  build.py                 stdlib-only; runs sim, merges content, assembles HTML, validates
  data/facts.json          section 4
  content/NN-<id>.json     one per phase: explainer copy, callouts, events, key numbers
  sim/trinity_sim.py       physics tables (imported by build.py), with its own self-checks
  src/page.html            template with /*__FONTS__*/ /*__CSS__*/ __DATA__ /*__JS__*/
  src/css/*.css
  src/js/00-core.js        data, palette C, state, util U (clamp, lerp, ease*, sstep, log maps)
  src/js/10-sim.js         Sim: interpolators over build-time tables
  src/js/20-canvas.js      canvas/DPR/resize, camera spring, text/label/callout/readout/scaleBar
  src/js/30-fx.js          FX: particle pool, glow, flash, shake, ping, vignette, heat palette
  src/js/35-world.js       World: sky, stars, mountains, ground, tower, bunkers (section views)
  src/js/36-gadget.js      Gadget: the layered cutaway, parameterised (see 5.4)
  src/js/40-instruments.js time microscope, scale ladder, energy bar, explainer panel
  src/js/scenes/5N-<id>.js one file per scene
  src/js/80-transport.js   play/pause, scrub, speed, chapters, keys, hash (read AND write)
  src/js/90-main.js        frame loop
  src/fonts/*.woff2        copied from ../apollo-11-explained/explained/live/fonts (OFL)
  tools/smoke.py           headless-Chrome smoke test + screenshots
  dist/trinity.html        build output (gitignored)
```

Files are concatenated in filename order inside one IIFE, as in Apollo. To keep that safe:
every file exposes exactly one namespace object (`U`, `Sim`, `FX`, `World`, `Gadget`, `Inst`,
`Scenes`) and scene files declare nothing at top level except one `Scenes.register(...)` call
whose locals live inside a function scope.

### 5.1 Time model

Playback seconds are the master clock. Phases are laid end to end; each maps its local progress
`u` to physical time by its `map`: `lin`, `log` (geometric interpolation t0→t1) or `hold`.
`build.py` emits `phases: [{id, title, play0, play1, t0, t1, map}]`. There is no global inverse
map: events and copy are authored as `(phase, u)` and `build.py` resolves them to playback
seconds. The slow-motion factor shown by the time microscope is d(play)/d(t) evaluated
numerically. Speeds 0.5/1/2/4× scale playback only.

### 5.2 Scene contract

```js
Scenes.register("fireball", {
  enter: function () {},          // optional; called on scene change and after any seek
  draw: function (f) {},          // required; immediate-mode, redraws everything
  onEvent: function (ev, f) {}    // optional; fired once when playback crosses an event
});
// f = { t, u, play, dt, playing, phase, W, H }   (CSS px, origin top-left, DPR already applied)
// A scene must set f.spanM = current view width in metres (feeds the scale ladder).
```

The engine, not the scene, detects event crossings (only while playing, never on seek), clears FX
on seeks, cross-fades between scenes (0.45 s snapshot fade), draws the vignette, and catches draw
errors into `data-draw-error` on `<html>`.

### 5.3 `Sim` (built by `sim/trinity_sim.py`, read by `10-sim.js`)

All pure functions of physical time `t`, backed by tables sampled densely in log time:
`Sim.lensFront(t)` (wave-front geometry parameters for scene 3), `Sim.coreRadius(t)`,
`Sim.density(t)`, `Sim.k(t)`, `Sim.generation(t)`, `Sim.energyJ(t)`, `Sim.tempK(t)`,
`Sim.shockR(t)`, `Sim.fireballR(t)` (follows the shock until breakaway at ~15 ms, then grows slowly to ~235 m by ~1 s),
`Sim.cloudTopM(t)`, `Sim.blastArrival(distanceM)`. Each table carries its tag (`C` or `I`) and a
one-line source note. `cloudTopM` reaches ~12 km at ~300 s and is stable by 600 s.
`shockR` is Taylor–Sedov (constant taken as 1; do not print a constant) until the front slows to ~1.1× sound speed, then
continues at sound speed. Self-checks: monotonicity, R(25 ms) within 10% of 136 m, total energy
equals yield, 2^generations × energy-per-fission within a factor of 2 of yield, arrival at 16 km
within 35–50 s.

### 5.4 Shared art modules (built once, in the foundation, so scenes cannot drift apart)

- `World.draw(view, opts)` — section-view desert: sky gradient keyed to `opts.dawn` 0..1, cached
  seeded starfield, layered mountain silhouettes, ground line, tower + cab, bunkers and base camp
  at true distances. `view = {cx, cy, span}` in metres. `opts.light` (0..1 + colour) relights the
  ground and mountains from the fireball position.
- `Gadget.draw(cx, cy, rPx, opts)` — the cutaway. `opts.reveal` (0..1 per layer), `opts.highlight`
  (layer id), `opts.compress` (0..1 squeezes the inner layers), `opts.burn` (0..1 radius fraction
  of consumed explosive), `opts.cut` (wedge angle of the cutaway). Returns layer radii in px so
  scenes can attach callouts and wave fronts.
- `FX.heat(x)` — one black-body-like colour ramp (deep red → orange → yellow-white → blue-white)
  used for everything hot, so temperature reads consistently across scenes.
- `FX.fireball(x, y, r, opts)` — layered additive radial gradients with fbm-noise turbulence
  (cached noise texture), `opts.temp` selects the palette position, `opts.rough` the mottling.

### 5.5 Page layout and look

Same shell as Apollo: header (title, big mono clock, chapter), a large canvas panel on the left,
a right column, a fixed transport bar with chapter bands and event ticks. Right column: an
**Explainer** panel (chapter number and title, 2–4 short paragraphs that reveal as `u` advances,
key-number rows with M/C/I chips) above an **Instruments** panel (time microscope, scale ladder,
energy released). Theatre mode (`F`) hides the right column; below 960 px it stacks.

Palette — night desert and incandescence, as CSS custom properties read into `C`:
`--bg:#0b0e14 --panel:#11161f --panel-2:#161d29 --line:#253044 --fg:#dde3ec --muted:#8792a5
--faint:#4a566b --hot:#fff4dc --fire:#ffa23a --ember:#e2481f --neutron:#7fe3ff --pu:#b6a4ff
--he-fast:#d08a4e --he-slow:#8b7355 --al:#aab4c2 --tamper:#6f9480 --trinitite:#8ed6a2
--alarm:#ff5a4f`. Accent is `--fire`. Fonts as Apollo: Barlow Condensed (display), IBM Plex Mono
(numerals), IBM Plex Sans (body), base64-embedded.

### 5.6 Build and verification

- `python3 build.py [--out PATH]` (default `dist/trinity.html`). Stdlib only. Fails loudly if
  validation fails (phase contiguity, every content file matches a phase, events sorted, every
  number in copy that is tagged resolves to a `facts.json` key, sim self-checks).
- `python3 tools/smoke.py [--file PATH] [--shots DIR] [--sweep N] [--at t1,t2]` — headless Chrome
  (`$CHROME` overrides the macOS default path); asserts `data-ready`, no `data-js-error` or
  `data-draw-error`, canvas ink above threshold; `--shots` writes one PNG per sample at 1440×900.
- **Parallel workers must build to their own output** (`--out <scratch>/x.html`, then
  `smoke.py --file` the same path) so they never overwrite each other's build.
- `#t=<playback seconds>` and `#<phase-id>` deep links pause at that point; the hash is written
  back (throttled) while paused.

## 6. Flash safety

The detonation flash is rendered as a single smooth rise and decay (no strobing): full-canvas
luminance ramps up over ≥ 150 ms, peaks at no more than 85% white, and decays over ≥ 1.5 s. No
effect anywhere alternates bright/dark faster than 3 times per second. Camera shake ≤ 10 px,
exponential decay, off under reduced motion.

## 7. Work packages

Planning and final review stay with the lead. Everything else is delegated.

| WP | What | Owns (may edit) | Depends on | Model |
|---|---|---|---|---|
| 1 | **Foundation**: build.py, sim, core/canvas/FX/World/Gadget/instruments/transport/main, CSS, page, fonts, smoke.py, nine *stub* scenes and stub content, `.gitignore` | everything except `data/facts.json`, PLAN.md | — | Sonnet |
| 2 | **Fact-check** section 4 against sources; correct `data/facts.json` and the section 4 table; list anything in section 3 that is wrong | `data/facts.json`, PLAN.md §4 | — | Sonnet |
| 3a | Scenes `countdown` + `aftermath` | their scene + content files | 1, 2 | Sonnet |
| 3b | Scenes `anatomy` + `lenses` | 〃 | 1, 2 | Sonnet |
| 3c | Scenes `implosion` + `chain` | 〃 | 1, 2 | Sonnet |
| 3d | Scenes `release` + `fireball` | 〃 | 1, 2 | Sonnet |
| 3e | Scene `cloud` | 〃 | 1, 2 | Sonnet |
| 4 | **Integration QA**: full smoke sweep with screenshots, fix seams between scenes, responsive and reduced-motion pass, README | anything | 3a–3e | Sonnet |
| 5 | Lead review of screenshots and copy; targeted fix requests | — | 4 | lead |

Scene workers may not edit shared modules. If a shared helper is missing or wrong, they work
around it locally inside their scene file and report it; WP4 folds real fixes back in.

Definition of done for a scene: builds; smoke passes at 12 evenly spaced `u` values with
screenshots; every frame is correct when jumped to directly; explainer copy ≤ 90 words per
paragraph, plain English, every number from `facts.json` with its tag; reduced-motion renders a
sensible static frame; looks good at 1440×900 and 390×844.
