"""Trinity physics tables.

Pure functions of physical time t (seconds from the firing signal) sampled onto a
non-uniform grid (dense where the story is fast), then shipped to the page as columns
and re-interpolated by src/js/10-sim.js. Every series carries a provenance tag
(C = calculated from a stated formula, I = illustrative) and a one-line note.

Run `python3 sim/trinity_sim.py` to execute the self-checks.
"""
from __future__ import annotations

import math

# ---- constants (SI) ---------------------------------------------------------
YIELD_J = 8.786e13        # 21 kt x 4.184e12 J, facts.json yield_j
RHO0 = 1.2                # sea-level-ish air density at the site, kg/m^3 (hot desert morning)
C_SOUND = 340.0           # m/s
E_FISSION = 3.204e-11      # J per fission (~200 MeV)
GEN_TIME = 1e-8           # s, one "shake"
GENERATIONS = 80
T_SHOCK = 45e-6           # converging wave reaches the pusher
T_PEAK = 60e-6            # peak compression; initiator releases neutrons
T_INIT = T_PEAK
T_DISASSEMBLY = T_INIT + GENERATIONS * GEN_TIME   # 60.8 us, core blows itself apart
PEAK_COMPRESSION = 2.3    # rho / rho0 at peak
PU_DENSITY = 15.8e3       # kg/m^3 (delta phase)
CORE_MASS = 6.2           # kg
T_BREAKAWAY_FIREBALL = 0.015  # s, shock outruns the glowing sphere (Glasstone, ~15 ms)
FIREBALL_MAX_R = 235.0    # m, reached after roughly a second (facts fireball_max_radius)
FIREBALL_GROW_TAU = 0.35  # s
V_EXPAND = 1.5e4          # m/s, expansion speed of the disassembling core (illustrative)
CLOUD_TAU = 75.0          # s, buoyant rise e-folding time (illustrative)
CLOUD_TOP_END = 12000.0   # m at ~10 min (documented)
K0 = 0.72                 # multiplication factor of the uncompressed core (illustrative)
K_EXP = 1.4               # k ~ K0 * (rho/rho0)^K_EXP (illustrative)

# Lens geometry for scene 3, normalised: detonator at the origin, lens exit radius 1,
# front speed in the fast explosive = 1, slow insert speed ratio below.
LENS = {
    "vS": 0.62,           # slow / fast detonation speed ratio (illustrative of Baratol vs Composition B)
    "insert_r0": 0.22,    # radial position where the slow insert starts
    "insert_w": 0.30,     # insert thickness on the axis
    "theta_max": 0.62,    # half-angle (rad) covered by the insert
    "t_lens": 30e-6,      # time for the fast front to reach the lens exit (s)
    "exit_frac": 0.64,    # lens exit radius as a fraction of the outer radius
    "pusher_frac": 0.50,  # pusher radius as a fraction of the outer radius
}

# Front speed in the fast explosive, in lens lengths per unit tau, chosen so that the on-axis front (delayed by the slow
# insert) reaches the lens exit (radius 1) exactly at tau = 1, i.e. at t_lens, where the merged converging front leaves the lenses.
LENS["fast_speed"] = LENS["insert_r0"] + LENS["insert_w"] / LENS["vS"] + (1.0 - LENS["insert_r0"] - LENS["insert_w"])

# A = (E / rho0)^(1/5): R_taylor = A * t^(2/5)
A_TS = (YIELD_J / RHO0) ** 0.2
T_BREAKAWAY_SHOCK = (0.4 * A_TS / (1.1 * C_SOUND)) ** (1 / 0.6)   # front slows to 1.1 c
R_BREAKAWAY_SHOCK = A_TS * T_BREAKAWAY_SHOCK ** 0.4
R_CORE0 = (3 * CORE_MASS / (4 * math.pi * PU_DENSITY)) ** (1 / 3)

TEMP_KNOTS = [  # (t, K): illustrative order-of-magnitude temperature of the hottest region
    (T_DISASSEMBLY, 5e7), (1e-4, 2e7), (1e-3, 1e6), (1e-2, 1e5), (0.1, 2e4),
    (1.0, 7e3), (10.0, 3e3), (100.0, 1e3), (1000.0, 350.0),
]


def sstep(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


# ---- functions --------------------------------------------------------------
def density(t: float) -> float:
    """rho / rho0 of the plutonium core."""
    if t <= T_DISASSEMBLY:
        return 1.0 + (PEAK_COMPRESSION - 1.0) * sstep((t - T_SHOCK) / (T_PEAK - T_SHOCK))
    r_pk = R_CORE0 * PEAK_COMPRESSION ** (-1 / 3)
    r = r_pk + V_EXPAND * (t - T_DISASSEMBLY)
    return PEAK_COMPRESSION * (r_pk / r) ** 3


def _core_radius_raw(t: float) -> float:
    if t <= T_DISASSEMBLY:
        return R_CORE0 * density(t) ** (-1 / 3)
    r_pk = R_CORE0 * PEAK_COMPRESSION ** (-1 / 3)
    return r_pk + V_EXPAND * (t - T_DISASSEMBLY)


def k_eff(t: float) -> float:
    return K0 * density(t) ** K_EXP


def generation(t: float) -> float:
    return max(0.0, min(float(GENERATIONS), (t - T_INIT) / GEN_TIME))


def energy_j(t: float) -> float:
    if t < T_INIT:
        return 0.0
    g = generation(t)
    return YIELD_J * (2 ** (g + 1) - 1) / (2 ** (GENERATIONS + 1) - 1)


def temp_k(t: float) -> float:
    if t < T_INIT:
        return 300.0
    if t <= T_DISASSEMBLY:
        return 300.0 + 5e7 * energy_j(t) / YIELD_J
    if t >= TEMP_KNOTS[-1][0]:
        return TEMP_KNOTS[-1][1]
    for (ta, va), (tb, vb) in zip(TEMP_KNOTS, TEMP_KNOTS[1:]):
        if ta <= t <= tb:
            f = math.log(t / ta) / math.log(tb / ta)
            return math.exp(math.log(va) + f * (math.log(vb) - math.log(va)))
    return TEMP_KNOTS[0][1]


def shock_r(t: float) -> float:
    if t <= 0:
        return 0.0
    if t <= T_BREAKAWAY_SHOCK:
        return A_TS * t ** 0.4
    return R_BREAKAWAY_SHOCK + C_SOUND * (t - T_BREAKAWAY_SHOCK)


def fireball_r(t: float) -> float:
    if t <= 0:
        return R_CORE0
    if t <= T_DISASSEMBLY:
        return _core_radius_raw(t)
    if t <= T_BREAKAWAY_FIREBALL:
        x = math.log10(t / T_DISASSEMBLY) / 1.3
        f = sstep(x)
        ts_r = A_TS * t ** 0.4
        return min(_core_radius_raw(t), ts_r) * (1 - f) + ts_r * f
    rb = A_TS * T_BREAKAWAY_FIREBALL ** 0.4
    return rb + (FIREBALL_MAX_R - rb) * (1 - math.exp(-(t - T_BREAKAWAY_FIREBALL) / FIREBALL_GROW_TAU))


def front_glow(t: float) -> float:
    """Visibility of the luminous shock front: 1 before 15 ms, 0 by 60 ms."""
    return 1.0 - sstep((t - T_BREAKAWAY_FIREBALL) / (0.060 - T_BREAKAWAY_FIREBALL))


def core_radius(t: float) -> float:
    r = _core_radius_raw(t)
    if t > T_DISASSEMBLY:
        r = min(r, 0.6 * fireball_r(t))
    return r


def cloud_top_m(t: float) -> float:
    if t <= 0:
        return 0.0
    return fireball_r(t) + (CLOUD_TOP_END - 300.0) * (1 - math.exp(-t / CLOUD_TAU))


def blast_arrival(d: float) -> float:
    if d <= R_BREAKAWAY_SHOCK:
        return (d / A_TS) ** 2.5
    return T_BREAKAWAY_SHOCK + (d - R_BREAKAWAY_SHOCK) / C_SOUND


# ---- tables -----------------------------------------------------------------
SERIES = {
    "coreRadius": (core_radius, "log", "I", "m",
                   "Pu sphere radius from mass and delta-phase density, squeezed by the illustrative density ramp, then expanding at ~15 km/s"),
    "density":    (density, "lin", "I", "x rho0",
                   "Illustrative ramp 1 to 2.3 between 45 and 60 us (facts: peak compression > 2x), then falling as the core expands"),
    "k":          (k_eff, "lin", "I", "",
                   "Illustrative: k = 0.72 (rho/rho0)^1.4, crossing 1 near rho/rho0 = 1.3"),
    "generation": (generation, "lin", "C", "",
                   "(t - 60 us) / 10 ns, capped at 80 generations"),
    "energyJ":    (energy_j, "log", "C", "J",
                   "E = Y (2^(g+1) - 1) / (2^81 - 1): cumulative doubling scaled to the 8.8e13 J yield"),
    "tempK":      (temp_k, "log", "I", "K",
                   "Order-of-magnitude temperature of the hottest region; tens of millions of K at peak"),
    "shockR":     (shock_r, "log", "C", "m",
                   "Taylor-Sedov R = (E t^2 / rho0)^(1/5) until the front slows to 1.1 c, then sound speed"),
    "fireballR":  (fireball_r, "log", "C", "m",
                   "Core radius blended into Taylor-Sedov from 61 us; follows the shock to breakaway at 15 ms, then grows slowly to ~235 m by ~1 s"),
    "frontGlow":  (front_glow, "lin", "I", "",
                   "Illustrative fade of the luminous shock front between breakaway (15 ms) and 60 ms"),
    "cloudTopM":  (cloud_top_m, "log", "I", "m",
                   "Fireball radius plus an exponential buoyant rise (tau 75 s) reaching ~12 km at ~300 s"),
}


def measured_points() -> list[list[float]]:
    """Taylor's measured radii from facts.json (fireball_r_vs_t), as [t seconds, R metres]."""
    import json
    from pathlib import Path
    f = json.loads((Path(__file__).resolve().parent.parent / "data" / "facts.json").read_text(encoding="utf-8"))
    return [[ms / 1000.0, r] for ms, r in f["fireball_r_vs_t"]["points"]]


def time_grid() -> list[float]:
    ts = {0.0}
    for i in range(0, 12 * 40 + 1):
        ts.add(10 ** (-9 + i / 40))
    n = 0
    while n * 0.25e-6 <= 70e-6 + 1e-12:
        ts.add(round(n * 0.25e-6, 12))
        n += 1
    n = 0
    while 59.9e-6 + n * 2e-9 <= 61.5e-6:
        ts.add(round(59.9e-6 + n * 2e-9, 12))
        n += 1
    ts.add(T_DISASSEMBLY)
    return sorted(ts)


def sig(x: float, n: int = 6) -> float:
    if x == 0 or not math.isfinite(x):
        return 0.0 if x == 0 else x
    return float(f"{x:.{n}g}")


def build_tables() -> dict:
    ts = time_grid()
    out = {"t": [sig(t, 8) for t in ts], "series": {}, "params": {}}
    for name, (fn, interp, tag, unit, note) in SERIES.items():
        out["series"][name] = {
            "v": [sig(fn(t)) for t in ts], "interp": interp, "tag": tag, "unit": unit, "note": note,
        }
    out["params"] = {
        "yieldJ": YIELD_J, "rho0": RHO0, "cSound": C_SOUND, "eFission": E_FISSION,
        "genTime": GEN_TIME, "generations": GENERATIONS, "tShock": T_SHOCK, "tPeak": T_PEAK,
        "tInit": T_INIT, "tDisassembly": T_DISASSEMBLY, "peakCompression": PEAK_COMPRESSION,
        "tBreakawayShock": T_BREAKAWAY_SHOCK, "rBreakawayShock": R_BREAKAWAY_SHOCK,
        "tBreakawayFireball": T_BREAKAWAY_FIREBALL, "rCore0": R_CORE0, "lens": LENS,
        "tempKnots": TEMP_KNOTS, "measuredR": measured_points(),
    }
    return out


def self_check(tables: dict | None = None) -> list[str]:
    """Return a list of failure strings (empty = all good)."""
    errs: list[str] = []
    tb = tables or build_tables()
    ts = tb["t"]
    if ts != sorted(set(ts)):
        errs.append("time grid not strictly increasing")
    for name in ("generation", "energyJ", "shockR", "fireballR", "cloudTopM"):
        v = tb["series"][name]["v"]
        if name in ("fireballR", "cloudTopM"):  # the radius shrinks while the core is compressed
            v = [x for t_, x in zip(ts, v) if t_ >= T_DISASSEMBLY]
        if any(b < a - 1e-12 * max(1, abs(a)) for a, b in zip(v, v[1:])):
            errs.append(f"{name} is not monotonic")
    r25 = shock_r(0.025)
    if abs(r25 - 130) / 130 > 0.10:
        errs.append(f"R(25 ms) = {r25:.1f} m, expected the measured 130 m +/- 10%")
    for tm, rm in measured_points():
        if tm >= 0.4e-3 and abs(shock_r(tm) - rm) / rm > 0.08:
            errs.append(f"R({tm * 1e3:g} ms) = {shock_r(tm):.1f} m, measured {rm} m (> 8% off)")
    if abs(energy_j(1.0) - YIELD_J) / YIELD_J > 1e-9:
        errs.append("total energy != yield")
    fis = 2 ** (GENERATIONS + 1) * E_FISSION
    if not (YIELD_J / 2 <= fis <= YIELD_J * 2):
        errs.append(f"2^(G+1) * e_fission = {fis:.3g} J not within 2x of yield")
    L = LENS  # on-axis front (through the slow insert) must reach the lens exit exactly at tau = 1
    sx = L["fast_speed"]
    on_axis = L["insert_r0"] + L["insert_w"] + (sx - L["insert_r0"] - L["insert_w"] / L["vS"])
    if abs(on_axis - 1.0) > 1e-9:
        errs.append(f"lens model: on-axis front at tau = 1 is {on_axis:.4f}, expected 1")
    arr = blast_arrival(16000)
    if not 35 <= arr <= 50:
        errs.append(f"blast arrival at 16 km = {arr:.1f} s, expected 35-50 s")
    peak_k = max(tb["series"]["k"]["v"])
    if k_eff(1e-6) >= 1 or peak_k <= 1 or k_eff(1e-3) >= 1:
        errs.append("k does not rise through 1 and fall back below 1")
    if max(tb["series"]["density"]["v"]) <= 2.0:
        errs.append("peak compression not above 2x")
    if cloud_top_m(300) < 11000 or abs(cloud_top_m(600) - 12000) > 1000:
        errs.append(f"cloud top at 10 min = {cloud_top_m(600):.0f} m")
    t_pu = energy_j(1.0) / E_FISSION * 239.05e-3 / 6.022e23
    if not 0.9 <= t_pu <= 1.3:
        errs.append(f"plutonium fissioned = {t_pu:.2f} kg, expected ~1.1")
    if not 50 < tb["series"]["tempK"]["v"][ts.index(sig(T_DISASSEMBLY, 8))] / 1e6 < 100:
        errs.append("peak temperature outside tens of millions of K")
    return errs


if __name__ == "__main__":
    errs = self_check()
    if errs:
        for e in errs:
            print("FAIL", e)
        raise SystemExit(1)
    print(f"sim OK: R(25ms)={shock_r(0.025):.1f} m, breakaway {T_BREAKAWAY_SHOCK:.3f} s at {R_BREAKAWAY_SHOCK:.0f} m, "
          f"16 km at {blast_arrival(16000):.1f} s, 9.1 km at {blast_arrival(9100):.1f} s")
