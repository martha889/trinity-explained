#!/usr/bin/env python3
"""Headless-Chrome smoke test for the built Trinity page (stdlib only).

    python3 tools/smoke.py [--file PATH] [--shots DIR] [--sweep N] [--at t1,t2] [--size WxH] [--phases]

Each target opens <file>#t=<playback seconds> (or #<phase-id>) paused and asserts: data-ready is set,
no data-js-error / data-draw-error, the canvas has ink, and data-phase matches the expected chapter.
--shots writes one PNG per target (default size 1440x900). $CHROME overrides the Chrome path.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_FILE = ROOT / "dist" / "trinity.html"
CHROME = os.environ.get("CHROME") or "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
MIN_INK = 25
MIN_WINDOW = 500   # Chrome's minimum window width


def load_data(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    m = re.search(r'<script id="trinity-data" type="application/json">(.*?)</script>', text, re.DOTALL)
    if not m:
        raise SystemExit(f"smoke: trinity-data script not found in {path}")
    return json.loads(m.group(1).replace("<\\/", "</"))


def phase_for(data: dict, play: float) -> str:
    for ph in data["phases"]:
        if play < ph["play1"]:
            return ph["id"]
    return data["phases"][-1]["id"]


def shot_name(frag: str) -> str:
    return (frag.replace("=", "-").replace("@", "-at-").replace(":", "-").replace("&", "_") or "default") + ".png"


def chrome_cmd(udir: str, size: str, budget: int, url: str, extra: list[str]) -> list[str]:
    return [CHROME, "--headless=new", "--disable-gpu", "--hide-scrollbars", f"--virtual-time-budget={budget}",
            f"--window-size={size}", f"--user-data-dir={udir}", *extra, url]


def with_rm(frag: str, rm: bool) -> str:
    return frag + "&rm" if rm else frag


def wrapper(udir: str, url: str, w: int, h: int) -> str:
    """Chrome will not open a window narrower than ~500 px, so narrow sizes are shown in an iframe of the true size.
    The page inside posts its layout facts (scroll width, inner width, errors, ready) to this wrapper, which copies them
    into data-child on <html>, so a dump-dom of the wrapper reports the truth about the narrow viewport."""
    wrap = Path(udir) / "wrap.html"
    wrap.write_text('<body style="margin:0;background:#000"><script>window.addEventListener("message",function(e){'
                    'if(e.data&&e.data.trinity)document.documentElement.setAttribute("data-child",JSON.stringify(e.data));});</script>'
                    f'<iframe src="{url}" style="width:{w}px;height:{h}px;border:0"></iframe>', encoding="utf-8")
    return wrap.as_uri()


def attrs_of(dom: str) -> tuple[str, dict]:
    """The <html> tag of a dumped DOM, and, for narrow wrappers, the facts the framed page reported."""
    m = re.search(r"<html\b[^>]*>", dom, re.IGNORECASE)
    tag = m.group(0) if m else ""
    child = {}
    mc = re.search(r'data-child="([^"]*)"', tag)
    if mc:
        import html as _h
        child = json.loads(_h.unescape(mc.group(1)))
    return tag, child


def check(frag: str, expect: str, uri: str, size: str, rm: bool = False) -> tuple[bool, str]:
    url = f"{uri}#{with_rm(frag, rm)}"
    cw, ch = (int(v) for v in size.split("x"))
    narrow = cw < MIN_WINDOW
    reason = "unknown"
    for attempt in range(3):
        with tempfile.TemporaryDirectory(prefix="trinity_smoke_") as udir:
            target = wrapper(udir, url, cw, ch) if narrow else url
            res = subprocess.run(chrome_cmd(udir, f"{max(cw, MIN_WINDOW)},{ch}", 8000 + attempt * 3000, target, ["--dump-dom"]),
                                 capture_output=True, text=True, timeout=90)
        if res.returncode != 0:
            reason = f"chrome exit {res.returncode}"
            continue
        tag, child = attrs_of(res.stdout)
        if narrow:
            if not child or not child.get("ready"):
                reason = "narrow page never reported ready"
                continue
            if child.get("err"):
                return False, "page error: " + child["err"]
            if int(child.get("ink") or 0) < MIN_INK:
                return False, f"blank canvas (ink={child.get('ink')})"
            over = int(child["sw"]) - int(child["iw"])
            if over > 2:
                return False, f"horizontal overflow at {cw} px: scrollWidth {child['sw']} > innerWidth {child['iw']}"
            if expect and child.get("phase") != expect:
                return False, f"expected phase {expect}, page shows {child.get('phase')}"
            if not rm_ok(tag, child, rm, narrow):
                return False, "reduced-motion flag not honoured"
            if child.get("ev") != child.get("toast"):
                return False, f"event strip shows {child.get('toast')!r}, expected {child.get('ev')!r}"
            return True, ""
        if "data-ready=" not in tag:
            reason = "missing data-ready"
            continue
        for bad in ("data-js-error", "data-draw-error"):
            mm = re.search(bad + r'="([^"]*)"', tag)
            if mm:
                return False, f"{bad}: {mm.group(1)}"
        ink = re.search(r'data-canvas-ink="(\d+)"', tag)
        if not ink or int(ink.group(1)) < MIN_INK:
            return False, f"blank canvas (data-canvas-ink={ink.group(1) if ink else 'missing'})"
        sw, iw = re.search(r'data-scroll-w="(\d+)"', tag), re.search(r'data-inner-w="(\d+)"', tag)
        if sw and iw and int(sw.group(1)) - int(iw.group(1)) > 2:
            return False, f"horizontal overflow: scrollWidth {sw.group(1)} > innerWidth {iw.group(1)}"
        ph = re.search(r'data-phase="([^"]*)"', tag)
        if expect and (not ph or ph.group(1) != expect):
            return False, f"expected phase {expect}, page shows {ph.group(1) if ph else 'none'}"
        if not rm_ok(tag, child, rm, narrow):
            return False, "reduced-motion flag not honoured"
        ev, to = re.search(r'data-event="([^"]*)"', tag), re.search(r'data-toast="([^"]*)"', tag)
        if ev and to and ev.group(1) != to.group(1):
            return False, f"event strip shows {to.group(1)!r}, expected {ev.group(1)!r}"
        return True, ""
    return False, reason


def rm_ok(tag: str, child: dict, rm: bool, narrow: bool) -> bool:
    if not rm or narrow:
        return True
    return 'data-rm="1"' in tag


def shoot(frag: str, uri: str, size: str, out: Path, rm: bool = False) -> tuple[bool, str]:
    path = out / shot_name(with_rm(frag, rm))
    w, h = (int(v) for v in size.split("x"))
    for attempt in range(3):
        with tempfile.TemporaryDirectory(prefix="trinity_shot_") as udir:
            if path.exists():
                path.unlink()
            url, win = f"{uri}#{with_rm(frag, rm)}", size.replace("x", ",")
            if w < MIN_WINDOW:
                url, win = wrapper(udir, url, w, h), f"{MIN_WINDOW},{h}"
            res = subprocess.run(chrome_cmd(udir, win, 6500 + attempt * 2000, url,
                                            [f"--screenshot={path}"]), capture_output=True, text=True, timeout=90)
        if res.returncode == 0 and path.is_file() and path.stat().st_size > 15000:
            return True, ""
    return False, "screenshot failed"


def play_one(uri: str, size: str, start: float, secs: int, rm: bool) -> dict:
    """Open #t=<start>&play&adv=<secs> (the page steps secs of frames synchronously) and read back what happened."""
    frag = f"t={fmt(start)}&play&adv={secs}" + ("&rm" if rm else "")
    with tempfile.TemporaryDirectory(prefix="trinity_play_") as udir:
        res = subprocess.run(chrome_cmd(udir, size.replace("x", ","), 20000, f"{uri}#{frag}", ["--dump-dom"]),
                             capture_output=True, text=True, timeout=600)
    tag, _ = attrs_of(res.stdout)
    out: dict = {"start": start, "err": "", "tag": tag}
    for bad in ("data-js-error", "data-draw-error"):
        mm = re.search(bad + r'="([^"]*)"', tag)
        if mm:
            out["err"] = f"{bad}: {mm.group(1)}"
    pl = re.search(r'data-play="([0-9.]+)"', tag)
    out["play"] = float(pl.group(1)) if pl else -1.0
    out["advanced"] = "data-advanced" in tag
    fm = re.search(r'data-flash="([^"]*)"', tag)
    out["flash"] = [float(x) for x in fm.group(1).split(",")] if fm else None
    fk = re.search(r'data-flicker="(\d+)"', tag)
    out["flicker"] = int(fk.group(1)) if fk else None
    return out


def play_check(data: dict, uri: str, size: str, rm: bool, long: bool) -> str:
    """Playback across the countdown's firing-signal event, and (long) across every chapter boundary: no errors, the clock
    advances, the detonation flash fires exactly once and within PLAN section 6 (peak <= 85%, rise >= 180 ms, decay >= 1.6 s),
    and nothing alternates bright/dark faster than 3 times a second. Under reduced motion no flash may fire at all."""
    runs = [(10.0, 8)]
    if long:
        runs = [(max(0.0, ph["play0"] - 2.0), 4) for ph in data["phases"][1:]] + runs
    with ThreadPoolExecutor(max_workers=2) as ex:
        results = list(ex.map(lambda r: play_one(uri, size, r[0], r[1], rm), runs))
    flashes = 0
    for (start, secs), r in zip(runs, results):
        if r["err"]:
            return f"at {start:g} s: {r['err']}"
        if rm:  # reduced motion never autoplays: the clock must stay where it was put
            if abs(r["play"] - start) > 0.01:
                return f"at {start:g} s: the clock moved under reduced motion (data-play={r['play']})"
        elif not r["advanced"] or not start + secs - 0.6 <= r["play"] <= start + secs + 0.6:
            return f"at {start:g} s: clock did not advance (data-play={r['play']}, advanced={r['advanced']})"
        if r["flicker"] is not None and r["flicker"] > 4:
            return f"at {start:g} s: {r['flicker']} bright/dark reversals in one second (limit 4)"
        fl = r["flash"]
        if fl:
            n, ign, peak, rise, decay, mx = fl
            flashes += int(n)
            if n > 1:
                return f"at {start:g} s: the flash fired {int(n)} times in one window"
            if n and (peak > 0.851 or rise < 0.179 or decay < 1.599 or mx > 0.851):
                return f"at {start:g} s: flash outside limits (peak {peak}, rise {rise} s, decay {decay} s, max alpha {mx})"
    if long and not rm and flashes != 1:
        return f"the detonation flash fired {flashes} times across the boundary windows (expected 1)"
    if long and rm and flashes != 0:
        return f"{flashes} flashes fired under reduced motion (expected 0)"
    return ""


def fmt(v: float) -> str:
    return (f"{v:.3f}".rstrip("0").rstrip(".")) or "0"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--file", default=str(DEFAULT_FILE), help="built HTML (default dist/trinity.html)")
    ap.add_argument("--shots", metavar="DIR", help="write a PNG per target")
    ap.add_argument("--sweep", type=int, metavar="N", help="N evenly spaced playback times")
    ap.add_argument("--at", metavar="T1,T2", help="comma-separated playback seconds")
    ap.add_argument("--size", default="1440x900", metavar="WxH", help="window size (default 1440x900)")
    ap.add_argument("--play", action="store_true", help="also play across the firing signal and (with --phases) every chapter boundary: no errors, one flash within limits, no flicker")
    ap.add_argument("--rm", action="store_true", help="force reduced motion (appends &rm to every hash)")
    ap.add_argument("--phases", action="store_true", help="also test each #<phase-id> deep link")
    args = ap.parse_args(argv)
    if not re.fullmatch(r"\d+x\d+", args.size):
        ap.error("--size must look like 1440x900")
    path = Path(args.file).resolve()
    if not path.is_file():
        print(f"smoke: {path} not found; run build.py first", file=sys.stderr)
        return 2
    data = load_data(path)
    total = float(data["meta"]["total"])
    targets: list[tuple[str, str]] = []  # (fragment, expected phase)
    if args.sweep:
        n = max(1, args.sweep)
        for i in range(n):
            t = fmt(total * i / (n - 1)) if n > 1 else "0"
            targets.append((f"t={t}", phase_for(data, float(t))))
    if args.at:
        for raw in args.at.split(","):
            if raw.strip():
                targets.append((f"t={raw.strip()}", phase_for(data, float(raw))))
    if args.phases or not targets:
        targets += [("t=0", phase_for(data, 0.0))] if not targets else []
        targets += [(ph["id"], ph["id"]) for ph in data["phases"]]
    uri = path.as_uri()
    play_fail = play_check(data, uri, args.size, args.rm, args.phases) if args.play else None
    out = Path(args.shots).resolve() if args.shots else None
    if out:
        out.mkdir(parents=True, exist_ok=True)
    with ThreadPoolExecutor(max_workers=3) as ex:
        results = list(ex.map(lambda t: check(t[0], t[1], uri, args.size, args.rm), targets))
    if out:
        ok_targets = [t for t, r in zip(targets, results) if r[0]]
        with ThreadPoolExecutor(max_workers=2) as ex:
            shots = dict(zip([t[0] for t in ok_targets], ex.map(lambda t: shoot(t[0], uri, args.size, out, args.rm), ok_targets)))
        results = [(r[0] and shots.get(t[0], (True, ""))[0], r[1] or shots.get(t[0], (True, ""))[1]) for t, r in zip(targets, results)]
    if play_fail:
        print(f"FAIL play: {play_fail}", file=sys.stderr)
        print("SMOKE FAIL: play")
        return 1
    bad = [(t[0], r[1]) for t, r in zip(targets, results) if not r[0]]
    for frag, why in bad:
        print(f"FAIL {frag}: {why}", file=sys.stderr)
    if bad:
        print("SMOKE FAIL: " + ", ".join(b[0] for b in bad))
        return 1
    print(f"SMOKE OK {len(targets)}/{len(targets)} ({args.size})" + (f", screenshots in {out}" if out else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
