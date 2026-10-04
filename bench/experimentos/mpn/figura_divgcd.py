"""Figure 10 and the numbers of section 4.9: division and gcd in Lean's GMP-free code, and faster algorithms.

Left: division of a 2n-bit number by an n-bit one. GMP (native Lean) and lean-vir (the same mpn_div
in WebAssembly) are timed through Lean (bench/out/aritmetica-*.json) and drawn from 4,096 bits, where
Lean's cost per operation is negligible; Lean's mpn_div natively, Newton's division and Barrett's (the
reciprocal already known) come from bench/experimentos/mpn/divgcd.cpp. Right: gcd, the same way, with
Lean's Euclid and Lehmer's algorithm. Three hues as the palette validates: blue GMP, orange Lean's code
as it is (hollow: in WebAssembly), aqua the faster algorithm (dashed: with the reciprocal reused).

Run: python bench/experimentos/mpn/figura_divgcd.py bench/out/divgcd-DATE.json
"""
import json
import math
import os
import sys

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
SURF, TXT, TXT2, GRID = "#fcfcfb", "#0b0b0b", "#52514e", "#e4e3de"
BLUE, ORANGE, AQUA = "#2a78d6", "#eb6834", "#1baf7a"
FROM = 4096
plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 9, "axes.edgecolor": TXT2, "axes.labelcolor": TXT2,
                     "xtick.color": TXT2, "ytick.color": TXT2, "text.color": TXT, "axes.facecolor": SURF,
                     "figure.facecolor": SURF, "savefig.facecolor": SURF, "axes.spines.top": False,
                     "axes.spines.right": False, "axes.axisbelow": True, "svg.fonttype": "none",
                     "svg.hashsalt": "lean-math-in-the-browser", "axes.titlesize": 10, "axes.titleweight": "bold"})


def lee(p):
    with open(os.path.join(RAIZ, p), encoding="utf-8") as h:
        return json.load(h)


def slope(pts):
    xs, ys = [math.log(b) for b, _ in pts], [math.log(t) for _, t in pts]
    mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
    return sum((a - mx) * (b - my) for a, b in zip(xs, ys)) / sum((a - mx) ** 2 for a in xs)


d = lee(sys.argv[1])["points"]
a = lee("bench/out/aritmetica-2026-10-03.json")["points"]
lean_timed = lambda eng, op: {p["bits"]: p["perOpUs"] for p in a if p["engine"] == eng and p["op"] == op and p["bits"] >= FROM}

# the numbers for the report: exponents from 2,048 bits up, and the gains at the sizes of the tables
print("exponents k (time ~ bits^k), 2,048 bits up:")
for key in ["div_lean_us", "div_newton_us", "div_barrett_us", "gcd_lean_us", "gcd_lehmer_us"]:
    pts = [(p["bits"], p[key]) for p in d if key in p and p["bits"] >= 2048]
    print(f"  {key}: {slope(pts):.2f}")
print("bits | div Lean | Newton | x | Barrett | x | gcd Lean | Lehmer | x")
for p in d:
    if p["bits"] in (1024, 4096, 16384, 65536, 131072):
        g = f"{p['gcd_lean_us']:.1f} | {p['gcd_lehmer_us']:.1f} | {p['gcd_lean_us'] / p['gcd_lehmer_us']:.1f}" if "gcd_lean_us" in p else "- | - | -"
        print(f"{p['bits']} | {p['div_lean_us']:.2f} | {p['div_newton_us']:.2f} | {p['div_lean_us'] / p['div_newton_us']:.2f} | "
              f"{p['div_barrett_us']:.2f} | {p['div_lean_us'] / p['div_barrett_us']:.2f} | {g}")
for op in ("div", "gcd"):
    w = lean_timed("wasm", op)
    key = f"{op}_lean_us"
    print(f"{op}: WebAssembly / native, same code:", {b: round(w[b] / p[key], 2) for p in d for b in w if p["bits"] == b and key in p})

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(9.6, 3.8))


def line(ax, xs, ys, color, marker, label, hollow=False, dashed=False):
    ax.plot(xs, ys, color=color, marker=marker, markersize=5 if hollow else 4, linewidth=2,
            linestyle="--" if dashed else "-", markerfacecolor=SURF if hollow else color, markeredgewidth=1.4)
    ax.annotate(label, (xs[-1], ys[-1]), textcoords="offset points", xytext=(5, 0), fontsize=8, color=TXT2, va="center")


for ax, op, ours, ours_label, extra in [(ax1, "div", "div_newton_us", "Newton on Lean's code", ("div_barrett_us", "Barrett, reciprocal reused")),
                                         (ax2, "gcd", "gcd_lehmer_us", "Lehmer on Lean's code", None)]:
    g = lean_timed("native", op)
    line(ax, sorted(g), [g[b] for b in sorted(g)], BLUE, "o", "GMP (native Lean)")
    pts = [p for p in d if f"{op}_lean_us" in p]
    line(ax, [p["bits"] for p in pts], [p[f"{op}_lean_us"] for p in pts], ORANGE, "s", "Lean's code, native")
    w = lean_timed("wasm", op)
    line(ax, sorted(w), [w[b] for b in sorted(w)], ORANGE, "s", "same, in WebAssembly", hollow=True, dashed=True)
    line(ax, [p["bits"] for p in pts], [p[ours] for p in pts], AQUA, "^", ours_label)
    if extra:
        line(ax, [p["bits"] for p in pts], [p[extra[0]] for p in pts], AQUA, "^", extra[1], hollow=True, dashed=True)
    ax.set_xscale("log", base=2)
    ax.set_yscale("log")
    ax.set_xlabel("operand size (bits)")
    ax.grid(True, color=GRID, linewidth=0.6)
    ax.set_xlim(right=ax.get_xlim()[1] * 9)
ax1.set_title("division, 2n by n bits, no GMP")
ax1.set_ylabel("µs per division")
ax2.set_title("gcd of two n-bit numbers, no GMP")
ax2.set_ylabel("µs per gcd")
fig.tight_layout()
out = os.path.join(RAIZ, "docs", "figuras", "10-division-gcd.svg")
fig.savefig(out, bbox_inches="tight", metadata={"Date": None})
if os.environ.get("PREVIEW_PNG"):
    fig.savefig(os.environ["PREVIEW_PNG"], bbox_inches="tight")
print("wrote", out)
