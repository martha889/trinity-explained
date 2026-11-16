#!/usr/bin/env python3
"""Build the Trinity explainer into one offline HTML file.

    python3 build.py [--out PATH] [--json PATH]

Stdlib only. Reads data/facts.json, content/NN-<id>.json, sim/trinity_sim.py,
src/page.html, src/css/*.css, src/js/*.js, src/js/scenes/*.js, src/fonts/*.woff2.
Fails loudly (exit 1) if validation fails.
"""
from __future__ import annotations

import argparse
import base64
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "sim"))
import trinity_sim  # noqa: E402

TITLE = "Trinity, explained"
DESC = ("An animated, scientific explainer of the Trinity nuclear test, 16 July 1945: how an implosion "
        "device works, from the firing signal to the cloud, on a clock from nanoseconds to minutes.")

# id, title, subtitle, play seconds, t0, t1, map, view width text
PHASES = [
    ("countdown", "Jornada del Muerto, 05:29", "Where and when", 14, -10.0, 0.0, "lin", "40 km to 60 m"),
    ("anatomy", "Inside the Gadget", "What the layers are for", 30, 0.0, 0.0, "hold", "3 m"),
    ("lenses", "Thirty-two waves become one", "The lens idea", 26, 0.0, 45e-6, "lin", "2 m"),
    ("implosion", "The squeeze", "Compression makes criticality", 18, 45e-6, 60e-6, "lin", "2 m to 59 cm"),
    ("chain", "Eighty generations", "The doubling", 30, 60e-6, 60.8e-6, "lin", "59 cm to 53 cm"),
    ("release", "A star for a millionth of a second", "Why it stops, and what the energy does first",
     16, 60.8e-6, 1e-3, "log", "53 cm to 100 m"),
    ("fireball", "The fireball and the shock", "The blast wave and Taylor's scaling", 35, 1e-3, 2.0, "log", "100 m to 3 km"),
    ("cloud", "The cloud", "Buoyancy", 37, 2.0, 600.0, "log", "3 km to 40 km"),
    ("aftermath", "What was left", "The ledger", 24, 600.0, 600.0, "hold", "420 m, then ledger"),
]
FACT_RE = re.compile(r"\{\{\s*([A-Za-z0-9_]+)\s*\}\}")
SPEEDS_NOTE = "events are authored as (phase, u); build.py resolves them to playback seconds"


class BuildError(Exception):
    pass


def load_json(path: Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        raise BuildError(f"{path.relative_to(ROOT)}: {exc}") from exc


def build_phases() -> list[dict]:
    out, play = [], 0.0
    for i, (pid, title, sub, dur, t0, t1, mp, view) in enumerate(PHASES):
        out.append({"id": pid, "index": i, "title": title, "subtitle": sub, "play0": play, "play1": play + dur,
                    "t0": t0, "t1": t1, "map": mp, "view": view})
        play += dur
    return out


def resolve_text(text: str, facts: dict, where: str, chips: bool) -> str:
    """Escape HTML, replace {{fact}} with its value (and a tag chip) or fail if unknown."""
    parts, last = [], 0
    esc = (lambda x: html.escape(x, quote=False)) if chips else (lambda x: x)  # canvas text stays plain
    for m in FACT_RE.finditer(text):
        parts.append(esc(text[last:m.start()]))
        key = m.group(1)
        if key not in facts or key.startswith("_"):
            raise BuildError(f"{where}: unknown fact key {{{{{key}}}}}")
        f = facts[key]
        val = html.escape(f["value"], quote=False) if chips else f["value"]
        if chips:
            parts.append(f'<span class="num" data-tag="{f["tag"]}" title="{html.escape(f["label"])}">{val}</span>')
        else:
            parts.append(val)
        last = m.end()
    parts.append(esc(text[last:]))
    return "".join(parts)


def build_content(phases, facts) -> tuple[dict, list[dict]]:
    content, events = {}, []
    seen_ids: set[str] = set()
    files = {p.name: p for p in (ROOT / "content").glob("*.json")}
    expected = {f"{i + 1:02d}-{ph['id']}.json": ph for i, ph in enumerate(phases)}
    extra = sorted(set(files) - set(expected))
    if extra:
        raise BuildError(f"content files that match no phase: {extra}")
    for name, ph in expected.items():
        if name not in files:
            raise BuildError(f"missing content file content/{name}")
        c = load_json(files[name])
        where = f"content/{name}"
        if c.get("phase") != ph["id"]:
            raise BuildError(f"{where}: \"phase\" must be \"{ph['id']}\"")
        span = ph["play1"] - ph["play0"]
        paras = []
        for i, p in enumerate(c.get("paragraphs", [])):
            u = float(p["u"])
            if not 0 <= u <= 1:
                raise BuildError(f"{where}: paragraph {i} u out of range")
            paras.append({"u": u, "html": resolve_text(p["text"], facts, f"{where} paragraph {i}", True)})
        if [p["u"] for p in paras] != sorted(p["u"] for p in paras):
            raise BuildError(f"{where}: paragraphs not sorted by u")
        keys = []
        for i, k in enumerate(c.get("keys", [])):
            if k["fact"] not in facts or k["fact"].startswith("_"):
                raise BuildError(f"{where}: key row {i} references unknown fact {k['fact']!r}")
            f = facts[k["fact"]]
            keys.append({"fact": k["fact"], "u": float(k.get("u", 0)), "label": k.get("label", f["label"]),
                         "value": f["value"], "tag": f["tag"],
                         "source": f.get("source", ""), "url": f.get("url", "")})
        callouts = []
        for i, k in enumerate(c.get("callouts", [])):
            u0, u1 = float(k["u0"]), float(k.get("u1", 1))
            if not 0 <= u0 < u1 <= 1.000001:
                raise BuildError(f"{where}: callout {i} needs 0 <= u0 < u1 <= 1")
            callouts.append({"id": k["id"], "u0": u0, "u1": u1,
                             "text": resolve_text(k["text"], facts, f"{where} callout {i}", False)})
        evs = c.get("events", [])
        us = [float(e["u"]) for e in evs]
        if us != sorted(us):
            raise BuildError(f"{where}: events not sorted by u")
        if not any(abs(u) < 1e-9 for u in us):
            evs = [{"id": ph["id"], "u": 0.0, "short": ph["title"], "detail": c.get("summary", ph["subtitle"]),
                    "major": True}] + evs
        for e in evs:
            eid = e["id"]
            if eid in seen_ids:
                raise BuildError(f"{where}: duplicate event id {eid!r}")
            seen_ids.add(eid)
            u = float(e["u"])
            if not 0 <= u <= 1:
                raise BuildError(f"{where}: event {eid} u out of range")
            events.append({"id": eid, "phase": ph["id"], "u": u, "play": ph["play0"] + u * span,
                           "short": e["short"], "detail": resolve_text(e.get("detail", ""), facts, f"{where} event {eid}", False),
                           "major": bool(e.get("major", False))})
        content[ph["id"]] = {"summary": c.get("summary", ph["subtitle"]), "paragraphs": paras, "keys": keys,
                             "callouts": callouts}
    events.sort(key=lambda e: e["play"])
    return content, events


def validate(phases, events, facts, tables):
    for a, b in zip(phases, phases[1:]):
        if abs(a["play1"] - b["play0"]) > 1e-9:
            raise BuildError(f"phases {a['id']} / {b['id']} are not contiguous in playback time")
        if a["map"] != "hold" and b["map"] != "hold" and abs(a["t1"] - b["t0"]) > 1e-12 * max(1, abs(a["t1"])):
            raise BuildError(f"phase {a['id']} ends at t={a['t1']} but {b['id']} starts at t={b['t0']}")
    for ph in phases:
        if ph["map"] == "log" and (ph["t0"] <= 0 or ph["t1"] <= ph["t0"]):
            raise BuildError(f"phase {ph['id']}: log map needs 0 < t0 < t1")
        if ph["map"] == "hold" and ph["t0"] != ph["t1"]:
            raise BuildError(f"phase {ph['id']}: hold map needs t0 == t1")
    if [e["play"] for e in events] != sorted(e["play"] for e in events):
        raise BuildError("events not sorted")
    yj = facts.get("yield_j", {}).get("num")
    if yj is not None and abs(yj - trinity_sim.YIELD_J) / yj > 1e-6:
        raise BuildError(f"facts.json yield_j ({yj}) differs from the Sim yield ({trinity_sim.YIELD_J})")
    errs = trinity_sim.self_check(tables)
    if errs:
        raise BuildError("sim self-check failed: " + "; ".join(errs))
    scenes = "\n".join(p.read_text(encoding="utf-8") for p in (ROOT / "src/js/scenes").glob("*.js"))
    for ph in phases:
        if not re.search(r'Scenes\.register\(\s*["\']%s["\']' % ph["id"], scenes):
            raise BuildError(f"no Scenes.register(\"{ph['id']}\", ...) found in src/js/scenes/")


FONTS = [
    ("barlow-condensed-500.woff2", "Barlow Condensed", "500"),
    ("barlow-condensed-600.woff2", "Barlow Condensed", "600"),
    ("barlow-condensed-700.woff2", "Barlow Condensed", "700"),
    ("ibm-plex-mono-400.woff2", "IBM Plex Mono", "400"),
    ("ibm-plex-mono-500.woff2", "IBM Plex Mono", "500"),
    ("ibm-plex-mono-600.woff2", "IBM Plex Mono", "600"),
    ("ibm-plex-sans-400-600.woff2", "IBM Plex Sans", "400 600"),
]


def font_css() -> str:
    out = []
    for fn, fam, wt in FONTS:
        p = ROOT / "src/fonts" / fn
        if not p.is_file():
            raise BuildError(f"missing font {p.relative_to(ROOT)}")
        b64 = base64.b64encode(p.read_bytes()).decode("ascii")
        out.append(f'@font-face{{font-family:"{fam}";font-style:normal;font-weight:{wt};font-display:swap;'
                   f'src:url(data:font/woff2;base64,{b64}) format("woff2")}}')
    return "\n".join(out) + "\n"


def assemble(data: dict) -> str:
    src = ROOT / "src"
    tpl = (src / "page.html").read_text(encoding="utf-8")
    css = "\n".join(p.read_text(encoding="utf-8") for p in sorted((src / "css").glob("*.css")))
    js_files = sorted(list((src / "js").glob("*.js")) + list((src / "js/scenes").glob("*.js")), key=lambda p: p.name)
    js = "\n".join(f"// ---- {p.name} ----\n" + p.read_text(encoding="utf-8") for p in js_files)
    node = shutil.which("node")
    if node:  # optional: catch syntax errors at build time (the page itself needs no node)
        with tempfile.TemporaryDirectory() as td:
            chk = Path(td) / "page.js"
            chk.write_text(js, encoding="utf-8")
            r = subprocess.run([node, "--check", str(chk)], capture_output=True, text=True)
            if r.returncode:
                raise BuildError("JS syntax error: " + r.stderr.strip().splitlines()[0:6].__str__())
    if "</script" in js.lower():
        raise BuildError("JS contains a literal </script; escape it")
    blob = json.dumps(data, separators=(",", ":"), ensure_ascii=False).replace("</", "<\\/")
    for ph in ("/*__FONTS__*/", "/*__CSS__*/", "__DATA__", "/*__JS__*/"):
        if ph not in tpl:
            raise BuildError(f"src/page.html is missing the placeholder {ph}")
    frag = (tpl.replace("/*__FONTS__*/", font_css()).replace("/*__CSS__*/", css)
            .replace("__DATA__", blob).replace("/*__JS__*/", js))
    return ("<!doctype html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n"
            "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1, viewport-fit=cover\">\n"
            f"<title>{html.escape(TITLE)}</title>\n"
            f"<meta name=\"description\" content=\"{html.escape(DESC, quote=True)}\">\n"
            "<meta name=\"theme-color\" content=\"#0b0e14\">\n"
            "<style>body{margin:0}[hidden]{display:none!important}</style>\n"
            "</head>\n<body>\n" + frag + "\n</body>\n</html>\n")


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Build the Trinity explainer into one HTML file.")
    ap.add_argument("--out", default=str(ROOT / "dist" / "trinity.html"), help="output path (default dist/trinity.html)")
    ap.add_argument("--json", metavar="PATH", help="also write the embedded data as JSON")
    args = ap.parse_args(argv)
    try:
        facts = load_json(ROOT / "data" / "facts.json")
        phases = build_phases()
        content, events = build_content(phases, facts)
        tables = trinity_sim.build_tables()
        validate(phases, events, facts, tables)
        data = {
            "meta": {"title": TITLE, "tZero": "T = 0 is the instant the detonators fire; 05:29:45 Mountain War Time is the officially recorded time", "total": phases[-1]["play1"]},
            "phases": phases, "events": events, "content": content,
            "facts": {k: v for k, v in facts.items() if not k.startswith("_")}, "sim": tables,
        }
        page = assemble(data)
    except BuildError as exc:
        print(f"build.py: ERROR: {exc}", file=sys.stderr)
        return 1
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")
    if args.json:
        Path(args.json).write_text(json.dumps(data, indent=1), encoding="utf-8")
    print(f"wrote {out} ({out.stat().st_size / 1e6:.2f} MB): {len(phases)} phases, {len(events)} events, "
          f"{len(tables['t'])} sim rows, playback {data['meta']['total']:.0f} s")
    return 0


if __name__ == "__main__":
    sys.exit(main())
